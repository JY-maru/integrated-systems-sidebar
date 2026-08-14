// message_router.js
// [PSEUDOCODE] System A(포털) 콘텐츠 스크립트의 메시지 허브.
//   1) 타입드 메시지 레지스트리 — chrome.runtime.onMessage / window.postMessage
//      호출부가 흩어져 있던 원본 구조를, 스키마 검증 + 오리진 검증 + 타임아웃
//      가드를 한 곳에서 담당하는 팩토리로 통일한 형태를 재현한다.
//   2) 임베드 폼(iframe) ↔ System B(케이스관리) API 응답 교차검증 — 사이드바가
//      "케이스 연결됨"으로 표시하기 전에 반드시 통과해야 하는 방어 로직.
// 실제 함수/타입 이름은 mock 네이밍으로 치환했고, 도메인 URL/한글 고유명사는
// 전부 제거했습니다.

// =========================================================================
// 1. 오리진 검증 — 이 파일이 다루는 postMessage 채널은 두 종류뿐이다.
//    a) "자기 자신 origin" — 페이지 메인 월드(injected_*.js) ↔ 콘텐츠 스크립트.
//       콘텐츠 스크립트는 항상 자신이 주입된 페이지와만 통신하므로 자기 origin
//       비교로 충분하다.
//    b) "임베드 폼 샌드박스 도메인" — 포털이 서빙하는 임베드 폼 iframe은 포털
//       자신의 origin이 아니라 별도 샌드박스 도메인에서 렌더링되므로 suffix로
//       검증해야 한다.
// 검증 로직은 호출부마다 인라인으로 다시 쓰지 않고 이 한 곳에만 둔다 —
// "깜빡하고 검증을 안 넣는" 실수를 원천 차단하기 위해서다.
// =========================================================================
const EMBED_SANDBOX_SUFFIX = '.mock-embed-sandbox.local';

function isSelfOrigin(origin) {
  return !!origin && origin === window.location.origin;
}
function isEmbedSandboxOrigin(origin) {
  return !!origin && origin.endsWith(EMBED_SANDBOX_SUFFIX);
}
function validatePostOrigin(event, mode) {
  if (mode === 'self') return isSelfOrigin(event.origin);
  if (mode === 'embed-sandbox') return isEmbedSandboxOrigin(event.origin);
  return false;
}

// =========================================================================
// 2. 타입드 메시지 레지스트리 — 여러 다른 디스패치 패턴(if/else 체인, 객체맵,
//    switch)을 하나로 통일. 같은 type을 두 번 등록하면 로드 시점에 즉시 에러를
//    던져서 "나중 정의가 조용히 이긴다" 류의 버그가 런타임까지 묻히지 않게 한다.
// =========================================================================
const _runtimeHandlers = (globalThis.__spogRuntimeHandlers ??= new Map());
const _postHandlers = (globalThis.__spogPostHandlers ??= new Map());

function registerRuntimeHandler(type, validate, handler) {
  if (_runtimeHandlers.has(type)) throw new Error(`[Messaging] 중복 등록된 타입: "${type}"`);
  _runtimeHandlers.set(type, { validate, handler });
}
function registerPostHandler(type, validate, handler) {
  if (_postHandlers.has(type)) throw new Error(`[Messaging] 중복 등록된 postMessage 타입: "${type}"`);
  _postHandlers.set(type, { validate, handler });
}

const DEFAULT_TIMEOUT_MS = 20000;

