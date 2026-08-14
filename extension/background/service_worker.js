// service_worker.js
// [PSEUDOCODE] MV3 백그라운드 허브 — 4개 시스템 탭 사이의 모든 메시지가
// 이 서비스워커를 거쳐 중계된다. 서비스워커는 예고 없이 유휴 종료→재기동될
// 수 있으므로, 재기동 후에도 필요한 상태(로그인 식별자 등)를 storage에서
// 복원하는 로직과, 탭 오케스트레이션(없으면 열기, 있으면 재사용/복구) 로직이
// 이 파일의 핵심이다.

const URL_PATTERNS = Object.freeze({
  PORTAL: 'http://localhost:8081/*',
  CASE: 'http://localhost:8082/*',
  DISPATCH: 'http://localhost:8083/*',
  CUSTOMER: 'http://localhost:8084/*',
});
const SYSTEM_LABEL = { CASE: 'System B(케이스관리)', DISPATCH: 'System C(예약·배차)', CUSTOMER: 'System D(고객응대)' };

let _bgState = { currentLoginId: '' };

// ── 탭 전체 브로드캐스트 ──
function broadcastToPortal(message) {
  chrome.tabs.query({ url: URL_PATTERNS.PORTAL }, (tabs) => tabs.forEach((t) => chrome.tabs.sendMessage(t.id, message).catch(() => {})));
}

// ── 전산 페이지 만료/세션끊김을 사이드바에 팝업으로 알림 ──
function notifyPageExpired(systemLabel, extraText) {
  broadcastToPortal({ type: 'PAGE_EXPIRED', system: systemLabel, text: extraText || `${systemLabel} 페이지가 만료되었습니다. 재인증이 필요합니다.` });
  console.error(`[SPoG:Background] ERR_PAGE_EXPIRED ${systemLabel} 탭 릴레이 실패`);
}

// ── 열려있는 탭에 명령 릴레이. 실패(주로 세션 만료로 콘텐츠 스크립트가 응답
//    안 함) 시 탭을 새로고침해 재인증 화면을 띄우고 사이드바에 알린다. ──
function relayOrRecover(tabId, message, systemLabel) {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    chrome.tabs.reload(tabId);
    notifyPageExpired(systemLabel);
  });
}

// 대상 시스템 탭에 명령을 릴레이하고, 탭이 아예 없으면 새로 열어서(find-or-create)
// 보낸다 — REQ_* → DO_* 커맨드 맵 변환은 호출부가 넘겨준다.
function makeRelay(urlPattern, systemLabel, cmdMap, { createIfMissing = false } = {}) {
  return (message, sender, sendResponse) => {
    chrome.tabs.query({ url: urlPattern }, (tabs) => {
      const payload = { ...message, type: cmdMap[message.type] || message.type };
      if (tabs.length > 0) {
        relayOrRecover(tabs[0].id, payload, systemLabel);
      } else if (createIfMissing) {
        chrome.tabs.create({ url: urlPattern.replace('/*', ''), active: false }, (newTab) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === newTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => chrome.tabs.sendMessage(newTab.id, payload).catch(() => {}), RPA_APP_CONFIG?.TIMEOUT?.TAB_CREATE_DELAY ?? 1500);
            }
          });
        });
      } else {
        broadcastToPortal({ type: 'DISPATCH_ERROR', error: `${systemLabel} 탭이 열려있지 않습니다.` });
        notifyPageExpired(systemLabel, `${systemLabel} 탭을 새로 열었습니다. 재인증 후 다시 시도해주세요.`);
        chrome.tabs.create({ url: urlPattern.replace('/*', ''), active: false });
      }
    });
    sendResponse({ status: 'ok' });
    return true;
  };
}

// =========================================================================
// 사이드바 중앙 폴링 — 버전/큐권한/공지사항을 백엔드에서 이 한 곳(서비스워커)
// 에서만 가져와 CLIENT_CONFIG_UPDATED로 사이드바에 push한다. 각 콘텐츠 스크립트가
// 제각각 폴링하면 중복 요청이 발생하므로 중앙 집중화했다.
// =========================================================================
function pollClientConfig() {
  if (!_bgState.currentLoginId) return; // 로그인 정보 확보 전이면 스킵
  const url = `${RPA_APP_CONFIG.URL.SIDEBAR_MGMT_WEBHOOK}?action=GET_CLIENT_CONFIG&loginId=${encodeURIComponent(_bgState.currentLoginId)}`;
  fetch(url).then((r) => r.json()).then((data) => {
    if (data?.status === 'success') broadcastToPortal({ type: 'CLIENT_CONFIG_UPDATED', config: data });
    else console.error('[SPoG:Background] GET_CLIENT_CONFIG 응답 실패:', data);
  }).catch((err) => console.error('[SPoG:Background] GET_CLIENT_CONFIG 요청 실패:', err));
}

