import { ref } from 'vue'

const THEME_KEY = 'agnes_theme'
const theme = ref('paper')

function normalizeTheme(value) {
  return value === 'night' ? 'night' : 'paper'
}

function applyTheme(value, persist = true) {
  theme.value = normalizeTheme(value)
  document.documentElement.dataset.theme = theme.value
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.value === 'night' ? '#17140f' : '#f4f0e6')
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme.value)
    } catch {
      // localStorage 不可用时仅当前会话生效
    }
  }
  window.electronAPI?.setTheme?.(theme.value)
}

export function initTheme() {
  let saved = 'paper'
  try {
    saved = localStorage.getItem(THEME_KEY) || 'paper'
  } catch {
    // 使用默认纸卷主题
  }
  applyTheme(saved, false)
}

export function useTheme() {
  return {
    theme,
    toggleTheme: () => applyTheme(theme.value === 'night' ? 'paper' : 'night'),
    setTheme: (value) => applyTheme(value)
  }
}
