// 서비스 워커 자동 정리: 모든 캐시를 삭제하고 자기 자신을 해제합니다.
// 브라우저가 이 파일의 변경을 감지하면 자동으로 활성화됩니다.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  )
})

// fetch 가로채기 안 함 → 모든 요청이 네트워크로 직접 전달
