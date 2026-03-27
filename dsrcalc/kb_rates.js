/* =============================================================================
   KB 금리 실시간 로더 — kb_rates.js
   ─────────────────────────────────────────────────────────────────────────────
   📋 관리자 안내
   이 파일만 수정하면 금리 로직이 바로 반영됩니다.
   금리 소스 URL이 바뀌면 SOURCE_URL 만 변경하세요.
   파싱이 실패하면 자동으로 APP_CONFIG.KB_MORTGAGE_RATES 폴백값을 사용합니다.
   ============================================================================= */

const KB_RATES_CONFIG = {
  // ── 소스 페이지 URL (수정 가능) ─────────────────────────────────────────────
  SOURCE_URL: 'https://kdk0781.github.io/kb/interest/index.html',

  // ── CORS 프록시 (로컬 개발 시 자동 사용) ───────────────────────────────────
  PROXY_URL: 'https://api.allorigins.win/raw?url=',

  // ── 캐시 유효 시간 (ms) — 기본 1시간, 변경 가능 ────────────────────────────
  CACHE_TTL_MS: 60 * 60 * 1000,

  // ── 캐시 스토리지 키 ──────────────────────────────────────────────────────
  CACHE_KEY: 'kb_rates_cache',

  // ── 금리 유형별 파싱 키워드 (우선순위 순서) ────────────────────────────────
  TYPE_KEYWORDS: {
    '5년변동':  ['금융채5년(변동)', '금융채 5년(변동)', '5년변동', '변동형'],
    '5년혼합':  ['금융채5년(혼합)', '금융채 5년(혼합)', '5년혼합', '혼합형'],
    '6_12변동': ['신규코픽스12개월', '신잔액코픽스6개월', '신규코픽스6개월', '코픽스'],
  },
};

// 내부 캐시 (메모리)
let _ratesCache   = null;
let _cacheTime    = 0;
let _fetchPromise = null;

/**
 * KB 금리를 가져옵니다.
 * @returns {Promise<{type: rate}|null>} — { '5년변동': 3.82, '5년혼합': 3.65, '6_12변동': 4.41 }
 */
