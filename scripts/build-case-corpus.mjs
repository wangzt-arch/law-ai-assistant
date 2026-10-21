import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 生成本地案例库。
 * 数据整理自 https://github.com/lttxzmj/chinese-law-corpus（CC0），
 * 原始来源为最高人民法院官网与《最高人民法院公报》。
 * 用法：npm run cases:update
 */

const REPO = 'lttxzmj/chinese-law-corpus'
const BRANCH = 'master'
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`
const CONTENTS_API = `https://api.github.com/repos/${REPO}/contents`
const OUT_DIR = path.resolve('src/data')
const UA = 'Mozilla/5.0 (law-ai-assistant case corpus builder)'
const CONCURRENCY = 6

async function fetchJson(url, retries = 3, timeout = 30000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise(resolve => setTimeout(resolve, 600 * attempt))
    } finally {
      clearTimeout(timer)
    }
  }
}

async function listCaseFiles(dir) {
  try {
    const list = await fetchJson(`${CONTENTS_API}/${encodeURIComponent(dir)}?ref=${BRANCH}`, 2, 20000)
    if (Array.isArray(list)) {
      return list.filter(item => item.type === 'file' && item.name.endsWith('.json') && item.name !== 'manifest.json').map(item => item.name)
    }
  } catch {
    // 避免 GitHub API 限流导致更新失败，回退到 jsDelivr 文件清单
  }

  const data = await fetchJson(`https://data.jsdelivr.com/v1/packages/gh/${REPO}@${BRANCH}?structure=flat`)
  return (data.files || [])
    .map(file => file.name)
    .filter(name => name.startsWith(`${dir}/`) && name.endsWith('.json') && !name.endsWith('/manifest.json'))
    .map(name => name.slice(dir.length + 1))
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function firstCaseNumber(text) {
  const match = String(text || '').match(/[（(]\d{4}[）)][^，。；\s]{1,40}?号/)
  return match ? match[0] : ''
}

function firstCourt(text) {
  const match = String(text || '').match(/([\u4e00-\u9fa5]{2,25}?法院)/)
  return match ? match[1] : ''
}

function buildGuidingCase(raw) {
  const title = clean(raw.title)
  const keywords = (raw.keywords || []).map(clean).filter(Boolean)
  const gist = clean((raw.gist || []).join(' '))
  const facts = clean((raw.facts || []).join(' '))
  const result = clean((raw.result || []).join(' '))
  const reasoning = clean((raw.reasoning || []).join(' '))
  const relatedLaws = (raw.relatedLaws || []).map(clean).filter(Boolean)

  return {
    id: raw.id,
    type: 'guiding',
    number: raw.number,
    title,
    caseNumber: firstCaseNumber(result),
    court: firstCourt(result),
    keywords,
    snippet: (gist || facts).slice(0, 220),
    excerpt: clean(`${facts.slice(0, 420)} ${reasoning.slice(0, 420)}`).slice(0, 900),
    relatedLaws,
    publishedAt: raw.publishedAt || '',
    sourceUrl: raw.sourceUrl || ''
  }
}

function findGazetteHolding(body) {
  for (let index = 0; index < body.length; index++) {
    const paragraph = body[index]
    const match = paragraph.match(/本院认为|裁判要旨|裁判摘要/)
    if (!match) continue
    if (match.index <= 30) return body.slice(index, index + 3).join(' ')
    return `${paragraph.slice(match.index)} ${body[index + 1] || ''}`.slice(0, 700)
  }
  return ''
}

function buildGazetteCase(raw) {
  const body = (raw.body || []).map(clean).filter(Boolean)
  const summary = clean((raw.summary || []).join(' '))
  const holding = findGazetteHolding(body)

  return {
    id: raw.id,
    type: 'gazette',
    number: null,
    title: clean(raw.title),
    caseNumber: clean(raw.caseNumber),
    court: clean(raw.court),
    category: clean(raw.category),
    issueNo: raw.issueNo || null,
    keywords: [],
    snippet: (summary || holding || body.slice(-2).join(' ') || clean(raw.title)).slice(0, 220),
    excerpt: clean(`${body.slice(0, 4).join(' ').slice(0, 350)} ${holding.slice(0, 700)} ${body.slice(-2).join(' ').slice(0, 250)}`).slice(0, 1200),
    relatedLaws: [],
    publishedAt: raw.issueYear ? String(raw.issueYear) : '',
    sourceUrl: raw.sourceUrl || ''
  }
}

async function main() {
  const [guidingFiles, gazetteFiles] = await Promise.all([
    listCaseFiles('guiding-cases'),
    listCaseFiles('gazette-cases')
  ])
  console.log(`发现指导性案例 ${guidingFiles.length} 件，公报案例 ${gazetteFiles.length} 件`)

  const guiding = await mapLimit(guidingFiles, CONCURRENCY, async name => {
    const raw = await fetchJson(RAW + 'guiding-cases/' + encodeURIComponent(name))
    return buildGuidingCase(raw)
  })
  const gazette = await mapLimit(gazetteFiles, CONCURRENCY, async name => {
    const raw = await fetchJson(RAW + 'gazette-cases/' + encodeURIComponent(name))
    return buildGazetteCase(raw)
  })

  const cases = [...guiding, ...gazette]
  if (guiding.length < 278 || gazette.length < 445) {
    throw new Error(`案例数量异常：指导性案例 ${guiding.length} 件，公报案例 ${gazette.length} 件`)
  }
  const generatedAt = new Date().toISOString().slice(0, 10)
  const meta = {
    generatedAt,
    source: `https://github.com/${REPO}`,
    license: 'CC0',
    guidingCount: guiding.length,
    gazetteCount: gazette.length,
    total: cases.length
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(
    path.join(OUT_DIR, 'legal-cases.json'),
    JSON.stringify({ ...meta, cases }),
    'utf8'
  )
  await fs.writeFile(
    path.join(OUT_DIR, 'legal-cases-index.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  )

  console.log(`完成：${guiding.length} 件指导性案例 + ${gazette.length} 件公报案例，共 ${cases.length} 件`)
  console.log(`输出：${path.join(OUT_DIR, 'legal-cases.json')}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
