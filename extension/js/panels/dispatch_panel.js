// panels/dispatch_panel.js
// [PSEUDOCODE] 🚗 예약/배차 자동화 패널 — 원버튼 자동화 3종(예약블록 생성/고객
// 예약 생성/후보 검색)을 하나의 패널에 담는다. 실제 원본에서는 예약블록 조회,
// 고객예약변경, 후보리소스검색, 추적 확인이 각각 독립된 서브탭/모달이었지만
// (message_router.js와 DOM을 직접 안 건드리는 setXxx(msg) 콜백만으로 연결된
// 완전히 독립적인 모듈들이었음), mock에서는 하나의 배차 패널로 합쳤다. 상관관계
// ID(resId)를 기준으로 요청/응답을 매칭하는 구조는 그대로 유지한다.

window.Panels = window.Panels || {};

let _resInfo = null;
let _reservationBlock = null;
let _searchResult = null;
let _searchProgress = null;
let _trackDots = []; // 진행 단계 점 표시 (예약블록취소 → 예약취소 → 예약창오픈)

Panels.dispatchActions = {
  setResInfo(msg) {
    _resInfo = msg.error ? null : msg;
    _render();
    UiController.updateStatus(msg.error ? '고객 예약 조회 실패' : '고객 예약 정보 조회 완료', msg.error ? 'error' : 'success');
  },
  setBlockInfo(msg) {
    _reservationBlock = msg.error ? null : msg;
    _render();
    UiController.updateStatus(msg.error ? '예약블록 조회 실패' : '예약블록 확인 완료', msg.error ? 'error' : 'success');
  },
  setSearchResult(msg) {
    _searchResult = msg;
    _renderCandidateList(msg.results);
    UiController.updateStatus(`후보 리소스 ${msg.results.length}건`, 'success');
  },
  setSearchProgress(msg) {
    _searchProgress = msg.progress;
    _renderProgress(msg.progress);
  },
  setSearchError(msg) {
    UiController.showToast(`후보 검색 실패: ${msg.error}`, 'error');
  },
};

function _render() {
  const summaryEl = document.getElementById('dispatch-res-summary');
  if (summaryEl && _resInfo) summaryEl.textContent = `✓ ${_resInfo.resType || '일반'} | 보장옵션 ${_resInfo.coverageOption} | ${_resInfo.duration}`;
  const blockEl = document.getElementById('dispatch-block-summary');
  if (blockEl && _reservationBlock) blockEl.textContent = `✓ ${_reservationBlock.reservationBlockAssetId} | ${_reservationBlock.reservationBlockRegionName}`;
}
function _renderCandidateList(results) {
  const list = document.getElementById('dispatch-candidate-list');
  if (list) list.innerHTML = results.map((r) => `<li>${r.resourceType} · ${r.distKm.toFixed(1)}km · ${r.address}</li>`).join('');
}
function _renderProgress(progress) {
  const el = document.getElementById('dispatch-search-progress');
  if (el) el.textContent = `탐색 중... (${progress.matchingCount}건 매칭 / wave ${progress.wave ?? 0})`;
}

// ── 원버튼 자동화 1: 예약블록 생성 (✍️ 쓰기) ──
function createReservationBlock() {
  const resId = document.getElementById('dispatch-block-res-input').value.trim();
  if (!resId) return UiController.showToast('예약번호를 입력해주세요.', 'warning');
  UiController.updateStatus('System C로 이동해 예약블록을 생성합니다...', 'pending');
  chrome.runtime.sendMessage({ type: 'REQ_CREATE_RESERVATION_BLOCK', resId });
}

// ── 원버튼 자동화 2: 고객 예약 생성 (✍️ 쓰기, 완료 후 System D 자동 연쇄) ──
function executeReservation() {
  const resId = document.getElementById('dispatch-block-res-input').value.trim();
  const blockResId = document.getElementById('dispatch-target-block-input').value.trim();
  if (!resId || !blockResId) return UiController.showToast('예약번호와 예약블록 번호를 모두 입력해주세요.', 'warning');
  UiController.updateStatus('예약 변경 처리 중...', 'pending');
  chrome.runtime.sendMessage({ type: 'REQ_DISPATCH_EXECUTE', customerResId: resId, blockResId });
}

// ── 원버튼 자동화 3: 후보 리소스 검색·스코어링 (📡 읽기, 세대+AbortController 가드) ──
function startCandidateSearch() {
  const resId = document.getElementById('dispatch-search-res-input').value.trim();
  const selectedCategories = [...document.querySelectorAll('.dispatch-category-checkbox:checked')].map((el) => el.value);
  if (!resId) return UiController.showToast('예약번호를 입력해주세요.', 'warning');
  chrome.runtime.sendMessage({ type: 'REQ_CANDIDATE_SEARCH_START', resId, selectedCategories });
}
function stopCandidateSearch() {
  const resId = document.getElementById('dispatch-search-res-input').value.trim();
  chrome.runtime.sendMessage({ type: 'REQ_CANDIDATE_SEARCH_STOP', resId });
}
function expandCandidateSearch() {
  const resId = document.getElementById('dispatch-search-res-input').value.trim();
  chrome.runtime.sendMessage({ type: 'REQ_CANDIDATE_SEARCH_EXPAND', resId });
}

Object.assign(Panels.dispatchActions, { createReservationBlock, executeReservation, startCandidateSearch, stopCandidateSearch, expandCandidateSearch });
