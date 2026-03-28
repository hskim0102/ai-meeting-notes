import { ref, computed } from 'vue'

const notifications = ref([
  { id: 1, type: 'action', title: '액션아이템 기한 임박', message: 'Figma 토큰 구조 설계 기한이 내일입니다', time: '5분 전', read: false, link: '/action-items' },
  { id: 2, type: 'meeting', title: '새 회의록 생성', message: '주간 스프린트 회고 회의록이 생성되었습니다', time: '30분 전', read: false, link: '/meetings/5' },
  { id: 3, type: 'comment', title: '코멘트 알림', message: '김민수님이 회의록에 코멘트를 남겼습니다', time: '1시간 전', read: true, link: '/meetings/1' },
  { id: 4, type: 'system', title: '시스템 알림', message: '회의실 예약이 확인되었습니다', time: '2시간 전', read: true, link: '/rooms' },
])

export function useNotifications() {
  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  function markAsRead(id) {
    const n = notifications.value.find(n => n.id === id)
    if (n) n.read = true
  }

  function markAllAsRead() {
    notifications.value.forEach(n => n.read = true)
  }

  function addNotification(notification) {
    notifications.value.unshift({
      id: Date.now(),
      time: '방금 전',
      read: false,
      ...notification,
    })
  }

  function removeNotification(id) {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }

  return { notifications, unreadCount, markAsRead, markAllAsRead, addNotification, removeNotification }
}
