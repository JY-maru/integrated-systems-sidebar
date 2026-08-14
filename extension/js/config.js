// config.js
// [PSEUDOCODE] 이 파일은 실제 동작 코드가 아니라, 원본 사내 확장 프로그램의
// 설정/유틸 모듈이 어떤 책임을 지는지를 보여주기 위한 구조적 요약입니다.
// 함수 본문은 실제 알고리즘/분기 구조를 최대한 그대로 옮기되, 실제 URL·부서
// 고유명사는 모두 mock 이름으로 치환했습니다.

// ── 전역 설정 객체 (모든 System A~D 콘텐츠 스크립트가 공유) ──
window.RPA_APP_CONFIG = {
  URL: {
    // System C(예약·배차) 예약 화면 — 탭이 없을 때 새로 열 때 사용
    SYSTEM_C_RESERVATION: 'http://localhost:8083/reservation',
    // 사이드바 관리용 백엔드 웹훅(공지사항/버전/큐권한 조회) — 실제로는 GAS 등 외부 스크립트
    SIDEBAR_MGMT_WEBHOOK: 'http://localhost:8086/sidebar-webhook',
    RESULT_LOG_WEBHOOK: 'http://localhost:8085/log',
  },

  TIMEOUT: {
    ELEMENT_DEFAULT: 3000,
    ELEMENT_LONG: 8000,
    WIDGET_INJECT: 400,
    TAB_CREATE_DELAY: 1500,
  },

  SIDEBAR_SYNC: {
    ALARM_NAME: 'spog-sidebar-sync',
    POLL_INTERVAL_MIN: 5, // chrome.alarms 최소 주기 제약(분 단위) 그대로 반영
  },

  STORAGE_KEY: {
    LAST_SYNC_TIME: 'SPOG_LAST_SYNC_TIME',
  },

  TONE: {
    // 토스트/상태바 톤 ↔ 아이콘/색 매핑을 이 한 곳에서만 파생시킨다
    success: { icon: '✓', color: '#22C55E' },
    error: { icon: '✕', color: '#EF4444' },
    warning: { icon: '⚠️', color: '#F59E0B' },
    info: { icon: 'ℹ️', color: '#3B82F6' },
    pending: { icon: '…', color: '#94A3B8' },
  },
};

// [주의] 과거 이 모듈에 TRUSTED_ORIGINS/isTrustedOrigin이 있었으나 실제 호출부가
// 0곳인 죽은 코드였다 — 오리진 검증은 이제 message_router.js의 중앙 registry가
// 전담한다(아래 참고). 여기 남겨두면 "검증하는 것처럼 보이지만 아무도 안 부르는"
// 함정이 재발하므로 이 파일에는 두지 않는다.

function getOneMonthAgoDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d;
}

function getCurrentTimeStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// 응답 헤더/쿠키 등에서 인증 토큰을 추출하는 헬퍼 — 실제 파싱 규칙은 사이트마다
// 다르므로 여기서는 "여러 후보 소스를 순서대로 시도하고 첫 성공을 채택한다"는
// 구조만 남긴다.
function extractToken(source) {
  const candidates = [
    () => source?.headers?.get?.('x-auth-token'),
    () => source?.cookie?.match(/spog_token=([^;]+)/)?.[1],
  ];
  for (const tryExtract of candidates) {
    const token = tryExtract();
    if (token) return token;
  }
  return null;
}

const RPA_UTILS = {
  log: (...args) => console.log('[SPoG]', ...args),
  warn: (...args) => console.warn('[SPoG]', ...args),
  error: (...args) => console.error('[SPoG]', ...args),
};
window.RPA_UTILS = RPA_UTILS;
