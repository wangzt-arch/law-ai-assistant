import corpusIndex from '../data/legal-corpus-index.json'
import { parseCnNumber, normalizeLawName, compactText, tokenize } from './chineseText.js'

// 交通事故垂直领域的核心条文加权，避免“挂车、试乘”等特殊情形条文挤占通用规则。
// 法条修订后条文序号若变化，需要同步核对这里的条目。
const TRAFFIC_INTENT_RE = /交通事故|车祸|撞车|撞人|撞了人|追尾|肇事|交强险|强制险|事故认定|责任认定|机动车.*(?:事故|撞|伤|损|赔)|(?:事故|撞|伤|损|赔).*机动车/
const INJURY_INTENT_RE = /受伤|撞伤|伤人|撞人|人身损害|人身伤亡|伤残|误工费|护理费|医疗费|营养费|残疾赔偿金|死亡赔偿金|精神损害/
const DUI_INTENT_RE = /酒驾|醉驾|饮酒驾驶|无证驾驶|套牌|逃逸|肇事/
const WORK_INJURY_INTENT_RE = /工伤|上下班途中|工作.*受伤/
const LITIGATION_INTENT_RE = /不赔|拒赔|索赔|起诉|打官司/
const DETERMINATION_INTENT_RE = /责任认定|事故认定|认定书|复核/
const PROPERTY_DAMAGE_INTENT_RE = /车辆.*(?:贬值|维修|修理|损坏|损失)|修车费|贬值损失|车辆损失|财产损失|施救费|停运损失/
const CONSUMER_INTENT_RE = /消费者|商品|产品|商家|购物|买卖|退货|假货|服务|网购|平台/
const CONSUMER_LAW_IDS = new Set(['consumer-protection-law', 'product-quality-law', 'food-safety-law', 'e-commerce-law'])
const SPECIAL_CASE_RE = /^(?:挂车|机动车在道路以外|接受机动车驾驶培训|机动车试乘)|套牌机动车|多次转让.*未办理登记|自本条例施行之日/

const CORE_BOOSTS = {
  traffic: [
    ['road-traffic-safety-law', '第七十六条', 60],
    ['compulsory-traffic-insurance-regulation', '第二十一条', 55],
    ['compulsory-traffic-insurance-regulation', '第二十三条', 50],
    ['civil-code', '第一千二百零八条', 40],
    ['civil-code', '第一千二百一十三条', 50],
    ['civil-code', '第一千二百一十六条', 30],
    ['traffic-accident-interpretation', '第一条', 30],
    ['traffic-accident-interpretation', '第十三条', 45],
    ['traffic-accident-interpretation', '第十六条', 45],
    ['road-traffic-safety-regulation', '第九十一条', 30],
    ['road-traffic-safety-regulation', '第九十二条', 30]
  ],
  injury: [
    ['civil-code', '第一千一百七十九条', 55],
    ['civil-code', '第一千一百八十三条', 25],
    ['personal-injury-interpretation', '第六条', 45],
    ['personal-injury-interpretation', '第七条', 45],
    ['personal-injury-interpretation', '第八条', 35],
    ['personal-injury-interpretation', '第十二条', 45],
    ['personal-injury-interpretation', '第十五条', 35],
    ['personal-injury-interpretation', '第二十三条', 20]
  ],
  dui: [
    ['road-traffic-safety-law', '第九十一条', 60],
    ['road-traffic-safety-law', '第一百零一条', 55],
    ['criminal-law', '第一百三十三条', 60],
    ['traffic-criminal-interpretation', '第二条', 50],
    ['civil-code', '第一千二百一十六条', 40],
    ['compulsory-traffic-insurance-regulation', '第二十二条', 30]
  ],
  workInjury: [
    ['work-injury-insurance-regulation', '第十四条', 65],
    ['work-injury-insurance-regulation', '第十七条', 55],
    ['work-injury-insurance-regulation', '第三十条', 30],
    ['work-injury-insurance-regulation', '第六十二条', 30],
    ['social-insurance-law', '第三十六条', 40]
  ],
  litigation: [
    ['civil-procedure-law', '第一百二十二条', 90],
    ['civil-procedure-law', '第一百二十三条', 40],
    ['road-traffic-safety-law', '第七十四条', 60]
  ],
  determination: [
    ['road-traffic-safety-law', '第七十三条', 65],
    ['road-traffic-safety-regulation', '第九十一条', 55],
    ['road-traffic-safety-regulation', '第九十二条', 45],
    ['road-traffic-safety-law', '第七十四条', 40]
  ],
  propertyDamage: [
    ['civil-code', '第一千一百八十四条', 55],
    ['traffic-accident-interpretation', '第十二条', 65],
    ['road-traffic-safety-law', '第七十六条', 20],
    ['compulsory-traffic-insurance-regulation', '第二十一条', 15],
    ['compulsory-traffic-insurance-regulation', '第二十三条', 40],
    ['civil-code', '第一千二百一十三条', 30]
  ]
}

