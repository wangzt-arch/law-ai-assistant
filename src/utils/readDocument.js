import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_TEXT_LENGTH = 60000

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log'])

/**
 * 读取文档并提取纯文本
 * @param {File} file - 用户上传的文件
 * @returns {Promise<{ text: string, truncated: boolean }>}
 */
export async function readDocument(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('文件不能超过 20MB')

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  let text

  if (ext === 'pdf') text = await readPdf(file)
  else if (ext === 'docx') text = await readDocx(file)
  else if (TEXT_EXTENSIONS.has(ext)) text = await file.text()
  else throw new Error('暂不支持该格式，请上传 PDF、DOCX、TXT、Markdown、CSV 或 JSON 文件')

  text = text.trim()
  if (!text) throw new Error('未能提取到文本内容，可能是扫描版 PDF 或空文件')

  return {
    text: text.slice(0, MAX_TEXT_LENGTH),
    truncated: text.length > MAX_TEXT_LENGTH
  }
}

async function readPdf(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map(item => item.str).join(' '))
  }

  pdf.destroy()
  return pages.join('\n\n')
}

async function readDocx(file) {
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return value
}
