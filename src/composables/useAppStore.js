/**
 * 应用状态管理 Store
 * 使用 Vue 3 Composition API 的组合式函数模式
 * 负责管理全局状态、业务逻辑和用户交互
 */
import { ref, computed } from 'vue'
import { setApiKey, setBaseUrl, DEFAULT_BASE_URL, testConnection, chat } from '../api/index.js'

// ==================== 导航状态 ====================

/** 当前选中的标签页：chat | settings */
const currentTab = ref('chat')

/** 错误消息 */
const errorMsg = ref('')
/** 提示消息 */
const toastMsg = ref('')

// ==================== API 配置状态 ====================

/** API Key */
const apiKey = ref('')
/** API 基础地址 */
const baseUrl = ref(DEFAULT_BASE_URL)
/** 连接状态：'' | 'ok' | 'error' */
const connStatus = ref('')

// ==================== 对话状态 ====================

const CHAT_RESPONSE_PROTOCOL = `当用户需要图像或视频生成提示词时，必须使用以下 Markdown 结构：

## 生图提示词
\`\`\`prompt
只放可直接发送给图像模型的完整正向提示词。
\`\`\`
## 生图反向提示词
\`\`\`negative-prompt
只放需要排除的内容；没有时保持空代码块。
\`\`\`

## 生视频提示词
\`\`\`prompt
只放可直接发送给视频模型的完整正向提示词。
\`\`\`
## 生视频反向提示词
\`\`\`negative-prompt
只放需要排除的内容；没有时保持空代码块。
\`\`\`

普通回答无需使用提示词区块。严禁在其他位置输出可提取提示词，也不要省略标题或代码块。`

/** 新建对话时可选择的固定角色 */
const chatRoles = [
  {
    id: 'default',
    name: '普通对话',
    description: '自然问答与通用协作',
    systemPrompt: '你是一个可靠、自然的通用 AI 助手。直接回答用户问题；只有用户明确需要创作提示词时才提供提示词区块。'
  },
  {
    id: 'prompt-assistant',
    name: '提示词助手',
    description: '将想法转成可生成提示词',
    systemPrompt: '你是专业提示词助手。先澄清创作目标，再给出适合目标媒介的高质量正向与反向提示词，覆盖主体、风格、构图、光线和质感。'
  },
  {
    id: 'visual-director',
    name: '视觉导演',
    description: '定义构图、风格与镜头语言',
    systemPrompt: '你是视觉导演。围绕品牌、受众和情绪提出构图、色彩、光线、镜头和参考方向，并在结尾给出可直接生成的提示词。'
  },
  {
    id: 'storyboard',
    name: '视频分镜师',
    description: '拆解镜头、动作与节奏',
    systemPrompt: '你是视频分镜师。把创意拆成清晰的镜头运动、主体动作、节奏和时长建议，并优先给出可直接用于视频生成的提示词。'
  },
  {
    id: 'brand-copywriter',
    name: '品牌文案师',
    description: '提炼品牌表达与内容方向',
    systemPrompt: '你是品牌文案师。根据品牌、受众和渠道提炼简报、传播主张和文案方向；需要视觉素材时，再给出匹配的生成提示词。'
  }
]

/** 对话会话列表 */
const chatSessions = ref([])
/** 当前激活的会话 ID */
const currentChatSessionId = ref(null)
/** 是否正在发送消息 */
const chatLoading = ref(false)

/**
 * 获取当前激活会话的消息列表
 * @returns {Array} 消息数组
 */
const chatMessages = computed(() => {
  const session = chatSessions.value.find(s => s.id === currentChatSessionId.value)
  return session ? session.messages : []
})

const currentChatRole = computed(() => {
  const session = chatSessions.value.find(s => s.id === currentChatSessionId.value)
  return getChatRole(session?.roleId)
})

// ==================== 初始化 ====================

/**
 * 加载用户设置
 * 从 localStorage 恢复 API Key、基础地址和对话会话
 */
function loadSettings() {
  apiKey.value = localStorage.getItem('agnes_api_key') || 'sk-KFwe3zkKdAkSFvFvnUs1uWlH4pWkFAzBHjqfSKNKsfTJAInc'
  baseUrl.value = localStorage.getItem('agnes_base_url') || DEFAULT_BASE_URL
  setApiKey(apiKey.value)
  setBaseUrl(baseUrl.value)

  const savedSessions = JSON.parse(localStorage.getItem('agnes_chat_sessions') || '[]')
  chatSessions.value = savedSessions.map(session => ({
    ...session,
    roleId: chatRoles.some(role => role.id === session.roleId) ? session.roleId : 'default',
    messages: session.messages.map(msg => ({
      ...msg,
      displayContent: msg.displayContent || msg.content
    }))
  }))
  // 如果有保存的会话，激活第一个；否则创建新会话
  if (savedSessions.length > 0) {
    currentChatSessionId.value = savedSessions[0].id
  } else {
    createChatSession()
  }
}

/**
 * 保存设置到 localStorage
 * @param {string} key - 设置项：api_key | base_url
 */
function saveSetting(key) {
  if (key === 'api_key') {
    localStorage.setItem('agnes_api_key', apiKey.value || '')
    setApiKey(apiKey.value)
  }
  if (key === 'base_url') {
    localStorage.setItem('agnes_base_url', baseUrl.value || '')
    setBaseUrl(baseUrl.value)
  }
}

/**
 * 测试 API 连接状态
 * 调用 /models 接口验证 API Key 是否有效
 */
