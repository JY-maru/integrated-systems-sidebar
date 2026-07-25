'use strict'
// System C 어댑터. 원버튼 3종: 블록생성 / 예약생성(폼 자동채움+제출, 결과는
// injected_c.js가 가로챈 fetch 응답에서 획득) / 후보 검색(결과 표를 dom_parser로
// 스크래핑 → candidate_search로 순수 스코어링).

const BLOCK_FIELD_IDS = { date: 'block-date', timeSlot: 'block-timeslot', reason: 'block-reason' }
const RESERVATION_FIELD_IDS = {
  customerName: 'rsv-customer', phone: 'rsv-phone', datetime: 'rsv-datetime', resourceType: 'rsv-resource-type',
}

function injectPageScript(file) {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL(file)
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)
}

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
async function fillFieldsSequentially(idMap, values) {
  for (const [key, id] of Object.entries(idMap)) {
    const el = document.getElementById(id)
    if (el) setNativeValue(el, values[key] || '')
    await delay(SPOG_CONFIG.RPA_FIELD_DELAY_MS)
  }
}

async function fillAndSubmitBlock(payload) {
  await fillFieldsSequentially(BLOCK_FIELD_IDS, payload)
  await delay(SPOG_CONFIG.RPA_SUBMIT_PAUSE_MS)
  document.getElementById('submit-block-btn')?.click()
}

async function fillAndSubmitReservation(payload) {
  await fillFieldsSequentially(RESERVATION_FIELD_IDS, payload)
  await delay(SPOG_CONFIG.RPA_SUBMIT_PAUSE_MS)
  document.getElementById('submit-reservation-btn')?.click()
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

async function runVehicleSearch() {
  document.getElementById('search-vehicles-btn')?.click()
  const table = await waitForElement('#vehicle-table', SPOG_CONFIG.IFRAME_TIMEOUT_MS)
  if (!table) return

  const rows = SPOG_DOM_PARSER.parseHtmlTable(table, {
    id: ['ID'],
    code: ['식별코드'],
    type: ['유형'],
    lat: ['위도'],
    lng: ['경도'],
    status: ['상태'],
  })
  const scored = SPOG_CANDIDATE_SEARCH.scoreCandidates(rows, SPOG_CONFIG.REFERENCE_POINT, { limit: 5 })
  chrome.runtime.sendMessage({ type: SPOG_CONFIG.MSG.VEHICLE_CANDIDATES_READY, payload: { candidates: scored } })
}

injectPageScript('js/injected_c.js')

window.addEventListener('message', (event) => {
  const msg = event.data
  if (msg?.type !== 'INTERCEPTED_DETAIL') return
  if (msg.kind === 'block') {
    chrome.runtime.sendMessage({ type: SPOG_CONFIG.MSG.BLOCK_CREATED, payload: msg.payload })
  } else if (msg.kind === 'reservation') {
    chrome.runtime.sendMessage({ type: SPOG_CONFIG.MSG.RESERVATION_CREATED, payload: msg.payload })
  }
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === SPOG_CONFIG.MSG.RUN_BLOCK_CREATION) fillAndSubmitBlock(message.payload)
  else if (message.type === SPOG_CONFIG.MSG.RUN_RESERVATION_CREATION) fillAndSubmitReservation(message.payload)
  else if (message.type === SPOG_CONFIG.MSG.RUN_VEHICLE_SEARCH) runVehicleSearch()
})
