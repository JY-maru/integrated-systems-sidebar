'use strict'
// 페이지 컨텍스트(MAIN world)에서 실행된다. 콘텐츠 스크립트는 격리된 월드에서
// 실행되어 페이지가 호출하는 fetch에 접근할 수 없으므로, 이 스크립트를
// <script src="..."> 로 주입해 페이지 자신의 fetch를 가로챈다.
// (README.md §3-1)

;(() => {
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
      if (url && url.includes('/api/cases') && response.ok) {
        const payload = await response.clone().json()
        window.postMessage({ type: 'INTERCEPTED_DETAIL', payload }, '*')
      }
    } catch {
      // 파싱 실패는 무시 — 원래 응답은 그대로 페이지에 전달된다.
    }
    return response
  }
})()
