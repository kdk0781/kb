/* =============================================================================
   금리 로더 — kb_rates.js  VER 2026.06
   ─────────────────────────────────────────────────────────────────────────────
   📋 동작 방식
   ・ https://kdk0781.github.io/kb/interest/script.js 에서 r 객체를 파싱합니다.
   ・ script.js 의 base / stress / add.mort 섹션을 개별 추출합니다.
   ・ 파싱 실패 시 FALLBACK_RATES 폴백값을 사용합니다.
   ・ 캐시 버스팅 타임스탬프로 매번 최신 script.js 를 가져옵니다.
   ・ APP_CONFIG.STRESS_RATES 에 스트레스 금리도 동기화합니다.

   ★ 버전 인식 캐시 키
   ・ <script src="kb_rates.js?v=2026.06"> 의 ?v= 값을 읽어 캐시 키로 사용합니다.
   ・ 버전 변경 시 구버전 캐시 자동 무효화 → 항상 최신 금리를 가져옵니다.
   ・ 금리 업데이트 순서: interest/script.js 수정 → 양쪽 ?v= 동시 변경

   📋 폴백값 수정 방법
   ・ FALLBACK_RATES 블록의 숫자만 변경하면 됩니다.
   ============================================================================= */

// ── 폴백값 (script.js 파싱 실패 시 사용) ─────────────────────────────────────
const FALLBACK_RATES = {
  '5년변동':  4.92,
  '5년혼합':  4.92,
  '6_12변동': 4.24,
  stress_m5_cycle: 1.15,
  stress_m5_mix:   1.50,
  stress_v_6_12:   2.87,
};

// ── 소스 설정 ─────────────────────────────────────────────────────────────────
const _KB_SCRIPT_URL = 'https://kdk0781.github.io/kb/interest/script.js';
const _KB_PROXY_URL  = 'https://api.allorigins.win/raw?url=';
const _KB_CACHE_MS   = 30 * 60 * 1000;  // 30분

let _ratesMem    = null;
let _cacheTimeMs = 0;
let _fetchProm   = null;

// ─────────────────────────────────────────────────────────────────────────────
//  ★ 버전 인식 캐시 키
//  <script src="kb_rates.js?v=2026.06"> → 캐시 키 = "kb_rates_2026.06"
//  버전 변경 시 구버전 캐시 자동 무시, 새 데이터 fetch
// ─────────────────────────────────────────────────────────────────────────────
function _getCacheKey() {
  try {
    const el  = document.querySelector('script[src*="kb_rates.js"]');
    const src = el?.src || '';
    const m   = src.match(/[?&]v=([^&]+)/);
    return 'kb_rates_' + (m ? m[1] : 'default');
  } catch {
    return 'kb_rates_default';
  }
}

/** 구버전 캐시 키 일괄 삭제 */
function _cleanOldCacheKeys(currentKey) {
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('kb_rates_') && k !== currentKey) {
        localStorage.removeItem(k);
      }
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
//  공개 API
// ─────────────────────────────────────────────────────────────────────────────
async function applyKBRatesToConfig() {
  const rates = await _loadRates();
  const r     = rates || FALLBACK_RATES;
  const cfg   = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG : null;
  if (!cfg?.KB_MORTGAGE_RATES) return;

  ['mortgage_level', 'mortgage_prin'].forEach(cat => {
    cfg.KB_MORTGAGE_RATES[cat]['5년변동']  = r['5년변동'];
    cfg.KB_MORTGAGE_RATES[cat]['5년혼합']  = r['5년혼합'];
    cfg.KB_MORTGAGE_RATES[cat]['6_12변동'] = r['6_12변동'];
  });

  cfg.STRESS_RATES = {
    m5_cycle: r.stress_m5_cycle,
    m5_mix:   r.stress_m5_mix,
    v_6_12:   r.stress_v_6_12,
  };

  console.log(`[금리] 적용 완료 (캐시키: ${_getCacheKey()})`, {
    '5년변동':    r['5년변동'],
    '5년혼합':    r['5년혼합'],
    '6,12개월':   r['6_12변동'],
    'ST주기형':   r.stress_m5_cycle,
    'ST혼합형':   r.stress_m5_mix,
    'ST변동형':   r.stress_v_6_12,
    '파싱시각':   r._parsed_at || '폴백',
  });
}

