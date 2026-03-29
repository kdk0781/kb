/* =============================================================================
   KB 금리 로더 — dsrcalc/kb_rates.js  VER 2603291337
   ─────────────────────────────────────────────────────────────────────────────
   📋 동작 방식
   ・ https://kdk0781.github.io/kb/interest/script.js 에서 r 객체를 파싱합니다.
   ・ script.js 의 base / stress / add.mort 섹션을 개별 추출합니다.
   ・ 파싱 실패 시 FALLBACK_RATES 폴백값을 사용합니다.
   ・ 캐시 버스팅 타임스탬프로 매번 최신 script.js 를 가져옵니다.
   ・ APP_CONFIG.STRESS_RATES 에 스트레스 금리도 동기화합니다.

   📋 폴백값 수정 방법
   ・ FALLBACK_RATES 블록의 숫자만 변경하면 됩니다.
   ============================================================================= */

// ── 폴백값 (script.js 파싱 실패 시 사용) ─────────────────────────────────────
const FALLBACK_RATES = {
  // 최종 대출 금리 (기준 + 가산 - 전자계약O 우대)
  '5년변동':  5.14,    // mor5(4.06) + m5(2.18) - primeOn(1.10)
  '5년혼합':  5.14,    // 동일 기준, 스트레스 금리만 다름
  '6_12변동': 4.41,    // ncofix(2.82) + n12(2.69) - primeOn(1.10) 최솟값

  // 스트레스 금리 (DSR 산정 시 가산)
  stress_m5_cycle: 1.15,   // 5년주기형(변동)
  stress_m5_mix:   1.50,   // 5년혼합형
  stress_v_6_12:   2.87,   // 6,12개월변동
};

// ── 소스 설정 ─────────────────────────────────────────────────────────────────
const _KB_SCRIPT_URL = 'https://kdk0781.github.io/kb/interest/script.js';
const _KB_PROXY_URL  = 'https://api.allorigins.win/raw?url=';
const _KB_CACHE_KEY  = 'kb_rates_v3';       // 버전 변경 시 캐시 자동 무효화
const _KB_CACHE_MS   = 30 * 60 * 1000;      // 30분 캐시 (금리 변동 대응)

let _ratesMem    = null;
let _cacheTimeMs = 0;
let _fetchProm   = null;

// ─────────────────────────────────────────────────────────────────────────────
//  공개 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * APP_CONFIG 에 파싱된 KB 금리를 반영합니다.
 * common.js 의 window.onload 에서 await 로 호출됩니다.
 */
