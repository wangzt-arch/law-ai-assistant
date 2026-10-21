<template>
  <div class="settings-tab">
    <div class="settings-card card">
      <div class="settings-header">
        <div class="settings-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="settings-heading">
          <span class="settings-eyebrow">CONFIGURATION · 系统配置</span>
          <h2>接口配置</h2>
        </div>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <div class="input-wrap">
          <input
            v-model="store.apiKey.value"
            type="password"
            placeholder="sk-xxxxxxxxxxx"
            @input="store.saveSetting('api_key')"
          >
          <div class="input-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>API 地址</label>
        <div class="input-wrap">
          <input
            v-model="store.baseUrl.value"
            type="text"
            :placeholder="DEFAULT_BASE_URL"
            @input="store.saveSetting('base_url')"
          >
          <div class="input-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="test-section">
        <button class="btn-secondary" @click="store.testConnection">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          测试连接
        </button>
        <Transition name="fade">
          <span v-if="store.connStatus.value" :class="['status-text', store.connStatus.value === 'ok' ? 'success' : 'error']">
            {{ store.connStatus.value === 'ok' ? '连接成功' : '连接失败' }}
          </span>
        </Transition>
      </div>

      <div class="info-box">
        <div class="info-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>
          </svg>
          <h4>说明</h4>
        </div>
        <ul>
          <li>API Key 与对话记录保存在浏览器本地，不会同步到本项目服务器</li>
          <li>对话内容与上传文档会发送至你配置的 API 服务，请先脱敏</li>
          <li>对话内容会实时保存在浏览器中，切换会话不会丢失</li>
          <li>网络错误或限流时，客户端会自动进行指数退避重试</li>
          <li>本地法条库：{{ corpusLawCount }} 部法律文件，共 {{ corpusArticleCount }} 条（更新于 {{ corpusMeta.generatedAt }}）</li>
          <li>本地案例库：{{ caseCorpusMeta.guidingCount }} 件指导性案例 + {{ caseCorpusMeta.gazetteCount }} 件公报案例（更新于 {{ caseCorpusMeta.generatedAt }}）</li>
          <li>法律顾问的引用会做本地核验；未匹配的条文会标记为“待核实”</li>
          <li>回答后会从本地案例库检索最多 3 条相关案例，不由模型生成</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from '../../composables/useAppStore.js'
import { DEFAULT_BASE_URL } from '../../api/index.js'
import corpusMeta from '../../data/legal-corpus-index.json'
import caseCorpusMeta from '../../data/legal-cases-index.json'

const store = useAppStore()
const corpusLawCount = corpusMeta.laws.length
const corpusArticleCount = corpusMeta.laws.reduce((sum, law) => sum + law.articleCount, 0)
</script>

<style scoped>
.settings-tab {
  animation: tab-enter 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes tab-enter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-card {
  max-width: 620px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.7rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--border-color);
}

.settings-icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--cinnabar);
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.2em;
  color: var(--bronze);
  text-transform: uppercase;
  margin-bottom: 0.15rem;
}

.settings-header h2 {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.02em;
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 2.75rem;
}

.input-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.test-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.4rem 0;
  padding-top: 1.2rem;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.status-text {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  transition: all 0.25s ease;
}

.status-text.success {
  color: var(--success);
  background: rgba(63, 106, 78, 0.08);
  border: 1px solid rgba(63, 106, 78, 0.24);
}

.status-text.error {
  color: var(--danger);
  background: var(--cinnabar-soft);
  border: 1px solid rgba(154, 46, 36, 0.24);
}

.info-box {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 1.2rem 1.3rem;
  margin-top: 1.5rem;
  border: 1px solid var(--border-color);
  border-left: 2px solid var(--bronze);
}

.info-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--bronze);
}

.info-header h4 {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink);
}

.info-box ul {
  padding-left: 1.25rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.info-box li {
  margin-bottom: 0.45rem;
  line-height: 1.7;
}

.info-box li:last-child { margin-bottom: 0; }

.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
