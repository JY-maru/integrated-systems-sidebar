'use strict'
// 페이지 컨텍스트(MAIN world) 주입. 블록/예약 생성 두 엔드포인트의 응답을
// 가로채 kind로 구분해 되돌려준다. (README.md §3-1)

;(() => {
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
      let kind = null
      if (url && url.includes('/api/blocks')) kind = 'block'
      else if (url && url.includes('/api/reservations')) kind = 'reservation'
      if (kind && response.ok) {
        const payload = await response.clone().json()
        window.postMessage({ type: 'INTERCEPTED_DETAIL', kind, payload }, '*')
      }
    } catch {
      // 파싱 실패는 무시
    }
    return response
  }
})()
