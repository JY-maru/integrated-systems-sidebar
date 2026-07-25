'use strict'
// 외부 시스템이 내려주는 HTML(표)을 파싱한다. 컬럼 인덱스를 하드코딩하지 않고
// <thead> 헤더 텍스트를 기준으로 동적 매핑해, 마크업의 컬럼 순서가 바뀌어도
// 파서가 깨지지 않도록 방어한다.

const SPOG_DOM_PARSER = (() => {
  function buildFieldIndexMap(headerTexts, aliasMap) {
    const fieldByIndex = {}
    headerTexts.forEach((text, idx) => {
      const trimmed = text.trim()
      for (const [field, aliases] of Object.entries(aliasMap)) {
        if (aliases.some((alias) => trimmed === alias || trimmed.includes(alias))) {
          fieldByIndex[idx] = field
        }
      }
    })
    return fieldByIndex
  }

  // aliasMap: { fieldName: ['헤더텍스트1', '헤더텍스트2', ...] }
  function parseHtmlTable(table, aliasMap) {
    if (!table) return []
    const headerTexts = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent)
    const fieldByIndex = buildFieldIndexMap(headerTexts, aliasMap)

    return Array.from(table.querySelectorAll('tbody tr')).map((tr) => {
      const row = {}
      Array.from(tr.children).forEach((td, idx) => {
        const field = fieldByIndex[idx]
        if (field) row[field] = td.textContent.trim()
      })
      return row
    })
  }

  return { parseHtmlTable }
})()

if (typeof globalThis !== 'undefined') {
  globalThis.SPOG_DOM_PARSER = SPOG_DOM_PARSER
}
