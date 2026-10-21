/**
 * 应用状态管理 Store
 * 使用 Vue 3 Composition API 的组合式函数模式
 * 负责管理全局状态、业务逻辑和用户交互
 */
import { ref, computed } from "vue";
import {
  setApiKey,
  setBaseUrl,
  DEFAULT_BASE_URL,
  testConnection,
  chat,
} from "../api/index.js";
import {
  searchLegalArticles,
  verifyCitations,
  inspectQueryCitations,
} from "../utils/legalCorpus.js";
import { searchRelatedCases } from "../utils/legalCases.js";

const LEGAL_CITATION_GUARD = `回答涉及法律条文时，必须遵守：
1. 只依据后面提供的“本地法条库”资料引用法律名称、条号和条文内容；资料中没有的条号、内容或版本信息，不得凭记忆补充。
2. 用户提到的条号如果在资料中查无此条，直接说明“本地法条库查无此条/未收录”，不得猜测其内容，也不得用其他条号替代。
3. 引用格式为《法律全称》第X条；无法确认时标注“待核实”，并提示以国家法律法规数据库官方文本为准。
4. 不得根据旧版本编号作答；不同修正版本的条号可能不同。`;

// ==================== 导航状态 ====================

/** 当前选中的标签页：chat | settings */
const currentTab = ref("chat");

/** 错误消息 */
const errorMsg = ref("");
/** 提示消息 */
const toastMsg = ref("");

// ==================== API 配置状态 ====================

/** API Key */
const apiKey = ref("");
/** API 基础地址 */
const baseUrl = ref(DEFAULT_BASE_URL);
/** 连接状态：'' | 'ok' | 'error' */
const connStatus = ref("");

// ==================== 对话状态 ====================

/** 新建对话时可选择的固定角色 */
const chatRoles = [
  {
    id: "legal",
    name: "法律顾问",
    description: "基于可核查来源的法律分析",
    temperature: 0.2,
    systemPrompt: `你是一名严谨的中国法律分析助手。回答必须遵守以下规则：
1. 来源可核查：涉及法律条文、司法解释、案例或裁判规则时，必须给出可核查的来源（法律法规或司法解释全称 + 条款号；案例需给出案号或官方发布名称）。不得编造法条、案号、发布机关、链接或案例。
2. 无法核实时：如果你不能确认某项依据的现行有效性或具体内容，必须标注“待核实”，并说明应在国家法律法规数据库、最高人民法院官网等权威渠道核对；不得用猜测填补。
3. 区分层次：明确区分“现行法律规定”“司法实践观点”“一般性分析/建议”。对存在地区差异、时效变化或学理争议的问题，说明不确定性；存在多种观点时，筛选并说明采信理由，优先采用现行有效、层级较高的规范。
4. 回答结构：先给结论；再列法律依据（来源 + 条款）；然后结合事实分析；最后给出实务建议和风险提示。
5. 不做绝对承诺：不预测裁判结果，不代替律师出具正式法律意见；涉及具体案件时，提示由执业律师结合证据复核。
6. 交通事故专项：按“责任认定 → 交强险/商业险赔付 → 人身或财产损害赔偿 → 调解或诉讼途径”的顺序分析；涉及上下班途中事故时，同时判断工伤认定条件。不得臆造事故责任比例、赔偿标准或金额，计算时必须写明依据、公式和假设（如伤残等级、收入、住院天数）。
7. 不要自行编造、列举或推荐具体案例；相关案例由系统从本地案例库单独检索展示。不得虚构案号、审理法院或裁判结果。`,
  },
  {
    id: "general",
    name: "基础问答",
    description: "通用问题解答与信息整理",
    temperature: 0.6,
    systemPrompt: `你是一个严谨、克制的通用 AI 助手。回答先给结论，再给必要的依据、步骤或示例；表达清晰、简洁。
- 只陈述你能够确认的信息；不确定时明确说明“不确定”或“无法确认”，并指出还需要哪些信息。
- 不得编造事实、数据、引文或来源；无法提供来源时直接说明。
- 涉及需要实时核验的信息（政策、价格、时效等）时，提醒用户以权威渠道为准。`,
  },
  {
    id: "document",
    name: "文档阅读",
    description: "阅读上传的文档并总结主要内容",
    temperature: 0.2,
    systemPrompt: `你是一个严谨的文档阅读助手。用户会提供一份文档的内容（可能来自 PDF、Word 或纯文本）。
请按以下结构回答：
1. 文档概览：类型、主题、结构/篇幅。
2. 核心结论：用 3-5 条概括文档的主旨。
3. 关键要点：按章节或主题列出，保留重要主体、金额、时间、权利义务等细节。
4. 风险与待确认事项：指出缺失、矛盾或需要进一步核实的内容。
严格只依据文档内容作答，不得补充文档中没有的事实。若文档内容不完整（如被截断、扫描件无法识别），必须明确说明。`,
  },
];

