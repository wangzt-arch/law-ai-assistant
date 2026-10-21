const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const CN_UNITS = { 十: 10, 百: 100, 千: 1000 }

let segmenter = null
try {
  segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'word' })
} catch {
  segmenter = null
}

export function parseCnNumber(input) {
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

export function normalizeLawName(name) {
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

export function compactText(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

export function tokenize(text) {
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
