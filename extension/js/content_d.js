'use strict'
// System D 어댑터. 두 가지 독립 트리거:
// (1) 콜백 이력 리스트에 새 항목이 추가되는 것을 감지해 인바운드 이벤트로 전달
// (2) background로부터 예약정보를 받아 응대 메모에 자동 삽입(RPA)

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function waitForElement(selector, timeoutMs) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector)
    if (existing) return resolve(existing)
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(document.querySelector(selector))
    }, timeoutMs)
  })
}

async function observeCallbackHistory() {
  const list = await waitForElement('#callback-history', SPOG_CONFIG.IFRAME_TIMEOUT_MS)
  if (!list) return

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1 || node.tagName !== 'LI') return
        chrome.runtime.sendMessage({
          type: SPOG_CONFIG.MSG.INBOUND_EVENT,
          payload: {
            id: node.dataset.id,
            customerName: node.dataset.customer,
            phone: node.dataset.phone,
            time: node.dataset.time,
            reason: node.dataset.reason,
          },
        })
      })
    })
  }).observe(list, { childList: true })
}

function fillCustomerMemo(payload) {
  const memo = document.getElementById('customer-memo')
  if (!memo) return
  const insertText = `[자동입력] 예약번호: ${payload.reservationId} / 고객명: ${payload.customerName} / 희망일시: ${payload.datetime}\n`
  setNativeValue(memo, (memo.value || '') + insertText)
  chrome.runtime.sendMessage({ type: SPOG_CONFIG.MSG.CUSTOMER_MEMO_FILLED, payload })
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === SPOG_CONFIG.MSG.FILL_CUSTOMER_MEMO) {
    fillCustomerMemo(message.payload)
  }
})

observeCallbackHistory()
