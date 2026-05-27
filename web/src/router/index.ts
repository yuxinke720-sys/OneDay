import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/',         name: 'home',     component: () => import('../views/Home.vue'),       meta: { title: 'OneDay' } },
  { path: '/library',  name: 'library',  component: () => import('../views/Library.vue'),    meta: { title: '物品库' } },
  { path: '/charts',   name: 'charts',   component: () => import('../views/Charts.vue'),     meta: { title: '图表' } },
  { path: '/settings', name: 'settings', component: () => import('../views/Settings.vue'),   meta: { title: '设置' } },
  { path: '/item/add', name: 'item-add', component: () => import('../views/ItemAdd.vue'),    meta: { title: '添加物品' } },
  { path: '/item/:id', name: 'item',     component: () => import('../views/ItemDetail.vue'), meta: { title: '物品详情' } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 }; },
});

router.afterEach((to) => {
  if (typeof to.meta.title === 'string') document.title = to.meta.title;
});

export default router;
