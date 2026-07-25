'use strict'
// 도메인 상수, 메시지 타입, 타임아웃 값을 한 곳에 동결해 등록한다.
// content script(<script> 로드)와 service worker(importScripts) 양쪽에서
// 같은 소스를 참조해 엔드포인트/타임아웃 중복 정의를 막는다.

const SPOG_CONFIG = Object.freeze({
  PATTERNS: {
    A: 'http://localhost:8081/*',
    B: 'http://localhost:8082/*',
    C: 'http://localhost:8083/*',
    D: 'http://localhost:8084/*',
  },
  ENTRY_URLS: {
    A: 'http://localhost:8081/',
    B: 'http://localhost:8082/',
    C: 'http://localhost:8083/',
    D: 'http://localhost:8084/',
  },
  SHEET_LOG_URL: 'http://localhost:8086/api/log',

  IFRAME_TIMEOUT_MS: 4000,
  TAB_READY_DELAY_MS: 250,
  // RPA 폼 자동입력: 필드를 한 번에 다 채우지 않고 한 항목씩 순서대로 채운다.
  // 다 채운 뒤에도 곧바로 제출하지 않고 잠시 멈췄다가 제출 버튼을 누른다
  // (제출 직전 확인 여지를 남기는, 실제 자동화의 의도된 동작).
  RPA_FIELD_DELAY_MS: 350,
  RPA_SUBMIT_PAUSE_MS: 400,

  MSG: {
    // System A 사이드바 ↔ 임베드 폼(iframe)
    REQUEST_DATA: 'REQUEST_DATA',
    RESPONSE_DATA: 'RESPONSE_DATA',

    // System B: 접수 카드 RPA 생성
    RUN_CASE_CREATION: 'RUN_CASE_CREATION',
    CASE_CREATED: 'CASE_CREATED',

    // System C: 예약·배차 원버튼 3종
    RUN_BLOCK_CREATION: 'RUN_BLOCK_CREATION',
    BLOCK_CREATED: 'BLOCK_CREATED',
    RUN_RESERVATION_CREATION: 'RUN_RESERVATION_CREATION',
    RESERVATION_CREATED: 'RESERVATION_CREATED',
    RUN_VEHICLE_SEARCH: 'RUN_VEHICLE_SEARCH',
    VEHICLE_CANDIDATES_READY: 'VEHICLE_CANDIDATES_READY',

    // System D: 고객 응대 인바운드 + 예약정보 역기입
    FILL_CUSTOMER_MEMO: 'FILL_CUSTOMER_MEMO',
    CUSTOMER_MEMO_FILLED: 'CUSTOMER_MEMO_FILLED',
    INBOUND_EVENT: 'INBOUND_EVENT',

    // 허브 상태 / 로그
    LOG_APPENDED: 'LOG_APPENDED',
    WORK_STARTED: 'WORK_STARTED',
    REQUEST_STATE: 'REQUEST_STATE',
    STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  },

  STORAGE_KEYS: {
    SETTINGS: 'spog_settings',
  },

  // 후보 차량 검색 기준점 (데모용 고정 좌표 — 서울시청)
  REFERENCE_POINT: { lat: 37.5663, lng: 126.9779 },
})

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_CONFIG = SPOG_CONFIG
}
