// 本地案例检索：最高人民法院指导性案例 + 《最高人民法院公报》案例
import caseIndexMeta from '../data/legal-cases-index.json'
import { tokenize, compactText, normalizeLawName, parseCnNumber } from './chineseText.js'
import { QUERY_EXPANSIONS } from './legalCorpus.js'

const state = {
  cases: [],
  docs: [],
  postings: new Map(),
  avgLen: 1,
  loadPromise: null
}

export const caseCorpusMeta = caseIndexMeta

const CASE_STOPWORDS = new Set([
  '可以', '要求', '怎么', '如何', '什么', '哪些', '是否', '有效', '需要', '应该', '能够',
  '因为', '所以', '但是', '已经', '没有', '进行', '相关', '问题', '法律', '赔偿', '责任',
  '时间', '多少', '现在', '我们', '他们', '一个', '这个', '那个', '如果', '还是', '就是',
  '不是', '有没有', '怎么办', '公司', '员工', '对方', '起诉', '法院'
])

const CASE_ANCHOR_RULES = [
  { test: /借钱|欠钱|欠款|还钱|讨债|不还|借款/, terms: ['借款合同', '民间借贷'] },
  { test: /离婚.*(财产|房产|房子)|(财产|房产).*分割|分财产/, terms: ['夫妻共同财产', '离婚'] },
  { test: /假货|翻新|假冒|伪劣|退一赔三|三倍赔偿|十倍赔偿|消费者/, terms: ['欺诈', '十倍赔偿', '三倍赔偿', '退一赔三'] },
  { test: /打人|故意伤害|轻伤|重伤/, terms: ['故意伤害'] },
  { test: /盗窃|偷东西|偷了|小偷/, terms: ['盗窃'] },
  { test: /诈骗|被骗|骗钱/, terms: ['诈骗'] },
  { test: /交通事故|车祸|撞车|撞人|追尾|肇事/, terms: ['交通事故', '机动车'] },
  { test: /交强险|强制险|保险理赔/, terms: ['交强险', '保险'] },
  { test: /逃逸|酒驾|醉驾/, terms: ['逃逸', '醉酒', '饮酒'] },
  { test: /工伤|上下班途中|上班途中|下班途中/, terms: ['工伤', '工伤保险'] },
  { test: /违法解除|单方解除|辞退|开除|裁员|解除劳动合同/, terms: ['解除劳动合同', '辞退'] },
  { test: /拖欠工资|欠薪|加班费/, terms: ['工资', '加班'] },
  { test: /租房|房东|租客|押金|退租/, terms: ['租赁', '租金'] },
  { test: /物业|业主|小区/, terms: ['物业服务', '业主'] },
  { test: /买房|商品房|开发商|交房|购房/, terms: ['商品房', '房屋买卖'] },
  { test: /遗嘱/, terms: ['遗嘱'] },
  { test: /继承|遗产/, terms: ['继承', '遗产'] },
  { test: /抚养权|抚养费|子女.*抚养/, terms: ['抚养'] },
  { test: /彩礼/, terms: ['彩礼'] },
  { test: /违约|违约金|毁约/, terms: ['违约'] },
  { test: /著作权|版权|抄袭/, terms: ['著作权'] },
  { test: /商标/, terms: ['商标'] },
  { test: /专利/, terms: ['专利'] },
  { test: /医疗事故|医疗损害/, terms: ['医疗损害'] },
  { test: /股权|股东/, terms: ['股权', '股东'] }
]

function collectAnchorTerms(question) {
  if (/工伤|上下班途中|上班途中|下班途中/.test(question)) return ['工伤', '工伤保险']

  const curated = new Set()
  for (const rule of CASE_ANCHOR_RULES) {
    if (rule.test.test(question)) {
      for (const term of rule.terms) curated.add(term)
    }
  }
  if (curated.size) return [...curated]

  return [...tokenize(question)]
    .filter(([token, info]) => info.weight >= 2.4 && token.length >= 3 && !CASE_STOPWORDS.has(token))
    .sort((a, b) => b[0].length - a[0].length)
    .slice(0, 2)
    .map(([token]) => token)
}

function buildSearchText(item) {
  return [
    item.title,
    ...(item.keywords || []),
    item.snippet,
    item.excerpt,
    ...(item.relatedLaws || []),
    item.court,
    item.category
  ].filter(Boolean).join(' ')
}

