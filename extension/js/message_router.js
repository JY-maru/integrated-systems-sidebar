'use strict'
// window.postMessage 수신(임베드 iframe)과 chrome.runtime.onMessage 수신(background)을
// 각각 "타입 → 핸들러" 매핑 테이블로 분배한다.

const SPOG_MESSAGE_ROUTER = (() => {
  let embedFrameWindow = null

  function setEmbedFrame(win) {
    embedFrameWindow = win
  }

  // 임베드 폼에 현재 값을 요청한다. 요청ID 없이 kind로만 매칭하고,
  // 동시에 하나만 대기한다는 전제하에 타임아웃 시 null을 반환한다.
  // (REFERENCE.md §4-2 패턴)
  function requestIframeData(kind) {
    return new Promise((resolve) => {
      if (!embedFrameWindow) return resolve(null)

      const timer = setTimeout(() => {
        cleanup()
        resolve(null)
      }, SPOG_CONFIG.IFRAME_TIMEOUT_MS)

      function onMessage(event) {
        const msg = event.data
        if (msg?.type === SPOG_CONFIG.MSG.RESPONSE_DATA && msg.kind === kind) {
          clearTimeout(timer)
          cleanup()
          resolve(msg.payload)
        }
      }
      function cleanup() {
        window.removeEventListener('message', onMessage)
      }

      window.addEventListener('message', onMessage)
      embedFrameWindow.postMessage({ type: SPOG_CONFIG.MSG.REQUEST_DATA, kind }, '*')
    })
  }

  function sendToBackground(type, payload) {
    chrome.runtime.sendMessage({ type, payload })
  }

  // background → System A 로 오는 메시지를 "타입 → 핸들러" 객체 리터럴 맵으로 분배.
  // 새 이벤트를 추가할 때 이 함수 자체는 건드리지 않고 handlers 맵에 한 줄만 추가하면 된다.
  function initRuntimeDispatch(handlers) {
    chrome.runtime.onMessage.addListener((msg) => {
      handlers[msg.type]?.(msg)
    })
  }

  return { setEmbedFrame, requestIframeData, sendToBackground, initRuntimeDispatch }
})()

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_MESSAGE_ROUTER = SPOG_MESSAGE_ROUTER
}