async function _testConnection() {
  if (!apiKey.value) { connStatus.value = 'error'; return }
  try {
    connStatus.value = await testConnection() ? 'ok' : 'error'
  } catch { connStatus.value = 'error' }
}

/**
 * 导出 Store 接口
 * 返回所有响应式状态和方法
 */
export function useAppStore() {
  return {
    // 导航状态
    currentTab,
    // 通用消息
    errorMsg,
    toastMsg,
    // API 配置
    apiKey,
    baseUrl,
    connStatus,
    // 对话
    chatMessages,
    chatLoading,
    chatRoles,
    currentChatRole,
    // 方法
    loadSettings,
    saveSetting,
    testConnection: _testConnection,
    sendMessage,
    clearChat,
    // 会话管理
    chatSessions,
    currentChatSessionId,
    createChatSession,
    deleteChatSession,
    switchChatSession,
    updateChatSessionTitle,
    getChatRole
  }
}

/**
 * 发送对话消息
 * @param {string} text - 用户输入的消息内容
 */
async function sendMessage(text) {
  if (!apiKey.value) { errorMsg.value = '请先在设置中配置 API Key'; return }
  if (!text.trim()) return

  const session = chatSessions.value.find(s => s.id === currentChatSessionId.value)
  if (!session) return

  chatLoading.value = true

  const userMsg = {
    id: Date.now(),
    role: 'user',
    content: text,
    createdAt: new Date().toISOString()
  }
  session.messages.push(userMsg)

  const assistantMsg = {
    id: Date.now() + 1,
    role: 'assistant',
    content: '',
    displayContent: '',
    createdAt: new Date().toISOString()
  }
  session.messages.push(assistantMsg)

  // 通过 session.messages 索引获取 reactive 引用
  const msgIndex = session.messages.length - 1

  // 更新会话标题（用第一条消息的前20个字符）
  if (session.messages.length === 2) {
    session.title = text.slice(0, 20) + (text.length > 20 ? '...' : '')
  }
  session.updatedAt = new Date().toISOString()
  saveChatSessions()

  try {
    const role = getChatRole(session.roleId)
    const messages = [
      {
        role: 'system',
        content: `${role.systemPrompt}\n\n${CHAT_RESPONSE_PROTOCOL}`
      },
      ...session.messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ]

    await chat({ messages }, (chunk, fullContent) => {
      // SSE 流式期间：用 rAF 节流，避免每个 chunk 都触发响应式更新
      const reactiveMsg = session.messages[msgIndex]
      reactiveMsg.content = fullContent
      if (!reactiveMsg._rafId) {
        reactiveMsg._rafId = requestAnimationFrame(() => {
          reactiveMsg.displayContent = reactiveMsg.content
          reactiveMsg._rafId = null
        })
      }
    })
  } catch (err) {
    console.error(err)
    errorMsg.value = err.message
    const reactiveMsg = session.messages[msgIndex]
    reactiveMsg.content = '抱歉，发生了错误：' + err.message
    reactiveMsg.displayContent = reactiveMsg.content
  } finally {
    chatLoading.value = false
    const reactiveMsg = session.messages[msgIndex]
    if (reactiveMsg._rafId) {
      cancelAnimationFrame(reactiveMsg._rafId)
      reactiveMsg._rafId = null
    }
    reactiveMsg.displayContent = reactiveMsg.content
    saveChatSessions()
  }
}

/**
 * 清空当前对话记录
 */
function clearChat() {
  const session = chatSessions.value.find(s => s.id === currentChatSessionId.value)
  if (!session) return
  if (confirm('确定清空当前对话？')) {
    session.messages = []
    session.title = '新对话'
    session.updatedAt = new Date().toISOString()
    saveChatSessions()
  }
}

/**
 * 保存对话会话到 localStorage
 */
function saveChatSessions() {
  localStorage.setItem('agnes_chat_sessions', JSON.stringify(chatSessions.value))
}

/**
 * 创建新对话会话
 * @returns {object} 新创建的会话对象
 */
function createChatSession(roleId = 'default') {
  const role = getChatRole(roleId)
  const newSession = {
    id: Date.now(),
    title: role.id === 'default' ? '新对话' : `${role.name}对话`,
    roleId: role.id,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  chatSessions.value.unshift(newSession)
  currentChatSessionId.value = newSession.id
  saveChatSessions()
  return newSession
}

/**
 * 删除对话会话
 * @param {string} sessionId - 会话 ID
 */
function deleteChatSession(sessionId) {
  const idx = chatSessions.value.findIndex(s => s.id === sessionId)
  if (idx === -1) return

  if (!confirm('确定删除该对话？')) return

  chatSessions.value.splice(idx, 1)
  saveChatSessions()

  // 如果删除的是当前激活的会话，切换到第一个或创建新会话
  if (sessionId === currentChatSessionId.value) {
    if (chatSessions.value.length > 0) {
      currentChatSessionId.value = chatSessions.value[0].id
    } else {
      createChatSession()
    }
  }
}

/**
 * 切换到指定会话
 * @param {string} sessionId - 会话 ID
 */
function switchChatSession(sessionId) {
  currentChatSessionId.value = sessionId
}

/**
 * 更新会话标题
 * @param {string} sessionId - 会话 ID
 * @param {string} title - 新标题
 */
function updateChatSessionTitle(sessionId, title) {
  const session = chatSessions.value.find(s => s.id === sessionId)
  if (session) {
    session.title = title
    session.updatedAt = new Date().toISOString()
    saveChatSessions()
  }
}

function getChatRole(roleId = 'default') {
  return chatRoles.find(role => role.id === roleId) || chatRoles[0]
}
