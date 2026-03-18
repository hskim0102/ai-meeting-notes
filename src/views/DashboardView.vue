<script setup>
import { ref } from 'vue'
import StatCard from '../components/StatCard.vue'
import MeetingCard from '../components/MeetingCard.vue'
import ActionItemRow from '../components/ActionItemRow.vue'
import { meetings, stats, upcomingMeetings, recentActionItems } from '../data/mockData.js'

const actionItems = ref([...recentActionItems])
const recentMeetings = meetings.filter(m => m.status === 'completed').slice(0, 3)

const toggleItem = (item) => {
  item.done = !item.done
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-slate-900">대시보드</h1>
      <p class="text-sm text-slate-500 mt-1">오늘의 회의 현황과 주요 지표를 확인하세요</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <StatCard
        title="전체 회의"
        :value="stats.totalMeetings"
        subtitle="이번 달"
        color="primary"
        icon="calendar"
      />
      <StatCard
        title="총 회의 시간"
        :value="`${stats.totalHours}h`"
        subtitle="이번 달"
        color="accent"
        icon="clock"
      />
      <StatCard
        title="액션 아이템 완료"
        :value="`${stats.actionItemsCompleted}/${stats.actionItemsTotal}`"
        :subtitle="`${Math.round(stats.actionItemsCompleted / stats.actionItemsTotal * 100)}% 달성률`"
        color="success"
        icon="check"
      />
      <StatCard
        title="회의 분위기"
        :value="`${stats.avgSentiment}%`"
        subtitle="긍정 지수"
        color="warning"
        icon="smile"
      />
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- Recent Meetings -->
      <div class="col-span-2">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-slate-900">최근 회의</h2>
          <router-link to="/meetings" class="text-sm text-primary-500 hover:text-primary-600 font-medium">
            전체 보기 &rarr;
          </router-link>
        </div>
        <div class="space-y-3">
          <MeetingCard v-for="meeting in recentMeetings" :key="meeting.id" :meeting="meeting" />
        </div>

        <!-- Live Meeting Banner -->
        <div v-if="meetings.find(m => m.status === 'in-progress')" class="mt-4 bg-primary-50 border border-primary-200 rounded-xl p-4">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div class="w-3 h-3 bg-primary-500 rounded-full"></div>
              <div class="w-3 h-3 bg-primary-500 rounded-full absolute inset-0 animate-ping"></div>
            </div>
            <div class="flex-1">
              <p class="text-sm font-semibold text-primary-900">진행 중인 회의</p>
              <p class="text-xs text-primary-600">{{ meetings.find(m => m.status === 'in-progress').title }}</p>
            </div>
            <router-link
              :to="`/meetings/${meetings.find(m => m.status === 'in-progress').id}`"
              class="text-xs px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              실시간 보기
            </router-link>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="space-y-6">
        <!-- Upcoming Meetings -->
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h3 class="text-sm font-semibold text-slate-900 mb-4">예정된 회의</h3>
          <div class="space-y-3">
            <div v-for="meeting in upcomingMeetings" :key="meeting.id" class="flex items-start gap-3">
              <div class="w-10 text-center shrink-0">
                <p class="text-xs text-slate-400">{{ meeting.date.slice(5) }}</p>
                <p class="text-sm font-semibold text-slate-700">{{ meeting.time }}</p>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-700 font-medium truncate">{{ meeting.title }}</p>
                <p class="text-xs text-slate-400">{{ meeting.participants.join(', ') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Items -->
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-900">미완료 액션 아이템</h3>
            <router-link to="/action-items" class="text-xs text-primary-500 hover:text-primary-600 font-medium">
              전체 보기
            </router-link>
          </div>
          <div class="-mx-4">
            <ActionItemRow
              v-for="(item, i) in actionItems.filter(a => !a.done).slice(0, 4)"
              :key="i"
              :item="item"
              show-meeting
              @toggle="toggleItem"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
