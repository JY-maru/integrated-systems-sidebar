'use strict'
// 의존성 0개: Node 내장 http/fs만 사용해 6개 오리진(포트)을 기동한다.
// 각 포트는 하나의 "사내 시스템"을 흉내낸다. 실제 시스템의 이름/도메인/필드명은
// README.md와 마찬가지로 일반화되어 있다.

const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const VENDOR_DIR = path.join(ROOT, 'vendor')

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

// /vendor/* 는 포트에 상관없이 공용 벤더 디렉터리(React UMD 빌드)에서 서빙한다.
function serveStatic(dir, req, res) {
  const urlPath = req.url.split('?')[0]
  if (urlPath.startsWith('/vendor/')) {
    const vendorFile = path.join(VENDOR_DIR, urlPath.replace('/vendor/', ''))
    if (!vendorFile.startsWith(VENDOR_DIR)) return sendHtml(res, 403, 'forbidden')
    return fs.readFile(vendorFile, (err, data) => {
      if (err) return sendHtml(res, 404, 'not found')
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
      res.end(data)
    })
  }
  const filePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '')
  const full = path.join(dir, filePath)
  if (!full.startsWith(dir)) return sendHtml(res, 403, 'forbidden')
  fs.readFile(full, (err, data) => {
    if (err) return sendHtml(res, 404, 'not found')
    const ext = path.extname(full)
    const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html'
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` })
    res.end(data)
  })
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
    })
  })
}

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// System B: 케이스 관리 (접수 카드 생성)
// ---------------------------------------------------------------------------
let caseSeq = 1000
function startSystemB(port) {
  const dir = path.join(ROOT, 'system-b')
  http.createServer(async (req, res) => {
    withCors(res)
    if (req.method === 'OPTIONS') return res.end()
    if (req.method === 'POST' && req.url === '/api/cases') {
      const body = await readJsonBody(req)
      await delay(400)
      caseSeq += 1
      return sendJson(res, 200, {
        caseId: `CASE-${caseSeq}`,
        ...body,
        createdAt: new Date().toISOString(),
      })
    }
    serveStatic(dir, req, res)
  }).listen(port, () => console.log(`[System B 케이스 관리] http://localhost:${port}`))
}

// ---------------------------------------------------------------------------
// System C: 예약/배차 관리 (블록생성 / 예약생성 / 후보 검색·스코어링)
// ---------------------------------------------------------------------------
let blockSeq = 3000
let reservationSeq = 5000
const RESOURCE_CANDIDATES = [
  { id: 'R-01', code: 'AB-1101', type: '준중형', lat: 37.5665, lng: 126.9780, status: '가용' },
  { id: 'R-02', code: 'AB-2202', type: 'SUV', lat: 37.5700, lng: 126.9820, status: '가용' },
  { id: 'R-03', code: 'AB-3303', type: '경형', lat: 37.5510, lng: 126.9882, status: '가용' },
  { id: 'R-04', code: 'AB-4404', type: '준중형', lat: 37.4980, lng: 127.0276, status: '점검중' },
  { id: 'R-05', code: 'AB-5505', type: '대형', lat: 37.5600, lng: 126.9400, status: '가용' },
  { id: 'R-06', code: 'AB-6606', type: '준중형', lat: 37.5290, lng: 127.0020, status: '가용' },
  { id: 'R-07', code: 'AB-7707', type: 'SUV', lat: 37.5400, lng: 127.0700, status: '가용' },
  { id: 'R-08', code: 'AB-8808', type: '경형', lat: 37.6100, lng: 126.9300, status: '가용' },
]
function startSystemC(port) {
  const dir = path.join(ROOT, 'system-c')
  http.createServer(async (req, res) => {
    withCors(res)
    if (req.method === 'OPTIONS') return res.end()
    if (req.method === 'POST' && req.url === '/api/blocks') {
      const body = await readJsonBody(req)
      await delay(350)
      blockSeq += 1
      return sendJson(res, 200, { blockId: `BLOCK-${blockSeq}`, ...body, createdAt: new Date().toISOString() })
    }
    if (req.method === 'POST' && req.url === '/api/reservations') {
      const body = await readJsonBody(req)
      await delay(350)
      reservationSeq += 1
      return sendJson(res, 200, { reservationId: `RSV-${reservationSeq}`, ...body, createdAt: new Date().toISOString() })
    }
    if (req.method === 'GET' && req.url.startsWith('/api/candidates')) {
      await delay(300)
      return sendJson(res, 200, { candidates: RESOURCE_CANDIDATES })
    }
    serveStatic(dir, req, res)
  }).listen(port, () => console.log(`[System C 예약/배차 관리] http://localhost:${port}`))
}

// ---------------------------------------------------------------------------
// System D: 고객 응대 (인바운드 알림 + 예약정보 자동 기입 대상)
// ---------------------------------------------------------------------------
let callbackSeq = 7000
function startSystemD(port) {
  const dir = path.join(ROOT, 'system-d')
  http.createServer(async (req, res) => {
    withCors(res)
    if (req.method === 'OPTIONS') return res.end()
    if (req.method === 'POST' && req.url === '/api/callbacks') {
      await delay(200)
      callbackSeq += 1
      return sendJson(res, 200, {
        id: `CB-${callbackSeq}`,
        customerName: '고객' + (callbackSeq % 100),
        phone: `010-${String(1000 + (callbackSeq % 9000)).padStart(4, '0')}-${String(callbackSeq).slice(-4)}`,
        time: new Date().toLocaleTimeString('ko-KR'),
        reason: '재통화 요청',
      })
    }
    serveStatic(dir, req, res)
  }).listen(port, () => console.log(`[System D 고객 응대] http://localhost:${port}`))
}

// ---------------------------------------------------------------------------
// 임베드 폼: 접수양식 붙여넣기 (System A에 iframe으로 삽입)
// ---------------------------------------------------------------------------
function startEmbedForm(port) {
  const dir = path.join(ROOT, 'embed-form')
  http.createServer((req, res) => {
    withCors(res)
    serveStatic(dir, req, res)
  }).listen(port, () => console.log(`[임베드 폼] http://localhost:${port}`))
}

// ---------------------------------------------------------------------------
// 결과 로그 시트 mock (쓰기 전용, 실제로는 외부 스프레드시트 API 대체)
// ---------------------------------------------------------------------------
const logRows = []
function startSheetLog(port) {
  const dir = path.join(ROOT, 'sheet-log')
  http.createServer(async (req, res) => {
    withCors(res)
    if (req.method === 'OPTIONS') return res.end()
    if (req.method === 'POST' && req.url === '/api/log') {
      const body = await readJsonBody(req)
      logRows.push({ time: new Date().toISOString(), ...body })
      return sendJson(res, 200, { ok: true, total: logRows.length })
    }
    if (req.method === 'GET' && req.url === '/api/log') {
      return sendJson(res, 200, { rows: logRows })
    }
    serveStatic(dir, req, res)
  }).listen(port, () => console.log(`[결과 로그 시트 mock] http://localhost:${port}`))
}

startSystemB(8082)
startSystemC(8083)
startSystemD(8084)
startEmbedForm(8085)
startSheetLog(8086)

// System A는 정적 파일만 서빙 (사이드바는 확장이 주입)
http.createServer((req, res) => {
  withCors(res)
  serveStatic(path.join(ROOT, 'system-a'), req, res)
}).listen(8081, () => console.log('[System A 포털] http://localhost:8081'))

console.log('\n모든 목업 시스템이 기동되었습니다. Ctrl+C로 종료.')
