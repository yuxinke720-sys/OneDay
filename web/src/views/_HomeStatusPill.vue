<template>
  <div class="pill">
    <div class="pill-head">
      <span class="dot" :style="{ background: color }" />
      <span class="label">{{ label }}</span>
    </div>
    <div class="count">{{ count }}</div>
    <div class="bar"><div class="bar-fill" :style="{ width: percent + '%', background: color }" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{
  label: string;
  count: number;
  total: number;
  color: string;
}>();
const percent = computed(() => Math.round((props.count / Math.max(1, props.total)) * 100));
</script>

<style scoped>
.pill {
  flex: 1;
  min-width: 0;
}
.pill-head {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-secondary);
}
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  display: inline-block;
}
.label { font-weight: 500; }
.count {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 2px 0 6px;
}
.bar {
  width: 100%;
  height: 4px;
  background: #f0f0f3;
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
</style>
