<template>
  <div class="home">
    <!-- ===== 层 1：顶部氛围层（粉色渐变 + 标题）===== -->
    <header class="header">
      <div class="header-row">
        <h1 class="brand">OneDay</h1>
        <div class="header-actions">
          <button
            class="icon-btn"
            :class="{ active: searchVisible }"
            aria-label="搜索"
            @click="toggleSearch"
          >
            <van-icon name="search" :size="20" />
          </button>
          <button class="icon-btn diamond" aria-label="高级版"><van-icon name="diamond-o" :size="20" /></button>
        </div>
      </div>
      <p class="header-sub" v-if="!searchVisible">记录每一件物品的真实使用成本</p>
      <!-- 搜索栏（点击 🔍 后展开） -->
      <transition name="slide-fade">
        <div v-if="searchVisible" class="search-wrap">
          <van-search
            v-model="searchKeyword"
            placeholder="搜索物品名"
            shape="round"
            background="transparent"
            show-action
            @cancel="closeSearch"
          >
            <template #action><span class="search-cancel" @click="closeSearch">取消</span></template>
          </van-search>
        </div>
      </transition>
    </header>

    <!-- ===== 层 2：数据大盘卡片 ===== -->
    <section class="overview-card">
      <div class="overview-top">
        <div class="ov-block">
          <div class="ov-label">总资产</div>
          <div class="ov-value">¥{{ formatNumber(overview.total_assets) }}</div>
        </div>
        <div class="ov-divider" />
        <div class="ov-block highlight">
          <div class="ov-label">日均成本</div>
          <div class="ov-value accent">¥{{ overview.daily_cost.toFixed(2) }}<span class="ov-unit">/天</span></div>
        </div>
      </div>

      <div class="dash-divider" />

      <div class="status-row">
        <StatusPill label="服役中" :count="overview.count_using"   :total="totalCount" color="var(--status-using)" />
        <StatusPill label="已退役" :count="overview.count_retired" :total="totalCount" color="var(--status-retired)" />
        <StatusPill label="已卖出" :count="overview.count_sold"    :total="totalCount" color="var(--status-sold)" />
      </div>
    </section>

    <!-- ===== 层 3：单层筛选条（品类 + 排序按钮）===== -->
    <section class="filter-bar">
      <div class="filter-categories">
        <button
          v-for="cat in categories"
          :key="cat"
          class="cat-tag"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >
          {{ cat }}
        </button>
      </div>
      <button class="sort-btn" @click="sortOpen = true">
        <van-icon name="apps-o" :size="14" />
        <span>{{ currentSortLabel }}</span>
        <van-icon name="arrow-down" :size="12" />
      </button>
    </section>

    <!-- ===== 层 4：双列网格 ===== -->
    <section class="grid">
      <div
        v-for="item in items"
        :key="item.id"
        class="item-card"
        @click="goItem(item.id)"
      >
        <div class="item-cover">
          <img
            v-if="item.cover_url"
            v-lazy="resolveAssetUrl(item.cover_url)"
            class="cover-img"
            :alt="item.name"
          />
          <div v-else class="cover-placeholder">
            <van-icon name="photo-o" :size="32" color="#cdcdd5" />
          </div>
          <span class="status-dot" :style="{ background: statusColor(item.status) }" :title="statusLabel(item.status)" />
        </div>
        <div class="item-meta">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-price">¥{{ formatNumber(item.purchase_price) }}</div>
          <div class="item-daily">
            ¥{{ Number(item.daily_cost ?? 0).toFixed(2) }} <span>/天</span>
          </div>
        </div>
      </div>

      <div v-if="!loading && items.length === 0" class="empty">
        <van-icon name="bag-o" :size="40" color="#cdcdd5" />
        <p v-if="searchKeyword">没找到「{{ searchKeyword }}」相关的物品</p>
        <p v-else>还没有任何物品，点右下角 + 开始记录</p>
      </div>
    </section>

    <!-- ===== 排序弹窗 ===== -->
    <van-popup v-model:show="sortOpen" position="bottom" round closeable>
      <div class="sort-popup">
        <h3 class="sort-title">排序方式</h3>
        <div class="sort-options">
          <button
            v-for="opt in sortOptions"
            :key="opt.key"
            class="sort-opt"
            :class="{ active: sortKey === opt.key }"
            @click="onSortPick(opt.key)"
          >
            <span class="opt-label">{{ opt.label }}</span>
            <van-icon v-if="sortKey === opt.key" name="success" :size="18" color="var(--accent-pink)" />
          </button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { fetchDashboard, type DashboardOverview } from '../api/dashboard';