chrome.alarms.create(RPA_APP_CONFIG.SIDEBAR_SYNC.ALARM_NAME, { periodInMinutes: RPA_APP_CONFIG.SIDEBAR_SYNC.POLL_INTERVAL_MIN });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === RPA_APP_CONFIG.SIDEBAR_SYNC.ALARM_NAME) pollClientConfig(); });

// [핵심] 서비스워커가 유휴 타임아웃 후 재기동됐을 때(같은 브라우저 세션 내에서는
// 흔함) 메모리 변수(_bgState.currentLoginId)가 초기화되어 폴링이 계속 스킵되는
// 문제 — storage에 남아있는 로그인ID로 즉시 복원 + 1회 재폴링한다.
chrome.storage.local.get(['SPOG_LOGIN_ID'], (res) => {
  if (res.SPOG_LOGIN_ID && !_bgState.currentLoginId) { _bgState.currentLoginId = res.SPOG_LOGIN_ID; pollClientConfig(); }
});

// [구분 필요] onStartup은 브라우저를 실제로 새로 켰을 때만 발생한다(서비스워커
// 유휴 재기동과는 다른 이벤트). 이전 세션의 로그인 식별자가 영구 저장소에
// 그대로 남아있으면, 포털 페이지를 열지도 않았는데 사이드바에 이전 사용자명이
// 뜨는 문제가 생기므로 브라우저가 새로 켜졌을 땐 신원 정보를 지운다.
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove(['SPOG_LOGIN_ID', 'SPOG_AGENT_NAME'], () => { _bgState.currentLoginId = ''; });
});

// =========================================================================
// 확장 업데이트 직후 이미 열려있던 시스템 탭 안내 — 콘텐츠 스크립트가 이미
// 페이지에 주입되어 실행 중이라, 업데이트해도 그 탭들은 "예전 코드"로 계속
// 돌아간다(페이지를 직접 새로고침해야만 새 코드로 교체됨). 강제 새로고침은
// 상담 중인 화면을 날릴 위험이 있어 하지 않고, 대신 "아직 새로고침 안 된
// 시스템" 안내 토스트만 띄운다. 각 탭이 실제로 새로고침되는 걸 감지할 때마다
// 목록에서 빼고, 다 빠지면 토스트를 닫으라는 신호를 보낸다.
// =========================================================================
const PENDING_REFRESH_KEY = 'SPOG_PENDING_REFRESH_SYSTEMS';
const REFRESH_TRACK_SYSTEMS = { CASE: SYSTEM_LABEL.CASE, DISPATCH: SYSTEM_LABEL.DISPATCH, CUSTOMER: SYSTEM_LABEL.CUSTOMER };

function _broadcastRefreshStatus(pendingKeys) {
  broadcastToPortal({ type: 'PENDING_REFRESH_STATUS', pending: pendingKeys.map((k) => REFRESH_TRACK_SYSTEMS[k]).filter(Boolean) });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install' && details.reason !== 'update') return; // 크롬 자체 업데이트는 해당 없음
  const checks = Object.entries({ CASE: URL_PATTERNS.CASE, DISPATCH: URL_PATTERNS.DISPATCH, CUSTOMER: URL_PATTERNS.CUSTOMER })
    .map(([key, pattern]) => new Promise((resolve) => chrome.tabs.query({ url: pattern }, (tabs) => resolve(tabs.length > 0 ? key : null))));
  Promise.all(checks).then((results) => {
    const pending = results.filter(Boolean);
    if (pending.length === 0) return;
    chrome.storage.local.set({ [PENDING_REFRESH_KEY]: pending });
    _broadcastRefreshStatus(pending);
  });
});

// onInstalled 시점에 push해도 그 순간 포털 탭 자신도 "예전 코드"라 새 메시지
// 타입을 못 받는다 — 실제로 새로고침돼서 새 코드가 실행되면 이 요청으로 현재
// pending 상태를 직접 pull한다.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'REQUEST_PENDING_REFRESH_STATUS') return false;
  chrome.storage.local.get([PENDING_REFRESH_KEY], (res) => {
    const pending = res[PENDING_REFRESH_KEY] || [];
    if (pending.length > 0) _broadcastRefreshStatus(pending);
    sendResponse({ status: 'ok' });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  chrome.storage.local.get([PENDING_REFRESH_KEY], (res) => {
    const pending = res[PENDING_REFRESH_KEY] || [];
    if (pending.length === 0) return;
    const matchedKey = Object.entries({ CASE: URL_PATTERNS.CASE, DISPATCH: URL_PATTERNS.DISPATCH, CUSTOMER: URL_PATTERNS.CUSTOMER })
      .find(([, pattern]) => tab.url.startsWith(pattern.replace('/*', '')))?.[0];
    if (!matchedKey || !pending.includes(matchedKey)) return;
    const next = pending.filter((k) => k !== matchedKey);
    chrome.storage.local.set({ [PENDING_REFRESH_KEY]: next });
    _broadcastRefreshStatus(next);
  });
});

