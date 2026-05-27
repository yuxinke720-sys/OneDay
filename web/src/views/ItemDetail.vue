<template>
  <div class="page" v-if="item">
    <!-- 顶部图片大区 -->
    <div class="hero">
      <img
        v-if="cover"
        :src="resolveAssetUrl(cover)"
        class="hero-img"
        :alt="item.name"
      />
      <div v-else class="hero-placeholder">
        <van-icon name="photo-o" :size="48" color="#cdcdd5" />
      </div>
      <div class="hero-top">
        <button class="hero-btn" @click="$router.back()">
          <van-icon name="arrow-left" :size="18" />
        </button>
        <button class="hero-btn" @click="onMoreActions">
          <van-icon name="ellipsis" :size="18" />
        </button>
      </div>
      <span class="status-badge" :style="{ background: statusColor }">{{ statusLabel }}</span>
    </div>

    <!-- 名称 + 分类 -->
    <div class="head">
      <h1 class="title">{{ item.name }}</h1>
      <div class="meta-row">
        <span v-if="item.category" class="chip">{{ item.category }}</span>
        <span class="chip muted">{{ formatDate(item.acquisition_date) }} 入手</span>
      </div>
      <p v-if="item.notes" class="notes">{{ item.notes }}</p>
    </div>

    <!-- 统计卡片 -->
    <section class="stats-card" v-if="stats">
      <div class="stat">
        <div class="stat-label">日均成本</div>
        <div class="stat-value accent">¥{{ stats.daily_cost.toFixed(2) }}<span class="unit">/天</span></div>
        <div class="stat-sub">已拥有 {{ stats.days_owned }} 天</div>
      </div>
      <div class="divider" />
      <div class="stat">
        <div class="stat-label">单次成本</div>
        <div class="stat-value accent">
          {{ stats.cost_per_use === null ? '—' : `¥${stats.cost_per_use.toFixed(2)}` }}
          <span class="unit" v-if="stats.cost_per_use !== null">/次</span>
        </div>
        <div class="stat-sub">使用 {{ stats.use_count }} 次</div>
      </div>
    </section>

    <!-- 快速操作：今天用了 -->
    <div class="quick-row" v-if="item.status === 'using'">
      <van-button
        block
        round
        size="large"
        type="primary"
        :loading="quickUsing"
        @click="quickUse"
      >
        <van-icon name="success" /> &nbsp; 今天用了
      </van-button>
    </div>

    <!-- 时间轴 -->
    <section class="timeline-section">
      <div class="section-head">
        <h3>时间轴</h3>
        <button class="add-event-btn" @click="eventModalOpen = true">
          <van-icon name="plus" :size="14" /> 添加
        </button>
      </div>

      <ul class="timeline">
        <li v-for="(ev, idx) in events" :key="ev.id" class="tl-item">
          <span class="tl-dot" :style="{ background: meta(ev.type).color }">
            <van-icon :name="meta(ev.type).icon" color="#fff" :size="13" />
          </span>
          <span v-if="idx < events.length - 1" class="tl-line" />
          <div class="tl-body">
            <div class="tl-header">
              <span class="tl-label">{{ meta(ev.type).label }}</span>
              <span class="tl-time">{{ formatDate(ev.occurred_at) }}</span>
            </div>
            <div class="tl-content">
              <span v-if="ev.amount > 0" class="tl-amount">¥{{ Number(ev.amount).toLocaleString('zh-CN') }}</span>
              <span v-if="ev.quantity > 1" class="tl-qty">×{{ ev.quantity }}</span>
              <span v-if="ev.description" class="tl-desc">{{ ev.description }}</span>
            </div>
          </div>
          <button class="tl-del" @click="onDeleteEvent(ev.id)" aria-label="删除">
            <van-icon name="cross" :size="14" />
          </button>
        </li>
      </ul>
    </section>

    <!-- 添加事件弹窗 -->
    <van-popup v-model:show="eventModalOpen" position="bottom" round closeable :style="{ paddingBottom: '32px' }">
      <div class="modal">
        <h3 class="modal-title">添加事件</h3>
        <div class="type-grid">
          <button
            v-for="t in addableTypes"
            :key="t"
            class="type-btn"
            :class="{ active: newEvent.type === t }"
            :style="newEvent.type === t ? { background: meta(t).color, color: '#fff' } : {}"
            @click="newEvent.type = t"
          >
            <van-icon :name="meta(t).icon" :size="18" />
            <span>{{ meta(t).label }}</span>
          </button>
        </div>

        <van-cell-group inset>
          <van-field v-model="newEvent.amount"   label="金额" type="number" placeholder="0.00" />
          <van-field v-model="newEvent.quantity" label="数量" type="number" placeholder="1" />
          <van-field
            v-model="newEvent.description"
            label="描述"
            placeholder="如：换电池 / 出差用了 / 出二手"
            type="textarea"
            rows="2"
            autosize
            maxlength="200"
          />
        </van-cell-group>

        <div class="modal-actions">
          <van-button block round type="primary" :loading="adding" @click="submitEvent">
            添加
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>

  <div v-else class="loading">
    <van-loading size="24" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import { getItem, deleteItem, type Item } from '../api/items';
