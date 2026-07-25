# Sidebar UI 레이아웃 레퍼런스

> 포트폴리오/오픈소스용으로 새로 만드는 사이드바가 실제 위젯과 **배치·구조**는 같고
> **내용(라벨, 브랜드, 사내 용어)**만 다르게 가도록 하기 위한 참고 문서입니다.
> 클래스명·ID는 실제 코드 그대로가 아니라 이해하기 쉬운 이름으로 일반화했습니다.
> 수치(px)와 트랜지션 값은 실제 위젯 값을 그대로 담아, 그대로 옮기면 레이아웃이 얼추 맞게 했습니다.

---

## 1. 전체 골격

사이드바는 **"아이콘 레일(nav rail) + 콘텐츠 패널"** 두 컬럼 구조이고, 하나의 컨테이너가 `collapsed`/`open` 두 상태를 오갑니다. 컬럼을 나누는 이유는 "지금 어떤 업무 화면인지"는 접혀 있어도 아이콘으로 항상 보이게 하기 위함입니다.

```
[collapsed, width: 56px]        [open, width: 320px]
┌────┐                          ┌────┬──────────────────────┐
│ L  │  ← 로고(열기/닫기 토글)   │ L  │  eyebrow 라벨          │
│────│                          │────│  타이틀                │
│ ●  │  ← 탭 아이콘1 (배지)      │ ●  │  상태 텍스트            │
│ ●  │  ← 탭 아이콘2 (기본활성)  │ ●  ├──────────────────────┤
│ ●  │  ← 탭 아이콘3 (진행점)   │ ●  │                        │
│ ●  │  ← 탭 아이콘4            │ ●  │   (스크롤 영역)         │
│    │                          │    │   활성 패널 내용        │
│ ─  │  ← 구분선                │ ─  │                        │
│ ○  │  ← 전체초기화            │ ○  │                        │
│ ◐  │  ← 주야간 토글           │ ◐  │                        │
│ ⓐ  │  ← 프로필 아바타+이름    │ ⓐ  │                        │
│ ⚙  │  ← 설정 탭               │ ⚙  │                        │
│ »  │  ← 펼치기/접기 화살표    │ «  │                        │
└────┘                          └────┴──────────────────────┘
```

- 컨테이너: `position: fixed`, 화면 왼쪽(`top`은 브라우저 상단 바 높이만큼 오프셋), 오른쪽 모서리만 둥글게(`border-radius: 0 20px 20px 0`), 큰 드롭섀도우.
- 너비 전환: `56px → 320px`, `transition: width 0.35~0.4s cubic-bezier(0.4,0,0.2,1)`.
- 콘텐츠 영역은 접혀 있을 때 `opacity: 0` + `pointer-events: none`으로 미리 렌더링된 채 숨어 있다가, 펼쳐질 때 페이드인만 함 (레이아웃 재계산 없음 → 전환이 끊기지 않음).

---

## 2. 치수 표

| 요소 | 값 |
|---|---|
| 컨테이너 collapsed 너비 | `56px` |
| 컨테이너 open 너비 | `320px` |
| 레일(nav rail) 너비 | `56px` (고정, open 상태에서도 안 늘어남) |
| 콘텐츠 영역 너비 | `264px` (`320 - 56`) |
| 로고 크기 | `36 × 36px`, radius `10px` |
| 탭 아이콘 버튼 크기 | `40 × 40px`, radius `10px`, 내부 svg `18 × 18px` |
| 설정 탭(하단, 작은 버전) | `32 × 32px` |
| 프로필 아바타 | `28 × 28px`, 원형 |
| 배지(카운터) | 최소 `14 × 14px`, 우상단 절대배치 `top:4px; right:4px` |
| 진행 점(track dot) | `8 × 8px`, 배지와 같은 위치에 배치 (배지·점은 동시에 안 씀) |
| 패널 좌우 패딩 | `16px` |
| 카드 radius | `12px` (헤더/바디 내부는 `border-bottom` 한 줄로 분리) |
| 버튼 radius | `9px`, 세로 패딩 `9px` |
| 입력/셀렉트 radius | `8px` |
| 헤더 상하 패딩 | `13px 16px 11px` |