import { listItems, type Item, type ItemStatus, type SortKey } from '../api/items';
import { resolveAssetUrl } from '../api/client';
import StatusPill from './_HomeStatusPill.vue';

const router = useRouter();

// ===== 总览 =====
const overview = ref<DashboardOverview>({
  total_assets: 0, daily_cost: 0, total_count: 0,
  count_using: 0, count_retired: 0, count_sold: 0,
});
const totalCount = computed(() => overview.value.total_count || 1);

// ===== 列表 =====
const items   = ref<Item[]>([]);
const loading = ref(false);

// ===== 筛选 + 搜索 + 排序 =====
const categories = ref<string[]>(['全部']);
const activeCategory = ref<string>('全部');

const searchVisible = ref(false);
const searchKeyword = ref('');

const sortKey = ref<SortKey>('updated');
const sortOpen = ref(false);
const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'updated',     label: '最近添加' },
  { key: 'acquisition', label: '最近购入' },
  { key: 'price',       label: '购入价高 → 低' },
  { key: 'daily_cost',  label: '日均成本高 → 低' },
];
const currentSortLabel = computed(() =>
  sortOptions.find(o => o.key === sortKey.value)?.label ?? '排序');

function toggleSearch() {
  searchVisible.value = !searchVisible.value;
  if (!searchVisible.value) searchKeyword.value = '';
}
function closeSearch() {
  searchVisible.value = false;
  searchKeyword.value = '';
}
function onSortPick(k: SortKey) {
  sortKey.value = k;
  sortOpen.value = false;
}

// ===== 数据加载（带 300ms 搜索防抖）=====
async function loadDashboard() {
  try {
    const data = await fetchDashboard();
    overview.value = data.overview;
  } catch { /* axios 拦截器已 toast */ }
}

async function loadItems() {
  loading.value = true;
  try {
    const data = await listItems({
      q:        searchKeyword.value.trim(),
      category: activeCategory.value === '全部' ? '' : activeCategory.value,
      sort:     sortKey.value,
      size: 100,
    });
    items.value = data.rows;
    if (!searchKeyword.value) {
      const uniq = new Set<string>(['全部']);
      data.rows.forEach((r) => { if (r.category) uniq.add(r.category); else uniq.add('未分类'); });
      categories.value = Array.from(uniq);
    }
  } finally {
    loading.value = false;
  }
}

// 搜索防抖：输入停 300ms 才发请求；其他筛选立即触发
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(loadItems, 300);
});
watch([activeCategory, sortKey], loadItems);

onMounted(() => {
  loadDashboard();
  loadItems();
});

