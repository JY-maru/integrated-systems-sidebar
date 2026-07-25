'use strict'
// 클로저로 감춰진 단일 상태 객체 + get/set/update 접근자.
// 등록되지 않은 키에 접근하면 콘솔 경고를 던지는 화이트리스트 가드 포함.
// (System A 탭 로컬 상태 — 페이지 새로고침 시 사라지는 휘발성 상태)

const SPOG_STATE = (() => {
  const _state = {
    activeCase: null, // { caseId, name, phone, code, receivedAt, location, detail }
    vehicleCandidates: [], // 스코어링된 후보 리스트
    blockInfo: null,
    reservationInfo: null,
    customerMemoStatus: null,
    inboundHistory: [], // 고객 응대 콜백 이력
    badges: { inbound: 0 },
    trackDots: { dispatch: false },
    settings: { notifications: true },
  }
  const knownKeys = new Set(Object.keys(_state))

  function guard(key) {
    if (!knownKeys.has(key)) {
      console.warn(`[SPOG_STATE] 알 수 없는 상태 키: ${key}`)
    }
  }

  return {
    get(key) {
      guard(key)
      return _state[key]
    },
    set(key, value) {
      guard(key)
      _state[key] = value
    },
    update(key, part) {
      guard(key)
      _state[key] = { ..._state[key], ...part }
    },
  }
})()

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_STATE = SPOG_STATE
}