이 수치들을 그대로 가져다 써도 실제 위젯과 거의 동일한 밀도(icon 40px, 텍스트 12~13px 등)가 나옵니다.

---

## 3. 색상 토큰 (다크 기본 + 라이트 오버라이드)

컨테이너 스코프에 CSS 커스텀 프로퍼티로 선언하고, 라이트 테마는 `[data-theme="light"]` 셀렉터로 값만 덮어씁니다. 브랜드 컬러(accent)만 자기 것으로 바꾸면 나머지 톤은 그대로 재사용 가능합니다.

```css
.app-sidebar {
  /* dark (기본) */
  --bg-main:    #0F172A;
  --bg-nav:     #080D1A;
  --bg-card:    rgba(255,255,255,0.06);
  --bg-input:   rgba(255,255,255,0.08);
  --border:     rgba(255,255,255,0.15);
  --text-pri:   #F8FAFC;
  --text-sec:   #94A3B8;
  --accent:     #3B82F6;      /* ← 브랜드 컬러로 교체 가능 */
  --accent-dim: rgba(59,130,246,0.18);
  --danger:     #EF4444;
  --ok:         #10B981;
  --warn:       #F59E0B;
}

.app-sidebar[data-theme="light"] {
  --bg-main:    #F8FAFC;
  --bg-nav:     #F1F5F9;
  --bg-card:    rgba(0,0,0,0.03);
  --bg-input:   rgba(0,0,0,0.05);
  --border:     rgba(0,0,0,0.08);
  --text-pri:   #0F172A;
  --text-sec:   #64748B;
  --accent:     #2563EB;
  --accent-dim: rgba(37,99,235,0.10);
  --danger:     #DC2626;
  --ok:         #059669;
  --warn:       #D97706;
}
```

의미 컬러는 3가지만 씁니다: `--ok`(완료/정상, 초록) / `--warn`(주의, 주황) / `--danger`(오류/충돌, 빨강). 그 외 모든 강조는 `--accent`.

---

## 4. 네비게이션 레일 구성 (위→아래 순서)

1. **로고 / 열기·닫기 토글** — 클릭하면 collapsed ↔ open 전환. hover 시 `scale(1.07)` + accent 색 아웃라인.
2. **탭 아이콘 리스트** (세로 스택, `gap: 4px`)
   - 각 아이콘은 `title` 속성을 그대로 커스텀 툴팁으로 사용 (`::after { content: attr(title) }`, 레일 오른쪽으로 pop, hover 시만 표시).
   - 활성 탭: 배경 `--accent-dim` + 글자색 `--accent` + `inset box-shadow` 1px 테두리.
   - 각 아이콘 우상단에 두 종류 중 하나의 인디케이터가 올라갈 수 있음 (§6 참고).
3. **구분선 아래 하단 스택** (`nav-footer`, 위쪽에 `border-top`으로 시각적 분리)
   - 전체 초기화 아이콘 버튼
   - 주야간 테마 토글 (커스텀 슬라이드 스위치, on/off에 따라 🌙 ↔ ☀️ 아이콘 이동)
   - 프로필 아바타 + 이름 (8px 초소형 라벨, 말줄임 처리, hover 시 이름 전체를 툴팁으로)
   - 설정 탭 (다른 탭보다 한 단계 작은 32px 버전)
   - 사이드바 펼치기/접기 화살표 아이콘 (24px, 방향 아이콘 회전으로 상태 표시)

레일의 모든 클릭 가능 요소는 **정사각형 hit box + radius**로 통일되어 있어서, 아이콘 종류가 늘어도 리듬이 깨지지 않습니다.

---

## 5. 콘텐츠 영역 구성

### 5-1. 헤더 (고정, 스크롤 안 됨)

3줄 고정 텍스트 블록:

```
EYEBROW LABEL           ← 9px, 굵게, 회색, 대문자 letter-spacing
타이틀 (앱/기능 이름)     ← 13px, 굵게, 주 텍스트색
상태 텍스트 (동적 갱신)   ← 10px, 회색, 색상만 성공/실패에 따라 바뀜
```

상태 텍스트는 색상 하나로 성공(초록)/실패(빨강)/중립(회색)을 표현하고, 일정 시간 후 자동으로 중립 문구로 리셋됩니다.

### 5-2. 스크롤 바디 + 패널

바디는 `flex:1; overflow-y:auto`이고, 그 안에 **패널(panel)** 이 탭 개수만큼 나란히 존재하되 `display:none` / `.active{display:flex}`로 하나만 보이게 스위칭합니다 (라우팅 없이 클래스 토글만으로 탭 전환).

각 패널 내부는 공통 컴포넌트 조합으로 이루어집니다.

| 컴포넌트 | 용도 | 핵심 스타일 |
|---|---|---|
| `.panel-header` | 패널 상단 아이콘+제목 줄 | flex row, 아이콘 15px |
| `.card` (head+body) | 정보 그룹 박스 | head: 회색 소제목 줄, body: 내용 |
| `.btn` / `.btn.primary` / `.btn.danger` | 액션 버튼 | 기본 회색 테두리, primary는 accent 톤, danger는 빨강 톤 |
| `.btn-row` | 버튼 가로 배치 | `display:flex; gap:8px`, 자식 `flex:1` |
| `.custom-select` | 네이티브 select 대체 드롭다운 | trigger + 절대배치 옵션 리스트, 열림 시 accent 테두리 |
| `.check-item` | 체크박스 항목 | accent-color 체크박스 + 라벨 |
| `.collapsible-section` | 접이식 섹션 (아코디언) | toggle 버튼 + `max-height` 트랜지션 바디 |
| `.chip` (label+value) | 라벨-값 쌍 표시 | 좌측 라벨 블록(고정폭, 배경 살짝 어둡게) + 우측 값(모노스페이스 폰트 가능) |
| `.status-dot` | 초소형 원형 상태 표시 | 6~8px, 색상으로 상태 구분, 진행중일 때 `pulse` 애니메이션 |

패널마다 이 컴포넌트를 다른 조합/순서로 배치할 뿐, **새로운 시각 언어를 만들지 않습니다.** 포폴 버전을 만들 때도 이 표에 있는 컴포넌트 6~9종만 재구성하면 "위치가 비슷한" 느낌을 만들 수 있습니다.

### 5-3. 모달 (확인 팝업)

패널과 별개로 전체 화면을 덮는 오버레이 1종:

- `position:fixed`, 반투명 배경 + `backdrop-filter: blur(4px)`
- 중앙에 카드형 모달 (`max-width:600px`), 헤더(아이콘+큰 타이틀) → 설명 텍스트 → 미리보기 블록(가로 나열, 각각 카드형) → 하단 좌우 버튼 2개
- 다크/라이트 색상 변수를 모달 자체에도 동일하게 선언 (사이드바 밖에 렌더링되므로 상속 안 됨 → 모달 스코프에 변수 재선언 필요)

---

## 6. 상태 인디케이터 규칙 (구조적으로 중요한 부분)

탭이 5개로 나뉘어 있기 때문에, **"지금 안 보고 있는 탭에서 뭔가 일어났다"**는 것을 알리는 장치가 반드시 필요합니다. 이 위젯은 두 종류를 구분해서 씁니다.

| 종류 | 모양 | 의미 | 사라지는 조건 |
|---|---|---|---|
| **배지 (badge)** | 우상단, 숫자 포함 작은 원 (빨강) | "대기 중인 항목 수" 같은 카운터 | 사용자가 처리하면 숫자 감소/숨김 |
| **트래킹 도트 (track dot)** | 우상단, 숫자 없는 초록 점 + pulse 애니메이션 | "다른 탭에서 자동화가 진행 중" 같은 이진 상태 | 해당 작업이 끝나면 사라짐 (배지처럼 카운트 안 함) |

