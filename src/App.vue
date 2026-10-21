<template>
  <div class="app-container">
    <AppHeader :current-tab="store.currentTab.value" @switch-tab="store.currentTab.value = $event" />

    <main class="app-main">
      <Transition name="tab-switch" mode="out-in">
        <ChatTab v-if="store.currentTab.value === 'chat'" key="chat" />
        <SettingsTab v-else key="settings" />
      </Transition>
    </main>

    <ErrorToast :error-msg="store.errorMsg.value" :success-msg="store.toastMsg.value" @dismiss="store.errorMsg.value = ''; store.toastMsg.value = ''" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAppStore } from './composables/useAppStore.js'
import AppHeader from './components/layout/AppHeader.vue'
import ChatTab from './components/tabs/ChatTab.vue'
import SettingsTab from './components/tabs/SettingsTab.vue'
import ErrorToast from './components/common/ErrorToast.vue'

const store = useAppStore()

onMounted(() => {
  store.loadSettings()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
}

.app-main {
  flex: 1;
  min-height: 0;
  max-width: 1320px;
  margin: 0 auto;
  width: 100%;
  padding: 1.5rem 2rem 2rem;
  position: relative;
  z-index: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-switch-enter-active,
.tab-switch-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-switch-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.tab-switch-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 900px) {
  .app-main { padding: 1rem 1rem 1.25rem; }
}

@media (max-width: 560px) {
  .app-main { padding: 0.75rem 0.75rem 1rem; }
}
</style>
