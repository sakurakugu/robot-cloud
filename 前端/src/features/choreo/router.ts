/**
 * 编舞系统路由配置
 */

import type { RouteRecordRaw } from 'vue-router'

export const choreoRoutes: RouteRecordRaw[] = [
  {
    path: '/choreo',
    name: 'ChoreoList',
    component: () => import('./views/ChoreoList.vue'),
    meta: {
      title: '编舞项目中心',
    },
  },
  {
    path: '/choreo/:uuid',
    name: 'ChoreoDetail',
    component: () => import('./views/ChoreoDetail.vue'),
    meta: {
      title: '编舞项目详情',
    },
  },
]