/** 对话会话列表 */
const chatSessions = ref([]);
/** 当前激活的会话 ID */
const currentChatSessionId = ref(null);
/** 是否正在发送消息 */
const chatLoading = ref(false);

/**
 * 获取当前激活会话的消息列表
 * @returns {Array} 消息数组
 */
const chatMessages = computed(() => {
  const session = chatSessions.value.find(
    (s) => s.id === currentChatSessionId.value,
  );
  return session ? session.messages : [];
});

const currentChatRole = computed(() => {
  const session = chatSessions.value.find(
    (s) => s.id === currentChatSessionId.value,
  );
  return getChatRole(session?.roleId);
});

// ==================== 初始化 ====================

/**
 * 加载用户设置
 * 从 localStorage 恢复 API Key、基础地址和对话会话
 */
function loadSettings() {
  apiKey.value =
    localStorage.getItem("agnes_api_key") ||
    "sk-aCTzQt662XYTkN9HJEZMVIU8hcz1dlzGNM2LWhLGllX0cshU";
  baseUrl.value = localStorage.getItem("agnes_base_url") || DEFAULT_BASE_URL;
  setApiKey(apiKey.value);
  setBaseUrl(baseUrl.value);

  const savedSessions = JSON.parse(
    localStorage.getItem("agnes_chat_sessions") || "[]",
  );
  chatSessions.value = savedSessions.map((session) => {
    const roleId = chatRoles.some((role) => role.id === session.roleId)
      ? session.roleId
      : "legal";
    const hasMessages = Array.isArray(session.messages) && session.messages.length > 0;
    return {
      ...session,
      // 空白的“基础问答”会话自动归入默认的法律顾问角色
      roleId: !hasMessages && roleId === "general" ? "legal" : roleId,
      messages: session.messages.map((msg) => ({
        ...msg,
        displayContent: msg.displayContent || msg.content,
      })),
    };
  });
  // 如果有保存的会话，激活第一个；否则创建新会话
  if (savedSessions.length > 0) {
    currentChatSessionId.value = savedSessions[0].id;
  } else {
    createChatSession();
  }
}

/**
 * 保存设置到 localStorage
 * @param {string} key - 设置项：api_key | base_url
 */
function saveSetting(key) {
  if (key === "api_key") {
    localStorage.setItem("agnes_api_key", apiKey.value || "");
    setApiKey(apiKey.value);
  }
  if (key === "base_url") {
    localStorage.setItem("agnes_base_url", baseUrl.value || "");
    setBaseUrl(baseUrl.value);
  }
}

/**
 * 测试 API 连接状态
 * 调用 /models 接口验证 API Key 是否有效
 */
async function _testConnection() {
  if (!apiKey.value) {
    connStatus.value = "error";
    return;
  }
  try {
    connStatus.value = (await testConnection()) ? "ok" : "error";
  } catch {
    connStatus.value = "error";
  }
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
    getChatRole,
  };
}

/**
 * 发送对话消息
 * @param {string} text - 用户输入的消息内容
 * @param {object} [attachment] - 附件内容：{ name, text }
 */
