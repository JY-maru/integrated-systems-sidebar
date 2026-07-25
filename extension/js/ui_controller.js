'use strict'
// 사이드바 DOM 생성 (아이콘 레일 + 콘텐츠 패널 2컬럼), 패널 전환, 배지/트랙-닷/
// 상태-닷 렌더링.
// 비즈니스 로직(무엇을 보낼지)은 content_a.js가 담당하고, 이 모듈은
// "그리기"와 "콜백 연결"만 한다.

const SPOG_UI = (() => {
  const TABS = [
    { key: 'inbound', icon: '📥', label: '인바운드 문의' },
    { key: 'case', icon: '📋', label: '케이스 처리' },
    { key: 'dispatch', icon: '🚗', label: '예약/배차 자동화' },
    { key: 'post', icon: '🗂️', label: '사후관리' },
  ]
  const SETTINGS_TAB = { key: 'settings', icon: '⚙️', label: '설정' }

  const PIPELINE_STEPS = [
    { key: 'case_created', label: '접수 카드 생성' },
    { key: 'block_created', label: '블록 생성' },
    { key: 'reservation_created', label: '예약 생성' },
    { key: 'vehicle_searched', label: '후보 검색' },
    { key: 'customer_memo_filled', label: '고객 응대 반영' },
    { key: 'logged', label: '로그 기록' },
  ]

  const els = { tabs: {}, panels: {}, badges: {}, dots: {} }
  const stepDots = {}
  let sidebarEl, collapseBtnEl, statusLineEl
  let candidateListEl, inboundListEl, postListEl, caseDetailEl, blockInfoEl, reservationInfoEl
  let statusResetTimer = null

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') node.className = v
      else if (k === 'onclick') node.addEventListener('click', v)
      else if (k === 'onchange') node.addEventListener('change', v)
      else node.setAttribute(k, v)
    }
    ;(Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    })
    return node
  }

  function card(headText, bodyChildren) {
    return el('div', { className: 'card' }, [
      el('div', { className: 'card-head' }, headText),
      el('div', { className: 'card-body' }, bodyChildren),
    ])
  }

  function chipRow(label, value) {
    return el('div', { className: 'chip' }, [
      el('div', { className: 'chip-label' }, label),
      el('div', { className: 'chip-val' }, value || '-'),
    ])
  }

  function statusDotRow(stepKey, label) {
    const dot = el('span', { className: 'status-dot' })
    stepDots[stepKey] = dot
    return el('div', { className: 'status-dot-row' }, [dot, document.createTextNode(label)])
  }

  function switchToPanel(key) {
    Object.entries(els.tabs).forEach(([k, tabEl]) => tabEl.classList.toggle('active', k === key))
    Object.entries(els.panels).forEach(([k, panelEl]) => panelEl.classList.toggle('active', k === key))
  }

  function toggleCollapse(forceOpen) {
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !sidebarEl.classList.contains('open')
    sidebarEl.classList.toggle('open', shouldOpen)
    collapseBtnEl.textContent = shouldOpen ? '«' : '»'
  }

  function setBadge(key, count) {
    const badgeEl = els.badges[key]
    if (!badgeEl) return
    if (count > 0) {
      badgeEl.textContent = String(count)
      badgeEl.style.display = 'flex'
    } else {
      badgeEl.style.display = 'none'
    }
  }

  function setTrackDot(key, active) {
    const dotEl = els.dots[key]
    if (!dotEl) return
    dotEl.classList.toggle('active', Boolean(active))
  }

  // 파이프라인 진행 표시줄: 시작 시 pulsing(진행 중), 완료 시 정적 점(완료)으로 바뀐다.
  function setStepActive(stepKey) {
    const dot = stepDots[stepKey]
    if (dot && !dot.classList.contains('done')) dot.classList.add('active')
  }

  function markStepDone(stepKey) {
    const dot = stepDots[stepKey]
    if (!dot) return
    dot.classList.remove('active')
    dot.classList.add('done')
  }

  function setStatus(text, kind) {
    statusLineEl.textContent = text
    statusLineEl.classList.remove('ok', 'err')
    if (kind) statusLineEl.classList.add(kind)
    clearTimeout(statusResetTimer)
    statusResetTimer = setTimeout(() => {
      statusLineEl.textContent = '대기 중'
      statusLineEl.classList.remove('ok', 'err')
    }, 4000)
  }

  function renderCaseDetail(caseData) {
    caseDetailEl.innerHTML = ''
    if (!caseData) return
    const rows = [
      ['접수 카드 번호', caseData.caseId],
      ['고객명', caseData.name],
      ['연락처', caseData.phone],
      ['식별코드', caseData.code],
      ['접수일시', caseData.receivedAt],
      ['위치', caseData.location],
    ]
    rows.forEach(([label, value]) => caseDetailEl.appendChild(chipRow(label, value)))
  }

  function renderBlockInfo(info) {
    blockInfoEl.textContent = info ? `블록 생성 완료: ${info.blockId}` : ''
    blockInfoEl.classList.toggle('ok', Boolean(info))
  }

  function renderReservationInfo(info) {
    reservationInfoEl.textContent = info ? `예약 생성 완료: ${info.reservationId}` : ''
    reservationInfoEl.classList.toggle('ok', Boolean(info))
  }

  function renderCandidates(list) {
    candidateListEl.innerHTML = ''
    if (!list || !list.length) return
    const table = el('table', { className: 'spog-table' })
    const thead = el('thead', {}, el('tr', {}, [
      el('th', {}, '식별코드'), el('th', {}, '유형'), el('th', {}, '거리(km)'), el('th', {}, '상태'),
    ]))
    const tbody = el('tbody')
    list.forEach((c) => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, c.code || '-'),
        el('td', {}, c.type || '-'),
        el('td', {}, String(c.distanceKm)),
        el('td', {}, c.status || '-'),
      ]))
    })
    table.appendChild(thead)
    table.appendChild(tbody)
    candidateListEl.appendChild(table)
  }

  function appendInboundEntry(entry) {
    inboundListEl.appendChild(el('li', {}, `[${entry.time}] ${entry.customerName} (${entry.phone}) — ${entry.reason}`))
  }

  function appendPostEntry(entry) {
    postListEl.appendChild(el('li', {}, `${entry.step || ''} · ${entry.caseId || ''} · ${entry.detail || ''}`))
  }

  // 인터럽트 기반 자동 전환: 사용자가 어느 패널에 있든, 접수 카드가 생성되면
  // 강제로 케이스 처리 패널로 전환한다 ("지금 보고 있는 화면"보다 "지금 가장
  // 중요한 업무"를 우선시하는 의도적인 UX 선택 — README.md §6).
  function onCriticalEventDetected(caseData) {
    renderCaseDetail(caseData)
    switchToPanel('case')
    markStepDone('case_created')
    setStatus('접수 카드 생성 완료', 'ok')
  }

  function resetAll() {
    caseDetailEl.innerHTML = ''
    blockInfoEl.textContent = ''
    blockInfoEl.classList.remove('ok')
    reservationInfoEl.textContent = ''
    reservationInfoEl.classList.remove('ok')
    candidateListEl.innerHTML = ''
    inboundListEl.innerHTML = ''
    postListEl.innerHTML = ''
    Object.values(stepDots).forEach((dot) => dot.classList.remove('active', 'done'))
    setBadge('inbound', 0)
    setTrackDot('dispatch', false)
    setStatus('초기화됨')
    switchToPanel('case')
  }

  function buildRail(callbacks) {
    const logo = el('div', { className: 'rail-logo', title: '펼치기/접기' }, 'S')
    logo.addEventListener('click', () => toggleCollapse())

    const railTabs = el('div', { className: 'rail-tabs' })
    TABS.forEach(({ key, icon, label }) => {
      const item = el('div', {
        className: 'rail-item',
        'data-label': label,
        title: label,
        onclick: () => switchToPanel(key),
      }, icon)
      if (key === 'inbound') {
        const badge = el('span', { className: 'badge' })
        item.appendChild(badge)
        els.badges.inbound = badge
      }
      if (key === 'dispatch') {
        const dot = el('span', { className: 'track-dot' })
        item.appendChild(dot)
        els.dots.dispatch = dot
      }
      els.tabs[key] = item
      railTabs.appendChild(item)
    })

    const resetBtn = el('div', {
      className: 'rail-icon-btn',
      title: '전체 초기화',
      onclick: () => callbacks.onResetAll(),
    }, '↺')

    const themeInput = el('input', {
      type: 'checkbox',
      onchange: (e) => sidebarEl.setAttribute('data-theme', e.target.checked ? 'light' : 'dark'),
    })
    const themeSwitch = el('label', { className: 'theme-switch', title: '테마 전환' }, [
      themeInput,
      el('span', { className: 'theme-slider' }),
    ])

    const profile = el('div', { className: 'profile' }, [
      el('div', { className: 'avatar' }, '👤'),
      el('div', { className: 'profile-name' }, '담당자'),
    ])

    const settingsItem = el('div', {
      className: 'rail-item',
      style: 'width:32px;height:32px;font-size:14px;',
      'data-label': SETTINGS_TAB.label,
      title: SETTINGS_TAB.label,
      onclick: () => switchToPanel(SETTINGS_TAB.key),
    }, SETTINGS_TAB.icon)
    els.tabs[SETTINGS_TAB.key] = settingsItem

    collapseBtnEl = el('div', { className: 'collapse-btn', title: '펼치기/접기' }, '«')
    collapseBtnEl.addEventListener('click', () => toggleCollapse())

    const railFooter = el('div', { className: 'rail-footer' }, [
      resetBtn, themeSwitch, profile, settingsItem, collapseBtnEl,
    ])

    return el('nav', { className: 'rail' }, [logo, railTabs, railFooter])
  }

  function buildInboundPanel() {
    inboundListEl = el('ul', { className: 'spog-list' })
    const panel = el('section', { className: 'panel' }, [
      el('div', { className: 'panel-header' }, el('h1', {}, '인바운드 문의')),
      card('콜백 이력', [inboundListEl]),
    ])
    els.panels.inbound = panel
    return panel
  }

  function buildCasePanel(callbacks) {
    // 접수양식 입력 폼은 사이드바가 아니라 System A 포털 페이지 본문(iframe)에
    // 있다. 사이드바는 그 iframe의 값을 읽어가기만 한다 (message_router.js).
    const createCaseBtn = el('button', {
      className: 'btn primary',
      onclick: () => callbacks.onCreateCase(),
    }, '접수 카드 생성')
    const hint = el('p', { className: 'card-hint' }, '포털 페이지 본문의 접수양식 값을 읽어와 접수 카드를 생성합니다.')

    const pipelineRows = PIPELINE_STEPS.map((s) => statusDotRow(s.key, s.label))
    caseDetailEl = el('div', { className: 'spog-case-detail' })

    const panel = el('section', { className: 'panel' }, [
      el('div', { className: 'panel-header' }, el('h1', {}, '케이스 처리')),
      card('접수 카드 생성', [hint, createCaseBtn]),
      card('파이프라인 진행', pipelineRows),
      card('케이스 상세', [caseDetailEl]),
    ])
    els.panels.case = panel
    return panel
  }

  function buildDispatchPanel(callbacks) {
    blockInfoEl = el('div', { className: 'status-line' })
    reservationInfoEl = el('div', { className: 'status-line' })
    candidateListEl = el('div', { className: 'spog-candidates' })

    const panel = el('section', { className: 'panel' }, [
      el('div', { className: 'panel-header' }, el('h1', {}, '예약/배차 자동화')),
      card('1. 블록 생성', [
        el('button', { className: 'btn primary', onclick: () => callbacks.onRunBlock() }, '블록 생성'),
        blockInfoEl,
      ]),
      card('2. 고객 예약 생성', [
        el('button', { className: 'btn primary', onclick: () => callbacks.onRunReservation() }, '예약 생성'),
        reservationInfoEl,
      ]),
      card('3. 후보 검색·스코어링', [
        el('button', { className: 'btn primary', onclick: () => callbacks.onRunSearch() }, '후보 검색'),
        candidateListEl,
      ]),
    ])
    els.panels.dispatch = panel
    return panel
  }

  function buildPostPanel() {
    postListEl = el('ul', { className: 'spog-list' })
    const panel = el('section', { className: 'panel' }, [
      el('div', { className: 'panel-header' }, el('h1', {}, '사후관리')),
      card('처리 로그', [postListEl]),
    ])
    els.panels.post = panel
    return panel
  }

  function buildSettingsPanel(callbacks) {
    const notifCheckbox = el('input', {
      type: 'checkbox',
      checked: 'checked',
      onchange: (e) => callbacks.onToggleNotifications(e.target.checked),
    })
    const panel = el('section', { className: 'panel' }, [
      el('div', { className: 'panel-header' }, el('h1', {}, '설정')),
      card('환경설정', [
        el('label', { className: 'check-item' }, [notifCheckbox, document.createTextNode('알림 사용')]),
      ]),
    ])
    els.panels.settings = panel
    return panel
  }

  function createSidebar(callbacks) {
    const rail = buildRail(callbacks)

    statusLineEl = el('span', { className: 'status-line' }, '대기 중')
    const header = el('div', { className: 'content-header' }, [
      el('span', { className: 'eyebrow' }, 'AUTOMATION ASSISTANT'),
      el('span', { className: 'title' }, '접수 자동화 어시스턴트'),
      statusLineEl,
    ])

    const body = el('div', { className: 'content-body' }, [
      buildInboundPanel(),
      buildCasePanel(callbacks),
      buildDispatchPanel(callbacks),
      buildPostPanel(),
      buildSettingsPanel(callbacks),
    ])

    const content = el('main', { className: 'content' }, [header, body])

    sidebarEl = el('div', { id: 'spog-sidebar', className: 'open' }, [rail, content])
    document.body.appendChild(sidebarEl)

    switchToPanel('case')
  }

  return {
    createSidebar,
    switchToPanel,
    setBadge,
    setTrackDot,
    setStepActive,
    markStepDone,
    setStatus,
    renderCaseDetail,
    renderBlockInfo,
    renderReservationInfo,
    renderCandidates,
    appendInboundEntry,
    appendPostEntry,
    onCriticalEventDetected,
    resetAll,
  }
})()

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_UI = SPOG_UI
}
