<template>
  <div class="page">
    <!-- 顶栏 -->
    <van-nav-bar
      title="添加物品"
      left-text="取消"
      left-arrow
      @click-left="$router.back()"
      :border="false"
    />

    <div class="form-area">
      <van-form @submit="handleSubmit" ref="formRef">
        <!-- ===== 图片：放最上面，更生活化 ===== -->
        <div class="section-title">物品图片</div>
        <div class="uploader-wrap">
          <van-uploader
            v-model="fileList"
            multiple
            :max-count="9"
            :preview-size="84"
            :after-read="onAfterRead"
          />
        </div>
        <div class="hint">第一张会作为封面；最多 9 张</div>

        <!-- ===== 基本信息 ===== -->
        <div class="section-title">基本信息</div>
        <van-cell-group inset>
          <van-field
            v-model="form.name"
            label="名字"
            placeholder="如：MacBook Pro 14"
            :rules="[{ required: true, message: '请输入名字' }]"
            required
            maxlength="100"
          />
          <van-field
            v-model="form.category"
            label="分类"
            placeholder="电子 / 服饰 / 美妆 / 家居 ..."
            :is-link="false"
          />
          <van-field
            v-model="form.notes"
            label="备注"
            placeholder="为什么入手？常用场景？"
            type="textarea"
            rows="2"
            autosize
            maxlength="500"
            show-word-limit
          />
        </van-cell-group>

        <!-- ===== 入手 ===== -->
        <div class="section-title">入手</div>
        <van-cell-group inset>
          <van-field
            :model-value="form.acquisition_date"
            label="入手日期"
            placeholder="选择日期"
            readonly
            is-link
            @click="dateOpen = true"
            :rules="[{ required: true, message: '请选择日期' }]"
            required
          />
          <van-field
            v-model="form.purchase_price"
            label="购入价"
            placeholder="0.00"
            type="number"
            :rules="[
              { required: true, message: '请输入金额' },
              { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入有效金额' },
            ]"
            required
          >
            <template #button><span class="unit">¥</span></template>
          </van-field>
        </van-cell-group>

        <!-- ===== 状态 ===== -->
        <div class="section-title">当前状态</div>
        <div class="status-options">
          <button
            v-for="s in statusOptions"
            :key="s.value"
            type="button"
            class="status-chip"
            :class="{ active: form.status === s.value }"
            :style="form.status === s.value ? { background: s.color, borderColor: s.color, color: '#fff' } : {}"
            @click="form.status = s.value"
          >
            <span class="dot" :style="{ background: s.color }" v-if="form.status !== s.value" />
            {{ s.label }}
          </button>
        </div>

        <div class="actions">
          <van-button block round type="primary" native-type="submit" :loading="submitting">
            完成添加
          </van-button>
        </div>
      </van-form>
    </div>

    <!-- 滚轮式日期选择器：年/月/日 三列上下拨，可任意年份 -->
    <van-popup v-model:show="dateOpen" position="bottom" round teleport="body">
      <van-date-picker
        v-model="dateValue"
        title="选择入手日期"
        :min-date="minDate"
        :max-date="maxDate"
        :columns-type="['year', 'month', 'day']"
        @confirm="onDateConfirm"
        @cancel="dateOpen = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, type UploaderFileListItem } from 'vant';
import { createItem, updateItem, type ItemStatus } from '../api/items';
import { uploadImage } from '../api/images';

const router = useRouter();

const formRef = ref();
const submitting = ref(false);

const form = reactive<{
  name: string;
  category: string;
  notes: string;
  acquisition_date: string;
  purchase_price: string;
  status: ItemStatus;
}>({
  name: '',
  category: '',
  notes: '',
  acquisition_date: new Date().toISOString().slice(0, 10),
  purchase_price: '',
  status: 'using',
});

const statusOptions: Array<{ value: ItemStatus; label: string; color: string }> = [
  { value: 'using',   label: '服役中', color: 'var(--status-using)' },
  { value: 'retired', label: '已退役', color: 'var(--status-retired)' },
  { value: 'sold',    label: '已卖出', color: 'var(--status-sold)' },
];

// ===== 图片 =====
const fileList = ref<UploaderFileListItem[]>([]);
function onAfterRead(_item: UploaderFileListItem | UploaderFileListItem[]) {
  // 仅作为占位，实际上传留到 submit 时；van-uploader 已显示预览
}

// ===== 滚轮式日期选择器（年 / 月 / 日 三列，1990-至今）=====
const dateOpen = ref(false);
const minDate = new Date(1990, 0, 1);
const maxDate = new Date();
// 滚轮的当前值 ['YYYY', 'MM', 'DD']
const dateValue = ref<string[]>([]);
onMounted(() => {
  const [y, m, d] = form.acquisition_date.split('-');
  if (y && m && d) dateValue.value = [y, m, d];
});
function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  form.acquisition_date = selectedValues.join('-');
  dateOpen.value = false;
}

// 桌面端补丁：Vant 滚轮只绑了 touch 事件，桌面鼠标必须我们自己加
//   - 鼠标滚轮 (wheel) → 当前列 ±1
//   - 按住拖动 (pointer) → 跟随鼠标位移，每 44px 拨一格
const ITEM_HEIGHT = 44;
const cleanups: Array<() => void> = [];