async function sendMessage(text, attachment = null) {
  if (!apiKey.value) {
    errorMsg.value = "请先在设置中配置 API Key";
    return;
  }
  if (!text.trim()) return;

  const session = chatSessions.value.find(
    (s) => s.id === currentChatSessionId.value,
  );
  if (!session) return;

  chatLoading.value = true;

  const userMsg = {
    id: Date.now(),
    role: "user",
    content: text,
    createdAt: new Date().toISOString(),
  };
  if (attachment) {
    userMsg.attachmentName = attachment.name;
    userMsg.attachmentText = attachment.text;
  }
  session.messages.push(userMsg);

  const assistantMsg = {
    id: Date.now() + 1,
    role: "assistant",
    content: "",
    displayContent: "",
    createdAt: new Date().toISOString(),
  };
  session.messages.push(assistantMsg);

  // 通过 session.messages 索引获取 reactive 引用
  const msgIndex = session.messages.length - 1;

  // 更新会话标题（用第一条消息的前20个字符）
  if (session.messages.length === 2) {
    session.title = text.slice(0, 20) + (text.length > 20 ? "..." : "");
  }
  session.updatedAt = new Date().toISOString();
  saveChatSessions();

  try {
    const role = getChatRole(session.roleId);
    const legalContext =
      role.id === "legal" ? await buildLegalContext(text) : "";
    const messages = [
      {
        role: "system",
        content: role.systemPrompt,
      },
      ...(role.id === "legal"
        ? [{ role: "system", content: LEGAL_CITATION_GUARD }]
        : []),
      ...(legalContext ? [{ role: "system", content: legalContext }] : []),
      ...session.messages.map((m) => ({
        role: m.role,
        content: m.attachmentText
          ? `${m.content}\n\n【文档《${m.attachmentName}》内容开始】\n${m.attachmentText}\n【文档内容结束】`
          : m.content,
      })),
    ];

    await chat(
      { messages, temperature: role.temperature },
      (chunk, fullContent) => {
        // SSE 流式期间：用 rAF 节流，避免每个 chunk 都触发响应式更新
        const reactiveMsg = session.messages[msgIndex];
        reactiveMsg.content = fullContent;
        if (!reactiveMsg._rafId) {
          reactiveMsg._rafId = requestAnimationFrame(() => {
            reactiveMsg.displayContent = reactiveMsg.content;
            reactiveMsg._rafId = null;
          });
        }
      },
    );

    if (role.id === "legal") {
      let checks = [];
      try {
        checks = await verifyCitations(session.messages[msgIndex].content);
        if (checks.length) session.messages[msgIndex].citationChecks = checks;
      } catch (err) {
        console.warn("法条核验失败:", err.message);
      }

      try {
        const relatedCases = await searchRelatedCases(text, checks, 3);
        session.messages[msgIndex].relatedCases = relatedCases;
        session.messages[msgIndex].casesChecked = true;
      } catch (err) {
        console.warn("相关案例检索失败:", err.message);
      }
    }
  } catch (err) {
    console.error(err);
    errorMsg.value = err.message;
    const reactiveMsg = session.messages[msgIndex];
    reactiveMsg.content = "抱歉，发生了错误：" + err.message;
    reactiveMsg.displayContent = reactiveMsg.content;
  } finally {
    chatLoading.value = false;
    const reactiveMsg = session.messages[msgIndex];
    if (reactiveMsg._rafId) {
      cancelAnimationFrame(reactiveMsg._rafId);
      reactiveMsg._rafId = null;
    }
    reactiveMsg.displayContent = reactiveMsg.content;
    saveChatSessions();
  }
}

/**
 * 清空当前对话记录
 */
function clearChat() {
  const session = chatSessions.value.find(
    (s) => s.id === currentChatSessionId.value,
  );
  if (!session) return;
  if (confirm("确定清空当前对话？")) {
    session.messages = [];
    session.title = "新对话";
    session.updatedAt = new Date().toISOString();
    saveChatSessions();
  }
}

/**
 * 保存对话会话到 localStorage
 */
