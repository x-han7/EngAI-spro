import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from "@/stores/user";
import home from './home/index'
import wordBook from './word-book/index'
import setting from './setting'
import chat from './chat'
import { ElMessage } from 'element-plus';
import course from './course';
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...home, //主页
    ...wordBook, //词库
    ...setting, //设置
    ...chat, //聊天
    ...course, //课程
  ]
})

// 添加全局前置守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const isAuthenticated = !!userStore.user?.id 

  // 如果路由配置了 meta.isAuth 为 true，则需要验证登录
  if (to.meta.isAuth) {
    if (isAuthenticated) {
      next() // 已登录，放行
    } else {
      // 未登录，重定向到登录页
      // 保存当前想去的路径，登录后跳回来
      ElMessage.warning('请先完成登录')
      next({
        path: '/', // 假设你的登录页路径是 /login
        query: { redirect: to.fullPath }
      })
    }
  } else {
    next() // 不需要登录的页面，直接放行
  }
})

router.afterEach((to) => {
  // 1. 获取 meta 中的 title
  const title = to.meta.title as string
  
  // 2. 如果有 title，则修改 document.title
  if (title) {
    document.title = `${title} | EngAI`
  } else {
    document.title = 'EngAI' // 默认标题
  }
})

export default router