// ===== 工具 =====
function formatNumber(n: number | string | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
function statusColor(s: ItemStatus): string {
  return ({ using: 'var(--status-using)', retired: 'var(--status-retired)', sold: 'var(--status-sold)' } as Record<string, string>)[s] ?? 'transparent';
}
function statusLabel(s: ItemStatus): string {
  return ({ using: '服役中', retired: '已退役', sold: '已卖出' } as Record<string, string>)[s] ?? '';
}
function goItem(id: number) { router.push({ name: 'item', params: { id: String(id) } }); }
</script>

<style scoped>
.home { position: relative; }

/* ===== 层 1：顶部氛围层 ===== */
.header {
  background: linear-gradient(160deg,
    var(--bg-grad-start) 0%,
    var(--bg-grad-mid)   60%,
    var(--bg-grad-end)   100%);
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px 80px;
  position: relative;
}
.header-row {
  display: flex; align-items: center; justify-content: space-between;
}
.brand {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}
.header-actions { display: flex; gap: 8px; }
.icon-btn {
  width: 36px; height: 36px;
  border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-primary);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(8px);
  cursor: pointer;
}
.icon-btn.active { background: var(--text-primary); color: #fff; }
.icon-btn.active .van-icon { color: #fff; }
.icon-btn.diamond { background: rgba(255, 255, 255, 0.8); color: #d4af37; }
.header-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 搜索栏 */
.search-wrap {
  margin: 8px -8px 0;
}
.search-cancel {
  font-size: 14px;
  color: var(--text-primary);
  padding: 0 8px;
}
:deep(.search-wrap .van-search__content) {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
}

/* 搜索栏滑入动画 */
.slide-fade-enter-active,
.slide-fade-leave-active { transition: all 0.22s ease; }
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ===== 层 2：数据大盘卡片 ===== */
.overview-card {
  margin: -64px 16px 16px;
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 18px 20px;
  box-shadow: var(--card-shadow);
  position: relative;
}
.overview-top { display: flex; align-items: center; }
.ov-block { flex: 1; }
.ov-block.highlight { text-align: right; }
.ov-label {
  font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;
}
.ov-value {
  font-size: 22px; font-weight: 700; color: var(--text-primary);
}
.ov-value.accent { color: var(--accent-pink); font-size: 26px; }
.ov-unit { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-left: 2px; }
.ov-divider {
  width: 1px; height: 36px;
  background: var(--card-border);
  margin: 0 14px;
}
.dash-divider {
  margin: 16px 0 12px;
  border-top: 1px dashed var(--card-border);
}
.status-row { display: flex; gap: 12px; }

/* ===== 层 3：单层筛选 + 排序按钮 ===== */
.filter-bar {
  padding: 0 16px;
  margin-bottom: 14px;
  display: flex; align-items: center;
  gap: 8px;
}
.filter-categories {
  display: flex; gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  flex: 1;
}
.cat-tag {
  border: 0; background: transparent;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-weight: 500;
  cursor: pointer;
}
.cat-tag.active {
  background: var(--accent-pink-soft);
  color: var(--text-primary);
}

.sort-btn {
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 4px;
  border: 0;
  background: #fff;
  border: 1px solid var(--card-border);
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.sort-btn:active { background: #f6f6f9; }

/* ===== 层 4：双列网格 ===== */
.grid {
  padding: 0 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.item-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  overflow: hidden;
  display: flex; flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.item-card:active { transform: scale(0.98); }

.item-cover {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f6f6f9;
}
.cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.status-dot {
  position: absolute;
  top: 8px; right: 8px;
  width: 10px; height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
}
.item-meta { padding: 10px 12px 14px; }
.item-name {
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.item-price {
  font-size: 11px; color: var(--text-muted); margin-bottom: 6px;
}
.item-daily {
  font-size: 16px; font-weight: 700; color: var(--accent-pink);
}
.item-daily span { font-size: 11px; color: var(--text-secondary); font-weight: 500; margin-left: 2px; }

.empty {
  grid-column: 1 / -1;
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 0; color: var(--text-muted); font-size: 13px;
}
.empty p { margin: 12px 0 0; }

/* ===== 排序弹窗 ===== */
.sort-popup {
  padding: 24px 0 12px;
}
.sort-title {
  margin: 0 20px 12px;
  font-size: 18px; font-weight: 700;
  color: var(--text-primary);
}
.sort-options {
  padding: 0;
}
.sort-opt {
  width: 100%;
  border: 0; background: transparent;
  padding: 14px 20px;
  font-size: 15px;
  color: var(--text-primary);
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer;
}
.sort-opt:active { background: #f6f6f9; }
.sort-opt.active .opt-label { color: var(--accent-pink); font-weight: 600; }
</style>