두 인디케이터는 **같은 좌표(`top:4px; right:4px`)** 를 재사용하므로 한 탭 아이콘에 동시에 뜨지 않게 하나만 노출합니다. 이 규칙을 지키면 아이콘이 지저분해지지 않습니다.

또한 특정 이벤트가 감지되면 **사용자가 다른 탭을 보고 있어도 강제로 핵심 탭으로 전환**하는 인터럽트 규칙이 있습니다(§ARCHITECTURE.md §7 참고). 포폴 버전에서는 굳이 실제 트리거 로직 없이, 버튼 하나로 이 전환 애니메이션만 시연해도 충분합니다.

---

## 7. 인터랙션/트랜지션 값 모음

그대로 재사용해도 되는 타이밍 값들입니다.

| 동작 | duration / easing |
|---|---|
| 사이드바 열기/닫기 (width) | `0.35~0.4s cubic-bezier(0.4,0,0.2,1)` |
| 콘텐츠 opacity 페이드 | `0.25~0.3s ease` |
| 레일 아이콘 hover 배경 | `0.18s` |
| 탭 전환 시 패널 opacity/translateY | `0.18s ease` |
| 아코디언 펼침 (`max-height`) | `0.25~0.35s ease` |
| 아코디언 펼침 (grid 방식, `grid-template-rows: 0fr → 1fr`) | `0.3~0.35s cubic-bezier(0.4,0,0.2,1)` |
| 배지/도트 pulse | `2s ease-in-out infinite` |
| 툴팁 등장 | `0.15s` |
| 모달 등장 (opacity + translateY) | `0.2s ease-in-out` |
| 버튼 클릭 피드백 | `active { transform: scale(0.97) }` |

포인트는 **"열기/닫기"류는 느리고 부드럽게(0.3s대 + cubic-bezier), 마이크로 인터랙션(hover, 클릭)은 짧고 즉각적으로(0.15~0.18s)** 라는 2단 속도 체계입니다. 이 완급 차이만 지켜도 "손맛"이 비슷해집니다.

---

## 8. 포폴 버전 제작 체크리스트

실제와 "느낌"이 다르다고 느껴지는 원인은 대부분 아래 중 하나입니다. 위에서부터 순서대로 맞춰보세요.

1. [ ] 컨테이너가 **2컬럼(레일 고정폭 + 콘텐츠 가변폭)** 구조인가, 아니면 단일 패널로 잘못 만들었는가
2. [ ] collapsed 상태에서도 **아이콘 레일만은 항상 보이는가** (완전히 숨기면 안 됨)
3. [ ] 탭 아이콘이 **정확히 40px 정사각형 + 4px 간격**으로 리듬감 있게 배치되어 있는가
4. [ ] 레일 하단에 **구분선 + 부가기능 스택**(테마토글/프로필/설정/접기버튼)이 있는가, 아니면 탭만 나열하고 끝났는가
5. [ ] 헤더가 **eyebrow + 타이틀 + 동적 상태줄** 3단 구조인가
6. [ ] 색상이 **딱 3개의 의미 컬러(성공/경고/위험) + 1개 강조색**으로만 절제되어 있는가, 아니면 색이 남발되고 있는가
7. [ ] 배지(카운터)와 트래킹 도트(진행중 점)를 **구분해서** 쓰고 있는가
8. [ ] 열기/닫기는 느리고 부드럽게, hover/클릭은 짧고 즉각적인 **2단 트랜지션 속도**를 지켰는가
9. [ ] 라이트 테마가 다크 테마의 변수만 오버라이드하는 구조인가 (별도 스타일시트를 통째로 만들지 않았는가)

---

## 9. 예시 HTML/CSS (그대로 저장해서 브라우저로 열어보기)

