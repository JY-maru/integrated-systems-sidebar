'use strict'
// 허브: 콘텐츠 스크립트 간 직접 통신이 불가능한 구조적 제약을 메우는
// switch-case 디스패처. content script 쪽(message_router.js, 맵 기반)과
// 의도적으로 다른 스타일을 유지한다 (README.md §3-3 참고 — 알려진 불일치).

importScripts('../js/config.js')

// 허브 상태 — 여러 탭에 걸쳐 지속되어야 하는 "현재 진행 중인 업무" 상태.
// MV3 서비스워커는 유휴 시 언제든 종료될 수 있으므로, 각 스텝이 끝날 때마다
// 재broadcast하고 A가 REQUEST_STATE로 다시 물어 복구할 수 있게 한다.
const hubState = { tracking: null }

function broadcastToA(type, payload) {
  chrome.tabs.query({ url: SPOG_CONFIG.PATTERNS.A }, (tabs) => {
    tabs.forEach((tab) => chrome.tabs.sendMessage(tab.id, { type, payload }))
  })
}

function updateTracking(part) {
  hubState.tracking = { ...(hubState.tracking || {}), active: true, ...part }
  broadcastToA(SPOG_CONFIG.MSG.WORK_STARTED, hubState.tracking)
}

function logToSheet(entry) {
  fetch(SPOG_CONFIG.SHEET_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
    .then(() => broadcastToA(SPOG_CONFIG.MSG.LOG_APPENDED, entry))
    .catch((err) => console.warn('[background] 로그 기록 실패', err))
}

// find-or-create-tab 패턴 (README.md §5). 필요한 시스템의 탭이 열려
// 있지 않으면 대신 열어준다. 4~5곳에서 거의 동일한 모양으로 재사용된다.
// focus:true면 자동화 대상 탭을 화면 앞으로 가져와, 값이 순서대로 채워지는
// 과정을 사용자가 직접 눈으로 볼 수 있게 한다 (B/C처럼 사용자가 버튼을 눌러
// 직접 트리거한 자동화용). D로 가는 C→D 자동 연쇄처럼 사용자 개입 없이
// 조용히 처리돼야 하는 경우는 focus:false로 백그라운드에서 수행한다.
function runOnHost(pattern, entryUrl, message, focus) {
  chrome.tabs.query({ url: pattern }, (tabs) => {
    if (tabs.length > 0) {
      if (focus) {
        chrome.tabs.update(tabs[0].id, { active: true }, () => chrome.tabs.sendMessage(tabs[0].id, message))
      } else {
        chrome.tabs.sendMessage(tabs[0].id, message)
      }
      return
    }
    chrome.tabs.create({ url: entryUrl, active: !!focus }, (newTab) => {
      function onUpdated(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated)
          // 페이지 자체 초기화 스크립트가 붙을 시간을 살짝 기다렸다가 전송
          setTimeout(() => chrome.tabs.sendMessage(newTab.id, message), SPOG_CONFIG.TAB_READY_DELAY_MS)
        }
      }
      chrome.tabs.onUpdated.addListener(onUpdated)
    })
  })
}

// 자동화가 끝난 뒤 사이드바(System A)로 화면을 되돌려, 결과 반영과 다음
// 버튼 클릭을 바로 이어갈 수 있게 한다.
function focusA() {
  chrome.tabs.query({ url: SPOG_CONFIG.PATTERNS.A }, (tabs) => {
    if (tabs[0]) chrome.tabs.update(tabs[0].id, { active: true })
  })
}

chrome.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case SPOG_CONFIG.MSG.RUN_CASE_CREATION:
      updateTracking({ step: 'case_creating' })
      runOnHost(SPOG_CONFIG.PATTERNS.B, SPOG_CONFIG.ENTRY_URLS.B, message, true)
      break

    case SPOG_CONFIG.MSG.CASE_CREATED:
      updateTracking({ step: 'case_created', case: message.payload })
      broadcastToA(SPOG_CONFIG.MSG.CASE_CREATED, message.payload)
      logToSheet({
        step: 'case_created',
        caseId: message.payload.caseId,
        detail: `${message.payload.name} / ${message.payload.code}`,
      })
      focusA()
      break

    case SPOG_CONFIG.MSG.RUN_BLOCK_CREATION:
      updateTracking({ step: 'block_creating' })
      runOnHost(SPOG_CONFIG.PATTERNS.C, SPOG_CONFIG.ENTRY_URLS.C, message, true)
      break

    case SPOG_CONFIG.MSG.BLOCK_CREATED:
      updateTracking({ step: 'block_created', block: message.payload })
      broadcastToA(SPOG_CONFIG.MSG.BLOCK_CREATED, message.payload)
      logToSheet({
        step: 'block_created',
        caseId: hubState.tracking?.case?.caseId,
        detail: message.payload.blockId,
      })
      focusA()
      break

    case SPOG_CONFIG.MSG.RUN_RESERVATION_CREATION:
      updateTracking({ step: 'reservation_creating' })
      runOnHost(SPOG_CONFIG.PATTERNS.C, SPOG_CONFIG.ENTRY_URLS.C, message, true)
      break

    case SPOG_CONFIG.MSG.RESERVATION_CREATED:
      updateTracking({ step: 'reservation_created', reservation: message.payload })
      broadcastToA(SPOG_CONFIG.MSG.RESERVATION_CREATED, message.payload)
      logToSheet({
        step: 'reservation_created',
        caseId: hubState.tracking?.case?.caseId,
        detail: message.payload.reservationId,
      })
      focusA()
      // C → D 자동 연쇄: 사용자 개입 없이 고객 응대 메모에 예약정보를 반영시킨다.
      // (D는 탭 전환 없이 백그라운드에서 조용히 처리 — 사이드바에 결과만 반영)
      runOnHost(SPOG_CONFIG.PATTERNS.D, SPOG_CONFIG.ENTRY_URLS.D, {
        type: SPOG_CONFIG.MSG.FILL_CUSTOMER_MEMO,
        payload: message.payload,
      }, false)
      break

    case SPOG_CONFIG.MSG.RUN_VEHICLE_SEARCH:
      updateTracking({ step: 'vehicle_searching' })
      runOnHost(SPOG_CONFIG.PATTERNS.C, SPOG_CONFIG.ENTRY_URLS.C, message, true)
      break

    case SPOG_CONFIG.MSG.VEHICLE_CANDIDATES_READY:
      updateTracking({ step: 'vehicle_searched' })
      broadcastToA(SPOG_CONFIG.MSG.VEHICLE_CANDIDATES_READY, message.payload)
      logToSheet({
        step: 'vehicle_searched',
        caseId: hubState.tracking?.case?.caseId,
        detail: `후보 ${message.payload.candidates.length}건`,
      })
      focusA()
      break

    case SPOG_CONFIG.MSG.CUSTOMER_MEMO_FILLED:
      updateTracking({ step: 'customer_memo_filled', active: false })
      broadcastToA(SPOG_CONFIG.MSG.CUSTOMER_MEMO_FILLED, message.payload)
      logToSheet({
        step: 'customer_memo_filled',
        caseId: hubState.tracking?.case?.caseId,
        detail: '고객 응대 메모 자동 반영 완료',
      })
      break

    case SPOG_CONFIG.MSG.INBOUND_EVENT:
      broadcastToA(SPOG_CONFIG.MSG.INBOUND_EVENT, message.payload)
      break

    case SPOG_CONFIG.MSG.REQUEST_STATE:
      if (sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, { type: SPOG_CONFIG.MSG.STATE_SNAPSHOT, payload: hubState })
      }
      break
  }
})