watch(dateOpen, async (open) => {
  if (!open) {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    return;
  }
  // 等 Vant teleport 渲染好
  await nextTick();
  await new Promise((r) => setTimeout(r, 60));
  const cols = document.querySelectorAll<HTMLElement>('.van-picker-column');
  cols.forEach((col, idx) => attachDesktopHandlers(col, idx));
});
onUnmounted(() => cleanups.forEach((fn) => fn()));

function attachDesktopHandlers(col: HTMLElement, idx: number) {
  // ===== 鼠标滚轮 =====
  let lastWheel = 0;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheel < 80) return;
    lastWheel = now;
    stepColumn(idx, e.deltaY > 0 ? 1 : -1);
  };
  col.addEventListener('wheel', onWheel, { passive: false });

  // ===== 按住拖动（鼠标专用，触屏让 Vant 原生处理）=====
  let drag: { startY: number; startNum: number; lastDelta: number } | null = null;

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) < 4) return; // 移动太小先不动，保护 click
    e.preventDefault();
    const deltaItems = Math.round(-dy / ITEM_HEIGHT);
    if (deltaItems === drag.lastDelta) return;
    drag.lastDelta = deltaItems;
    setColumn(idx, drag.startNum + deltaItems);
  };
  const onPointerUp = () => {
    drag = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // 触屏交给 Vant
    if (e.button !== 0) return;             // 只接左键
    const arr = dateValue.value;
    if (arr.length !== 3) return;
    drag = {
      startY: e.clientY,
      startNum: parseInt(arr[idx] ?? '0'),
      lastDelta: 0,
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup',   onPointerUp);
  };
  col.addEventListener('pointerdown', onPointerDown);

  cleanups.push(() => {
    col.removeEventListener('wheel', onWheel);
    col.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup',   onPointerUp);
  });
}

function setColumn(colIdx: number, newNum: number) {
  const arr = dateValue.value.length === 3
    ? [...dateValue.value]
    : [String(maxDate.getFullYear()), '01', '01'];
  const y = arr[0] ?? '2024';
  const m = arr[1] ?? '01';
  const d = arr[2] ?? '01';
  if (colIdx === 0) {
    const clamped = Math.max(minDate.getFullYear(),
                     Math.min(maxDate.getFullYear(), newNum));
    dateValue.value = [String(clamped), m, d];
  } else if (colIdx === 1) {
    const clamped = Math.max(1, Math.min(12, newNum));
    dateValue.value = [y, String(clamped).padStart(2, '0'), d];
  } else if (colIdx === 2) {
    const clamped = Math.max(1, Math.min(31, newNum));
    dateValue.value = [y, m, String(clamped).padStart(2, '0')];
  }
}
function stepColumn(colIdx: number, dir: 1 | -1) {
  const arr = dateValue.value;
  if (arr.length !== 3) return;
  setColumn(colIdx, parseInt(arr[colIdx] ?? '0') + dir);
}

// ===== 提交 =====
async function handleSubmit() {
  submitting.value = true;
  try {
    // 1. 创建 item
    const item = await createItem({
      name: form.name.trim(),
      category: form.category.trim() || null,
      acquisition_date: form.acquisition_date,
      purchase_price: Number(form.purchase_price) || 0,
      status: form.status,
      notes: form.notes.trim() || null,
    });

    // 2. 依次上传图片（如果有）
    if (fileList.value.length > 0) {
      showToast({ type: 'loading', message: '上传图片中...', duration: 0, forbidClick: true });
      const uploaded = [];
      for (const f of fileList.value) {
        const file = (f as any).file as File | undefined;
        if (!file) continue;
        try {
          const img = await uploadImage(file, item.id);
          uploaded.push(img);
        } catch (e) {
          console.error('上传单张图片失败：', e);
        }
      }
      // 3. 把第一张设为封面
      if (uploaded.length > 0 && uploaded[0]) {
        await updateItem(item.id, { cover_image_id: uploaded[0].id });
      }
    }

    showToast({ type: 'success', message: '添加成功' });
    router.replace({ name: 'item', params: { id: String(item.id) } });
  } catch (e) {
    console.error(e);
    // axios 拦截器已弹 toast
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: #f6f6f9;
}

.form-area {
  padding: 8px 0 32px;
}

.section-title {
  margin: 16px 16px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.uploader-wrap {
  background: #fff;
  margin: 0 16px;
  padding: 16px;
  border-radius: 14px;
}

.hint {
  margin: 6px 22px 0;
  font-size: 11px;
  color: var(--text-muted);
}

.unit { color: var(--text-muted); font-size: 13px; }

.status-options {
  margin: 0 16px;
  display: flex;
  gap: 8px;
}
.status-chip {
  flex: 1;
  border: 1px solid var(--card-border);
  background: #fff;
  padding: 12px 10px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
}
.status-chip .dot {
  width: 8px; height: 8px; border-radius: 50%;
}

.actions {
  margin: 28px 16px 0;
}

:deep(.van-nav-bar) {
  background: transparent;
}
</style>
