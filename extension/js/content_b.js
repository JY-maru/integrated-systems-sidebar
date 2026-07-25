'use strict'
// System B 어댑터. RUN_CASE_CREATION을 받으면 실제 폼 DOM을 자동 채움+제출한다(RPA).
// 결과(접수 카드 번호)는 injected_b.js가 가로챈 fetch 응답에서 얻는다.

const FIELD_ID_MAP = {
  name: 'field-name',
  phone: 'field-phone',
  code: 'field-code',
  receivedAt: 'field-received-at',
  location: 'field-location',
  detail: 'field-detail',
}

function injectPageScript(file) {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL(file)
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)
}

// 리액트 controlled input은 네이티브 value setter를 우회해야 상태에 반영된다.
// (input.value = x 만으로는 리액트의 onChange가 발화하지 않는다)
function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 필드를 한 번에 다 채우지 않고 한 항목씩 순서대로 채운다. 다 채운 뒤에도
// 곧바로 제출하지 않고 잠시 멈췄다가 제출 버튼을 누른다.
async function fillAndSubmitCase(fields) {
  for (const [key, id] of Object.entries(FIELD_ID_MAP)) {
    const el = document.getElementById(id)
    if (el) setNativeValue(el, fields[key] || '')
    await delay(SPOG_CONFIG.RPA_FIELD_DELAY_MS)
  }
  await delay(SPOG_CONFIG.RPA_SUBMIT_PAUSE_MS)
  document.getElementById('submit-case-btn')?.click()
}

injectPageScript('js/injected_b.js')

window.addEventListener('message', (event) => {
  const msg = event.data
  if (msg?.type === 'INTERCEPTED_DETAIL') {
    chrome.runtime.sendMessage({ type: SPOG_CONFIG.MSG.CASE_CREATED, payload: msg.payload })
  }
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === SPOG_CONFIG.MSG.RUN_CASE_CREATION) {
    fillAndSubmitCase(message.payload)
  }
})
