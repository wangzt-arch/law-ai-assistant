import { createApp } from 'vue'
import App from './App.vue'
import { initTheme } from './composables/useTheme.js'

initTheme()
createApp(App).mount('#app')