function buildIndex() {
  state.docs = []
  state.postings = new Map()
  let totalLen = 0

  for (const item of state.cases) {
    const idx = state.docs.length
    const text = buildSearchText(item)
    const tokens = tokenize(text)
    let len = 0
    for (const [token, info] of tokens) {
      let list = state.postings.get(token)
      if (!list) state.postings.set(token, list = [])
      list.push([idx, info.tf])
      len += info.tf
    }
    totalLen += len
    state.docs.push({ item, len, compact: compactText(text) })
  }

  state.avgLen = state.docs.length ? totalLen / state.docs.length : 1
}

function ensureCases() {
  if (!state.loadPromise) {
    state.loadPromise = import('../data/legal-cases.json')
      .then(module => {
        state.cases = module.default.cases
        buildIndex()
        return state
      })
      .catch(err => {
        state.loadPromise = null
        throw err
      })
  }
  return state.loadPromise
}

function articleNumber(label) {
  const match = String(label || '').match(/第\s*([一二三四五六七八九十百千零〇两\d]+)\s*条/)
  return match ? parseCnNumber(match[1]) : 0
}

/**
 * 检索与问题、已核验法条相关的本地案例
 * @param {string} query - 用户问题
 * @param {Array} [citations] - verifyCitations 的结果
 * @param {number} [limit] - 最多返回条数
 */
export async function searchRelatedCases(query, citations = [], limit = 3) {
  await ensureCases()
  const question = (query || '').trim()
  if (!question) return []

  const queryTokens = new Map()
  for (const [token, info] of tokenize(question)) queryTokens.set(token, info.weight)
  for (const rule of QUERY_EXPANSIONS) {
    if (!rule.test.test(question)) continue
    for (const [token, info] of tokenize(rule.terms)) {
      if (!queryTokens.has(token)) queryTokens.set(token, info.weight * 0.45)
    }
  }

  const citationText = (citations || [])
    .map(citation => `${citation.lawTitle || citation.law || ''}${citation.articleLabel || ''}`)
    .filter(Boolean)
    .join(' ')
  for (const [token, info] of tokenize(citationText)) {
    queryTokens.set(token, Math.max(queryTokens.get(token) || 0, info.weight * 0.75))
  }

  const anchorTerms = collectAnchorTerms(question)
  if (!anchorTerms.length) return []

  const scores = new Map()
  const total = state.docs.length
  const K1 = 1.2
  const B = 0.7

  for (const [token, weight] of queryTokens) {
    const list = state.postings.get(token)
    if (!list) continue
    const idf = Math.log(1 + (total - list.length + 0.5) / (list.length + 0.5))
    for (const [idx, tf] of list) {
      const doc = state.docs[idx]
      const norm = tf + K1 * (1 - B + B * doc.len / state.avgLen)
      const score = idf * weight * (tf * (K1 + 1)) / norm
      scores.set(idx, (scores.get(idx) || 0) + score)
    }
  }

  if (!scores.size) return []

  const citationCompacts = (citations || [])
    .map(citation => compactText(`${citation.lawTitle || citation.law || ''}${citation.articleLabel || ''}`))
    .filter(Boolean)
  const citedLawNames = (citations || [])
    .map(citation => normalizeLawName(citation.lawTitle || citation.law || ''))
    .filter(Boolean)
  const citedArticleNumbers = new Set((citations || []).map(citation => articleNumber(citation.articleLabel)).filter(Boolean))

  const results = []
  for (const [idx, base] of scores) {
    const doc = state.docs[idx]
    if (!anchorTerms.some(term => doc.compact.includes(term))) continue

    let score = base
    if (doc.item.type === 'guiding') score += 3
    if (citationCompacts.some(item => doc.compact.includes(item))) score += 14

    for (const lawText of doc.item.relatedLaws || []) {
      const normalized = normalizeLawName(lawText)
      const sameLaw = citedLawNames.some(name => normalized.includes(name) || name.includes(normalized))
      if (!sameLaw) continue
      const sameArticle = articleNumber(lawText) && citedArticleNumbers.has(articleNumber(lawText))
      score += sameArticle ? 10 : 5
      break
    }

    if (score > 0) results.push({ item: doc.item, score })
  }

  results.sort((a, b) => b.score - a.score)
  const topScore = results[0]?.score || 0
  const threshold = Math.max(5, topScore * 0.3)

  return results
    .filter(result => result.score >= threshold)
    .slice(0, limit)
    .map(({ item, score }) => ({
      id: item.id,
      type: item.type,
      number: item.number,
      title: item.title,
      caseNumber: item.caseNumber,
      court: item.court,
      category: item.category,
      issueNo: item.issueNo,
      publishedAt: item.publishedAt,
      snippet: item.snippet,
      relatedLaws: (item.relatedLaws || []).slice(0, 3),
      sourceUrl: item.sourceUrl,
      score
    }))
}