async function loadKBRates() {
  // 메모리 캐시
  if (_ratesCache && Date.now() - _cacheTime < KB_RATES_CONFIG.CACHE_TTL_MS) {
    return _ratesCache;
  }

  // localStorage 캐시
  try {
    const cached = JSON.parse(localStorage.getItem(KB_RATES_CONFIG.CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.time < KB_RATES_CONFIG.CACHE_TTL_MS) {
      _ratesCache = cached.data; _cacheTime = cached.time;
      return _ratesCache;
    }
  } catch {}

  // 중복 fetch 방지
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = _doFetch().finally(() => { _fetchPromise = null; });
  return _fetchPromise;
}

async function _doFetch() {
  const { SOURCE_URL, PROXY_URL } = KB_RATES_CONFIG;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const fetchUrl = isLocal ? PROXY_URL + encodeURIComponent(SOURCE_URL) : SOURCE_URL;

  try {
    const resp = await fetch(fetchUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const rates = _parseRates(html);
    if (!rates) throw new Error('파싱 실패');

    // 캐시 저장
    _ratesCache = rates; _cacheTime = Date.now();
    localStorage.setItem(KB_RATES_CONFIG.CACHE_KEY, JSON.stringify({ data: rates, time: _cacheTime }));
    console.log('[KB금리] 로드 성공:', rates);
    return rates;
  } catch (e) {
    console.warn('[KB금리] 로드 실패, 폴백값 사용:', e.message);
    return null;
  }
}

/**
 * HTML에서 금리 값을 파싱합니다.
 * best-rate 클래스 또는 빨간 굵은 텍스트에서 전자계약O 금리를 추출합니다.
 */
function _parseRates(html) {
  const parser  = new DOMParser();
  const doc     = parser.parseFromString(html, 'text/html');
  const result  = {};
  const { TYPE_KEYWORDS } = KB_RATES_CONFIG;

  // ── 전략 1: .best-rate 클래스에서 추출 ─────────────────────────────────
  //   예상 구조: <span class="best-rate">5.14%</span>
  //   전자계약O 항목이 best-rate 로 표시된다고 가정
  const bestRateEls = doc.querySelectorAll('.best-rate, [class*="best-rate"]');

  if (bestRateEls.length > 0) {
    // 각 best-rate 요소의 가장 가까운 섹션 타이틀을 찾아 유형 매핑
    bestRateEls.forEach(el => {
      const rateText  = el.textContent.trim();
      const rateNum   = parseFloat(rateText.replace('%', '').trim());
      if (isNaN(rateNum)) return;

      // 부모 컨테이너에서 섹션 타이틀 텍스트 찾기
      const container = el.closest('[class*="section"], [class*="card"], [class*="item"], li, tr, .rate-card') || el.parentElement;
      const sectionText = _getSectionTitle(doc, container)?.toLowerCase() || '';

      for (const [typeKey, keywords] of Object.entries(TYPE_KEYWORDS)) {
        if (keywords.some(kw => sectionText.includes(kw.toLowerCase()))) {
          // 더 낮은 값으로 업데이트
          if (!result[typeKey] || rateNum < result[typeKey]) {
            result[typeKey] = rateNum;
          }
          break;
        }
      }
    });
  }

  // ── 전략 2: 전자계약O + 금리 패턴으로 추출 ─────────────────────────────
  if (Object.keys(result).length < 3) {
    const bodyText = doc.body?.textContent || '';

    for (const [typeKey, keywords] of Object.entries(TYPE_KEYWORDS)) {
      if (result[typeKey]) continue; // 이미 추출됨

      for (const keyword of keywords) {
        const idx = bodyText.indexOf(keyword);
        if (idx === -1) continue;

        // keyword 이후 300자 내에서 전자계약O + 숫자 패턴 찾기
        const nearby = bodyText.substring(idx, idx + 300);
        // "전자계약o" 또는 "o" 다음에 오는 숫자 (더 낮은 값)
        const matches = [...nearby.matchAll(/(\d+\.\d+)%/g)];
        const nums    = matches.map(m => parseFloat(m[1])).filter(n => n > 0 && n < 30);
        if (nums.length > 0) {
          result[typeKey] = Math.min(...nums); // 가장 낮은 금리 선택
          break;
        }
      }
    }
  }

  // 최소 하나라도 추출됐으면 반환
  return Object.keys(result).length > 0 ? result : null;
}

/** DOM에서 섹션 타이틀 텍스트를 역방향으로 탐색 */
function _getSectionTitle(doc, el) {
  let cur = el;
  for (let i = 0; i < 5; i++) {
    if (!cur) break;
    // 형제나 이전 헤딩 찾기
    let prev = cur.previousElementSibling;
    while (prev) {
      const tag = prev.tagName?.toLowerCase() || '';
      if (['h1','h2','h3','h4','h5','dt','th','strong','b'].includes(tag)) {
        return prev.textContent;
      }
      if (prev.textContent.length < 50) return prev.textContent;
      prev = prev.previousElementSibling;
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * 로드된 금리를 APP_CONFIG에 반영합니다.
 * common.js 의 window.onload 에서 호출됩니다.
 */
async function applyKBRatesToConfig() {
  const rates = await loadKBRates();
  if (!rates) return; // 폴백: APP_CONFIG.KB_MORTGAGE_RATES 그대로 사용

  const cfg = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG : null;
  if (!cfg?.KB_MORTGAGE_RATES) return;

  // 5년변동
  if (rates['5년변동'] != null) {
    cfg.KB_MORTGAGE_RATES.mortgage_level['5년변동'] = rates['5년변동'];
    cfg.KB_MORTGAGE_RATES.mortgage_prin['5년변동']  = rates['5년변동'];
  }
  // 5년혼합
  if (rates['5년혼합'] != null) {
    cfg.KB_MORTGAGE_RATES.mortgage_level['5년혼합'] = rates['5년혼합'];
    cfg.KB_MORTGAGE_RATES.mortgage_prin['5년혼합']  = rates['5년혼합'];
  }
  // 6,12개월변동
  if (rates['6_12변동'] != null) {
    cfg.KB_MORTGAGE_RATES.mortgage_level['6_12변동'] = rates['6_12변동'];
    cfg.KB_MORTGAGE_RATES.mortgage_prin['6_12변동']  = rates['6_12변동'];
  }

  // UI의 placeholder/옵션 텍스트 업데이트
  document.querySelectorAll('.l-rate-type').forEach(sel => {
    [...sel.options].forEach(opt => {
      const typeKey = opt.value;
      if (rates[typeKey] != null) {
        const label = {
          '5년변동':  `5년변동 (${rates['5년변동']}%)`,
          '5년혼합':  `5년혼합 (${rates['5년혼합']}%)`,
          '6_12변동': `6,12개월변동 (${rates['6_12변동']}%)`,
        }[typeKey];
        if (label) opt.textContent = label;
      }
    });
  });

  console.log('[KB금리] APP_CONFIG 반영 완료:', cfg.KB_MORTGAGE_RATES.mortgage_level);
}
