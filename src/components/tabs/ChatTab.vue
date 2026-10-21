<template>
  <div class="chat-tab">
    <!-- 会话侧边栏 -->
    <div class="sessions-sidebar">
      <div class="sessions-header">
        <div class="sessions-heading">
          <span class="eyebrow">CASE FILES</span>
          <h3>案卷目录</h3>
        </div>
        <button class="new-session-btn" @click="rolePickerOpen = true" title="新建对话">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>新建</span>
        </button>
      </div>
      <div class="sessions-list">
        <div
          v-for="session in store.chatSessions.value"
          :key="session.id"
          :class="['session-item', { active: session.id === store.currentChatSessionId.value }]"
          @click="store.switchChatSession(session.id)"
        >
          <div class="session-info">
            <div class="session-title">{{ session.title }}</div>
            <div class="session-meta">
              <span class="session-role">{{ store.getChatRole(session.roleId).name }}</span>
              {{ session.messages.length }} 条消息
            </div>
          </div>
          <button class="btn-icon delete-btn" @click.stop="store.deleteChatSession(session.id)" title="删除对话">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 对话主区域 -->
    <div class="chat-main">
      <div class="chat-header">
        <div class="header-title">
          <span class="eyebrow">CONVERSATION · 对话卷宗</span>
          <h2>{{ store.currentChatRole.value.name }}</h2>
          <p class="page-desc">{{ store.currentChatRole.value.description }}</p>
        </div>
        <div class="header-actions">
          <button v-if="store.chatMessages.value.length > 0" class="btn-secondary" @click="store.clearChat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            清空对话
          </button>
        </div>
      </div>

      <div class="chat-container">
        <div ref="messagesContainer" class="messages-list">
          <div v-if="store.chatMessages.value.length === 0" class="empty-chat">
            <div class="empty-mark" aria-hidden="true"></div>
            <p class="empty-title">先查来源，再下结论。</p>
            <p class="empty-hint">选择「法律顾问」陈述事实与争议焦点，或上传合同、判决书交给「文档阅读」提炼要点。</p>
            <p class="empty-note">AI 输出仅供参考 · 不构成正式法律意见</p>
          </div>

          <div
            v-for="(msg, idx) in store.chatMessages.value"
            :key="msg.id || idx"
            :class="['message-item', msg.role]"
          >
            <div class="message-avatar" aria-hidden="true">{{ msg.role === 'user' ? '你' : '卢' }}</div>
            <div class="message-content">
              <div class="message-header">
                <span class="role-label">{{ msg.role === 'user' ? '你' : `小卢 · ${store.currentChatRole.value.name}` }}</span>
                <span v-if="msg.role === 'assistant'" class="model-label">AI 生成</span>
              </div>
              <div class="message-body" v-html="renderMessage(msg, idx)"></div>
              <div v-if="msg.attachmentName" class="message-attachment">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                {{ msg.attachmentName }}
              </div>
              <div v-if="msg.citationChecks?.length" class="citation-check">
                <div class="citation-head">
                  <span class="citation-heading">本地法条核验</span>
                  <span class="citation-summary">{{ verifiedCount(msg.citationChecks) }} / {{ msg.citationChecks.length }} 条匹配</span>
                </div>
                <div v-for="(check, ci) in msg.citationChecks" :key="ci" class="citation-item" :class="check.status">
                  <span class="citation-status">{{ citationLabel(check.status) }}</span>
                  <div class="citation-detail">
                    <div class="citation-ref" :title="check.lawTitle">《{{ check.law }}》{{ check.articleLabel }}</div>
                    <p v-if="check.snippet" class="citation-snippet">{{ check.snippet }}</p>
                    <p v-else class="citation-snippet">{{ check.status === 'law-missing' ? '本地法条库未收录该法律，请以国家法律法规数据库的官方文本为准。' : '本地法条库未收录该条文，请以国家法律法规数据库的官方文本为准。' }}</p>
                  </div>
                </div>
                <p class="citation-foot">核验依据：本地法条库（整理自国家法律法规数据库）</p>
              </div>
              <div v-if="msg.relatedCases?.length || msg.casesChecked" class="case-check">
                <div class="case-head">
                  <span class="case-heading">相关案例</span>
                  <span class="case-summary">本地案例库 · 最多 3 条</span>
                </div>
                <a
                  v-for="item in msg.relatedCases"
                  :key="item.id"
                  class="case-item"
                  :href="item.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div class="case-meta">
                    <span class="case-tag">{{ caseLabel(item) }}</span>
                    <span v-if="item.caseNumber" class="case-no">{{ item.caseNumber }}</span>
                    <span v-if="item.type === 'gazette' && item.publishedAt" class="case-no">{{ item.publishedAt }}{{ item.issueNo ? `年第${item.issueNo}期` : '年' }}</span>
                    <span v-if="item.court" class="case-court">{{ item.court }}</span>
                  </div>
                  <div class="case-title">{{ item.title }}</div>
                  <p class="case-snippet">{{ item.snippet }}</p>
                  <span class="case-source">最高人民法院官网 →</span>
                </a>
                <p v-if="!msg.relatedCases?.length" class="case-empty">本地案例库未检索到相近案例，未生成推测性案例。</p>
                <p class="case-foot">案例来源：最高人民法院指导性案例 / 公报案例（本地检索，不由模型生成）</p>
              </div>
              <div v-if="msg.role === 'assistant' && store.chatLoading.value && idx === store.chatMessages.value.length - 1 && !(msg.displayContent || msg.content)" class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <div class="input-wrapper">
            <div v-if="pendingFile" class="attachment-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <span class="attachment-name">{{ pendingFile.name }}</span>
              <span class="attachment-meta">{{ pendingFile.truncated ? '内容过长，已截取前 6 万字' : `${pendingFile.text.length} 字` }}</span>
              <button class="attachment-remove" title="移除附件" @click="clearPendingFile">×</button>
            </div>
            <textarea
              v-model="inputMessage"
              placeholder="输入问题或陈述事实，Enter 发送..."
              rows="3"
              @keydown.enter="sendMessage"
              :disabled="store.chatLoading.value"
            ></textarea>
            <button class="clear-input" v-if="inputMessage" @click="inputMessage = ''">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
          <div class="input-actions">
            <div class="input-tools">
              <input ref="fileInput" type="file" accept=".txt,.md,.markdown,.csv,.json,.log,.pdf,.docx" hidden @change="handleFileChange">
              <button class="attach-btn" :disabled="store.chatLoading.value || readingFile" :title="readingFile ? '正在解析文档' : '上传文档'" @click="fileInput.click()">
                <svg v-if="!readingFile" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <svg v-else class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </button>
              <span class="attach-hint">{{ readingFile ? '正在解析文档...' : '支持 PDF / DOCX / TXT，最大 20MB' }}</span>
            </div>
            <button class="btn-primary send-btn" @click="sendMessage" :disabled="(!inputMessage.trim() && !pendingFile) || store.chatLoading.value || readingFile">
              <svg v-if="!store.chatLoading.value" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/>
              </svg>
              <svg v-else class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              {{ store.chatLoading.value ? '思考中...' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="rolePickerOpen" class="role-picker-mask" @click.self="rolePickerOpen = false">
      <section class="role-picker" role="dialog" aria-modal="true" aria-labelledby="role-picker-title">
        <div class="role-picker-header">
          <div>
            <span class="role-picker-eyebrow">NEW CONVERSATION</span>
            <h3 id="role-picker-title">选择对话角色</h3>
          </div>
          <button class="btn-icon" title="关闭" @click="rolePickerOpen = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 6-12 12M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="role-grid">
          <button v-for="role in store.chatRoles" :key="role.id" class="role-card" @click="createRoleSession(role.id)">
            <strong>{{ role.name }}</strong>
            <span>{{ role.description }}</span>
          </button>
        </div>
        <p class="role-picker-note">法律顾问会标注可核查依据；无法确认时将明确提示“待核实”。</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { marked } from 'marked'
import { useAppStore } from '../../composables/useAppStore.js'
import { readDocument } from '../../utils/readDocument.js'

const store = useAppStore()
const inputMessage = ref('')
const messagesContainer = ref(null)
const rolePickerOpen = ref(false)
const fileInput = ref(null)
const pendingFile = ref(null)
const readingFile = ref(false)

function createRoleSession(roleId) {
  store.createChatSession(roleId)
  rolePickerOpen.value = false
}

async function handleFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  readingFile.value = true
  try {
    pendingFile.value = { name: file.name, ...(await readDocument(file)) }
  } catch (err) {
    pendingFile.value = null
    store.errorMsg.value = err.message || '文件解析失败'
  } finally {
    readingFile.value = false
  }
}

function clearPendingFile() {
  pendingFile.value = null
}

const CITATION_LABELS = {
  verified: '已核实',
  'not-found': '本地未找到',
  'law-missing': '法律未收录'
}

function citationLabel(status) {
  return CITATION_LABELS[status] || '待核实'
}

function caseLabel(item) {
  return item.type === 'guiding' ? `指导案例${item.number}号` : '公报案例'
}

function verifiedCount(checks) {
  return checks.filter(check => check.status === 'verified').length
}

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

/**
 * 渲染消息内容
 * 推送中：增量更新（只处理新增部分），避免重复扫描全文
 * 推送完成后：完整 Markdown 渲染（带缓存）
 */
const renderCache = new WeakMap()

function renderMessage(msg, idx) {
  const content = msg.displayContent || msg.content
  if (!content) return ''

  const isLastAssistant = msg.role === 'assistant' && idx === store.chatMessages.value.length - 1
  const isStreaming = isLastAssistant && store.chatLoading.value

  if (isStreaming) {
    // 推送中：增量更新，只处理新增部分
    const cached = renderCache.get(msg)
    if (cached && cached.source.length <= content.length && content.startsWith(cached.source)) {
      // 只处理新增部分
      const newPart = content.slice(cached.source.length)
      const newHtml = newPart.replace(/\n/g, '<br>')
      cached.source = content
      cached.html = cached.html + newHtml
      return cached.html
    }
    // 缓存失效（内容回退或首次）：全量处理
    const html = content.replace(/\n/g, '<br>')
    renderCache.set(msg, { source: content, html })
    return html
  }

  // 推送完成：Markdown 渲染（带缓存）
  if (msg.role === 'assistant') {
    const cached = renderCache.get(msg)
    if (cached && cached.source === content && cached.completed) {
      return cached.html
    }
    const html = marked.parse(content)
    renderCache.set(msg, { source: content, html, completed: true })
    return html
  }

  // 用户消息：简单文本
  return content.replace(/\n/g, '<br>')
}

async function sendMessage() {
  if (store.chatLoading.value || readingFile.value) return

  const attachment = pendingFile.value
  const text = inputMessage.value.trim() || (attachment ? `请阅读《${attachment.name}》并总结主要内容。` : '')
  if (!text) return

  await store.sendMessage(text, attachment)
  inputMessage.value = ''
  pendingFile.value = null
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// 监听消息内容变化（推送过程中频繁更新）
watch(() => {
  const msgs = store.chatMessages.value
  if (msgs.length === 0) return 0
  const last = msgs[msgs.length - 1]
  return (last.displayContent || last.content || '').length
}, () => {
  scrollToBottom()
})

// 监听消息数量变化
watch(() => store.chatMessages.value.length, () => {
  scrollToBottom()
})

onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-tab {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  animation: tab-enter 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes tab-enter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.2em;
  color: var(--bronze);
  text-transform: uppercase;
}

/* ===== 案卷目录 ===== */
.sessions-sidebar {
  width: 252px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sessions-header {
  padding: 1.05rem 1.1rem 0.85rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.6rem;
}

.sessions-heading {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.sessions-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.04em;
}

.new-session-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0;
  background: transparent;
  border: none;
  color: var(--cinnabar);
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease;
}

.new-session-btn:hover {
  color: var(--cinnabar-dark);
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.session-item {
  padding: 0.7rem 0.9rem;
  border-left: 2px solid transparent;
  border-bottom: 1px solid rgba(185, 174, 153, 0.35);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.session-item:hover {
  background: rgba(251, 248, 241, 0.72);
}

.session-item.active {
  background: var(--bg-card);
  border-left-color: var(--cinnabar);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  font-family: var(--font-mono);
  font-size: 0.63rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
  letter-spacing: 0.02em;
}

.session-role {
  color: var(--bronze);
  margin-right: 0.3rem;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: var(--radius-sm);
  transition: color 0.2s ease, background 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.session-item:hover .delete-btn,
.session-item.active .delete-btn {
  opacity: 1;
}

/* ===== 对话主区域 ===== */
.chat-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.2rem 1.5rem 0;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  /* gap: 1rem; */
  flex-wrap: wrap;
  /* padding-bottom: 0.85rem; */
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-title {
  min-width: 0;
}

.header-title h2 {
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.02em;
  margin: 0.12rem 0 0.15rem;
  line-height: 1;
}

.page-desc {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.4rem;
}

.chat-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.messages-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.4rem 0.15rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

/* ===== 空白卷宗 ===== */
.empty-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 1rem;
}

.empty-mark {
  width: 34px;
  height: 2px;
  background: var(--cinnabar);
  margin-bottom: 1.25rem;
}

.empty-title {
  font-family: var(--font-serif);
  font-size: 1.42rem;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.06em;
}

.empty-hint {
  max-width: 430px;
  margin-top: 0.65rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.85;
}

.empty-note {
  margin-top: 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: var(--bronze);
}

/* ===== 消息 ===== */
.message-item {
  display: flex;
  gap: 0.85rem;
  animation: message-enter 0.28s ease;
}

@keyframes message-enter {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.8rem;
  line-height: 1;
}

.message-item.assistant .message-avatar {
  background: var(--cinnabar);
  border-color: var(--cinnabar);
  color: #fbf8f1;
  box-shadow: inset 0 0 0 1px rgba(251, 248, 241, 0.45);
}

.message-content {
  min-width: 0;
  max-width: 82%;
}

.message-item.user .message-content {
  max-width: 72%;
  padding: 0.75rem 0.95rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.message-item.assistant .message-content {
  padding-left: 1rem;
  border-left: 1px solid var(--border-strong);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.role-label {
  font-family: var(--font-mono);
  font-size: 0.63rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--bronze);
}

.message-item.user .role-label {
  color: var(--text-muted);
}

.model-label {
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.06rem 0.3rem;
  line-height: 1.5;
}

.message-body {
  font-size: 0.92rem;
  line-height: 1.85;
  color: var(--ink);
  word-wrap: break-word;
}

.message-attachment {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.55rem;
  padding: 0.22rem 0.5rem;
  background: var(--cinnabar-soft);
  border: 1px solid rgba(154, 46, 36, 0.16);
  border-radius: var(--radius-sm);
  color: var(--cinnabar-dark);
  font-size: 0.7rem;
  word-break: break-all;
}

/* ===== 法条核验 ===== */
.citation-check {
  margin-top: 0.9rem;
  padding: 0.7rem 0.85rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-left: 2px solid var(--bronze);
}

.citation-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--border-color);
}

.citation-heading {
  font-family: var(--font-mono);
  font-size: 0.63rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--bronze);
}

.citation-summary {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
}

.citation-item {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.55rem 0;
  border-bottom: 1px dashed rgba(185, 174, 153, 0.42);
}

.citation-item:last-of-type {
  border-bottom: none;
}

.citation-status {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.3rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  white-space: nowrap;
}

.citation-item.verified .citation-status {
  color: var(--success);
}

.citation-item.not-found .citation-status {
  color: var(--bronze);
}

.citation-item.law-missing .citation-status {
  color: var(--cinnabar);
}

.citation-detail {
  min-width: 0;
}

.citation-ref {
  font-family: var(--font-serif);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink);
}

.citation-snippet {
  margin-top: 0.2rem;
  font-size: 0.73rem;
  line-height: 1.65;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.citation-foot {
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

/* ===== 相关案例 ===== */
.case-check {
  margin-top: 0.7rem;
  padding: 0.7rem 0.85rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-left: 2px solid var(--cinnabar);
}

.case-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--border-color);
}

.case-heading {
  font-family: var(--font-mono);
  font-size: 0.63rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--cinnabar);
}