const EXTRA_ALIASES = {
  'road-traffic-safety-law': ['道交法'],
  'road-traffic-safety-regulation': ['道交法实施条例'],
  'traffic-accident-interpretation': ['道路交通事故解释', '交通事故损害赔偿司法解释'],
  'personal-injury-interpretation': ['人身损害赔偿司法解释']
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
export const QUERY_EXPANSIONS = [
  { test: /借钱|欠钱|欠款|还钱|讨债|不还|借款/, terms: '借款 贷款人 借款人 返还 偿还 债务' },
  { test: /离婚.*(财产|房产|房子)|(财产|房产).*分割|分财产/, terms: '夫妻 共同财产 协议 分割 照顾子女' },
  { test: /假货|假冒|伪劣|翻新|退一赔三|三倍赔偿|十倍赔偿|几倍赔偿|消费者/, terms: '消费者 经营者 欺诈 商品 增加赔偿 三倍' },
  { test: /打人|打架|故意伤害|轻伤|重伤/, terms: '故意伤害 身体 有期徒刑 拘役' },
  { test: /盗窃|偷东西|偷了|小偷/, terms: '盗窃 公私财物 数额' },
  { test: /诈骗|被骗|骗钱/, terms: '诈骗 公私财物 数额' },
  { test: /交通事故|车祸|撞车|撞人|撞了人|追尾|肇事|事故认定|责任认定|机动车|电动车.*(?:撞|事故|伤)|驾驶.*(?:撞|伤|事故)/, terms: '机动车 交通事故 人身损害 财产损失 赔偿责任 事故认定 交通费' },
  { test: /交强险|强制险|商业险|第三者责任险|保险理赔|保险公司.*赔/, terms: '机动车交通事故责任强制保险 保险公司 责任限额 商业第三者责任保险 赔偿' },
  { test: /逃逸|酒驾|醉驾|饮酒驾驶|无证驾驶|套牌|肇事逃逸/, terms: '逃逸 饮酒 醉酒 驾驶 机动车 交通肇事 刑事责任' },
  { test: /撞伤|伤人|受伤|人身损害|人身伤亡|伤残/, terms: '人身损害 赔偿' },
  { test: /赔偿.*(?:项目|标准|范围)|赔哪些|赔什么|赔偿多少/, terms: '医疗费 误工费 护理费 交通费 住院伙食补助费 营养费 残疾赔偿金 死亡赔偿金 精神损害抚慰金' },
  { test: /上下班途中|工伤|工作.*受伤/, terms: '工伤 工伤保险 上下班途中 非本人主要责任 社会保险 工伤认定' },
  { test: /对方.*(?:不赔|拒赔)|拒不赔偿|索赔|起诉|打官司/, terms: '赔偿 起诉 诉讼 人民法院 责任' },
  { test: /违法解除|单方解除|辞退|开除|裁员|解除劳动合同|劳动仲裁|经济补偿/, terms: '违反本法规定解除 用人单位 劳动者 经济补偿 赔偿金 二倍 工作年限 每满一年 月工资' },
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

function buildIndex() {
  state.docs = []
  state.postings = new Map()
  state.aliasMap = new Map()
  state.aliases = []
  let totalLen = 0

  for (const law of state.laws) {
    const variants = new Set([law.title, law.shortName, ...(law.aliases || []), ...(EXTRA_ALIASES[law.id] || [])])
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
  const definitionQuery = /含义|定义|是指|是什么|所称/.test(text)
  const boostedLawIds = new Set()
  for (const { norm, law } of state.aliases) {
    if (norm.length >= 2 && queryLaw.includes(norm)) boostedLawIds.add(law.id)
  }
  const articleMatch = text.match(/第\s*([一二三四五六七八九十百千零〇两\d]+)\s*条/)
  const queryArticleN = articleMatch ? parseCnNumber(articleMatch[1]) : 0

  const coreBoosts = new Map()
  const addBoosts = entries => {
    for (const [lawId, articleNo, boost] of entries) {
      const key = `${lawId}:${articleNo}`
      coreBoosts.set(key, Math.max(coreBoosts.get(key) || 0, boost))
    }
  }
  const trafficIntent = TRAFFIC_INTENT_RE.test(text)
  const workInjuryQuery = WORK_INJURY_INTENT_RE.test(text)
  const duiQuery = DUI_INTENT_RE.test(text)
  const damagesQuery = /误工费|护理费|医疗费|营养费|残疾赔偿金|死亡赔偿金|精神损害|伤残等级|伤残鉴定|赔偿标准|赔偿项目/.test(text)
  const determinationQuery = DETERMINATION_INTENT_RE.test(text)
  const propertyDamageQuery = PROPERTY_DAMAGE_INTENT_RE.test(text)
  const litigationQuery = LITIGATION_INTENT_RE.test(text)
  const consumerQuery = CONSUMER_INTENT_RE.test(text)
  const specialCaseQuery = SPECIAL_CASE_RE.test(text)

  if (trafficIntent) {
    if (workInjuryQuery) {
      addBoosts([['road-traffic-safety-law', '第七十六条', 20]])
    } else if (duiQuery || damagesQuery) {
      addBoosts([
        ['road-traffic-safety-law', '第七十六条', 20],
        ['compulsory-traffic-insurance-regulation', '第二十一条', 15]
      ])
    } else if (determinationQuery || propertyDamageQuery) {
      addBoosts([['road-traffic-safety-law', '第七十六条', 15]])
    } else if (litigationQuery) {
      addBoosts([
        ['road-traffic-safety-law', '第七十六条', 30],
        ['compulsory-traffic-insurance-regulation', '第二十一条', 25],
        ['civil-code', '第一千二百一十三条', 25]
      ])
    } else {
      addBoosts(CORE_BOOSTS.traffic)
    }
  }
  if (INJURY_INTENT_RE.test(text) && !(workInjuryQuery && !trafficIntent)) addBoosts(CORE_BOOSTS.injury)
  if (duiQuery) addBoosts(CORE_BOOSTS.dui)
  if (workInjuryQuery) addBoosts(CORE_BOOSTS.workInjury)
  if (litigationQuery) addBoosts(CORE_BOOSTS.litigation)
  if (determinationQuery) addBoosts(CORE_BOOSTS.determination)
  if (propertyDamageQuery) addBoosts(CORE_BOOSTS.propertyDamage)
  if (definitionQuery && /交强险|强制险|机动车交通事故责任强制保险/.test(text)) {
    addBoosts([['compulsory-traffic-insurance-regulation', '第三条', 80]])
  }

  for (const [idx, base] of scores) {
    let score = base
    const doc = state.docs[idx]
    if (boostedLawIds.has(doc.law.id)) score += 6
    if (queryArticleN && boostedLawIds.has(doc.law.id) && doc.article.n === queryArticleN) score += 50
    score += coreBoosts.get(`${doc.law.id}:${doc.article.no}`) || 0
    if (!specialCaseQuery && SPECIAL_CASE_RE.test(doc.article.text)) score *= 0.6
    if (trafficIntent && !consumerQuery && CONSUMER_LAW_IDS.has(doc.law.id)) score *= 0.45
    if (!definitionQuery && /下列用语的含义|本条例所称|本法所称|本法中下列用语/.test(doc.article.text)) score *= 0.55
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
