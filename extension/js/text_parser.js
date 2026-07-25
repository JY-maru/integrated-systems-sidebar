'use strict'
// 접수양식 원문 텍스트(비정형) → 구조화 필드 변환.
// dom_parser.js와 같은 원칙: 줄 순서나 컬럼 위치를 하드코딩하지 않고
// "라벨 텍스트"를 기준으로 동적 매핑한다. 상담원마다 라벨 표기가
// 조금씩 달라도(고객명/이름, 연락처/전화번호 등) 깨지지 않게 alias를 둔다.

const SPOG_TEXT_PARSER = (() => {
  const LABEL_ALIASES = {
    name: ['고객명', '이름', '성명'],
    phone: ['연락처', '전화번호', '전화'],
    code: ['식별코드', '코드'],
    receivedAt: ['접수일시', '일시'],
    location: ['위치', '장소'],
    detail: ['상세내용', '내용'],
  }

  function matchField(label) {
    const trimmed = label.trim()
    for (const [field, aliases] of Object.entries(LABEL_ALIASES)) {
      if (aliases.some((alias) => trimmed === alias || trimmed.includes(alias))) {
        return field
      }
    }
    return null
  }

  function parseIntakeText(raw) {
    const result = { name: '', phone: '', code: '', receivedAt: '', location: '', detail: '' }
    if (!raw) return result

    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const m = line.match(/^\s*([^:：]+)[:：]\s*(.*)$/)
      if (!m) continue
      const field = matchField(m[1])
      if (!field) continue
      result[field] = m[2].trim()
    }
    return result
  }

  function isComplete(fields) {
    return Boolean(fields.name && fields.code)
  }

  return { parseIntakeText, isComplete }
})()

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_TEXT_PARSER = SPOG_TEXT_PARSER
}
