// state/bulletin_store.ts
// [PSEUDOCODE] 포털 게시판(공지사항) 패널 전용 상태. 원본에서 가장 까다로웠던
// 버그가 여기서 나왔다 — 아래 순서로 도달한 최종 구조를 그대로 옮긴다.
//
//  1차 증상: 게시글 "고정" 클릭 → 화면이 잠깐 꺼짐 → 뒤늦게 다시 켜짐.
//  원인: 고정 쓰기(POST)를 이 패널이 백엔드에 직접 보내고 있었는데, 그거랑
//  완전히 무관한 배경 폴링(GET, 5분 알람)이 "고정 전" 스냅샷을 들고 뒤늦게
//  도착해서 통째 교체 — 그래서 방금 켠 고정이 꺼진 것처럼 보였다가, 다음
//  폴링이 진짜 최신값을 가져오면 다시 켜졌다.
//  1차 patch(폐기됨): 클라이언트에서 "방금 낙관적으로 바꾼 필드는 N초간
//  서버값보다 우선한다"는 타임스탬프 톰스톤을 넣어 증상을 가림 — 그러나
//  이건 "N초면 충분하다"는 추측에 기댄 patch일 뿐 경쟁 자체를 없애지 못했다.
//  최종 구조: 쓰기를 서비스워커 경유로 바꾸고, 서비스워커가 "쓰기 시작 시점
//  이전에 나가있던 폴링 응답은 도착해도 버린다"는 세대 카운터로 원천 차단
//  (service_worker.js 참고) — 그래서 이 스토어엔 타이밍 추측 코드가 없다.
import { createStore } from 'zustand/vanilla';

export interface Bulletin {
  id: string;
  title: string;
  date: string;
  category: string;
  /** [핵심] 목록 폴링 응답엔 이 필드가 없다 — 본문은 무겁고 대부분의 폴링
   *  순간엔 아무도 안 보고 있어서, 전체 사용자에게 5분마다 실어보내던 걸
   *  없앴다. 세부창을 열 때만 fetchBulletinDetail()로 개별 조회해서 채운다. */
  content?: string;
  isRead: boolean;
  isPinned: boolean;
  pinnedOrder?: number;
}

interface BulletinState {
  bulletins: Bulletin[];
  loginId: string;
}

export const bulletinStore = createStore<BulletinState>(() => ({ bulletins: [], loginId: '' }));

/** 배경 폴링(GET_CLIENT_CONFIG)이 CLIENT_CONFIG_UPDATED로 밀어줄 때마다 통째
 *  교체한다 — 병합 로직이 없는 이유는 위 주석의 최종 구조 설명 참고(서비스
 *  워커가 이미 "낡은 응답을 아예 안 보낸다"를 보장하므로 여기선 필요 없음). */
export function setBulletins(bulletins: unknown, loginId?: string): void {
  const list = Array.isArray(bulletins) ? (bulletins as Bulletin[]) : [];
  bulletinStore.setState((s) => ({ bulletins: list, loginId: loginId || s.loginId }));
}

/** 낙관적 업데이트 → 서비스워커 경유 쓰기 → 실패 시 되돌림. 세 액션(읽음/고정/
 *  재정렬) 모두 같은 모양 — 성공 여부를 실제로 확인해서 실패를 화면에 반영한다
 *  (원본의 옛날 버전은 fire-and-forget이라 실패해도 화면은 계속 "성공한 척"
 *  남아있었다). */
export async function toggleBulletinRead(id: string): Promise<void> {
  const { bulletins, loginId } = bulletinStore.getState();
  const target = bulletins.find((b) => b.id === id);
  if (!target) return;
  const prev = target.isRead;
  bulletinStore.setState({ bulletins: bulletins.map((b) => (b.id === id ? { ...b, isRead: !prev } : b)) });
  const res = await chrome.runtime.sendMessage({ type: 'TOGGLE_BULLETIN_READ', loginId, bulletinId: id, read: !prev });
  if (!res?.success) {
    bulletinStore.setState((s) => ({ bulletins: s.bulletins.map((b) => (b.id === id ? { ...b, isRead: prev } : b)) }));
  }
}

export async function toggleBulletinPin(id: string): Promise<void> {
  const { bulletins, loginId } = bulletinStore.getState();
  const target = bulletins.find((b) => b.id === id);
  if (!target) return;
  const prevPinned = target.isPinned;
  const prevOrder = target.pinnedOrder;
  const nowPinned = !prevPinned;
  const pinnedOrder = nowPinned ? Math.max(-1, ...bulletins.filter((b) => b.isPinned).map((b) => b.pinnedOrder ?? -1)) + 1 : -1;
  bulletinStore.setState({ bulletins: bulletins.map((b) => (b.id === id ? { ...b, isPinned: nowPinned, pinnedOrder } : b)) });
  const res = await chrome.runtime.sendMessage({ type: 'TOGGLE_BULLETIN_PIN', loginId, bulletinId: id, pinned: nowPinned, pinnedOrder });
  if (!res?.success) {
    bulletinStore.setState((s) => ({ bulletins: s.bulletins.map((b) => (b.id === id ? { ...b, isPinned: prevPinned, pinnedOrder: prevOrder } : b)) }));
  }
}

/** [신규] 본문 온디맨드 조회 — 성공하면 스토어에 패치해 같은 세션 안 재열람 시
 *  재요청을 막는다. 결과는 호출자에게도 반환해 컴포넌트가 자기 로딩/에러 UI를
 *  그리게 한다. */
export async function fetchBulletinDetail(id: string): Promise<{ success: boolean; content?: string; error?: string }> {
  const res = await chrome.runtime.sendMessage({ type: 'GET_BULLETIN_DETAIL', bulletinId: id });
  if (res?.success) {
    bulletinStore.setState((s) => ({ bulletins: s.bulletins.map((b) => (b.id === id ? { ...b, content: res.content } : b)) }));
    return { success: true, content: res.content };
  }
  return { success: false, error: res?.error };
}
