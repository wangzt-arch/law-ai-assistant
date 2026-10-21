import corpusIndex from '../data/legal-corpus-index.json'

const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const CN_UNITS = { 十: 10, 百: 100, 千: 1000 }

let segmenter = null
try {
  segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'word' })
} catch {
  segmenter = null
}

const state = {
  laws: [],
  docs: [],
  postings: new Map(),
  aliases: [],
  aliasMap: new Map(),
  avgLen: 1,
  loadPromise: null
}

// 口语化问题与法条用语的常见对应关系，用于扩展检索词
const QUERY_EXPANSIONS = [
  { test: /借钱|欠钱|欠款|还钱|讨债|不还|借款/, terms: '借款 贷款人 借款人 返还 偿还 债务' },
  { test: /离婚.*(财产|房产|房子)|(财产|房产).*分割|分财产/, terms: '夫妻 共同财产 协议 分割 照顾子女' },
  { test: /假货|假冒|伪劣|退一赔三|几倍赔偿|消费者/, terms: '消费者 经营者 欺诈 商品 增加赔偿 三倍' },
  { test: /打人|打架|故意伤害|轻伤|重伤/, terms: '故意伤害 身体 有期徒刑 拘役' },
  { test: /盗窃|偷东西|偷了|小偷/, terms: '盗窃 公私财物 数额' },
  { test: /诈骗|被骗|骗钱/, terms: '诈骗 公私财物 数额' },
  { test: /交通事故|车祸|撞车|撞人/, terms: '交通事故 损害赔偿 责任' },
  { test: /工伤|上班.*受伤|工作中受伤/, terms: '工伤 工伤保险 用人单位 劳动能力' },
  { test: /违法解除|单方解除|辞退|开除|裁员|解除劳动合同/, terms: '违反本法规定解除 用人单位 劳动者 经济补偿 赔偿金 二倍' },
  { test: /拖欠工资|欠薪|讨薪|加班费/, terms: '劳动报酬 工资 加班 用人单位' },
  { test: /租房|房东|租客|押金|退租|租赁/, terms: '租赁合同 租赁物 承租人 出租人 返还 恢复原状 提前解除 赔偿损失' },
  { test: /物业|业主|小区/, terms: '物业服务 业主 物业费' },
  { test: /买房|商品房|开发商|交房|购房/, terms: '商品房 买卖 开发商 房屋' },
  { test: /继承|遗产|遗嘱/, terms: '继承 遗产 遗嘱 继承人 自书遗嘱 代书遗嘱 打印遗嘱 公证遗嘱 见证人 签名 年月日' },
  { test: /抚养权|抚养费|子女.*抚养/, terms: '抚养 子女 直接抚养' },
  { test: /彩礼/, terms: '彩礼 婚约 返还' },
  { test: /违约|违约金|毁约/, terms: '违约 违约责任 违约金 赔偿损失' }
]

export const corpusMeta = corpusIndex

function parseCnNumber(input) {
  if (/^\d+$/.test(input)) return Number(input)
  let section = 0
  let number = 0
  for (const ch of input) {
    if (ch in CN_DIGITS) number = CN_DIGITS[ch]
    else if (ch in CN_UNITS) {
      if (number === 0) number = 1
      section += number * CN_UNITS[ch]
      number = 0
    }
  }
  return section + number
}

function normalizeLawName(name) {
  return (name || '')
    .replace(/[《》〈〉「」『』()（）\s　·,，.。:：;；、<>]/g, '')
    .replace(/中华人民共和国/g, '')
    .replace(/最高人民法院|最高人民检察院/g, '')
    .replace(/关于/g, '')
    .replace(/适用/g, '')
    .replace(/若干问题/g, '')
    .replace(/的/g, '')
    .toLowerCase()
}

