<template>
  <header class="app-header">
    <div class="header-inner">
      <div class="logo-section">
        <div class="logo-icon" aria-hidden="true">卢</div>
        <div class="logo-text">
          <h1>法律AI助手<span class="wordmark-name">-小卢</span></h1>
          <span class="subtitle">LEGAL AI COUNSEL</span>
        </div>
      </div>
      <div class="header-right">
        <nav class="header-nav" aria-label="主导航">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['nav-btn', { active: currentTab === tab.key }]"
            @click="$emit('switch-tab', tab.key)"
          >
            <svg class="nav-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="tab.svg"></svg>
            <span>{{ tab.label }}</span>
          </button>
        </nav>
        <span class="header-divider" aria-hidden="true"></span>
        <button
          class="theme-toggle"
          type="button"
          :title="theme === 'night' ? '切换到纸卷主题' : '切换到夜读主题'"
          :aria-label="theme === 'night' ? '切换到纸卷主题' : '切换到夜读主题'"
          @click="toggleTheme"
        >
          <svg v-if="theme === 'night'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <span>{{ theme === 'night' ? '纸卷' : '夜读' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useTheme } from '../../composables/useTheme.js'

defineProps(['currentTab'])
defineEmits(['switch-tab'])

const { theme, toggleTheme } = useTheme()

const tabs = [
  {
    key: 'chat',
    label: '对话',
    svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
  },
  {
    key: 'settings',
    label: '设置',
    svg: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
  }
]
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-header);
  backdrop-filter: blur(10px) saturate(1.05);
  -webkit-backdrop-filter: blur(10px) saturate(1.05);
  border-bottom: 3px double var(--border-strong);
  padding: 0 2rem;
}

.header-inner {
  max-width: 1320px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.logo-icon {
  width: 38px;
  height: 38px;
  background: var(--cinnabar-solid);
  color: var(--on-accent);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: inset 0 0 0 2px var(--on-accent-seal);
  transition: background 0.2s ease;
}

.logo-icon:hover {
  background: var(--cinnabar-solid-hover);
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.logo-text h1 {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.03em;
  line-height: 1.2;
}

.wordmark-name {
  color: var(--cinnabar);
}

.logo-text .subtitle {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  color: var(--bronze);
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}

.header-divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.theme-toggle:hover {
  color: var(--cinnabar);
  border-color: var(--cinnabar);
  background: var(--cinnabar-soft);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 1.9rem;
  background: transparent;
  padding: 0;
  border: none;
  border-radius: 0;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0;
  margin: 0;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-serif);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.nav-btn:hover {
  color: var(--ink);
  background: transparent;
}

.nav-btn.active {
  color: var(--cinnabar);
  border-bottom-color: var(--cinnabar);
  background: transparent;
  box-shadow: none;
}

.nav-icon-svg {
  opacity: 0.8;
}

@media (max-width: 768px) {
  .app-header { padding: 0 1.1rem; }
  .header-inner { height: 60px; }
  .logo-icon { width: 32px; height: 32px; font-size: 1.05rem; }
  .logo-text h1 { font-size: 1.08rem; }
  .logo-text .subtitle { display: none; }
  .header-right { gap: 0.9rem; }
  .header-nav { gap: 1.2rem; }
  .nav-btn { font-size: 0.88rem; }
  .theme-toggle { padding: 0.32rem; }
  .theme-toggle span { display: none; }
}

@media (max-width: 480px) {
  .header-nav { gap: 0.9rem; }
  .nav-btn { font-size: 0.82rem; }
  .nav-icon-svg { display: none; }
  .header-divider { display: none; }
  .header-right { gap: 0.7rem; }
}
</style>