.case-summary {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
}

.case-item {
  display: block;
  padding: 0.6rem 0;
  border-bottom: 1px dashed rgba(185, 174, 153, 0.42);
  color: inherit;
  text-decoration: none;
}

.case-item:last-of-type {
  border-bottom: none;
}

.case-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.55rem;
  margin-bottom: 0.28rem;
}

.case-tag {
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.03em;
  padding: 0.08rem 0.3rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  color: var(--cinnabar-dark);
  white-space: nowrap;
}

.case-no,
.case-court {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: var(--text-muted);
}

.case-court {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.case-title {
  font-family: var(--font-serif);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.55;
  color: var(--ink);
  transition: color 0.15s ease;
}

.case-snippet {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  line-height: 1.65;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.case-source {
  display: inline-block;
  margin-top: 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  color: var(--bronze);
  transition: color 0.15s ease;
}

.case-item:hover .case-title,
.case-item:focus-visible .case-title,
.case-item:hover .case-source,
.case-item:focus-visible .case-source {
  color: var(--cinnabar);
}

.case-empty {
  padding: 0.65rem 0 0.2rem;
  font-size: 0.73rem;
  color: var(--text-muted);
}

.case-foot {
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

/* Markdown 渲染样式 */
.message-body :deep(p) {
  margin: 0.55rem 0;
}

.message-body :deep(p:first-child) {
  margin-top: 0;
}

.message-body :deep(p:last-child) {
  margin-bottom: 0;
}

.message-body :deep(h1),
.message-body :deep(h2),
.message-body :deep(h3),
.message-body :deep(h4) {
  font-family: var(--font-serif);
  margin: 1.1rem 0 0.5rem;
  font-weight: 600;
  line-height: 1.45;
  color: var(--ink);
}

.message-body :deep(h1) { font-size: 1.3rem; }
.message-body :deep(h2) { font-size: 1.15rem; }
.message-body :deep(h3) { font-size: 1.04rem; }

.message-body :deep(ul),
.message-body :deep(ol) {
  padding-left: 1.45rem;
  margin: 0.5rem 0;
}

.message-body :deep(li) {
  margin: 0.3rem 0;
}

.message-body :deep(blockquote) {
  border-left: 2px solid var(--cinnabar);
  padding: 0.5rem 0.9rem;
  margin: 0.6rem 0;
  background: var(--cinnabar-soft);
  color: var(--text-secondary);
}

.message-body :deep(code) {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.08rem 0.32rem;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.message-body :deep(pre) {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.85rem 1rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 0.6rem 0;
}

.message-body :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  line-height: 1.65;
}

.message-body :deep(table) {
  border-collapse: collapse;
  margin: 0.6rem 0;
  width: 100%;
  font-size: 0.84rem;
}

.message-body :deep(th),
.message-body :deep(td) {
  border: 1px solid var(--border-color);
  padding: 0.45rem 0.65rem;
  text-align: left;
}

.message-body :deep(th) {
  background: var(--bg-secondary);
  font-family: var(--font-serif);
  font-weight: 600;
}

.message-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1rem 0;
}

.message-body :deep(a) {
  color: var(--cinnabar);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message-body :deep(a:hover) {
  color: var(--cinnabar-dark);
}

.message-body :deep(strong) {
  font-weight: 700;
  color: var(--ink);
}

.message-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-sm);
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding-top: 0.45rem;
}

.typing-dot {
  width: 5px;
  height: 5px;
  background: var(--cinnabar);
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* ===== 输入区 ===== */
.chat-input-area {
  flex-shrink: 0;
  padding: 0.1rem 0 0.2rem;
  border-top: 1px solid var(--border-color);
  background: transparent;
}

.input-wrapper {
  position: relative;
  margin-bottom: 0.1rem;
}

.attachment-chip {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.5rem;
  padding: 0.38rem 0.65rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--bronze);
  font-size: 0.76rem;
  width: fit-content;
  max-width: 100%;
}

.attachment-name {
  color: var(--ink);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-meta {
  font-family: var(--font-mono);
  color: var(--text-muted);
  font-size: 0.64rem;
  white-space: nowrap;
}

.attachment-remove {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.15rem;
}

.attachment-remove:hover {
  color: var(--cinnabar);
}

.input-wrapper textarea {
  width: 100%;
  padding: 1rem;
  padding-right: 2.4rem;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-family: var(--font-sans);
  line-height: 1.2;
  resize: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.input-wrapper textarea:focus {
  outline: none;
  border-color: var(--cinnabar);
  background: var(--bg-input-focus);
  box-shadow: 0 0 0 3px var(--cinnabar-soft);
}

.input-wrapper textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-wrapper textarea::placeholder {
  color: var(--text-muted);
}

.clear-input {
  position: absolute;
  right: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: color 0.2s ease, background 0.2s ease;
}

.clear-input:hover {
  color: var(--cinnabar);
  background: var(--cinnabar-soft);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.input-tools {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.attach-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.attach-btn:hover:not(:disabled) {
  border-color: var(--cinnabar);
  color: var(--cinnabar);
  background: var(--cinnabar-soft);
}

.attach-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.attach-hint {
  font-family: var(--font-mono);
  font-size: 0.61rem;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.send-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.spin-icon {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 角色选择 ===== */
.role-picker-mask {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(31, 36, 43, 0.45);
  backdrop-filter: blur(4px);
}

.role-picker {
  width: min(760px, 100%);
  padding: 1.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  position: relative;
}

.role-picker::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--cinnabar);
}

.role-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.role-picker-eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--bronze);
}

.role-picker h3 {
  margin-top: 0.2rem;
  font-size: 1.25rem;
  color: var(--ink);
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.role-card {
  min-height: 112px;
  padding: 0.95rem;
  color: var(--ink);
  text-align: left;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.role-card:hover {
  border-color: var(--cinnabar);
  background: var(--bg-card);
  box-shadow: inset 2px 0 0 var(--cinnabar);
}

.role-card strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 0.98rem;
  font-weight: 600;
}

.role-card span {
  display: block;
  margin-top: 0.35rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.65;
}

.role-picker-note {
  margin-top: 1.1rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--border-color);
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ===== 移动端 ===== */
@media (max-width: 900px) {
  .chat-tab {
    flex-direction: column;
  }

  .sessions-sidebar {
    width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .sessions-header {
    padding: 0.7rem 0.9rem 0.6rem;
  }

  .sessions-list {
    display: flex;
    gap: 0.35rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0.75rem 0.65rem;
    flex: none;
  }

  .session-item {
    min-width: 185px;
    max-width: 220px;
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--border-color);
    border-left-width: 2px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-card);
  }

  .session-item.active {
    border-color: var(--cinnabar);
  }

  .chat-main {
    flex: 1;
    min-height: 0;
    padding: 1rem 1rem 0;
  }

  .chat-container {
    flex: 1;
    min-height: 0;
  }

  .messages-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .message-item.user .message-content {
    max-width: 88%;
  }

  .message-item.assistant .message-content {
    max-width: 92%;
  }

  .chat-header {
    align-items: flex-start;
    gap: 0.6rem;
  }

  .header-title h2 {
    font-size: 1.45rem;
  }

  .role-grid {
    grid-template-columns: 1fr;
  }

  .role-picker {
    width: min(560px, 100%);
    padding: 1.15rem;
    max-height: calc(100vh - 3rem);
    overflow-y: auto;
  }

  .role-card {
    min-height: 0;
  }
}

@media (max-width: 560px) {
  .attach-hint { display: none; }
  .empty-title { font-size: 1.2rem; }
  .empty-hint { font-size: 0.8rem; }
  .chat-main { padding: 0.85rem 0.75rem 0; }
  .chat-input-area { padding: 0.75rem 0 0.85rem; }
  .message-avatar { width: 26px; height: 26px; font-size: 0.72rem; }
  .message-content { max-width: 86%; }
  .message-item.user .message-content { max-width: 90%; }
}

@media (hover: none) {
  .delete-btn { opacity: 1; }
}
</style>
