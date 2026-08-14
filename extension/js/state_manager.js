// state_manager.js
// [PSEUDOCODE] System A 전역 상태 저장소. 원본은 이 파일이 손으로 짠 get/set
// 파사드였다가, 나중에 진짜 pub/sub 스토어(구독 가능)로 교체되면서도 기존
// 43곳의 호출부(message_router.js, ui_controller.js)가 전혀 안 바뀌도록 같은
// 이름의 파사드를 그대로 유지한 2단 구조였다 — 그 구조를 그대로 반영한다.

// ── 내부 스토어 (실제로는 pub/sub 가능한 경량 store) ──
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    getState: () => state,
    setState: (partial) => {
      state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      listeners.forEach((fn) => fn(state));
    },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

function defaultCaseInfo() {
  return { id: null, insNumber: '', isEmergency: false, isPlan: null, isReturnOverdue: false, overdueEndAt: '' };
}

const initialState = {
  activeCaseInfo: defaultCaseInfo(),
  latestEmbedFormData: { caseId: null, resourceId: null },
  cachedResourceId: null,        // System C 리소스 ID 캐시 (URL 생성 최적화)
  cachedResourceDisplayId: null, // cachedResourceId가 어느 표시 식별자의 것인지 추적 — stale 캐시 검증용
  isWaitingForRpaResult: false,
  activeResIdForRpa: null,
  targetHtmlFrame: null,   // 임베드 폼 iframe 직통 채널 — 직렬화 불가한 라이브 참조라 새로고침 시 초기화됨
  globalRecipientList: [],
  queueToggleEnabled: true, // 대기큐 스위치 사용 가능 여부, fail-open 기본값
};

const _store = createStore(initialState);
function resetCaseInfoImpl() {
  _store.setState({
    activeCaseInfo: defaultCaseInfo(),
    activeResIdForRpa: null,
    isWaitingForRpaResult: false,
    globalRecipientList: [],
  });
}

// ── 레거시 호환 파사드 — message_router.js/ui_controller.js는 이 인터페이스만 안다 ──
const _knownKeys = new Set(Object.keys(_store.getState()));
function _guardKey(key) {
  if (!_knownKeys.has(key)) RPA_UTILS?.warn(`[StateManager] 알 수 없는 상태 키: "${key}" — 오타 확인 필요`);
}

window.StateManager = {
  get(key) { _guardKey(key); return _store.getState()[key]; },
  set(key, value) { _guardKey(key); _store.setState({ [key]: value }); },
  // 객체 상태만 부분 업데이트(스프레드 병합) — 배열/원시값에 쓰면 경고 후 무시
  update(key, partial) {
    _guardKey(key);
    const current = _store.getState()[key];
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      RPA_UTILS?.warn(`[StateManager] update()는 일반 객체 상태에만 사용 가능합니다: "${key}"`);
      return;
    }
    _store.setState({ [key]: { ...current, ...partial } });
  },
  resetCaseInfo: resetCaseInfoImpl,
  subscribe: _store.subscribe,
};
