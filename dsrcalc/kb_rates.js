/* =============================================================================
   KB 금리 로더 — kb_rates.js  VER 2026.05-C
   ─────────────────────────────────────────────────────────────────────────────
   📋 관리자 안내
   ・ https://kdk0781.github.io/kb/interest/script.js 의 base/add/stress 값을
     자동으로 파싱해 금리를 계산합니다.
   ・ script.js 숫자를 변경하면 이 파일에 자동 반영됩니다.
   ・ 파싱 실패 시 아래 FALLBACK_RATES 폴백값을 사용합니다.
   ・ 불가피한 경우 FALLBACK_RATES 숫자만 수정해 업로드하면 즉시 반영됩니다.
   ============================================================================= */

// ── 폴백 금리 (파싱 실패 시 사용) — 숫자만 변경하면 됩니다 ───────────────────
const FALLBACK_RATES = {
  '5년변동':  5.14,   // mor5 + m5 - primeOn
  '5년혼합':  5.14,   // mor5 + m5 - primeOn (혼합형, stress만 다름)
  '6_12변동': 4.41,   // min(ncofix+n12, ...) - primeOn

  // 스트레스 금리
  stress_m5_cycle: 1.15,   // 60개월변동
  stress_m5_mix:   1.50,   // 60개월혼합
  stress_v_6_12:   2.87,   // 6,12개월변동
};

// ── 스크립트 URL 설정 ─────────────────────────────────────────────────────────
const KB_SCRIPT_URL  = 'https://kdk0781.github.io/kb/interest/script.js';
const KB_PROXY_URL   = 'https://api.allorigins.win/raw?url=';
const KB_CACHE_KEY   = 'kb_rates_v2';
const KB_CACHE_MS    = 60 * 60 * 1000; // 1시간

let _ratesCache   = null;
let _cacheTime    = 0;
let _fetchPromise = null;

// ── 공개 API ───────────────────────────────────────────────────────────────────

/** APP_CONFIG.KB_MORTGAGE_RATES 와 스트레스 옵션에 계산 금리를 반영 */
async function applyKBRatesToConfig() {
  const rates = await _loadRates();
  const r     = rates || FALLBACK_RATES;
  const cfg   = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG : null;
  if (!cfg?.KB_MORTGAGE_RATES) return;

  // ── 금리 반영 ──────────────────────────────────────────────────────────────
  ['mortgage_level', 'mortgage_prin'].forEach(cat => {
    cfg.KB_MORTGAGE_RATES[cat]['5년변동']  = r['5년변동'];
    cfg.KB_MORTGAGE_RATES[cat]['5년혼합']  = r['5년혼합'];
    cfg.KB_MORTGAGE_RATES[cat]['6_12변동'] = r['6_12변동'];
  });

  // ── 스트레스 금리 동기화 ──────────────────────────────────────────────────
  cfg.STRESS_RATES = {
    m5_cycle: r.stress_m5_cycle,
    m5_mix:   r.stress_m5_mix,
    v_6_12:   r.stress_v_6_12,
  };

  // ── 셀렉트 옵션 텍스트 갱신 ──────────────────────────────────────────────
  _syncSelectOptions(r);

  console.log('[KB금리] 반영 완료:', { '5년변동': r['5년변동'], '5년혼합': r['5년혼합'], '6,12개월': r['6_12변동'] });
}

// ── 내부 함수 ──────────────────────────────────────────────────────────────────

async function _loadRates() {
  // 메모리 캐시
  if (_ratesCache && Date.now() - _cacheTime < KB_CACHE_MS) return _ratesCache;

  // localStorage 캐시
  try {
    const c = JSON.parse(localStorage.getItem(KB_CACHE_KEY) || 'null');
    if (c && Date.now() - c.t < KB_CACHE_MS) {
      _ratesCache = c.d; _cacheTime = c.t;
      return _ratesCache;
    }
  } catch {}

  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = _fetchAndParse().finally(() => { _fetchPromise = null; });
  return _fetchPromise;
}

async function _fetchAndParse() {
  const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
  let text = null;

  // 직접 fetch (같은 origin 또는 CORS 허용 시)
  if (!isLocal) {
    try {
      const r = await fetch(KB_SCRIPT_URL, { cache: 'no-cache' });
      if (r.ok) text = await r.text();
    } catch {}
  }

  // CORS 프록시 (로컬 개발 또는 직접 fetch 실패 시)
  if (!text) {
    try {
      const r = await fetch(KB_PROXY_URL + encodeURIComponent(KB_SCRIPT_URL), { cache: 'no-cache' });
      if (r.ok) text = await r.text();
    } catch {}
  }

  if (!text) { console.warn('[KB금리] 스크립트 로드 실패 — 폴백값 사용'); return null; }

  const rates = _calcRates(text);
  if (!rates) { console.warn('[KB금리] 파싱 실패 — 폴백값 사용'); return null; }

  _ratesCache = rates; _cacheTime = Date.now();
  try { localStorage.setItem(KB_CACHE_KEY, JSON.stringify({ d: rates, t: _cacheTime })); } catch {}
  return rates;
}

