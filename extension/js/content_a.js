'use strict'
// System A 진입점. 진입 조건(정확한 페이지인지)은 manifest의 matches가
// 이미 보장하므로, 여기서는 모듈 초기화 순서만 책임진다.
// 로드 순서: config → state → text_parser → dom_parser → candidate_search
//            → message_router → ui_controller → content_a(본 파일, init 호출)

// 허브 tracking.step(예: 'block_creating') → 파이프라인 진행 표시줄에서
// pulsing 처리할 스텝 키. *_created 시점에는 markStepDone으로 정적 점이 된다.
const STEP_ACTIVE_MAP = {
  case_creating: 'case_created',
  block_creating: 'block_created',
  reservation_creating: 'reservation_created',
  vehicle_searching: 'vehicle_searched',
}

function init() {
  const callbacks = {
    onCreateCase: handleCreateCase,
    onRunBlock: handleRunBlock,
    onRunReservation: handleRunReservation,
    onRunSearch: handleRunSearch,
    onToggleNotifications: handleToggleNotifications,
    onResetAll: handleResetAll,
  }

  SPOG_UI.createSidebar(callbacks)
  SPOG_MESSAGE_ROUTER.initRuntimeDispatch(HANDLERS)

  // 접수양식 폼은 사이드바가 아니라 포털 페이지 본문(iframe)에 있다.
  const hostEmbedFrame = document.getElementById('intake-embed-frame')
  if (hostEmbedFrame) {
    SPOG_MESSAGE_ROUTER.setEmbedFrame(hostEmbedFrame.contentWindow)
  }

  // SW 재시작(cold start) 대비: 로드 시 허브 상태를 다시 물어 복구한다.
  SPOG_MESSAGE_ROUTER.sendToBackground(SPOG_CONFIG.MSG.REQUEST_STATE, {})
}

async function handleCreateCase() {
  // 임베드 폼(별도 오리진)에 현재 입력값을 요청 → 교차검증.
  // 타임아웃/빈 값이면 처리 중단 (README.md §7 "값 불일치 → 처리 중단"과 동일한 방어).
  const rawText = await SPOG_MESSAGE_ROUTER.requestIframeData('intake_text')
  if (!rawText) {
    window.alert('접수양식 값을 가져오지 못했습니다. 임베드 폼에 내용을 입력했는지 확인하세요.')
    return
  }

  const fields = SPOG_TEXT_PARSER.parseIntakeText(rawText)
  if (!SPOG_TEXT_PARSER.isComplete(fields)) {
    window.alert('필수 항목(고객명/식별코드)이 비어 있습니다.')
    return
  }

  SPOG_UI.setStatus('접수 카드 생성 중...')
  SPOG_MESSAGE_ROUTER.sendToBackground(SPOG_CONFIG.MSG.RUN_CASE_CREATION, fields)
}

function handleRunBlock() {
  const activeCase = SPOG_STATE.get('activeCase')
  SPOG_UI.setStatus('블록 생성 중...')
  SPOG_MESSAGE_ROUTER.sendToBackground(SPOG_CONFIG.MSG.RUN_BLOCK_CREATION, {
    date: new Date().toISOString().slice(0, 10),
    timeSlot: '09:00-11:00',
    reason: activeCase ? `케이스 ${activeCase.caseId} 관련` : '자동화 데모',
  })
}

function handleRunReservation() {
  const activeCase = SPOG_STATE.get('activeCase')
  SPOG_UI.setStatus('예약 생성 중...')
  SPOG_MESSAGE_ROUTER.sendToBackground(SPOG_CONFIG.MSG.RUN_RESERVATION_CREATION, {
    customerName: activeCase?.name || '',
    phone: activeCase?.phone || '',
    datetime: activeCase?.receivedAt || '',
    resourceType: '준중형',
  })
}

function handleRunSearch() {
  SPOG_UI.setStatus('후보 검색 중...')
  SPOG_MESSAGE_ROUTER.sendToBackground(SPOG_CONFIG.MSG.RUN_VEHICLE_SEARCH, {})
}

