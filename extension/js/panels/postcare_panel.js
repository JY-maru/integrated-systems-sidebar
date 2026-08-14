// panels/postcare_panel.js
// [PSEUDOCODE] 🗂️ 사후관리 패널 — 결과 로그 시트(쓰기 전용) 확인 + 사진 검수
// 배치 스캔 트리거. SCAN_BATCH_COMPLETE/SCAN_ALERT는 message_router.js가
// React 트리 밖(백그라운드 이벤트)에서 이 패널 상태를 갱신해야 하므로 별도
// 상태 모듈로 분리되어 있던 원본 구조를 그대로 반영한다.

window.Panels = window.Panels || {};

// scanStep: 0=숨김, 1=대기건 탐색, 2=검수 진행, 4=완료
let _scanStep = 0;
let _scanning = false;
let _scanMsg = null;
let _lastSyncTime = '데이터 없음';
let _msgHideTimer = null;
let _stepResetTimer = null;

function _showMsg(text, tone, durationMs) {
  if (_msgHideTimer) clearTimeout(_msgHideTimer);
  _scanMsg = { text, tone };
  _render();
  _msgHideTimer = setTimeout(() => { _scanMsg = null; _render(); }, durationMs);
}
function _render() {
  const el = document.getElementById('postcare-scan-status');
  if (el) el.textContent = _scanMsg?.text || (_scanning ? '검수 진행 중...' : '');
  const syncEl = document.getElementById('postcare-last-sync');
  if (syncEl) syncEl.textContent = _lastSyncTime;
}

// ── 지금 바로 검수 스캔 버튼 — 대기건 조회 후 없으면 즉시 종료, 있으면
//    배치 스캔을 시작하고 SCAN_BATCH_COMPLETE(비동기, 여러 System B 탭을
//    거쳐 나중에 도착)를 기다린다. ──
async function executeImageScan() {
  _scanning = true; _scanStep = 1; _render();
  UiController.updateStatus('검수 필요건 조회 중...');
  try {
    const res = await fetch(`${RPA_APP_CONFIG.URL.SIDEBAR_MGMT_WEBHOOK}?action=GET_PENDING_SCANS`);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    if (!data.pending?.length) {
      _scanStep = 0; _scanning = false; _render();
      UiController.updateStatus('검수할 항목이 없습니다.', 'success');
      _showMsg('검수할 항목이 없습니다.', undefined, 5000);
      return;
    }
    _scanStep = 2; _render();
    chrome.runtime.sendMessage({ type: 'START_IMAGE_SCAN_BATCH', reservations: data.pending.map((i) => i.resId) });
  } catch (err) {
    _scanStep = 0; _scanning = false; _render();
    UiController.updateStatus(`오류: ${err.message}`, 'error');
  }
}

// SCAN_BATCH_COMPLETE(message_router.js) → 배치 정상 완료
function onScanBatchComplete() {
  _scanning = false; _scanStep = 4;
  _lastSyncTime = RPA_APP_CONFIG ? new Date().toISOString().slice(0, 19).replace('T', ' ') : '';
  chrome.storage.local.set({ [RPA_APP_CONFIG.STORAGE_KEY.LAST_SYNC_TIME]: _lastSyncTime });
  UiController.updateStatus('사진 검수 완료', 'success');
  _render();
  if (_stepResetTimer) clearTimeout(_stepResetTimer);
  _stepResetTimer = setTimeout(() => { _scanStep = 0; _render(); }, 2000);
}

// SCAN_ALERT(message_router.js) → 스캔 중 오류(토큰/페이지 만료 등)
function showScanAlert(text, tone) {
  _scanning = false; _scanStep = 0; _render();
  _showMsg(text, tone, 8000);
}

function loadLastSyncTime() {
  chrome.storage.local.get([RPA_APP_CONFIG.STORAGE_KEY.LAST_SYNC_TIME], (res) => {
    const saved = res[RPA_APP_CONFIG.STORAGE_KEY.LAST_SYNC_TIME];
    if (saved) { _lastSyncTime = saved; _render(); }
  });
}

Panels.postcareActions = { executeImageScan, onScanBatchComplete, showScanAlert, loadLastSyncTime };
