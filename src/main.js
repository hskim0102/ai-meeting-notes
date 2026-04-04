// 서비스 워커 즉시 제거 (캐시 문제 완전 해결)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
  if (typeof caches !== 'undefined') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
  }
}

import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { MotionPlugin } from '@vueuse/motion'
import './style.css'
import App from './App.vue'

import DashboardView from './views/DashboardView.vue'
import MeetingDetailView from './views/MeetingDetailView.vue'
import MeetingsListView from './views/MeetingsListView.vue'
import ActionItemsView from './views/ActionItemsView.vue'
import NewMeetingView from './views/NewMeetingView.vue'
import SearchView from './views/SearchView.vue'
import RoomListView from './views/RoomListView.vue'
import RoomCalendarView from './views/RoomCalendarView.vue'
import MeetingAnalysisView from './views/MeetingAnalysisView.vue'
import ReportView from './views/ReportView.vue'
import LoginView from './views/LoginView.vue'
import SettingsView from './views/SettingsView.vue'
import AuditLogView from './views/AuditLogView.vue'
import RecordingsListView from './views/RecordingsListView.vue'
import ChatView from './views/ChatView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/meetings', name: 'meetings', component: MeetingsListView },
    { path: '/meetings/new', name: 'new-meeting', component: NewMeetingView },
    { path: '/recordings', name: 'recordings', component: RecordingsListView },
    { path: '/meetings/:id', name: 'meeting-detail', component: MeetingDetailView },
    { path: '/action-items', name: 'action-items', component: ActionItemsView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/chat', name: 'chat', component: ChatView },
    { path: '/rooms', name: 'rooms', component: RoomListView },
    { path: '/rooms/calendar', name: 'room-calendar', component: RoomCalendarView },
    { path: '/analysis', name: 'analysis', component: MeetingAnalysisView },
    { path: '/reports', name: 'reports', component: ReportView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/audit-log', name: 'audit-log', component: AuditLogView, meta: { requiresAdmin: true } },
  ],
})

// 라우트 가드: 인증 체크
router.beforeEach((to, from, next) => {
  const user = JSON.parse(localStorage.getItem('auth_user') || 'null')
  if (!to.meta.public && !user) {
    next({ name: 'login' })
  } else if (to.name === 'login' && user) {
    next({ name: 'dashboard' })
  } else if (to.meta.requiresAdmin && user?.role !== 'admin') {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

const app = createApp(App)
app.use(router)
app.use(MotionPlugin)

// 라우터 초기 네비게이션 완료 후 앱 마운트 (transition out-in 빈 화면 방지)
router.isReady().then(() => {
  app.mount('#app')
})