/** 강제 캐시 삭제 (FAB 새로고침 버튼용) */
async function clearKBRatesCache() {
  const key = _getCacheKey();
  localStorage.removeItem(key);
  _cleanOldCacheKeys(key); // 구버전 키도 함께 정리
  _ratesMem    = null;
  _cacheTimeMs = 0;
  console.log(`[금리] 캐시 삭제 완료 (키: ${key})`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  내부 함수
// ─────────────────────────────────────────────────────────────────────────────
async function _loadRates() {
  const cacheKey = _getCacheKey();

  // ── 메모리 캐시 ────────────────────────────────────────────────────────────
  if (_ratesMem && Date.now() - _cacheTimeMs < _KB_CACHE_MS) return _ratesMem;

  // ── localStorage 캐시 (버전 키 기반) ──────────────────────────────────────
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (c && Date.now() - c.t < _KB_CACHE_MS) {
      _ratesMem = c.d; _cacheTimeMs = c.t;
      console.log(`[금리] 캐시 사용 (키: ${cacheKey})`);
      return _ratesMem;
    }
  } catch {}

  // ── 중복 fetch 방지 ────────────────────────────────────────────────────────
  if (_fetchProm) return _fetchProm;
  _fetchProm = _fetchAndParse(cacheKey).finally(() => { _fetchProm = null; });
  return _fetchProm;
}

async function _fetchAndParse(cacheKey) {
  const bustUrl = _KB_SCRIPT_URL + '?_cb=' + Date.now();
  const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
  let text = null;

  if (!isLocal) {
    try {
      const res = await fetch(bustUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      if (res.ok) text = await res.text();
    } catch {}
  }

  if (!text) {
    try {
      const res = await fetch(_KB_PROXY_URL + encodeURIComponent(bustUrl), { cache: 'no-store' });
      if (res.ok) text = await res.text();
    } catch {}
  }

  if (!text) { console.warn('[금리] script.js 로드 실패 — 폴백값 사용'); return null; }

  const rates = _parseScript(text);
  if (!rates) { console.warn('[금리] 파싱 실패 — 폴백값 사용'); return null; }

  _ratesMem = rates; _cacheTimeMs = Date.now();
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ d: rates, t: _cacheTimeMs }));
    _cleanOldCacheKeys(cacheKey); // 구버전 키 정리
  } catch {}

  console.log(`[금리] 파싱 성공 → 캐시 저장 (키: ${cacheKey})`);
  return rates;
}

function _parseScript(text) {
  try {
    const baseM  = text.match(/\bbase\s*:\s*\{([^}]+)\}/);
    if (!baseM) return null;
    const baseKV = baseM[1];
    const mor5    = _kv(baseKV, 'mor5');
    const ncofix  = _kv(baseKV, 'ncofix');
    const scofix  = _kv(baseKV, 'scofix');
    const primeOn = _kv(baseKV, 'primeOn');
    if (!mor5 || !ncofix || !scofix || !primeOn) return null;

    const stressM  = text.match(/\bstress\s*:\s*\{([^}]+)\}/);
    if (!stressM) return null;
    const stressKV = stressM[1];
    const m5_cycle = _kv(stressKV, 'm5_cycle');
    const m5_mix   = _kv(stressKV, 'm5_mix');
    const v_6_12   = _kv(stressKV, 'v_6_12');
    if (!m5_cycle || !m5_mix || !v_6_12) return null;

    const mortM  = text.match(/\bmort\s*:\s*\{([^}]+)\}/);
    if (!mortM) return null;
    const mortKV = mortM[1];
    const m5  = _kv(mortKV, 'm5');
    const n6  = _kv(mortKV, 'n6');
    const n12 = _kv(mortKV, 'n12');
    const s6  = _kv(mortKV, 's6');
    const s12 = _kv(mortKV, 's12');
    if (!m5) return null;

    const rate5 = _r2(mor5 + m5 - primeOn);
    const cands = [
      n6  != null ? _r2(ncofix + n6  - primeOn) : Infinity,
      n12 != null ? _r2(ncofix + n12 - primeOn) : Infinity,
      s6  != null ? _r2(scofix + s6  - primeOn) : Infinity,
      s12 != null ? _r2(scofix + s12 - primeOn) : Infinity,
    ].filter(v => v < Infinity && v > 0);
    const rate612 = cands.length ? Math.min(...cands) : FALLBACK_RATES['6_12변동'];

    return {
      '5년변동':       rate5,
      '5년혼합':       rate5,
      '6_12변동':      rate612,
      stress_m5_cycle: m5_cycle,
      stress_m5_mix:   m5_mix,
      stress_v_6_12:   v_6_12,
      _parsed_at:      new Date().toISOString(), // 파싱 시각 기록
      _raw: { mor5, ncofix, scofix, primeOn, m5, m5_cycle, m5_mix, v_6_12 }
    };
  } catch (e) {
    console.warn('[금리] 계산 오류:', e);
    return null;
  }
}

function _kv(text, key) {
  const re = new RegExp('\\b' + key + '\\s*:\\s*([\\d]+(?:\\.[\\d]+)?)');
  const m  = text.match(re);
  return m ? parseFloat(m[1]) : null;
}

function _r2(v) { return Math.round(v * 100) / 100; }

