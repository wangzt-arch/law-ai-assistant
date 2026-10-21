/**
 * API 模块统一导出
 * 通过此文件导入所有 API 方法，避免分散引用
 */
export { setApiKey, setBaseUrl, DEFAULT_BASE_URL, testConnection } from './client.js'
export { chat } from './chat.js'
