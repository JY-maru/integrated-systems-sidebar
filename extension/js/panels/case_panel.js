// panels/case_panel.js
// [PSEUDOCODE] 📋 케이스 처리 패널(기본 활성) — 접수양식 텍스트 파싱 결과와
// System B RPA 진행 표시줄, 케이스 연결 상태를 보여준다. message_router.js가
// 교차검증을 통과시킨 뒤에만 setConnected()를 호출한다(이 파일 자체는 검증하지
// 않는다 — 검증 책임은 message_router.js에 있고, 여기는 결과 반영만 한다).

window.Panels = window.Panels || {};

let _connected = false;
let _connectedLabel = '';
let _recipientList = [];

Panels.caseActions = {
  setConnected(label) {
    _connected = true;
    _connectedLabel = label;
    document.getElementById('case-status-badge').textContent = `🟢 ${label}`;
  },
  setDisconnected() {
    _connected = false;
    _connectedLabel = '';
    document.getElementById('case-status-badge').textContent = '⚪ 연결 안 됨';
  },
  // 검증 실패 시 팝업 대신 빨간불 + "고객정보 불일치" 텍스트만 표시(원본 방어
  // 로직 그대로) — 사용자가 매번 팝업을 닫아야 하는 번거로움을 없앤 UX 결정.
  applyMismatch() {
    document.getElementById('case-status-badge').textContent = '🔴 고객정보 불일치';
  },
  clearRecipientsForNewCard() {
    _recipientList = [];
    _renderRecipients();
  },
  renderRecipientList(list) {
    _recipientList = list;
    _renderRecipients();
  },
};

function _renderRecipients() {
  const el = document.getElementById('case-recipient-list');
  if (el) el.innerHTML = _recipientList.map((r) => `<li>${r.name} (${r.phone})</li>`).join('');
}

// ── 접수양식 텍스트 파싱 → RPA 시작 진입점 ──
function submitIntakeText() {
  const raw = document.getElementById('case-intake-textarea').value;
  const fields = TextParser.parseIntakeTemplate(raw);
  if (!fields) {
    UiController.showToast('접수양식 형식을 인식하지 못했습니다. 필수 항목을 확인해주세요.', 'warning');
    return;
  }
  const data = TextParser.normalizeFields(fields);
  UiController.updateStatus('System B로 이동해 접수 카드를 생성합니다...', 'info');
  chrome.runtime.sendMessage({ type: 'DO_START_CASE_AUTOMATION', data, searchMode: data.resId ? 'RES' : 'ASSET' });
}

Panels.caseActions.submitIntakeText = submitIntakeText;