async function applyKBRatesToConfig() {
  const rates = await _loadRates();
  const r     = rates || FALLBACK_RATES;
  const cfg   = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG : null;
  if (!cfg?.KB_MORTGAGE_RATES) return;

  // ── 담보 금리 반영 ────────────────────────────────────────────────────────
  ['mortgage_level', 'mortgage_prin'].forEach(cat => {
    cfg.KB_MORTGAGE_RATES[cat]['5년변동']  = r['5년변동'];
    cfg.KB_MORTGAGE_RATES[cat]['5년혼합']  = r['5년혼합'];
    cfg.KB_MORTGAGE_RATES[cat]['6_12변동'] = r['6_12변동'];
  });

  // ── 스트레스 금리 반영 (APP_CONFIG.STRESS_RATES) ──────────────────────────
  cfg.STRESS_RATES = {
    m5_cycle: r.stress_m5_cycle,
    m5_mix:   r.stress_m5_mix,
    v_6_12:   r.stress_v_6_12,
  };

  console.log('[KB금리] 적용 완료:', {
    '5년변동': r['5년변동'],
    '5년혼합': r['5년혼합'],
    '6,12개월': r['6_12변동'],
    '스트레스(주기)': r.stress_m5_cycle,
    '스트레스(혼합)': r.stress_m5_mix,
    '스트레스(변동)': r.stress_v_6_12,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  내부 함수
// ─────────────────────────────────────────────────────────────────────────────

async function _loadRates() {
  // ── 메모리 캐시 ────────────────────────────────────────────────────────────
  if (_ratesMem && Date.now() - _cacheTimeMs < _KB_CACHE_MS) return _ratesMem;

  // ── localStorage 캐시 ──────────────────────────────────────────────────────
  try {
    const c = JSON.parse(localStorage.getItem(_KB_CACHE_KEY) || 'null');
    if (c && Date.now() - c.t < _KB_CACHE_MS) {
      _ratesMem = c.d; _cacheTimeMs = c.t;
      return _ratesMem;
    }
  } catch {}

  // ── 중복 fetch 방지 ────────────────────────────────────────────────────────
  if (_fetchProm) return _fetchProm;
  _fetchProm = _fetchAndParse().finally(() => { _fetchProm = null; });
  return _fetchProm;
}

async function _fetchAndParse() {
  // ★ 캐시 버스팅 타임스탬프 — 항상 최신 script.js 를 가져옴
  const bustUrl = _KB_SCRIPT_URL + '?_cb=' + Date.now();
  const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

  let text = null;

  // 1차: 직접 fetch (same-origin 또는 CORS 허용 시)
  if (!isLocal) {
    try {
      const res = await fetch(bustUrl, {
        cache: 'no-store',   // 브라우저 캐시 완전 무시
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      if (res.ok) text = await res.text();
    } catch {}
  }

  // 2차: CORS 프록시 (로컬 개발 또는 직접 fetch 실패)
  if (!text) {
    try {
      const res = await fetch(_KB_PROXY_URL + encodeURIComponent(bustUrl), {
        cache: 'no-store'
      });
      if (res.ok) text = await res.text();
    } catch {}
  }

  if (!text) {
    console.warn('[KB금리] script.js 로드 실패 — 폴백값 사용');
    return null;
  }

  const rates = _parseScript(text);
  if (!rates) {
    console.warn('[KB금리] 파싱 실패 — 폴백값 사용');
    return null;
  }

  // ── 캐시 저장 ────────────────────────────────────────────────────────────
  _ratesMem = rates; _cacheTimeMs = Date.now();
  try {
    localStorage.setItem(_KB_CACHE_KEY, JSON.stringify({ d: rates, t: _cacheTimeMs }));
  } catch {}

  return rates;
}

/**
 * script.js 텍스트를 파싱하여 최종 금리를 계산합니다.
 *
 * script.js 구조:
 *   const r = {
 *     base:   { mor5, mor2, ncofix, scofix, primeOn, primeOff },
 *     stress: { m5_cycle, m5_mix, v_6_12 },
 *     add:    { mort: { m5, n6, n12, s6, s12 }, ... }
 *   };
 *   const calc = (b, a, p) => b + a - p;
 *
 * 금리 공식:
 *   5년변동/혼합 = mor5 + mort.m5 - primeOn
 *   6,12개월변동  = min(ncofix+n6, ncofix+n12, scofix+s6, scofix+s12) - primeOn
 */
function _parseScript(text) {
  try {
    // ── base 섹션 추출 ──────────────────────────────────────────────────────
    const baseM  = text.match(/\bbase\s*:\s*\{([^}]+)\}/);
    if (!baseM) return null;
    const baseKV = baseM[1];

    const mor5     = _kv(baseKV, 'mor5');
    const ncofix   = _kv(baseKV, 'ncofix');
    const scofix   = _kv(baseKV, 'scofix');
    const primeOn  = _kv(baseKV, 'primeOn');
    if (!mor5 || !ncofix || !scofix || !primeOn) return null;

    // ── stress 섹션 추출 ────────────────────────────────────────────────────
    const stressM  = text.match(/\bstress\s*:\s*\{([^}]+)\}/);
    if (!stressM) return null;
    const stressKV = stressM[1];

    const m5_cycle = _kv(stressKV, 'm5_cycle');
    const m5_mix   = _kv(stressKV, 'm5_mix');
    const v_6_12   = _kv(stressKV, 'v_6_12');
    if (!m5_cycle || !m5_mix || !v_6_12) return null;

    // ── add.mort 섹션 추출 ──────────────────────────────────────────────────
    const mortM  = text.match(/\bmort\s*:\s*\{([^}]+)\}/);
    if (!mortM) return null;
    const mortKV = mortM[1];

    const m5  = _kv(mortKV, 'm5');
    const n6  = _kv(mortKV, 'n6');
    const n12 = _kv(mortKV, 'n12');
    const s6  = _kv(mortKV, 's6');
    const s12 = _kv(mortKV, 's12');
    if (!m5) return null;

    // ── 최종 금리 계산 ──────────────────────────────────────────────────────
    const rate5 = _r2(mor5 + m5 - primeOn);

    // 6,12개월변동: 4가지 코픽스 조합 중 최솟값
    const cands = [
      n6  != null ? _r2(ncofix + n6  - primeOn) : Infinity,
      n12 != null ? _r2(ncofix + n12 - primeOn) : Infinity,
      s6  != null ? _r2(scofix + s6  - primeOn) : Infinity,
      s12 != null ? _r2(scofix + s12 - primeOn) : Infinity,
    ].filter(v => v < Infinity && v > 0);

    const rate612 = cands.length ? Math.min(...cands) : FALLBACK_RATES['6_12변동'];

    return {
      '5년변동':        rate5,
      '5년혼합':        rate5,   // 기준금리·가산금리 동일, 스트레스만 다름
      '6_12변동':       rate612,
      stress_m5_cycle:  m5_cycle,
      stress_m5_mix:    m5_mix,
      stress_v_6_12:    v_6_12,
      // 원시 값 저장 (디버깅용)
      _raw: { mor5, ncofix, scofix, primeOn, m5, m5_cycle, m5_mix, v_6_12 }
    };
  } catch (e) {
    console.warn('[KB금리] 계산 오류:', e);
    return null;
  }
}

/** key: value 쌍에서 숫자 추출 (섹션 내부 텍스트에서 사용) */
function _kv(text, key) {
  const re = new RegExp('\\b' + key + '\\s*:\\s*([\\d]+(?:\\.[\\d]+)?)');
  const m  = text.match(re);
  return m ? parseFloat(m[1]) : null;
}

/** 소수점 2자리 반올림 */
function _r2(v) { return Math.round(v * 100) / 100; }

/**
 * 강제 캐시 초기화 후 재로드 (FAB 새로고침 버튼용)
 * common.js 의 hardRefresh() 에서 호출합니다.
 */
async function clearKBRatesCache() {
  localStorage.removeItem(_KB_CACHE_KEY);
  _ratesMem    = null;
  _cacheTimeMs = 0;
  console.log('[KB금리] 캐시 초기화 완료');
}