// =========================================================================
// 결과 로그 시트 기록 — 각 자동화 스텝 완료마다 쓰기 전용으로 기록(감사/추적용)
// =========================================================================
function sendLog(entry) {
  fetch(RPA_APP_CONFIG.URL.RESULT_LOG_WEBHOOK, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
  }).catch((err) => console.error('[SPoG:Background] 로그 기록 실패:', err));
}

// =========================================================================
// 명령 릴레이 등록
// =========================================================================
const _dispatchRelay = makeRelay(URL_PATTERNS.DISPATCH, SYSTEM_LABEL.DISPATCH, {
  REQ_DISPATCH_RES_INFO: 'DO_DISPATCH_RES_INFO',
  REQ_DISPATCH_BLOCK_INFO: 'DO_DISPATCH_BLOCK_INFO',
  REQ_DISPATCH_EXECUTE: 'DO_DISPATCH_EXECUTE',
  REQ_CANDIDATE_SEARCH_START: 'DO_CANDIDATE_SEARCH_START',
  REQ_CANDIDATE_SEARCH_RESET: 'DO_CANDIDATE_SEARCH_RESET',
  REQ_CANDIDATE_SEARCH_STOP: 'DO_CANDIDATE_SEARCH_STOP',
  REQ_CANDIDATE_SEARCH_EXPAND: 'DO_CANDIDATE_SEARCH_EXPAND',
  REQ_CREATE_RESERVATION_BLOCK: 'DO_CREATE_RESERVATION_BLOCK',
});
['REQ_DISPATCH_RES_INFO', 'REQ_DISPATCH_BLOCK_INFO', 'REQ_DISPATCH_EXECUTE',
  'REQ_CANDIDATE_SEARCH_START', 'REQ_CANDIDATE_SEARCH_RESET', 'REQ_CANDIDATE_SEARCH_STOP', 'REQ_CANDIDATE_SEARCH_EXPAND',
  'REQ_CREATE_RESERVATION_BLOCK'].forEach((type) => chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== type) return false;
  return _dispatchRelay(msg, sender, sendResponse);
}));

// 대상 시스템 → 사이드바 결과/진행상황 중계 (그대로 broadcast)
['DISPATCH_RES_INFO', 'DISPATCH_BLOCK_INFO', 'DISPATCH_EXECUTE_RESULT',
  'CANDIDATE_SEARCH_PROGRESS', 'CANDIDATE_SEARCH_RESULT', 'CANDIDATE_SEARCH_ERROR', 'RESERVATION_BLOCK_CREATED',
].forEach((type) => chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== type) return false;
  broadcastToPortal(msg);
  sendResponse({ status: 'ok' });
  return true;
}));

// 자동 연쇄: 예약 생성이 끝나면 사용자 개입 없이 System D 탭을 방문해 응대
// 메모에도 정보를 반영한다.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'DISPATCH_EXECUTE_RESULT' || !msg.success) return false;
  chrome.tabs.query({ url: URL_PATTERNS.CUSTOMER }, (tabs) => {
    if (tabs.length > 0) relayOrRecover(tabs[0].id, { type: 'DO_APPLY_RESERVATION_TO_MEMO', ...msg }, SYSTEM_LABEL.CUSTOMER);
  });
  sendLog({ step: 'dispatch_execute', ...msg, at: new Date().toISOString() });
  return false;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'INTERCEPTED_AGENT_INFO') {
    _bgState.currentLoginId = msg.loginId;
    chrome.storage.local.set({ SPOG_LOGIN_ID: msg.loginId, SPOG_AGENT_NAME: msg.managerName });
    pollClientConfig(); // 로그인 직후 첫 데이터는 알람을 기다리지 않고 즉시 확보
    return false;
  }
  if (msg.type === 'INTERCEPTED_CASE') {
    broadcastToPortal(msg);
    sendLog({ step: 'case_created', caseId: msg.caseId, at: new Date().toISOString() });
    return false;
  }
  if (msg.type === 'INBOUND_CALLBACK_ARRIVED' || msg.type === 'INBOUND_CALLBACK_COUNT_UPDATE' || msg.type === 'SEND_CASE_TO_PORTAL') {
    broadcastToPortal(msg);
    return false;
  }
  return false;
});
