// panels/settings_panel.js
// [PSEUDOCODE] ⚙️ 설정 패널 — 사이드바 자체의 환경설정(알림 on/off, 테마,
// 대기큐 자동참여 강제 여부 등). 다른 패널과 달리 백엔드 상태를 반영하지
// 않는 순수 로컬 설정이 대부분이라 별도 서버 동기화 로직이 없다.

window.Panels = window.Panels || {};

const SETTINGS_KEYS = { NOTIFICATIONS: 'spog-notifications-enabled', THEME: 'spog-theme', QUEUE_AUTO_ENFORCE: 'spog-queue-auto-enforce' };

function _loadSettings() {
  return {
    notificationsEnabled: localStorage.getItem(SETTINGS_KEYS.NOTIFICATIONS) !== 'false',
    theme: localStorage.getItem(SETTINGS_KEYS.THEME) || 'light',
    queueAutoEnforce: localStorage.getItem(SETTINGS_KEYS.QUEUE_AUTO_ENFORCE) === 'true',
  };
}

function toggleNotifications(enabled) {
  localStorage.setItem(SETTINGS_KEYS.NOTIFICATIONS, String(enabled));
}
function setTheme(theme) {
  localStorage.setItem(SETTINGS_KEYS.THEME, theme);
  document.documentElement.dataset.theme = theme;
}
function toggleQueueAutoEnforce(enabled) {
  localStorage.setItem(SETTINGS_KEYS.QUEUE_AUTO_ENFORCE, String(enabled));
  chrome.runtime.sendMessage({ type: 'SET_QUEUE_AUTO_ENFORCE', enabled });
}

function renderSettings() {
  const s = _loadSettings();
  const notifEl = document.getElementById('settings-notifications-toggle');
  if (notifEl) notifEl.checked = s.notificationsEnabled;
  const themeEl = document.getElementById('settings-theme-select');
  if (themeEl) themeEl.value = s.theme;
  const queueEl = document.getElementById('settings-queue-enforce-toggle');
  if (queueEl) queueEl.checked = s.queueAutoEnforce;
}

Panels.settingsActions = { toggleNotifications, setTheme, toggleQueueAutoEnforce, renderSettings, loadSettings: _loadSettings };