function handleToggleNotifications(checked) {
  const settings = SPOG_STATE.get('settings')
  SPOG_STATE.set('settings', { ...settings, notifications: checked })
}

function handleResetAll() {
  SPOG_STATE.set('activeCase', null)
  SPOG_STATE.set('vehicleCandidates', [])
  SPOG_STATE.set('blockInfo', null)
  SPOG_STATE.set('reservationInfo', null)
  SPOG_STATE.set('customerMemoStatus', null)
  SPOG_STATE.set('inboundHistory', [])
  SPOG_STATE.set('badges', { inbound: 0 })
  SPOG_UI.resetAll()
}

// background → A 로 오는 메시지의 "타입 → 핸들러" 맵.
const HANDLERS = {
  [SPOG_CONFIG.MSG.CASE_CREATED]: (msg) => {
    SPOG_STATE.set('activeCase', msg.payload)
    SPOG_UI.onCriticalEventDetected(msg.payload) // 인터럽트 강제 전환
  },

  [SPOG_CONFIG.MSG.BLOCK_CREATED]: (msg) => {
    SPOG_STATE.set('blockInfo', msg.payload)
    SPOG_UI.renderBlockInfo(msg.payload)
    SPOG_UI.markStepDone('block_created')
    SPOG_UI.setStatus('블록 생성 완료', 'ok')
  },

  [SPOG_CONFIG.MSG.RESERVATION_CREATED]: (msg) => {
    SPOG_STATE.set('reservationInfo', msg.payload)
    SPOG_UI.renderReservationInfo(msg.payload)
    SPOG_UI.markStepDone('reservation_created')
    SPOG_UI.setStatus('예약 생성 완료 — 고객 응대 반영 대기 중', 'ok')
  },

  [SPOG_CONFIG.MSG.VEHICLE_CANDIDATES_READY]: (msg) => {
    SPOG_STATE.set('vehicleCandidates', msg.payload.candidates)
    SPOG_UI.renderCandidates(msg.payload.candidates)
    SPOG_UI.markStepDone('vehicle_searched')
    SPOG_UI.setStatus('후보 검색 완료', 'ok')
  },

  [SPOG_CONFIG.MSG.CUSTOMER_MEMO_FILLED]: (msg) => {
    SPOG_STATE.set('customerMemoStatus', msg.payload)
    SPOG_UI.markStepDone('customer_memo_filled')
    SPOG_UI.setStatus('고객 응대 메모 자동 반영 완료', 'ok')
  },

  [SPOG_CONFIG.MSG.INBOUND_EVENT]: (msg) => {
    const history = SPOG_STATE.get('inboundHistory')
    SPOG_STATE.set('inboundHistory', [...history, msg.payload])
    SPOG_UI.appendInboundEntry(msg.payload)

    const badges = SPOG_STATE.get('badges')
    const nextCount = badges.inbound + 1
    SPOG_STATE.set('badges', { ...badges, inbound: nextCount })
    SPOG_UI.setBadge('inbound', nextCount)
    // 인바운드는 뱃지만 갱신하고 패널을 강제 전환하지 않는다 (§7 원칙).
  },

  [SPOG_CONFIG.MSG.LOG_APPENDED]: (msg) => {
    SPOG_UI.appendPostEntry(msg.payload)
    SPOG_UI.markStepDone('logged')
  },

  [SPOG_CONFIG.MSG.WORK_STARTED]: (msg) => {
    SPOG_UI.setTrackDot('dispatch', msg.payload?.active !== false)
    const activeStepKey = STEP_ACTIVE_MAP[msg.payload?.step]
    if (activeStepKey) SPOG_UI.setStepActive(activeStepKey)
  },

  [SPOG_CONFIG.MSG.STATE_SNAPSHOT]: (msg) => {
    if (msg.payload?.tracking?.active) {
      SPOG_UI.setTrackDot('dispatch', true)
    }
  },
}

init()
