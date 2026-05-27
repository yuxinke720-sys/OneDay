<template>
  <div class="layout">
    <div class="app-scroll">
      <slot />
    </div>

    <!-- 悬浮胶囊导航 + 黑色 FAB（始终固定在底部）-->
    <div class="floating-bar" :style="{ paddingBottom: 'calc(12px + var(--safe-bottom))' }">
      <nav class="capsule-nav">
        <button
          v-for="tab in tabs"
          :key="tab.name"
          class="nav-item"
          :class="{ active: route.name === tab.name }"
          @click="router.push({ name: tab.name })"
        >
          <van-icon :name="tab.icon" :size="20" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <button class="fab" aria-label="添加物品" @click="router.push({ name: 'item-add' })">
        <van-icon name="plus" :size="26" color="#fff" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const tabs = [
  { name: 'home',     label: '首页',   icon: 'home-o'    },
  { name: 'library',  label: '物品库', icon: 'apps-o'    },
  { name: 'charts',   label: '图表',   icon: 'bar-chart-o' },
  { name: 'settings', label: '设置',   icon: 'setting-o' },
];
</script>

<style scoped>
.layout {
  position: relative;
  min-height: 100%;
  width: 100%;
}

/* 整条底部 bar：水平排布胶囊 + FAB */
.floating-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  pointer-events: none;
}

/* 胶囊导航 */
.capsule-nav {
  pointer-events: auto;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-radius: 999px;
  padding: 6px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 1px 0 rgba(255, 255, 255, 0.6) inset;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.nav-item {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 8px 4px;
  border-radius: 999px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.nav-item.active {
  background: var(--text-primary);
  color: #fff;
}
.nav-item.active .van-icon {
  color: #fff;
}

/* 大号黑色 FAB */
.fab {
  pointer-events: auto;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 0;
  background: var(--text-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.22),
    0 2px 0 rgba(255, 255, 255, 0.08) inset;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}
.fab:active {
  transform: scale(0.92);
}
</style>