function compactText(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function tokenize(text) {
  const tokens = new Map()
  const add = (token, weight) => {
    const current = tokens.get(token)
    if (current) current.tf += 1
    else tokens.set(token, { tf: 1, weight })
  }

  const normalized = (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
  if (segmenter) {
    for (const part of segmenter.segment(normalized)) {
      if (part.isWordLike && part.segment.length >= 2) {
        add(part.segment, part.segment.length >= 3 ? 2.4 : 1.8)
      }
    }
  }
  for (const run of normalized.match(/[\u4e00-\u9fff]{2,}/g) || []) {
    for (let i = 0; i < run.length - 1; i++) {
      const bigram = run.slice(i, i + 2)
      if (!tokens.has(bigram)) add(bigram, 1)
    }
  }
  for (const word of normalized.match(/[a-z0-9]{2,}/g) || []) add(word, 2)
  return tokens
}

function buildIndex() {
  state.docs = []
  state.postings = new Map()
  state.aliasMap = new Map()
  state.aliases = []
  let totalLen = 0

  for (const law of state.laws) {
    const variants = new Set([law.title, law.shortName, ...(law.aliases || [])])
    for (const base of [...variants]) {
      const withoutCivilCode = base.replace(/^民法典/, '')
      if (withoutCivilCode && withoutCivilCode !== base) variants.add(withoutCivilCode)
    }
    for (const variant of variants) {
      const norm = normalizeLawName(variant)
      if (!norm) continue
      state.aliases.push({ norm, law })
      if (!state.aliasMap.has(norm)) state.aliasMap.set(norm, law)
    }

    for (const article of law.articles) {
      const idx = state.docs.length
      const tokens = tokenize(`${law.title} ${law.shortName} ${article.no} ${article.chapter || ''} ${article.text}`)
      let len = 0
      for (const [token, info] of tokens) {
        let list = state.postings.get(token)
        if (!list) state.postings.set(token, list = [])
        list.push([idx, info.tf])
        len += info.tf
      }
      totalLen += len
      state.docs.push({
        law,
        article,
        len,
        compact: compactText(`${law.title}${law.shortName}${article.no}${article.chapter || ''}${article.text}`)
      })
    }
  }

  state.avgLen = state.docs.length ? totalLen / state.docs.length : 1
}

function ensureCorpus() {
  if (!state.loadPromise) {
    state.loadPromise = import('../data/legal-corpus.json')
      .then(module => {
        state.laws = module.default.laws
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

/**
 * 在本地法条库中检索相关条文
 * @param {string} query - 用户问题
 * @param {number} [limit] - 返回条数
 */
export async function searchLegalArticles(query, limit = 6) {
  await ensureCorpus()
  const text = (query || '').trim()
  if (!text) return []

  const queryTokens = new Map()
  for (const [token, info] of tokenize(text)) queryTokens.set(token, info.weight)
  for (const rule of QUERY_EXPANSIONS) {
    if (!rule.test.test(text)) continue
    for (const [token, info] of tokenize(rule.terms)) {
      if (!queryTokens.has(token)) queryTokens.set(token, info.weight * 0.6)
    }
  }

  const scores = new Map()
  const total = state.docs.length
  const K1 = 1.2
  const B = 0.75

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

  if (scores.size === 0) return []

  const queryCompact = compactText(text)
  const queryLaw = normalizeLawName(text)
  const boostedLawIds = new Set()
  for (const { norm, law } of state.aliases) {
    if (norm.length >= 2 && queryLaw.includes(norm)) boostedLawIds.add(law.id)
  }

  for (const [idx, base] of scores) {
    let score = base
    const doc = state.docs[idx]
    if (boostedLawIds.has(doc.law.id)) score += 6
    if (queryCompact.length >= 2 && doc.compact.includes(queryCompact)) score += 6
    scores.set(idx, score)
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([idx, score]) => ({
      law: state.docs[idx].law,
      article: state.docs[idx].article,
      score
    }))
}

const CITATION_RE = /《([^《》\n]{1,90})》([^。；;\n]{0,24}?)第\s*([一二三四五六七八九十百千零〇两\d]+)\s*条(之[一二三四五六七八九十]+)?/g

function extractCitations(text) {
  const found = []
  const seen = new Set()
  for (const match of (text || '').matchAll(CITATION_RE)) {
    const lawName = match[1].trim()
    const numberCn = match[3]
    const suffix = match[4] || ''
    const n = parseCnNumber(numberCn)
    if (!n) continue
    const key = `${normalizeLawName(lawName)}-${n}-${suffix}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ lawName, numberCn, n, suffix })
  }
  return found
}

function findLaw(name) {
  const norm = normalizeLawName(name)
  if (!norm) return null

  const exact = state.aliasMap.get(norm)
  if (exact) return exact

  let contained = null
  for (const alias of state.aliases) {
    if (alias.norm.length < 2) continue
    if (norm.includes(alias.norm) && (!contained || alias.norm.length > contained.norm.length)) {
      contained = alias
    }
  }
  if (contained) return contained.law

  if (norm.length >= 4) {
    let shortest = null
    for (const alias of state.aliases) {
      if (alias.norm.includes(norm) && (!shortest || alias.norm.length < shortest.norm.length)) {
        shortest = alias
      }
    }
    if (shortest) return shortest.law
  }

  return null
}

/**
 * 校验文本中的法条引用
 * @param {string} text - 模型回答
 * @returns {Promise<Array>} 引用核验结果
 */
export async function verifyCitations(text) {
  await ensureCorpus()
  const checks = []
  const seen = new Set()

  for (const cite of extractCitations(text)) {
    const key = `${normalizeLawName(cite.lawName)}-${cite.n}-${cite.suffix}`
    if (seen.has(key)) continue
    seen.add(key)

    const law = findLaw(cite.lawName)
    if (!law) {
      checks.push({
        law: cite.lawName,
        lawTitle: cite.lawName,
        articleLabel: `第${cite.numberCn}条${cite.suffix}`,
        status: 'law-missing',
        snippet: ''
      })
      continue
    }

    const article = law.articles.find(item => item.n === cite.n && (item.suffix || '') === cite.suffix)
    checks.push({
      law: law.shortName,
      lawTitle: law.title,
      articleLabel: article ? `${article.no}${article.suffix || ''}` : `第${cite.numberCn}条${cite.suffix}`,
      status: article ? 'verified' : 'not-found',
      snippet: article ? article.text.slice(0, 160) : ''
    })
  }

  return checks.slice(0, 12)
}