import {
  listEvents, addEvent, deleteEvent, getItemStats,
  EVENT_META, type EventType, type ItemEvent, type ItemStats,
} from '../api/events';
import { resolveAssetUrl } from '../api/client';

const route = useRoute();
const router = useRouter();
const itemId = computed(() => Number(route.params.id));

const item   = ref<(Item & { images: any[] }) | null>(null);
const events = ref<ItemEvent[]>([]);
const stats  = ref<ItemStats | null>(null);

const cover = computed(() => {
  if (item.value?.cover_url) return item.value.cover_url;
  return item.value?.images?.[0]?.url ?? '';
});

const statusColor = computed(() => {
  const s = item.value?.status;
  return s === 'using' ? 'var(--status-using)' : s === 'retired' ? 'var(--status-retired)' : 'var(--status-sold)';
});
const statusLabel = computed(() =>
  ({ using: '服役中', retired: '已退役', sold: '已卖出' } as const)[item.value?.status ?? 'using']);

function meta(t: EventType) { return EVENT_META[t]; }
function formatDate(s?: string | null) {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadAll() {
  const id = itemId.value;
  const [it, evs, st] = await Promise.all([
    getItem(id),
    listEvents(id),
    getItemStats(id).catch(() => null),
  ]);
  item.value   = it;
  events.value = evs;
  stats.value  = st;
}
onMounted(loadAll);

// ===== 快速使用 =====
const quickUsing = ref(false);
async function quickUse() {
  quickUsing.value = true;
  try {
    await addEvent(itemId.value, { type: 'usage', occurred_at: new Date().toISOString() });
    showToast({ type: 'success', message: '已记录' });
    await loadAll();
  } finally {
    quickUsing.value = false;
  }
}

// ===== 删除事件 =====
async function onDeleteEvent(id: number) {
  try {
    await showConfirmDialog({ title: '删除这条事件？', message: '统计会随之更新', confirmButtonText: '删除' });
    await deleteEvent(id);
    await loadAll();
  } catch { /* 用户取消 */ }
}

// ===== 添加事件弹窗 =====
const eventModalOpen = ref(false);
const adding = ref(false);
const addableTypes: EventType[] = ['usage', 'maintenance', 'repair', 'consumable', 'sell'];
const newEvent = reactive<{
  type: EventType; amount: string; quantity: string; description: string;
}>({ type: 'maintenance', amount: '', quantity: '', description: '' });

async function submitEvent() {
  adding.value = true;
  try {
    await addEvent(itemId.value, {
      type: newEvent.type,
      amount:   Number(newEvent.amount)   || 0,
      quantity: Number(newEvent.quantity) || 1,
      description: newEvent.description.trim() || undefined,
    });
    eventModalOpen.value = false;
    // 重置
    Object.assign(newEvent, { type: 'maintenance', amount: '', quantity: '', description: '' });
    await loadAll();
    showToast({ type: 'success', message: '已添加' });
  } finally {
    adding.value = false;
  }
}

// ===== 更多操作 =====
async function onMoreActions() {
  try {
    await showConfirmDialog({
      title: '删除「' + item.value?.name + '」？',
      message: '所有事件、图片都会被一起删除，此操作不可恢复。',
      confirmButtonText: '删除',
      confirmButtonColor: '#ed6f6f',
    });
    await deleteItem(itemId.value);
    showToast({ type: 'success', message: '已删除' });
    router.replace({ name: 'home' });
  } catch { /* cancel */ }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: #f6f6f9;
  padding-bottom: 32px;
}

/* ===== Hero ===== */
.hero {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #ececf0;
  overflow: hidden;
}
.hero-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.hero-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.hero-top {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  left: 12px; right: 12px;
  display: flex; justify-content: space-between;
}
.hero-btn {
  width: 36px; height: 36px;
  border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-primary);
}
.status-badge {
  position: absolute;
  bottom: 12px; left: 16px;
  padding: 4px 10px;
  font-size: 11px; font-weight: 700;
  color: #fff;
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.16);
}