/**
 * script.js 텍스트에서 base / add.mort / stress 값을 파싱해
 * 최종 금리를 계산합니다.
 *
 * 공식:
 *   5년변동/혼합 = base.mor5 + add.mort.m5 - base.primeOn
 *   6,12개월변동 = min(
 *     ncofix+n6, ncofix+n12, scofix+s6, scofix+s12
 *   ) - primeOn
 */
function _calcRates(text) {
  try {
    // ── base 파싱 ────────────────────────────────────────────────────────────
    const base = _parseObj(text, 'base');
    if (!base?.mor5) return null;

    // ── add.mort 파싱 ─────────────────────────────────────────────────────
    const mortMatch = text.match(/mort\s*:\s*\{([^}]+)\}/);
    const mort = mortMatch ? _parseKV(mortMatch[1]) : null;
    if (!mort?.m5) return null;

    // ── stress 파싱 ───────────────────────────────────────────────────────
    const stress = _parseObj(text, 'stress');
    // 키명 다양성 처리 (m5_cycle, m5cycle, m5_mix, m5mix 등)
    const m5c = stress?.m5_cycle ?? stress?.m5cycle ?? 1.15;
    const m5m = stress?.m5_mix   ?? stress?.m5mix   ?? 1.50;
    const v6  = stress?.v_6_12   ?? stress?.v612     ?? 2.87;

    // ── 금리 계산 ─────────────────────────────────────────────────────────
    const primeOn  = base.primeOn  ?? 1.10;
    const mor5     = base.mor5;
    const ncofix   = base.ncofix  ?? 2.82;
    const scofix   = base.scofix  ?? 2.47;

    const rate5    = _round2(mor5 + mort.m5 - primeOn);

    // 6,12개월 변동: 4가지 조합 중 최솟값
    const candidates = [
      mort.n6  != null ? ncofix + mort.n6  - primeOn : Infinity,
      mort.n12 != null ? ncofix + mort.n12 - primeOn : Infinity,
      mort.s6  != null ? scofix + mort.s6  - primeOn : Infinity,
      mort.s12 != null ? scofix + mort.s12 - primeOn : Infinity,
    ].filter(v => v < Infinity && v > 0);
    const rate612 = candidates.length ? _round2(Math.min(...candidates)) : FALLBACK_RATES['6_12변동'];

    return {
      '5년변동':         rate5,
      '5년혼합':         rate5,  // 동일 기준, 스트레스만 다름
      '6_12변동':        rate612,
      stress_m5_cycle:   m5c,
      stress_m5_mix:     m5m,
      stress_v_6_12:     v6,
    };
  } catch (e) {
    console.warn('[KB금리] 계산 오류:', e);
    return null;
  }
}

/** { key: val, ... } 형태 문자열 파싱 */
function _parseKV(inner) {
  const result = {};
  for (const [, k, v] of inner.matchAll(/(\w+)\s*:\s*([\d.]+)/g)) {
    result[k] = parseFloat(v);
  }
  return Object.keys(result).length ? result : null;
}

/** `name: { ... }` 형태 추출 */
function _parseObj(text, name) {
  const re  = new RegExp(name + '\\s*:\\s*\\{([^}]+)\\}');
  const m   = text.match(re);
  return m ? _parseKV(m[1]) : null;
}

function _round2(v) { return Math.round(v * 100) / 100; }

/** 셀렉트 옵션 텍스트 + 스트레스 옵션 갱신 */
function _syncSelectOptions(r) {
  const rateMap = { '5년변동': `5년변동 (${r['5년변동']}%)`, '5년혼합': `5년혼합 (${r['5년혼합']}%)`, '6_12변동': `6,12개월변동 (${r['6_12변동']}%)` };
  document.querySelectorAll('.l-rate-type').forEach(sel => {
    [...sel.options].forEach(opt => { if (rateMap[opt.value]) opt.textContent = rateMap[opt.value]; });
  });

  // 스트레스 금리 셀렉트 옵션 텍스트도 갱신
  document.querySelectorAll('.l-sr-select').forEach(sel => {
    [...sel.options].forEach(opt => {
      if (opt.value === '1.15') opt.textContent = `60개월변동 (${r.stress_m5_cycle}%)`;
      if (opt.value === '1.50') opt.textContent = `60개월혼합 (${r.stress_m5_mix}%)`;
      if (opt.value === '2.87') opt.textContent = `6,12개월변동 (${r.stress_v_6_12}%)`;
    });
  });
}
