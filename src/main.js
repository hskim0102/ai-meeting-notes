import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

import DashboardView from './views/DashboardView.vue'
import MeetingDetailView from './views/MeetingDetailView.vue'
import MeetingsListView from './views/MeetingsListView.vue'
import ActionItemsView from './views/ActionItemsView.vue'
import NewMeetingView from './views/NewMeetingView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/meetings', name: 'meetings', component: MeetingsListView },
    { path: '/meetings/new', name: 'new-meeting', component: NewMeetingView },
    { path: '/meetings/:id', name: 'meeting-detail', component: MeetingDetailView },
    { path: '/action-items', name: 'action-items', component: ActionItemsView },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