/* ===== 名字 + 分类 ===== */
.head {
  padding: 16px 20px 0;
}
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
}
.meta-row {
  margin-top: 8px;
  display: flex; gap: 6px;
  flex-wrap: wrap;
}
.chip {
  font-size: 11px;
  padding: 3px 10px;
  background: var(--accent-pink-soft);
  color: var(--text-primary);
  border-radius: 999px;
  font-weight: 500;
}
.chip.muted {
  background: #ececf0;
  color: var(--text-secondary);
}
.notes {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ===== 统计卡片 ===== */
.stats-card {
  margin: 18px 16px 0;
  padding: 18px 20px;
  background: #fff;
  border-radius: var(--card-radius);
  display: flex;
  box-shadow: var(--card-shadow);
}
.stat { flex: 1; }
.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.stat-value.accent { color: var(--accent-pink); }
.unit { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.stat-sub {
  margin-top: 4px;
  font-size: 11px; color: var(--text-muted);
}
.divider {
  width: 1px;
  background: var(--card-border);
  margin: 0 14px;
}

/* ===== 快速使用按钮 ===== */
.quick-row {
  margin: 16px 16px 0;
}

/* ===== 时间轴 ===== */
.timeline-section {
  margin-top: 28px;
  padding: 0 16px;
}
.section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.section-head h3 {
  margin: 0; font-size: 16px; font-weight: 700;
}
.add-event-btn {
  display: inline-flex; align-items: center; gap: 4px;
  border: 0; background: var(--text-primary); color: #fff;
  padding: 6px 12px; border-radius: 999px; font-size: 12px;
}

.timeline {
  list-style: none;
  padding: 0 0 0 8px;
  margin: 0;
}
.tl-item {
  position: relative;
  padding: 0 0 18px 32px;
  display: flex; flex-direction: column;
}
.tl-dot {
  position: absolute;
  left: 0; top: 2px;
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 3px #f6f6f9;
}
.tl-line {
  position: absolute;
  left: 11px; top: 26px;
  width: 2px; bottom: -8px;
  background: var(--card-border);
}
.tl-body {
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
}
.tl-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 2px;
}
.tl-label {
  font-size: 12px; font-weight: 600;
  color: var(--text-primary);
}
.tl-time {
  font-size: 11px; color: var(--text-muted);
}
.tl-content { font-size: 13px; color: var(--text-secondary); }
.tl-amount {
  font-weight: 600; color: var(--text-primary); margin-right: 6px;
}
.tl-qty { color: var(--text-muted); margin-right: 6px; }
.tl-desc { word-break: break-all; }
.tl-del {
  position: absolute;
  right: 0; top: 6px;
  border: 0; background: transparent;
  color: var(--text-muted);
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.tl-del:active { background: #f0f0f3; }

/* ===== 添加事件弹窗 ===== */
.modal {
  padding: 20px 0 0;
}
.modal-title {
  margin: 0 20px 16px;
  font-size: 18px; font-weight: 700;
}
.type-grid {
  margin: 0 20px 16px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.type-btn {
  border: 1px solid var(--card-border);
  background: #fff;
  padding: 10px 4px;
  border-radius: 12px;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-weight: 500;
}
.type-btn.active { border-color: transparent; }
.modal-actions { margin: 20px; }

.loading {
  height: 60vh;
  display: flex; align-items: center; justify-content: center;
}
</style>
