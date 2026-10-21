import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 生成本地法条库。
 * 文本整理自 https://github.com/LawRefBook/Laws（按国家法律法规数据库文本整理）。
 * 用法：npm run corpus:update
 */

const REPO_RAW = 'https://raw.githubusercontent.com/LawRefBook/Laws/master/'
const REPO_TREE = 'https://github.com/LawRefBook/Laws/tree/master/'
const OUT_DIR = path.resolve('src/data')
const UA = 'Mozilla/5.0 (law-ai-assistant corpus builder)'

const LAWS = [
  {
    id: 'constitution', title: '中华人民共和国宪法', shortName: '宪法',
    category: '宪法', date: '2018-03-11', files: ['宪法/宪法.md']
  },
  {
    id: 'civil-code', title: '中华人民共和国民法典', shortName: '民法典',
    category: '法律', date: '2020-05-28',
    files: [
      '民法典/总则.md',
      '民法典/物权编.md',
      '民法典/合同编.md',
      '民法典/人格权编.md',
      '民法典/婚姻家庭编.md',
      '民法典/继承编.md',
      '民法典/侵权责任编.md',
      '民法典/附则.md'
    ]
  },
  {
    id: 'criminal-law', title: '中华人民共和国刑法', shortName: '刑法',
    category: '法律', date: '2023-12-29', files: ['刑法/刑法.md']
  },
  {
    id: 'civil-procedure-law', title: '中华人民共和国民事诉讼法', shortName: '民事诉讼法',
    category: '诉讼与非诉讼程序法', date: '2023-09-01',
    files: ['诉讼与非诉讼程序法/民事诉讼法(2023-09-01).md']
  },
  {
    id: 'criminal-procedure-law', title: '中华人民共和国刑事诉讼法', shortName: '刑事诉讼法',
    category: '诉讼与非诉讼程序法', date: '2018-10-26',
    files: ['诉讼与非诉讼程序法/刑事诉讼法(2018-10-26).md']
  },
  {
    id: 'administrative-procedure-law', title: '中华人民共和国行政诉讼法', shortName: '行政诉讼法',
    category: '诉讼与非诉讼程序法', date: '2017-06-27',
    files: ['诉讼与非诉讼程序法/行政诉讼法(2017-06-27).md']
  },
  {
    id: 'administrative-penalty-law', title: '中华人民共和国行政处罚法', shortName: '行政处罚法',
    category: '行政法', date: '2021-01-22', files: ['行政法/行政处罚法(2021-01-22).md']
  },
  {
    id: 'administrative-license-law', title: '中华人民共和国行政许可法', shortName: '行政许可法',
    category: '行政法', date: '2019-04-23', files: ['行政法/行政许可法(2019-04-23).md']
  },
  {
    id: 'administrative-coercion-law', title: '中华人民共和国行政强制法', shortName: '行政强制法',
    category: '行政法', date: '2011-06-30', files: ['行政法/行政强制法(2011-06-30).md']
  },
  {
    id: 'administrative-reconsideration-law', title: '中华人民共和国行政复议法', shortName: '行政复议法',
    category: '行政法', date: '2023-09-01', files: ['诉讼与非诉讼程序法/行政复议法(2023-09-01).md']
  },
  {
    id: 'public-security-penalty-law', title: '中华人民共和国治安管理处罚法', shortName: '治安管理处罚法',
    category: '行政法', date: '2025-06-27', files: ['行政法/治安管理处罚法(2025-06-27).md']
  },
  {
    id: 'road-traffic-safety-law', title: '中华人民共和国道路交通安全法', shortName: '道路交通安全法',
    category: '行政法', date: '2021-04-29', files: ['行政法/道路交通安全法(2021-04-29).md']
  },
  {
    id: 'labor-law', title: '中华人民共和国劳动法', shortName: '劳动法',
    category: '社会法', date: '2018-12-29', files: ['社会法/劳动法(2018-12-29).md']
  },
  {
    id: 'labor-contract-law', title: '中华人民共和国劳动合同法', shortName: '劳动合同法',
    category: '社会法', date: '2012-12-28', files: ['社会法/劳动合同法(2012-12-28).md']
  },
  {
    id: 'social-insurance-law', title: '中华人民共和国社会保险法', shortName: '社会保险法',
    category: '社会法', date: '2018-12-29', files: ['社会法/社会保险法(2018-12-29).md']
  },
  {
    id: 'labor-dispute-mediation-law', title: '中华人民共和国劳动争议调解仲裁法', shortName: '劳动争议调解仲裁法',
    category: '诉讼与非诉讼程序法', date: '2007-12-29',
    files: ['诉讼与非诉讼程序法/劳动争议调解仲裁法(2007-12-29).md']
  },
  {
    id: 'people-mediation-law', title: '中华人民共和国人民调解法', shortName: '人民调解法',
    category: '诉讼与非诉讼程序法', date: '2010-08-28',
    files: ['诉讼与非诉讼程序法/人民调解法(2010-08-28).md']
  },
  {
    id: 'arbitration-law', title: '中华人民共和国仲裁法', shortName: '仲裁法',
    category: '诉讼与非诉讼程序法', date: '2025-09-12',
    files: ['诉讼与非诉讼程序法/仲裁法(2025-09-12).md']
  },
  {
    id: 'company-law', title: '中华人民共和国公司法', shortName: '公司法',
    category: '民法商法', date: '2023-12-29', files: ['民法商法/公司法(2023-12-29).md']
  },
  {
    id: 'partnership-enterprise-law', title: '中华人民共和国合伙企业法', shortName: '合伙企业法',
    category: '民法商法', date: '2006-08-27', files: ['民法商法/合伙企业法(2006-08-27).md']
  },
  {
    id: 'enterprise-bankruptcy-law', title: '中华人民共和国企业破产法', shortName: '企业破产法',
    category: '民法商法', date: '2006-08-27', files: ['民法商法/企业破产法(2006-08-27).md']
  },
  {
    id: 'insurance-law', title: '中华人民共和国保险法', shortName: '保险法',
    category: '民法商法', date: '2015-04-24', files: ['民法商法/保险法(2015-04-24).md']
  },
  {
    id: 'consumer-protection-law', title: '中华人民共和国消费者权益保护法', shortName: '消费者权益保护法',
    category: '民法商法', date: '2013-10-25', files: ['民法商法/消费者权益保护法(2013-10-25).md']
  },
  {
    id: 'ecommerce-law', title: '中华人民共和国电子商务法', shortName: '电子商务法',
    category: '民法商法', date: '2018-08-31', files: ['民法商法/电子商务法(2018-08-31).md']
  },
  {
    id: 'anti-unfair-competition-law', title: '中华人民共和国反不正当竞争法', shortName: '反不正当竞争法',
    category: '经济法', date: '2025-06-27', files: ['经济法/反不正当竞争法(2025-06-27).md']
  },
  {
    id: 'anti-monopoly-law', title: '中华人民共和国反垄断法', shortName: '反垄断法',
    category: '经济法', date: '2022-06-24', files: ['经济法/反垄断法(2022-06-24).md']
  },
  {
    id: 'product-quality-law', title: '中华人民共和国产品质量法', shortName: '产品质量法',
    category: '经济法', date: '2018-12-29', files: ['经济法/产品质量法(2018-12-29).md']
  },
  {
    id: 'tax-collection-law', title: '中华人民共和国税收征收管理法', shortName: '税收征收管理法',
    category: '经济法', date: '2015-04-24', files: ['经济法/税收征收管理法(2015-04-24).md']
  },
  {
    id: 'individual-income-tax-law', title: '中华人民共和国个人所得税法', shortName: '个人所得税法',
    category: '经济法', date: '2018-08-31', files: ['经济法/个人所得税法(2018-08-31).md']
  },
  {
    id: 'patent-law', title: '中华人民共和国专利法', shortName: '专利法',
    category: '民法商法', date: '2020-10-17', files: ['民法商法/专利法(2020-10-17).md']
  },
  {
    id: 'trademark-law', title: '中华人民共和国商标法', shortName: '商标法',
    category: '民法商法', date: '2026-06-26', files: ['民法商法/商标法(2026-06-26).md']
  },
  {
    id: 'copyright-law', title: '中华人民共和国著作权法', shortName: '著作权法',
    category: '民法商法', date: '2020-11-11', files: ['民法商法/著作权法(2020-11-11).md']
  },
  {
    id: 'personal-information-protection-law', title: '中华人民共和国个人信息保护法', shortName: '个人信息保护法',
    category: '行政法', date: '2021-08-20', files: ['行政法/个人信息保护法(2021-08-20).md']
  },
  {
    id: 'data-security-law', title: '中华人民共和国数据安全法', shortName: '数据安全法',
    category: '行政法', date: '2021-06-10', files: ['行政法/数据安全法(2021-06-10).md']
  },
  {
    id: 'cybersecurity-law', title: '中华人民共和国网络安全法', shortName: '网络安全法',
    category: '行政法', date: '2025-10-28', files: ['行政法/网络安全法(2025-10-28).md']
  },
  {
    id: 'food-safety-law', title: '中华人民共和国食品安全法', shortName: '食品安全法',
    category: '行政法', date: '2025-09-12', files: ['行政法/食品安全法(2025-09-12).md']
  },
  {
    id: 'minor-protection-law', title: '中华人民共和国未成年人保护法', shortName: '未成年人保护法',
    category: '社会法', date: '2024-04-26', files: ['社会法/未成年人保护法(2024-04-26).md']
  },
  {
    id: 'women-protection-law', title: '中华人民共和国妇女权益保障法', shortName: '妇女权益保障法',
    category: '社会法', date: '2022-10-30', files: ['社会法/妇女权益保障法(2022-10-30).md']
  },
  {
    id: 'anti-domestic-violence-law', title: '中华人民共和国反家庭暴力法', shortName: '反家庭暴力法',
    category: '社会法', date: '2015-12-27', files: ['社会法/反家庭暴力法(2015-12-27).md']
  },
  {
    id: 'safety-production-law', title: '中华人民共和国安全生产法', shortName: '安全生产法',
    category: '社会法', date: '2021-06-10', files: ['社会法/安全生产法(2021-06-10).md']
  },
  {
    id: 'legal-aid-law', title: '中华人民共和国法律援助法', shortName: '法律援助法',
    category: '行政法', date: '2021-08-20', files: ['行政法/法律援助法(2021-08-20).md']
  },
  {
    id: 'lawyer-law', title: '中华人民共和国律师法', shortName: '律师法',
    category: '行政法', date: '2017-09-01', files: ['行政法/律师法(2017-09-01).md']
  },
  {
    id: 'environmental-protection-law', title: '中华人民共和国环境保护法', shortName: '环境保护法',
    category: '行政法', date: '2014-04-24', files: ['行政法/环境保护法(2014-04-24).md']
  },
  {
    id: 'civil-code-general-interpretation', title: '最高人民法院关于适用《中华人民共和国民法典》总则编若干问题的解释', shortName: '民法典总则编解释',
    category: '司法解释', date: '2022-02-24',
    files: ['司法解释/最高人民法院关于适用《民法典》总则编若干问题的解释(2022-02-24).md']
  },
  {
    id: 'civil-code-property-interpretation', title: '最高人民法院关于适用《中华人民共和国民法典》物权编的解释（一）', shortName: '民法典物权编解释（一）',
    category: '司法解释', date: '2020-12-29',
    files: ['司法解释/最高人民法院关于适用《民法典》物权编的解释（一）(2020-12-29).md']
  },
  {
    id: 'civil-code-contract-interpretation', title: '最高人民法院关于适用《中华人民共和国民法典》合同编通则若干问题的解释', shortName: '民法典合同编通则解释',
    category: '司法解释', date: '2023-12-04',
    files: ['司法解释/最高人民法院关于适用《民法典》合同编通则若干问题的解释(2023-12-04).md']
  },
  {
    id: 'civil-code-marriage-interpretation-1', title: '最高人民法院关于适用《中华人民共和国民法典》婚姻家庭编的解释（一）', shortName: '民法典婚姻家庭编解释（一）',
    category: '司法解释', date: '2020-12-29',
    files: ['司法解释/最高人民法院关于适用《民法典》婚姻家庭编的解释（一）(2020-12-29).md']
  },
  {
    id: 'civil-code-marriage-interpretation-2', title: '最高人民法院关于适用《中华人民共和国民法典》婚姻家庭编的解释（二）', shortName: '民法典婚姻家庭编解释（二）',
    category: '司法解释', date: '2025-01-15',
    files: ['司法解释/最高人民法院关于适用《民法典》婚姻家庭编的解释（二）(2025-01-15).md']
  },
  {
    id: 'civil-code-inheritance-interpretation', title: '最高人民法院关于适用《中华人民共和国民法典》继承编的解释（一）', shortName: '民法典继承编解释（一）',
    category: '司法解释', date: '2020-12-29',
    files: ['司法解释/最高人民法院关于适用《民法典》继承编的解释（一）(2020-12-29).md']
  },
  {
    id: 'civil-code-tort-interpretation', title: '最高人民法院关于适用《中华人民共和国民法典》侵权责任编的解释（一）', shortName: '民法典侵权责任编解释（一）',
    category: '司法解释', date: '2024-09-25',
    files: ['司法解释/最高人民法院关于适用《民法典》侵权责任编的解释（一）(2024-09-25).md']
  },
  {
    id: 'civil-code-security-interpretation', title: '最高人民法院关于适用《中华人民共和国民法典》有关担保制度的解释', shortName: '民法典担保制度解释',
    category: '司法解释', date: '2020-12-31',
    files: ['司法解释/最高人民法院关于适用《民法典》有关担保制度的解释(2020-12-31).md']
  },
  {
    id: 'labor-dispute-interpretation-1', title: '最高人民法院关于审理劳动争议案件适用法律问题的解释（一）', shortName: '劳动争议解释（一）',
    category: '司法解释', date: '2020-12-29',
    files: ['司法解释/最高人民法院关于审理劳动争议案件适用法律问题的解释（一）(2020-12-29).md']
  },
  {
    id: 'labor-dispute-interpretation-2', title: '最高人民法院关于审理劳动争议案件适用法律问题的解释（二）', shortName: '劳动争议解释（二）',
    category: '司法解释', date: '2025-07-31',
    files: ['司法解释/最高人民法院关于审理劳动争议案件适用法律问题的解释（二）(2025-07-31).md']
  },
  {
    id: 'civil-procedure-interpretation', title: '最高人民法院关于适用《中华人民共和国民事诉讼法》的解释', shortName: '民事诉讼法解释',
    category: '司法解释', date: '2022-04-02',
    files: ['司法解释/最高人民法院关于适用《民事诉讼法》的解释(2022-04-02).md']
  },
  {
    id: 'administrative-procedure-interpretation', title: '最高人民法院关于适用《中华人民共和国行政诉讼法》的解释', shortName: '行政诉讼法解释',
    category: '司法解释', date: '2018-02-06',
    files: ['司法解释/最高人民法院关于适用《行政诉讼法》的解释(2018-02-06).md']
  },
  {
    id: 'personal-injury-interpretation', title: '最高人民法院关于审理人身损害赔偿案件适用法律若干问题的解释', shortName: '人身损害赔偿解释',
    category: '司法解释', date: '2022-04-24',
    aliases: ['人身损害赔偿解释', '人身损害解释'],
    files: ['司法解释/最高人民法院关于审理人身损害赔偿案件适用法律若干问题的解释(2022-04-24).md']
  },
  {
    id: 'traffic-accident-interpretation', title: '最高人民法院关于审理道路交通事故损害赔偿案件适用法律若干问题的解释', shortName: '道路交通事故损害赔偿解释',
    category: '司法解释', date: '2020-12-29',
    aliases: ['道路交通事故损害赔偿解释', '交通事故损害赔偿解释', '道交损害赔偿解释'],
    files: ['司法解释/最高人民法院关于审理道路交通事故损害赔偿案件适用法律若干问题的解释(2020-12-29).md']
  },
  {
    id: 'traffic-criminal-interpretation', title: '最高人民法院关于审理交通肇事刑事案件具体应用法律若干问题的解释', shortName: '交通肇事刑事案件解释',
    category: '司法解释', date: '2000-11-15',
    aliases: ['交通肇事刑事案件解释', '交通肇事解释'],
    files: ['司法解释/最高人民法院关于审理交通肇事刑事案件具体应用法律若干问题的解释(2000-11-15).md']
  },
  {
    id: 'compulsory-traffic-insurance-regulation', title: '机动车交通事故责任强制保险条例', shortName: '交强险条例',
    category: '行政法规', date: '2019-03-02',
    aliases: ['交强险条例', '机动车交通事故责任强制保险条例', '交强险'],
    files: ['行政法规/机动车交通事故责任强制保险条例(2019-03-02).md']
  },
  {
    id: 'work-injury-insurance-regulation', title: '工伤保险条例', shortName: '工伤保险条例',
    category: '行政法规', date: '2010-12-20',
    aliases: ['工伤保险条例', '工伤条例'],
    files: ['行政法规/工伤保险条例(2010-12-20).md']
  },
  {
    id: 'road-traffic-safety-regulation', title: '中华人民共和国道路交通安全法实施条例', shortName: '道路交通安全法实施条例',
    category: '行政法规', date: '2017-10-07',
    aliases: ['道路交通安全法实施条例', '道交法实施条例'],
    files: ['行政法规/道路交通安全法实施条例(2017-10-07).md']
  }
]

