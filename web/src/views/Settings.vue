<template>
  <div class="page">
    <h2>设置</h2>
    <van-cell-group inset>
      <van-cell title="主题色" value="浅粉色" is-link />
      <van-cell title="货币" value="CNY" is-link />
      <van-cell title="导出数据" is-link />
      <van-cell title="关于 OneDay" value="v0.0.1" is-link />
    </van-cell-group>
  </div>
</template>

<style scoped>
.page { padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px 20px; }
.page h2 { margin: 0 0 16px 4px; font-size: 24px; font-weight: 800; }
</style>