function saveChatSessions() {
  localStorage.setItem(
    "agnes_chat_sessions",
    JSON.stringify(chatSessions.value),
  );
}

/**
 * 创建新对话会话
 * @returns {object} 新创建的会话对象
 */
function createChatSession(roleId = "legal") {
  const role = getChatRole(roleId);
  const newSession = {
    id: Date.now(),
    title: role.id === "general" ? "新对话" : `${role.name}对话`,
    roleId: role.id,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chatSessions.value.unshift(newSession);
  currentChatSessionId.value = newSession.id;
  saveChatSessions();
  return newSession;
}

/**
 * 删除对话会话
 * @param {string} sessionId - 会话 ID
 */
function deleteChatSession(sessionId) {
  const idx = chatSessions.value.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;

  if (!confirm("确定删除该对话？")) return;

  chatSessions.value.splice(idx, 1);
  saveChatSessions();

  // 如果删除的是当前激活的会话，切换到第一个或创建新会话
  if (sessionId === currentChatSessionId.value) {
    if (chatSessions.value.length > 0) {
      currentChatSessionId.value = chatSessions.value[0].id;
    } else {
      createChatSession();
    }
  }
}

/**
 * 切换到指定会话
 * @param {string} sessionId - 会话 ID
 */
function switchChatSession(sessionId) {
  currentChatSessionId.value = sessionId;
}

/**
 * 更新会话标题
 * @param {string} sessionId - 会话 ID
 * @param {string} title - 新标题
 */
function updateChatSessionTitle(sessionId, title) {
  const session = chatSessions.value.find((s) => s.id === sessionId);
  if (session) {
    session.title = title;
    session.updatedAt = new Date().toISOString();
    saveChatSessions();
  }
}

function getChatRole(roleId = "legal") {
  return chatRoles.find((role) => role.id === roleId) || chatRoles[0];
}

/**
 * 在本地法条库中检索相关条文，构造发给模型的法律上下文
 * @param {string} query - 用户问题
 * @returns {Promise<string>} 法条上下文
 */
async function buildLegalContext(query) {
  const [results, citationInfo] = await Promise.all([
    searchLegalArticles(query, 8),
    inspectQueryCitations(query),
  ]);

  const parts = [];
  if (citationInfo) {
    const { law, queries, total, firstNo, lastNo } = citationInfo;
    const lines = queries.map(({ numberCn, suffix, article }) => {
      const label = `第${numberCn}条${suffix}`;
      if (article) {
        return `用户提到《${law.title}》${label}，本地库收录的 ${law.date} 版本中确有该条，原文：\n${article.text.slice(0, 700)}`;
      }
      return `用户提到《${law.title}》${label}，但本地库收录的 ${law.date} 版本共 ${total} 条（${firstNo}至${lastNo}），其中查无此条。不得猜测或编造该条内容，也不得用其他条号替代；应明确告知用户本地库查无此条，并提示以国家法律法规数据库的官方文本为准。`;
    });
    parts.push(`【用户所问条号核对】\n${lines.join("\n\n")}`);
  }

  if (results.length === 0) {
    parts.push(
      "本地法条库未检索到与当前问题直接相关的其他条文。回答涉及法条时，只有确认准确时才引用，并给出《法律名称》第X条；无法确认时明确标注“待核实”，不得编造法条、案号或来源。",
    );
  } else {
    const references = results
      .map((result, index) => {
        const { law, article } = result;
        return `【${index + 1}】《${law.title}》${article.no}${article.suffix || ""}${article.chapter ? `（${article.chapter}）` : ""}\n${article.text.slice(0, 700)}`;
      })
      .join("\n\n");
    parts.push(
      `以下是本地法条库（整理自国家法律法规数据库）检索到的相关条文。请优先依据这些原文回答；引用时必须使用《法律全称》第X条 的格式；若所需条文不在此列表中且无法确认，请明确标注“待核实”，不得编造法条、案号或来源。\n\n${references}`,
    );
  }

  return parts.join("\n\n");
}