아래 코드를 `example.html` 하나로 저장하면 바로 동작을 확인할 수 있습니다. 라벨/아이콘은 전부 자리표시자이며, 위에서 설명한 치수·색상 토큰·트랜지션 값을 그대로 반영했습니다. 탭 전환, 열기/닫기, 배지/도트, 다크·라이트 토글까지 순수 HTML/CSS/JS만으로 동작합니다.

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Sidebar UI Example</title>
<style>
  body {
    margin: 0;
    min-height: 100vh;
    background: #1e293b;
    font-family: -apple-system, 'Segoe UI', sans-serif;
  }

  /* ── 컨테이너 ── */
  .app-sidebar {
    --bg-main:    #0F172A;
    --bg-nav:     #080D1A;
    --bg-card:    rgba(255,255,255,0.06);
    --bg-input:   rgba(255,255,255,0.08);
    --border:     rgba(255,255,255,0.15);
    --text-pri:   #F8FAFC;
    --text-sec:   #94A3B8;
    --accent:     #3B82F6;
    --accent-dim: rgba(59,130,246,0.18);
    --danger:     #EF4444;
    --ok:         #10B981;
    --warn:       #F59E0B;

    position: fixed;
    top: 64px; left: 0;
    height: calc(100vh - 74px);
    display: flex;
    width: 56px;
    border-radius: 0 20px 20px 0;
    box-shadow: 6px 0 40px rgba(0,0,0,0.6);
    overflow: hidden;
    font-size: 13px;
    transition: width 0.4s cubic-bezier(0.25,1,0.5,1);
  }
  .app-sidebar.open { width: 320px; }

  .app-sidebar[data-theme="light"] {
    --bg-main:    #F8FAFC;
    --bg-nav:     #F1F5F9;
    --bg-card:    rgba(0,0,0,0.03);
    --bg-input:   rgba(0,0,0,0.05);
    --border:     rgba(0,0,0,0.08);
    --text-pri:   #0F172A;
    --text-sec:   #64748B;
    --accent:     #2563EB;
    --accent-dim: rgba(37,99,235,0.10);
    --danger:     #DC2626;
    --ok:         #059669;
    --warn:       #D97706;
  }

  /* ── 네비게이션 레일 ── */
  .rail {
    width: 56px; flex-shrink: 0;
    background: var(--bg-nav);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    align-items: center;
    padding: 12px 0 10px;
  }
  .rail-logo {
    width: 36px; height: 36px; border-radius: 10px;
    background: var(--accent-dim);
    color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; cursor: pointer;
    transition: transform 0.15s;
  }
  .rail-logo:hover { transform: scale(1.07); }

  .rail-tabs {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: 4px;
    width: 100%; padding: 16px 8px 0; box-sizing: border-box;
  }
  .rail-item {
    position: relative;
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-sec); cursor: pointer;
    font-weight: 700; font-size: 13px;
    transition: background 0.18s, color 0.18s;
  }
  .rail-item:hover { background: rgba(255,255,255,0.07); color: var(--text-pri); }
  .rail-item.active {
    background: var(--accent-dim); color: var(--accent);
    box-shadow: inset 0 0 0 1px rgba(59,130,246,0.3);
  }
  .rail-item::after {
    content: attr(data-label);
    position: absolute; left: calc(100% + 10px); top: 50%;
    transform: translateY(-50%);
    background: var(--text-pri); color: var(--bg-main);
    font-size: 11px; font-weight: 800; padding: 6px 12px;
    border-radius: 6px; white-space: nowrap;
    opacity: 0; pointer-events: none; transition: opacity 0.15s;
  }
  .rail-item:hover::after { opacity: 1; }

  /* 배지(카운터) */
  .badge {
    position: absolute; top: 4px; right: 4px;
    min-width: 14px; height: 14px; border-radius: 7px;
    background: var(--danger); color: #fff;
    font-size: 9px; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    padding: 0 3px; line-height: 1;
  }
  /* 트래킹 도트(진행중) */
  .track-dot {
    position: absolute; top: 4px; right: 4px;
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 6px rgba(16,185,129,0.7);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }

  .rail-footer {
    width: 100%; display: flex; flex-direction: column;
    align-items: center; gap: 6px; padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .rail-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-sec); cursor: pointer; font-size: 14px;
    transition: background 0.18s, color 0.18s;
  }
  .rail-icon-btn:hover { background: rgba(255,255,255,0.07); color: var(--text-pri); }

  .theme-switch {
    position: relative; width: 32px; height: 18px; cursor: pointer;
  }
  .theme-switch input { opacity: 0; width: 0; height: 0; }
  .theme-slider {
    position: absolute; inset: 0; background: #1E293B;
    border: 1px solid var(--border); border-radius: 18px; transition: background 0.3s;
  }
  .theme-slider::before {
    content: "🌙"; position: absolute; top: 50%; left: 2px;
    transform: translateY(-50%); font-size: 10px; transition: transform 0.3s;
  }
  .theme-switch input:checked + .theme-slider { background: #0fbcf9; }
  .theme-switch input:checked + .theme-slider::before { content: "☀️"; transform: translateY(-50%) translateX(14px); }

  .profile { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--accent-dim); color: var(--accent);
    display: flex; align-items: center; justify-content: center; font-size: 12px;
  }
  .profile-name { font-size: 8px; font-weight: 700; color: var(--text-sec); }

  .collapse-btn {
    width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
    color: var(--text-sec); cursor: pointer; font-size: 12px;
  }

  /* ── 콘텐츠 영역 ── */
  .content {
    width: 264px; flex-shrink: 0;
    background: var(--bg-main);
    display: flex; flex-direction: column;
    opacity: 1; transition: opacity 0.3s ease;
  }
  .app-sidebar:not(.open) .content { opacity: 0; pointer-events: none; }

  .content-header { padding: 13px 16px 11px; border-bottom: 1px solid var(--border); }
  .eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-sec); display: block; }
  .title   { font-size: 13px; font-weight: 800; color: var(--text-pri); display: block; margin-top: 1px; }
  .status-line { font-size: 10px; font-weight: 600; color: var(--text-sec); display: block; margin-top: 3px; transition: color 0.25s; }
  .status-line.ok  { color: var(--ok); }
  .status-line.err { color: var(--danger); }

  .content-body { flex: 1; overflow-y: auto; padding: 16px; }
  .panel { display: none; flex-direction: column; gap: 12px; }
  .panel.active { display: flex; }

  .panel-header { display: flex; align-items: center; gap: 8px; }
  .panel-header h1 { margin: 0; font-size: 13px; font-weight: 800; color: var(--text-pri); }

  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .card-head { padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 700; color: var(--text-sec); }
  .card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }

  .btn {
    width: 100%; padding: 9px 14px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--bg-card);
    color: var(--text-sec); font-size: 12px; font-weight: 700;
    cursor: pointer; transition: background 0.18s, color 0.18s, transform 0.13s;
  }
  .btn:hover { background: rgba(255,255,255,0.08); color: var(--text-pri); }
  .btn:active { transform: scale(0.97); }
  .btn.primary { background: var(--accent-dim); color: var(--accent); border-color: rgba(59,130,246,0.25); }
  .btn.danger  { color: var(--danger); border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.06); }
  .btn-row { display: flex; gap: 8px; }
  .btn-row .btn { flex: 1; }

  .chip { display: flex; border-radius: 6px; overflow: hidden; background: var(--bg-card); border: 1px solid var(--border); }
  .chip-label { flex-shrink: 0; width: 42px; padding: 5px 8px; font-size: 10px; font-weight: 800; text-align: center; color: var(--text-sec); background: rgba(255,255,255,0.03); border-right: 1px solid var(--border); }
  .chip-val { flex: 1; padding: 5px 10px; font-size: 11px; font-weight: 600; color: var(--text-pri); font-family: 'SF Mono', monospace; }

  .status-dot-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-pri); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 5px rgba(16,185,129,0.6); animation: pulse 2s ease-in-out infinite; }
  .status-dot.done { background: #334155; box-shadow: none; animation: none; }
</style>
</head>
<body>

<div class="app-sidebar" id="sidebar">
  <nav class="rail">
    <div class="rail-logo" id="toggleBtn">L</div>

    <div class="rail-tabs">
      <div class="rail-item" data-panel="panel-1" data-label="Tab 1">①<span class="badge">3</span></div>
      <div class="rail-item active" data-panel="panel-2" data-label="Tab 2">②<span class="track-dot" style="display:none"></span></div>
      <div class="rail-item" data-panel="panel-3" data-label="Tab 3">③<span class="track-dot"></span></div>
      <div class="rail-item" data-panel="panel-4" data-label="Tab 4">④</div>
    </div>

    <div class="rail-footer">
      <div class="rail-icon-btn" title="전체 초기화">↺</div>
      <label class="theme-switch">
        <input type="checkbox" id="themeToggle">
        <span class="theme-slider"></span>
      </label>
      <div class="profile">
        <div class="avatar">👤</div>
        <div class="profile-name">User</div>
      </div>
      <div class="rail-item" style="width:32px;height:32px;" data-panel="panel-settings" data-label="설정">⚙</div>
      <div class="collapse-btn" id="collapseIcon">»</div>
    </div>
  </nav>

  <main class="content">
    <div class="content-header">
      <span class="eyebrow">SIDEBAR ASSISTANT</span>
      <span class="title">예시 워크플로 도우미</span>
      <span class="status-line" id="statusLine">대기 중...</span>
    </div>

    <div class="content-body">
      <section class="panel" id="panel-1">
        <div class="panel-header"><h1>Tab 1</h1></div>
        <div class="card">
          <div class="card-head">카드 제목</div>
          <div class="card-body">
            <div class="chip"><div class="chip-label">필드</div><div class="chip-val">값 예시</div></div>
            <div class="btn-row">
              <button class="btn primary">주요 액션</button>
              <button class="btn danger">위험 액션</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel active" id="panel-2">
        <div class="panel-header"><h1>Tab 2 (기본 활성)</h1></div>
        <div class="card">
          <div class="card-head">진행 상태</div>
          <div class="card-body">
            <div class="status-dot-row"><span class="status-dot"></span>항목 A 처리 중</div>
            <div class="status-dot-row"><span class="status-dot done"></span>항목 B 완료</div>
          </div>
        </div>
      </section>

      <section class="panel" id="panel-3">
        <div class="panel-header"><h1>Tab 3</h1></div>
        <div class="card"><div class="card-body">내용 자리표시자</div></div>
      </section>

      <section class="panel" id="panel-4">
        <div class="panel-header"><h1>Tab 4</h1></div>
        <div class="card"><div class="card-body">내용 자리표시자</div></div>
      </section>

      <section class="panel" id="panel-settings">
        <div class="panel-header"><h1>설정</h1></div>
        <div class="card"><div class="card-body">설정 값 자리표시자</div></div>
      </section>
    </div>
  </main>
</div>

<script>
  const sidebar = document.getElementById('sidebar');
  document.getElementById('toggleBtn').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    document.getElementById('collapseIcon').textContent = sidebar.classList.contains('open') ? '«' : '»';
  });
  sidebar.classList.add('open'); // 데모 편의상 처음부터 펼침

  document.querySelectorAll('.rail-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.rail-item[data-panel]').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(item.dataset.panel).classList.add('active');
    });
  });

  document.getElementById('themeToggle').addEventListener('change', (e) => {
    sidebar.setAttribute('data-theme', e.target.checked ? 'light' : 'dark');
  });
</script>
</body>
</html>
```

이 예시는 §1~§7에서 설명한 규칙(2컬럼 골격, 치수, 색상 토큰, 배지/도트 구분, 트랜지션 속도)을 전부 반영했으므로, 여기서 라벨과 아이콘만 실제 프로젝트에 맞게 바꿔도 "위치가 비슷한" 포트폴리오용 사이드바가 됩니다.