const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const CN_UNITS = { 十: 10, 百: 100, 千: 1000 }

function parseCnNumber(input) {
  if (/^\d+$/.test(input)) return Number(input)
  let section = 0
  let number = 0
  for (const ch of input) {
    if (ch in CN_DIGITS) {
      number = CN_DIGITS[ch]
    } else if (ch in CN_UNITS) {
      if (number === 0) number = 1
      section += number * CN_UNITS[ch]
      number = 0
    }
  }
  return section + number
}

function cleanText(text) {
  return text
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function rawUrl(relativePath) {
  return REPO_RAW + relativePath.split('/').map(encodeURIComponent).join('/')
}

function sourceUrl(files) {
  if (files.length === 1) return rawUrl(files[0])
  const dir = files[0].split('/').slice(0, -1).join('/')
  return REPO_TREE + dir.split('/').map(encodeURIComponent).join('/')
}

async function fetchText(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise(resolve => setTimeout(resolve, 800 * attempt))
    }
  }
}

const ARTICLE_RE = /^#{0,6}\s*\**\s*第([一二三四五六七八九十百千零〇两\d]+)条(之[一二三四五六七八九十]+)?[\s　]*(.*)$/
const HEADING_RE = /^#{2,5}\s+(.+)$/

function parseArticles(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const articles = []
  let chapter = ''
  let current = null

  function flush() {
    if (!current) return
    const text = cleanText(current.lines.join('\n'))
    if (text) {
      articles.push({
        n: parseCnNumber(current.numberCn),
        no: `第${current.numberCn}条`,
        suffix: current.suffix,
        chapter,
        text
      })
    }
    current = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (current) current.lines.push('')
      continue
    }
    if (line.startsWith('<!--')) continue

    const heading = line.match(HEADING_RE)
    if (heading && !ARTICLE_RE.test(line)) {
      flush()
      chapter = cleanText(heading[1].replace(/\*\*/g, ''))
      continue
    }

    const match = line.match(ARTICLE_RE)
    if (match) {
      flush()
      current = {
        numberCn: match[1],
        suffix: match[2] || '',
        lines: match[3] ? [match[3]] : []
      }
      continue
    }

    if (current) current.lines.push(line)
  }

  flush()
  return articles
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function buildLaw(meta) {
  const parts = []
  for (const file of meta.files) {
    const content = await fetchText(rawUrl(file))
    parts.push(content)
  }

  const markdown = decodeEntities(parts.join('\n\n'))
  let articles = parseArticles(markdown)

  const seen = new Set()
  articles = articles
    .filter(article => {
      const key = `${article.n}${article.suffix}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.n - b.n)

  if (articles.length === 0) {
    throw new Error(`${meta.title} 未解析到条文`)
  }

  return {
    id: meta.id,
    title: meta.title,
    shortName: meta.shortName,
    category: meta.category,
    date: meta.date,
    source: sourceUrl(meta.files),
    aliases: [meta.title, meta.shortName, ...(meta.aliases || [])],
    articles
  }
}

async function main() {
  const laws = []
  for (const meta of LAWS) {
    process.stdout.write(`读取 ${meta.shortName} ... `)
    const law = await buildLaw(meta)
    laws.push(law)
    console.log(`${law.articles.length} 条`)
  }

  const generatedAt = new Date().toISOString().slice(0, 10)
  const corpus = {
    generatedAt,
    source: 'https://flk.npc.gov.cn/',
    sourceMirror: 'https://github.com/LawRefBook/Laws',
    laws
  }

  const index = {
    generatedAt,
    source: corpus.source,
    sourceMirror: corpus.sourceMirror,
    laws: laws.map(law => ({
      id: law.id,
      title: law.title,
      shortName: law.shortName,
      category: law.category,
      date: law.date,
      articleCount: law.articles.length
    }))
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(path.join(OUT_DIR, 'legal-corpus.json'), JSON.stringify(corpus), 'utf8')
  await fs.writeFile(path.join(OUT_DIR, 'legal-corpus-index.json'), JSON.stringify(index, null, 2), 'utf8')

  const articleCount = laws.reduce((sum, law) => sum + law.articles.length, 0)
  console.log(`\n完成：${laws.length} 部法律文件，共 ${articleCount} 条`)
  console.log(`输出：${path.join(OUT_DIR, 'legal-corpus.json')}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
