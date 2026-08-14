// panels/inbound_panel.js
// [PSEUDOCODE] 📥 인바운드 문의 패널 + 사이드바 셸(공통 마운트/패널전환/토스트)
// 공지사항은 백엔드가 진실 소스이고, 여기 보관하는 건 그 서버 상태의 로컬
// 캐시 + 낙관적 업데이트일 뿐이다 — message_router.js가 CLIENT_CONFIG_UPDATED를
// 받을 때마다 setAnnouncements()로 배열을 통째로 교체한다.

window.Panels = window.Panels || {};

// ── 공통 셸 — 패널 마운트/전환, 전역 토스트 (원본은 Shell.tsx + toastStore.ts 역할) ──
let _activePanel = 'panel-case';
const _toasts = new Map(); // id -> {text, tone}

Panels.mount = function mount(rootEl) {
  rootEl.dataset.mounted = 'true'; // 실제로는 각 패널 컴포넌트를 여기서 렌더
};
Panels.setActivePanel = function setActivePanel(panelId) {
  _activePanel = panelId;
  document.querySelectorAll('.spog-panel').forEach((el) => el.classList.toggle('active', el.id === panelId));
};
Panels.flashNavItem = function flashNavItem(panelId) {
  const navItem = document.querySelector(`.spog-nav-item[data-panel="${panelId}"]`);
  navItem?.classList.add('flash');
  setTimeout(() => navItem?.classList.remove('flash'), 600);
};

const AUTO_DISMISS_MS = 5000;
Panels.toastActions = {
  push(text, tone = 'info') {
    const id = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    _toasts.set(id, { text, tone });
    _renderToasts();
    setTimeout(() => Panels.toastActions.dismiss(id), AUTO_DISMISS_MS);
  },
  // 자동 소멸 없이, 같은 id로 다시 부르면 텍스트/톤만 교체(중복 방지) — 호출자가
  // 직접 dismiss()할 때까지 유지된다. service_worker.js의 "미새로고침 시스템 안내"용.
  upsertPersistent(id, text, tone = 'info') { _toasts.set(id, { text, tone, persistent: true }); _renderToasts(); },
  dismiss(id) { _toasts.delete(id); _renderToasts(); },
};
function _renderToasts() {
  const container = document.getElementById('spog-toast-container');
  if (!container) return;
  container.innerHTML = [..._toasts.entries()].map(([id, t]) => `<div class="toast toast-${t.tone}" data-id="${id}">${t.text}</div>`).join('');
}

// ── 인바운드 문의 패널 고유 상태 ──
let _notices = [];
let _loginId = '';
let _badgeCount = 0;

Panels.inboundActions = {
  // 예번 없이도 이름+회원ID만으로: ①헤더에 이름 표시 ②사고이력 선조회 트리거
  //   ③패널은 강제 전환하지 않는다(콜백 "건수" 갱신과 달리 이건 상담원이 이미
  //   보고 있는 화면일 확률이 높아 인터럽트가 아니라 정보 갱신으로 취급)
  memberArrived(data) {
    document.getElementById('inbound-member-name').textContent = data.name || '';
  },
  setBadgeCount(count) {
    _badgeCount = count;
    const badge = document.querySelector('.spog-nav-item[data-panel="panel-inbound"] .badge');
    if (badge) { badge.textContent = String(count); badge.classList.toggle('hidden', count === 0); }
  },
  setAnnouncements(announcements, loginId) {
    _notices = Array.isArray(announcements) ? announcements : [];
    _loginId = loginId || _loginId;
    _renderNotices();
  },
};

function _renderNotices() {
  const list = document.getElementById('inbound-notice-list');
  if (!list) return;
  const sorted = _sortWithinTier(_notices);
  list.innerHTML = sorted.map((n) => `<li class="${n.isRead ? 'read' : 'unread'}">${n.title}</li>`).join('');
}
// 정렬 우선순위: 개인고정 > 안읽음 > 읽음, 각 구간 내부는 최신순
function _sortWithinTier(list) {
  return [...list].sort((a, b) => {
    const aPinned = (a.pinnedOrder ?? -1) !== -1;
    const bPinned = (b.pinnedOrder ?? -1) !== -1;
    if (aPinned && bPinned) return (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return (b.date || '').localeCompare(a.date || '');
  });
}

function toggleNoticeRead(id) {
  const target = _notices.find((a) => a.id === id);
  if (!target) return;
  const nowRead = !target.isRead;
  _notices = _notices.map((a) => (a.id === id ? { ...a, isRead: nowRead } : a)); // 낙관적 업데이트
  _renderNotices();
  fetch(RPA_APP_CONFIG.URL.SIDEBAR_MGMT_WEBHOOK, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: nowRead ? 'MARK_NOTICE_READ' : 'MARK_NOTICE_UNREAD', loginId: _loginId, noticeId: id }),
  }).catch((err) => console.error('[Panels:Inbound] 공지 읽음처리 실패:', err));
}

Panels.inboundActions.toggleNoticeRead = toggleNoticeRead;
