// state/tracking_store.ts
// [PSEUDOCODE] System C(예약·배차)의 "예약 블록" 추적 목록 — 이 프로젝트에서
// 가장 여러 라운드에 걸쳐 재설계된 부분이다. 폴링(스캔)으로만 상태를 확인할 수
// 있는 외부 시스템을 상대로, 눈에 보이는 깜빡임 없이 목록을 유지하는 문제.
//
// 겪은 버그와 최종 구조:
//  1) 블록을 막 취소했는데 카드가 사라졌다가 다시 나타났다가 다시 사라짐.
//     원인: 취소 확인 스캔(단건 조회)은 취소를 봤는데, 그 직후 도는 다른 종류의
//     재확인 스캔(전체 테이블 스캔)은 아직 취소 반영 전 상태(stale)를 돌려줘서,
//     "새로 발견된 항목"으로 오인되어 방금 지운 카드가 되살아났다.
//  2) 여러 스캔이 동시에 진행 중일 때, 서로 다른 스캔 결과가 상대방이 방금 찾은
//     항목을 "이번엔 안 보였다"는 이유로 지워버림 — 스캔은 "이번에 이 스코프
//     안에서 실제로 훑은 id들"을 같이 넘겨서, 그 스코프에 없던 id는 건드리지
//     않게 해야 했다.
//
// 해결책 두 가지를 조합한다:
//  A) 톰스톤(tombstone) — 방금 생성/제거를 확인한 id는 짧은 시간(TTL) 동안
//     "확정된 값"으로 보호한다. 그 시간 안에 낡은 스캔 결과가 반대로 말해도 무시.
//  B) scopedMergeById — 이번 스캔이 실제로 훑고 지나간 id 집합(scannedIds)을
//     같이 받아서, "이번 스캔 결과에 없다"를 "삭제됐다"로 해석하는 걸 그
//     스코프 안의 id로만 한정한다. 스코프 밖의 기존 항목은 이번 결과가
//     뭐라고 하든 그대로 둔다.
import { createStore } from 'zustand/vanilla';

export interface TrackedBlock {
  id: string;
  scanScopeId: string; // 이 항목을 발견한 스캔의 스코프(예: 예약번호) — B)의 핵심
  label: string;
  startAt?: string;
}

interface TrackingState {
  blocks: TrackedBlock[];
}

export const trackingStore = createStore<TrackingState>(() => ({ blocks: [] }));

const TOMBSTONE_TTL_MS = 8000; // okstraTrackingStore와 동일 기준
const recentlyCreatedIds = new Map<string, number>(); // id -> 만료 시각
const recentlyRemovedIds = new Map<string, number>();

function isAlive(map: Map<string, number>, id: string): boolean {
  const exp = map.get(id);
  if (!exp) return false;
  if (Date.now() > exp) { map.delete(id); return false; }
  return true;
}

export function markBlockCreated(id: string): void {
  recentlyCreatedIds.set(id, Date.now() + TOMBSTONE_TTL_MS);
}
export function markBlockRemoved(id: string): void {
  recentlyRemovedIds.set(id, Date.now() + TOMBSTONE_TTL_MS);
}

/** 새로 생성 확인된 블록을 추가한다 — 방금 취소 확인된(A) id면 무시. 낡은
 *  재확인 스캔이 취소 사실을 놓치고 이 함수를 다시 부르는 경우를 막는다. */
export function addCreatedBlock(block: TrackedBlock): void {
  if (isAlive(recentlyRemovedIds, block.id)) return;
  trackingStore.setState((s) => (s.blocks.some((b) => b.id === block.id) ? s : { blocks: [...s.blocks, block] }));
}

/** [핵심] B) 스코프 한정 병합 — scanScopeId가 같은 기존 항목 중, 이번 스캔이
 *  실제로 훑었는데(scannedIds에 있음) 결과엔 없는 것만 제거한다. 스코프가
 *  다른 항목이나, 이번 스캔이 아예 안 훑은 항목은 결과에 없어도 그대로 둔다 —
 *  "다른 스캔이 서로의 발견을 지워버리는" 문제(2번)의 원인을 원천 차단. */
export function scopedMergeById(scanScopeId: string, scannedIds: string[], foundBlocks: TrackedBlock[]): void {
  trackingStore.setState((s) => {
    const stillRelevant = s.blocks.filter((b) => {
      if (b.scanScopeId !== scanScopeId) return true; // 다른 스코프는 무관
      if (isAlive(recentlyCreatedIds, b.id)) return true; // 방금 생성 확인됨 — 보호
      if (!scannedIds.includes(b.id)) return true; // 이번 스캔이 안 훑은 id — 판단 보류
      return foundBlocks.some((f) => f.id === b.id); // 훑었는데 결과에 없으면 진짜 사라진 것
    });
    const merged = [...stillRelevant];
    for (const f of foundBlocks) {
      if (isAlive(recentlyRemovedIds, f.id)) continue; // A) 방금 취소 확인됨 — 되살리지 않음
      if (!merged.some((b) => b.id === f.id)) merged.push(f);
    }
    return { blocks: merged };
  });
}

export function removeBlockWithTombstone(id: string): void {
  markBlockRemoved(id);
  trackingStore.setState((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
}