// mode: 'respond'(호출자가 응답을 기다림 — 타임아웃/중복응답 가드 적용) |
//       'notify'(fire-and-forget — 알림성 메시지에 타임아웃을 걸면 스팸 에러만 남으므로 생략)
function createRuntimeListener({ timeoutMs = DEFAULT_TIMEOUT_MS, mode = 'respond' } = {}) {
  return (message, sender, sendResponse) => {
    const entry = _runtimeHandlers.get(message?.type);
    if (!entry) {
      if (mode === 'respond') sendResponse({ status: 'error', msg: `Unknown type: ${message?.type}` });
      return false;
    }
    if (!entry.validate(message)) {
      console.error(`[Messaging] invalid payload for "${message.type}"`);
      if (mode === 'respond') sendResponse({ status: 'error', msg: 'invalid payload' });
      return false;
    }
    if (mode === 'notify') {
      try { entry.handler(message, sender, () => {}); }
      catch (err) { console.error(`[Messaging] handler threw for "${message.type}"`, err); }
      return false;
    }

    let responded = false;
    const timer = setTimeout(() => {
      if (responded) return;
      responded = true;
      sendResponse({ status: 'error', msg: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    const guardedSendResponse = (response) => {
      if (responded) return;
      responded = true;
      clearTimeout(timer);
      sendResponse(response);
    };
    try {
      const maybePromise = entry.handler(message, sender, guardedSendResponse);
      if (maybePromise?.catch) maybePromise.catch((err) => guardedSendResponse({ status: 'error', msg: String(err) }));
    } catch (err) {
      guardedSendResponse({ status: 'error', msg: String(err) });
    }
    return true; // 응답은 guardedSendResponse가 책임지므로 채널은 항상 열어둔다
  };
}

// window.addEventListener('message', ...)에 그대로 넘길 리스너. 오리진 검증은
// 항상 이 팩토리가 선행 수행한다.
function createPostListener(originMode) {
  return (event) => {
    if (!validatePostOrigin(event, originMode)) return;
    const entry = _postHandlers.get(event.data?.type);
    if (!entry) return; // 등록 안 된 타입은 조용히 무시(원본 동작과 동일)
    if (!entry.validate(event.data)) {
      console.error(`[Messaging] invalid postMessage payload for "${event.data.type}"`);
      return;
    }
    entry.handler(event.data, event.source);
  };
}

// =========================================================================
// 3. 임베드 폼 ↔ System B API 교차검증 — 케이스 카드가 실제로 지금 이 화면의
//    폼과 같은 건인지 대조한 다음에만 "연결됨"으로 표시한다.
//    확인 불가(타임아웃)도 안전하지 않은 상태로 간주해 차단한다 — "모르면
//    일단 통과시킨다"는 예전 방식은 실제 불일치를 놓치는 구멍이었다.
// =========================================================================
async function getEmbedFormData(kind) {
  const frame = StateManager.get('targetHtmlFrame') || document.querySelector('iframe');
  if (!frame) return null;
  return await requestFromFrame(frame, kind, /* timeoutMs */ 2000); // 구현 생략: postMessage 왕복
}

async function handleInterceptedCase(msg) {
  UiController.updateStatus('데이터 교차 검증 중...');
  const formData = await getEmbedFormData('ITEMIZED');

  if (formData) {
    const formCaseId = String(formData.caseId || '').trim();
    const formResourceId = String(formData.resourceId || '').replace(/\s/g, '');
    const apiCaseId = String(msg.apiCaseId || '').trim();
    const apiResourceId = String(msg.apiResourceId || '').replace(/\s/g, '');

    let conflict = false;
    if (formCaseId && apiCaseId && formCaseId !== apiCaseId) conflict = true;
    if (formResourceId && apiResourceId && !formResourceId.includes(apiResourceId) && !apiResourceId.includes(formResourceId)) conflict = true;
    // API가 연결 정보 없음(둘 다 빈값)인데 폼엔 값이 남아있으면 이전 세션 잔여물일
    // 위험 — 안전 쪽으로 기본값을 잡아 이것도 충돌로 취급한다.
    if (!apiCaseId && !apiResourceId && (formCaseId || formResourceId)) conflict = true;
    // 반대 방향(API엔 값이 있는데 폼은 비어있음)도 "확인 불가"와 동급으로 막는다 —
    // 비교할 대상이 없다고 그냥 통과시키면 방금 생성된 카드가 빈 폼 상태로도 연결된다.
    if ((apiCaseId && !formCaseId) || (apiResourceId && !formResourceId)) conflict = true;

    if (conflict) {
      console.warn(`[Router] 데이터 불일치 (API: ${apiCaseId}/${apiResourceId} vs 폼: ${formCaseId}/${formResourceId})`);
      Panels.caseActions.applyMismatch();
      return; // 검증 실패 시 즉시 중단
    }
  } else if (StateManager.get('targetHtmlFrame') || document.querySelectorAll('iframe').length > 0) {
    // 대조할 iframe이 있는데 응답을 못 받은 경우 = 확인 불가 = 차단 (iframe 자체가
    // 없는 정상 상황과는 구분한다)
    console.warn('[Router] 임베드 폼 조회 실패(타임아웃) — 대조 불가로 연결 차단');
    Panels.caseActions.applyMismatch();
    return;
  }

  // 검증 통과 — 이전 케이스와 다른 카드가 들어왔으면 상태부터 초기화
  const prevId = StateManager.get('activeCaseInfo')?.id;
  if (prevId && prevId !== msg.caseId) {
    UiController.clearSecurityTimer();
    StateManager.resetCaseInfo();
    Panels.caseActions.clearRecipientsForNewCard();
  }

  Panels.caseActions.setConnected(`ID: ${msg.caseId}`);
  StateManager.update('activeCaseInfo', {
    id: msg.caseId,
    insNumber: msg.insuranceNumber,
    isEmergency: msg.isEmergency,
    isPlan: msg.isPlan ?? null,
  });
  UiController.updateStatus(`케이스 연결됨 (ID: ${msg.caseId})`, msg.isEmergency ? 'error' : 'success');
  UiController.startSecurityTimer(); // 연결 시점부터 카운트다운 — 방치된 세션 자동 잠금

  if (msg.recipientList) UiController.renderRecipientList(msg.recipientList);
}

// =========================================================================
// 4. 사이드바 중앙 폴링 응답 반영 — 백그라운드(service_worker.js)가
//    GET_CLIENT_CONFIG를 대신 가져와 CLIENT_CONFIG_UPDATED로 push한 것을 받아
//    공지사항/버전배너/큐권한을 갱신한다.
// =========================================================================
function handleClientConfigUpdated(msg) {
  const cfg = msg.config;
  Panels.inboundActions.setAnnouncements(cfg.announcements, cfg.loginId);
  if (cfg.latestVersion) UiController.showVersionBanner(cfg.latestVersion, cfg.driveFileVerified);
  StateManager.set('queueToggleEnabled', cfg.queueToggleEnabled !== false); // fail-open 기본값
}

// =========================================================================
// 5. 초기화 — 모든 핸들러 등록
// =========================================================================
function init() {
  registerRuntimeHandler('INTERCEPTED_CASE', (m) => !!m.caseId, handleInterceptedCase);
  registerRuntimeHandler('CLIENT_CONFIG_UPDATED', (m) => !!m.config, handleClientConfigUpdated);
  registerRuntimeHandler('DISPATCH_RES_INFO', (m) => !!m.resId, (m) => Panels.dispatchActions.setResInfo(m));
  registerRuntimeHandler('DISPATCH_BLOCK_INFO', (m) => !!m.resId, (m) => Panels.dispatchActions.setBlockInfo(m));
  registerRuntimeHandler('CANDIDATE_SEARCH_RESULT', (m) => !!m.resId, (m) => Panels.dispatchActions.setSearchResult(m));
  registerRuntimeHandler('CANDIDATE_SEARCH_PROGRESS', (m) => !!m.resId, (m) => Panels.dispatchActions.setSearchProgress(m));
  registerRuntimeHandler('CANDIDATE_SEARCH_ERROR', (m) => !!m.resId, (m) => Panels.dispatchActions.setSearchError(m));
  registerRuntimeHandler('INBOUND_CALLBACK_ARRIVED', (m) => !!m, (m) => Panels.inboundActions.memberArrived(m));
  registerRuntimeHandler('SCAN_BATCH_COMPLETE', () => true, () => Panels.postcareActions.onScanBatchComplete());
  registerRuntimeHandler('SCAN_ALERT', (m) => !!m.text, (m) => Panels.postcareActions.showScanAlert(m.text, m.color));

  chrome.runtime.onMessage.addListener(createRuntimeListener({ mode: 'notify' }));

  registerPostHandler('CASE_FORM_DATA', (d) => !!d, (data) => {
    StateManager.set('latestEmbedFormData', { caseId: data.caseId, resourceId: data.resourceId });
  });
  window.addEventListener('message', createPostListener('embed-sandbox'));
}

window.MessageRouter = { init, registerRuntimeHandler, registerPostHandler };
