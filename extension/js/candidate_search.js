'use strict'
// 순수 함수만 모아둔 도메인 엔진: 좌표 거리 계산 + 후보 필터링/스코어링.
// DOM에 의존하지 않으므로 브라우저 콘솔에서 바로 호출해 검증할 수 있다.

const SPOG_CANDIDATE_SEARCH = (() => {
  const EARTH_RADIUS_KM = 6371

  function toRad(deg) {
    return (deg * Math.PI) / 180
  }

  function distanceKm(a, b) {
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const sinLat = Math.sin(dLat / 2)
    const sinLng = Math.sin(dLng / 2)
    const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
  }

  // candidates: [{ code, type, lat, lng, status, ... }] (lat/lng은 문자열이어도 됨)
  function scoreCandidates(candidates, referencePoint, options = {}) {
    const requireAvailable = options.requireAvailable !== false
    const limit = options.limit || 5

    return candidates
      .filter((c) => !requireAvailable || c.status === '가용')
      .map((c) => {
        const point = { lat: parseFloat(c.lat), lng: parseFloat(c.lng) }
        return { ...c, distanceKm: Number(distanceKm(referencePoint, point).toFixed(2)) }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
  }

  return { distanceKm, scoreCandidates }
})()

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_CANDIDATE_SEARCH = SPOG_CANDIDATE_SEARCH
}
