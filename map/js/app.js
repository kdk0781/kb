/* ─────────────────────────────────────────────
아파트 시세표 | app.js  v5.0
최적화 포인트
① searchKey를 파싱 시점 1회 생성 (검색마다 rowsText 재조합 제거)
② 시/도 지역 칩 필터 (지역별 즉시 좁히기)
③ 가격 범위 미리보기 (아코디언 열기 전 일반가 최저~최고 노출)
④ 면적 타입 suffix 배지 (T=테라스, P=펜트하우스, C=코너 등)
⑤ 결과 카운트 표시
⑥ 정렬 기능 (기본/가나다/가격 낮은순/높은순)
⑦ ㎡ ↔ 평 단위 토글 (CSS class 방식, 재렌더링 없음)
⑧ 규제지역 배지 (투기지역/투기과열지구/조정대상지역)
⑨ 비동기 청크 파싱 + 상태기계 CSV 파서 (무한로딩 방지)
───────────────────────────────────────────── */

let allGroups     = [];
let filteredGroups = [];
let activeRegion  = ‘전체’;
let activeSort    = ‘default’;
let areaUnit      = ‘sqm’;   // ‘sqm’ | ‘pyeong’
let loadedCount   = 0;
const LOAD_STEP   = 20;
let searchDebounceTimer = null;
let scrollObserver = null;

// 면적 타입 suffix → 한글 레이블 매핑
const SUFFIX_MAP = {
‘T’: ‘테라스’, ‘P’: ‘펜트’, ‘C’: ‘코너’, ‘A’: ‘타입A’,
‘B’: ‘타입B’, ‘D’: ‘타입D’, ‘E’: ‘타입E’,
};

/* ══════════════ 규제지역 데이터 (2025.10.16 기준) ══════════════
출처: 국토교통부 2025.10.15 주택시장 안정화 대책
┌───────────────────────────────────────────────────────┐
│ 투기지역        : 서울 강남·서초·송파·용산            │
│ 투기과열지구    : 서울 전 25개 구 + 경기 12곳         │
│ 조정대상지역    : 투기과열지구와 동일                  │
└───────────────────────────────────────────────────────┘ */
const ZONE_DATA = {
// 투기지역 (+ 투기과열지구 + 조정대상지역 모두 해당)
투기지역: {
‘서울특별시’: [‘강남구’, ‘서초구’, ‘송파구’, ‘용산구’],
},
// 투기과열지구 + 조정대상지역 (투기지역 제외 나머지)
투기과열지구: {
‘서울특별시’: [
‘강동구’,‘강북구’,‘강서구’,‘관악구’,‘광진구’,
‘구로구’,‘금천구’,‘노원구’,‘도봉구’,‘동대문구’,
‘동작구’,‘마포구’,‘서대문구’,‘성동구’,‘성북구’,
‘양천구’,‘영등포구’,‘은평구’,‘종로구’,‘중구’,‘중랑구’,
],
‘경기도’: [
‘과천시’,‘광명시’,‘의왕시’,‘하남시’,
// 성남시 (분당구·수정구·중원구)
‘분당구’,‘수정구’,‘중원구’,
// 수원시 (영통구·장안구·팔달구)
‘영통구’,‘장안구’,‘팔달구’,
// 안양시 동안구
‘동안구’,
// 용인시 수지구
‘수지구’,
],
},
};

/**

- 시도·시군구 문자열을 받아 규제지역 등급을 반환
- @returns { zone: ‘A’|‘B’|null, labels: string[] }
- zone A = 투기지역+투기과열+조정  (강남3구+용산)
- zone B = 투기과열+조정           (서울 나머지+경기 12곳)
  */
  function getRegulationZone(시도, 시군구) {
  const sido  = 시도.trim();
  const sgg   = 시군구.trim();

```
const 투기지역구 = ZONE_DATA.투기지역[sido] || [];
if (투기지역구.some(g => sgg.includes(g))) {
    return { zone: 'A', labels: ['투기지역'] };
}

const 투기과열구 = ZONE_DATA.투기과열지구[sido] || [];
if (투기과열구.some(g => sgg.includes(g))) {
    return { zone: 'B', labels: ['투기과열지구'] };
}

return { zone: null, labels: [] };
```

}

/* ══════════════ 초기화 ══════════════ */
document.addEventListener(‘DOMContentLoaded’, () => {

```
// 서비스워커 등록
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('[SW]', err));
}

// 강제 새로고침 버튼
document.getElementById('hardRefreshBtn').addEventListener('click', async () => {
    document.querySelector('#hardRefreshBtn span').textContent = '업데이트 중...';
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
        }
        localStorage.clear();
        sessionStorage.clear();
    } finally {
        window.location.reload(true);
    }
});

// 아코디언 (이벤트 위임)
document.getElementById('listBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.accordion-btn');
    if (!btn) return;

    const item = btn.parentElement;
    const wasActive = item.classList.contains('active');

    document.querySelectorAll('.group-item.active').forEach(el => {
        if (el !== item) el.classList.remove('active');
    });
    item.classList.toggle('active', !wasActive);

    if (!wasActive) {
        // 아코디언 애니메이션(280ms) 완료 후 위치 측정
        setTimeout(() => {
            const stickyEl = document.querySelector('.sticky-header');
            // 스티키 헤더의 실제 하단 픽셀 위치 (동적 측정)
            const headerBottom = stickyEl
                ? stickyEl.getBoundingClientRect().bottom
                : 130;
            const GAP = 10; // 헤더 아래 여백

            const rect = item.getBoundingClientRect();

            // 카드 상단이 헤더 하단 + 여백보다 위에 있을 때만 스크롤
            if (rect.top < headerBottom + GAP) {
                window.scrollTo({
                    top: window.scrollY + rect.top - headerBottom - GAP,
                    behavior: 'smooth',
                });
            }
        }, 320);
    }
});

// 검색 (디바운스 250ms)
document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilters, 250);
});

// 정렬
document.getElementById('sortSelect').addEventListener('change', (e) => {
    activeSort = e.target.value;
    applyFilters();
});

// ㎡ ↔ 평 단위 토글 (CSS class만 변경 → 재렌더링 없음)
document.getElementById('unitToggleBtn').addEventListener('click', () => {
    areaUnit = areaUnit === 'sqm' ? 'pyeong' : 'sqm';
    document.body.classList.toggle('pyeong-mode', areaUnit === 'pyeong');
    const btn = document.getElementById('unitToggleBtn');
    btn.querySelector('.u-label-sqm').classList.toggle('active', areaUnit === 'sqm');
    btn.querySelector('.u-label-pyeong').classList.toggle('active', areaUnit === 'pyeong');
});

setupScrollObserver();
loadData();
```

});

/* ── 스티키 헤더 높이 → scroll-padding-top 동기화 ──
아코디언 외에도 브라우저 앵커 이동 등에서 헤더 아래로 정확히 위치시킴 */
function syncScrollPadding() {
const el = document.querySelector(’.sticky-header’);
if (!el) return;
const h = el.offsetHeight;
document.documentElement.style.setProperty(‘scroll-padding-top’, (h + 10) + ‘px’);
}

// 지역 칩 생성 후 / 화면 크기 변경 시 재측정
window.addEventListener(‘resize’, syncScrollPadding, { passive: true });

/* ══════════════ 데이터 로딩 ══════════════ */
function loadData() {
// 안전망: 최대 15초 후 스플래시 강제 제거 (어떤 오류에도 무한 로딩 방지)
const splashSafetyTimer = setTimeout(() => hideSplash(), 15000);

```
fetch('excel/map.csv?t=' + Date.now())
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
    })
    .then(async buf => {
        const csv = new TextDecoder('euc-kr').decode(buf);
        await parseCSV(csv);           // 비동기 청크 파싱
        clearTimeout(splashSafetyTimer);
        hideSplash();
    })
    .catch(err => {
        clearTimeout(splashSafetyTimer);
        console.error('[loadData]', err);
        showSplashError();
    });
```

}

function hideSplash() {
const splash = document.getElementById(‘splashOverlay’);
if (splash) splash.classList.add(‘hide’);
}

function showSplashError() {
const splash = document.getElementById(‘splashOverlay’);
if (!splash) return;
splash.innerHTML = ` <div class="splash-error"> <span style="font-size:2rem">⚠️</span> <p>데이터를 불러올 수 없습니다.</p> <small>네트워크를 확인하고 새로고침 해주세요.</small> <button onclick="window.location.reload(true)" class="refresh-btn" style="margin-top:16px"> <span>다시 시도</span> </button> </div>`;
}

/* 한 프레임을 브라우저에 돌려주는 유틸 */
const yieldFrame = () => new Promise(r => setTimeout(r, 0));

/* 스플래시 진행률 업데이트 */
function setSplashProgress(pct, msg) {
const fill = document.getElementById(‘splashProgressFill’);
const text = document.getElementById(‘splashProgressText’);
if (fill) fill.style.width = pct + ‘%’;
if (text) text.textContent = msg || ‘’;
}

/* ══════════════ 안전한 CSV 한 줄 파서 (상태기계) ══════════════
기존 정규식 /,(?=(?:(?:[^”]*”){2})*[^”]*$)/ 은
홀수 따옴표 라인에서 재앙적 역추적(Catastrophic Backtracking)을
일으켜 브라우저 탭을 완전히 멈춥니다.
→ 상태기계 파서로 완전 대체, O(n) 보장 */
function parseCSVLine(line) {
const fields = [];
let field = ‘’;
let inQ = false;

```
for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
        if (inQ && line[i + 1] === '"') { // escaped quote ""
            field += '"';
            i++;
        } else {
            inQ = !inQ;
        }
    } else if (ch === ',' && !inQ) {
        fields.push(field.trim());
        field = '';
    } else {
        field += ch;
    }
}
fields.push(field.trim());
return fields;
```

}

/* ══════════════ CSV 파싱 (비동기 청크) ══════════════
31,000행을 한 번에 처리하면 메인 스레드를 수 초 독점 →
CHUNK_SIZE 행씩 처리 후 yieldFrame()으로 브라우저에 제어권 반환
→ 스피너 애니메이션 유지, 진행률 표시 가능 */
async function parseCSV(csv) {
try {
await _parseCSVInner(csv);
} catch (err) {
console.error(’[parseCSV]’, err);
// 내부 예외도 스플래시 에러로 표시 (무한 로딩 방지)
showSplashError();
}
}

async function _parseCSVInner(csv) {
const CHUNK_SIZE = 800; // 한 번에 처리할 행 수
const lines = csv.split(/\r\n|\n/);
const total = lines.length;

```
setSplashProgress(5, '파일 읽는 중...');
await yieldFrame();

/* ── 기준일 추출 (앞 15줄만 빠르게) ── */
let baseDateText = '';
for (let i = 0; i < Math.min(15, total); i++) {
    const regex = /(20\d{2})[-.년\s]+([0-1]?\d)[-.월\s]+([0-3]?\d)일?/g;
    const dates = [];
    let m;
    while ((m = regex.exec(lines[i])) !== null) {
        dates.push(`${m[1]}.${m[2].padStart(2,'0')}.${m[3].padStart(2,'0')}`);
    }
    if (dates.length >= 2) { baseDateText = `${dates[0]} ~ ${dates[1]}`; break; }
    if (dates.length === 1) { baseDateText = dates[0]; break; }
}

const dateLabel = document.getElementById('baseDateLabel');
if (baseDateText) {
    dateLabel.textContent = `기준일 ${baseDateText}`;
} else {
    dateLabel.style.display = 'none';
}

/* ── 스킵 키워드 ── */
const SKIP = [
    '전국은행연합회','조견표','절대 수정 금지','대출상담사',
    '시도,시군구','시/도','공급면적','하한가',
];

/* ── 헬퍼 함수 ── */
const toPrice = (val) => {
    const n = parseFloat(val.replace(/,/g, ''));
    return (isNaN(n) || n === 0) ? '-' : n.toLocaleString('ko-KR');
};
const toRawPrice = (val) => {
    const n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
};
const toArea = (val) => {
    const n = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(n)) return val;
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};
const toPyeong = (sqmStr, csvPyeong) => {
    if (csvPyeong) {
        const p = parseFloat(String(csvPyeong).replace(/,/g, ''));
        if (!isNaN(p) && p > 0) return p + '평';
    }
    const n = parseFloat(String(sqmStr).replace(/,/g, ''));
    if (isNaN(n)) return '-';
    return (n / 3.3058).toFixed(1) + '평';
};
const getSuffix = (val) => {
    const raw = String(val).trim().replace(/^[\d.,]+/, '');
    if (!raw) return '';
    if (/[가-힣]/.test(raw)) return raw.slice(0, 6);
    const upper = raw.toUpperCase();
    if (SUFFIX_MAP[upper]) return SUFFIX_MAP[upper];
    return raw.slice(0, 6);
};

/* ── 비동기 청크 파싱 ── */
const flatData = [];

for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, total);

    for (let i = start; i < end; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (SKIP.some(k => line.includes(k))) continue;

        // ✅ 안전한 상태기계 파서 (정규식 X)
        const col = parseCSVLine(line);

        if (col.length < 11 || !col[0]) continue;
        if (col[3] === '아파트' || col[3] === '단지명') continue;

        const sido    = col[0].trim();
        const sigungu = col[1].trim();
        const dong    = col[2].trim();
        const apt     = col[3].trim();
        if (!apt || sido === '') continue;

        const areaSuffix   = getSuffix(col[4]);
        const supply       = toArea(col[6] || col[4]);
        const excl         = toArea(col[5]);
        const supplyPyeong = toPyeong(col[6] || col[4], col[7]);
        const exclPyeong   = toPyeong(col[5], '');
        const low     = toPrice(col[8]  || '');
        const mid     = toPrice(col[9]  || '');
        const high    = toPrice(col[10] || '');
        const midRaw  = toRawPrice(col[9] || '');

        flatData.push({
            시도: sido, 시군구: sigungu, 동: dong,
            지역: `${sido} ${sigungu} ${dong}`.replace(/\s+/g, ' '),
            아파트: apt,
            공급면적: supply, 전용면적: excl,
            공급평형: supplyPyeong, 전용평형: exclPyeong,
            suffix: areaSuffix,
            하한가: low, 일반가: mid, 상한가: high,
            일반가Raw: midRaw,
        });
    }

    // 진행률 업데이트 후 브라우저에 한 프레임 양보
    const pct = Math.round((end / total) * 85) + 5; // 5~90%
    setSplashProgress(pct, `데이터 파싱 중... ${flatData.length.toLocaleString()}건`);
    await yieldFrame();
}

setSplashProgress(92, '단지 정보 구성 중...');
await yieldFrame();

/* ── 그룹화 ── */
const map = new Map();
flatData.forEach(row => {
    const key = `${row.시도}|${row.시군구}|${row.동}|${row.아파트}`;
    if (!map.has(key)) {
        const reg = getRegulationZone(row.시도, row.시군구);
        map.set(key, {
            시도: row.시도, 시군구: row.시군구, 동: row.동,
            지역: row.지역, 아파트: row.아파트,
            rows: [],
            minPrice: Infinity, maxPrice: 0,
            regZone:   reg.zone,
            regLabels: reg.labels,
        });
    }
    const g = map.get(key);
    g.rows.push(row);
    if (row.일반가Raw > 0) {
        g.minPrice = Math.min(g.minPrice, row.일반가Raw);
        g.maxPrice = Math.max(g.maxPrice, row.일반가Raw);
    }
});

setSplashProgress(97, '화면 구성 중...');
await yieldFrame();

allGroups = Array.from(map.values()).map(g => {
    if (g.minPrice === Infinity) g.minPrice = 0;
    g.searchKey = `${g.지역} ${g.아파트}`.toLowerCase();
    return g;
});

/* ── 지역 칩 생성 ── */
const regions = ['전체', ...new Set(allGroups.map(g => g.시도).sort())];
buildRegionChips(regions);
requestAnimationFrame(syncScrollPadding);

filteredGroups = allGroups;
setSplashProgress(100, '완료');
renderInitial();
```

}

/* ══════════════ 지역 칩 ══════════════ */
function buildRegionChips(regions) {
const wrap = document.getElementById(‘regionFilter’);
wrap.innerHTML = regions.map(r =>
`<button class="region-chip${r === '전체' ? ' active' : ''}" data-region="${r}">${r}</button>`
).join(’’);

```
wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.region-chip');
    if (!chip) return;
    activeRegion = chip.dataset.region;
    wrap.querySelectorAll('.region-chip').forEach(c => c.classList.toggle('active', c === chip));
    applyFilters();
});
```

}

/* ══════════════ 필터 + 정렬 적용 ══════════════ */
function applyFilters() {
const raw   = document.getElementById(‘searchInput’).value.trim().toLowerCase();
const terms = raw ? raw.split(/\s+/) : [];

```
let result = allGroups;

// 1) 지역 필터
if (activeRegion !== '전체') {
    result = result.filter(g => g.시도 === activeRegion);
}

// 2) 키워드 검색 (pre-built searchKey 사용)
if (terms.length > 0) {
    result = result.filter(g => terms.every(t => g.searchKey.includes(t)));
}

// 3) 정렬
switch (activeSort) {
    case 'name':
        result = [...result].sort((a, b) => a.아파트.localeCompare(b.아파트, 'ko'));
        break;
    case 'price_asc':
        result = [...result].sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity));
        break;
    case 'price_desc':
        result = [...result].sort((a, b) => b.maxPrice - a.maxPrice);
        break;
    // default: 원본 순서 유지
}

filteredGroups = result;
renderInitial();
```

}

/* ══════════════ HTML 생성 ══════════════ */
function getPriceRange(g) {
if (!g.minPrice && !g.maxPrice) return ‘’;
if (g.minPrice === g.maxPrice) return `${g.minPrice.toLocaleString('ko-KR')}만`;
return `${g.minPrice.toLocaleString('ko-KR')} ~ ${g.maxPrice.toLocaleString('ko-KR')}만`;
}

function createGroupHTML(g) {
const priceRange = getPriceRange(g);
const rowCnt     = g.rows.length;

```
// 규제지역 배지 HTML 생성 (최상위 등급 1개만 표시)
let regBadgesHTML = '';
if (g.regLabels && g.regLabels.length > 0) {
    const label = g.regLabels[0];
    const cls = g.regZone === 'A' ? 'reg-badge reg-A'
              : g.regZone === 'B' ? 'reg-badge reg-B'
              :                     'reg-badge reg-C';
    regBadgesHTML = `<span class="${cls}">${label}</span>`;
}

let rowsHTML = '';
g.rows.forEach(row => {
    const suffixBadge = row.suffix
        ? `<span class="area-suffix">${row.suffix}</span>`
        : '';

    // ㎡ / 평 양쪽 렌더링 → CSS로 show/hide (재렌더 불필요)
    rowsHTML += `
    <div class="inner-row">
        <div class="inner-area">
            <span class="area-val u-sqm">${row.공급면적}㎡</span>
            <span class="area-divider u-sqm">/</span>
            <span class="area-val exclusive u-sqm">${row.전용면적}㎡</span>
            <span class="area-val u-pyeong">${row.공급평형}</span>
            <span class="area-divider u-pyeong">/</span>
            <span class="area-val exclusive u-pyeong">${row.전용평형}</span>
            ${suffixBadge}
        </div>
        <div class="inner-prices">
            <div class="price-box low">
                <span class="price-label">하한가</span>
                <span class="price-val">${row.하한가}</span>
            </div>
            <div class="price-box mid">
                <span class="price-label">일반가</span>
                <span class="price-val">${row.일반가}</span>
            </div>
            <div class="price-box high">
                <span class="price-label">상한가</span>
                <span class="price-val">${row.상한가}</span>
            </div>
        </div>
    </div>`;
});

return `
<div class="group-item${g.regZone ? ' has-reg zone-' + g.regZone : ''}">
    <div class="accordion-btn">
        <div class="group-title-wrap">
            <span class="group-apt">${g.아파트}</span>
            <span class="group-region">${g.지역}</span>
            ${regBadgesHTML ? `<div class="reg-badges">${regBadgesHTML}</div>` : ''}
        </div>
        <div class="accordion-right">
            ${priceRange ? `<span class="price-range-badge">${priceRange}</span>` : ''}
            <span class="row-count-badge">${rowCnt}개</span>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </div>
    </div>
    <div class="accordion-content">
        <div class="content-header">
            <span class="header-area">
                면적 (공급 / 전용)
                <span class="header-unit-badge u-sqm">㎡</span>
                <span class="header-unit-badge u-pyeong">평</span>
            </span>
            <span class="header-unit">(단위: 만원)</span>
        </div>
        ${rowsHTML}
    </div>
</div>`;
```

}

/* ══════════════ 렌더링 ══════════════ */
function renderInitial() {
const listBody  = document.getElementById(‘listBody’);
const sentinel  = document.getElementById(‘scrollSentinel’);
const countEl   = document.getElementById(‘resultCount’);

```
listBody.innerHTML = '';
loadedCount = 0;

const total = filteredGroups.length;
const isFiltered = activeRegion !== '전체'
    || document.getElementById('searchInput').value.trim() !== '';

if (countEl) {
    countEl.textContent = isFiltered
        ? `${total.toLocaleString()}개 단지`
        : `전체 ${allGroups.length.toLocaleString()}개 단지`;
}

if (total === 0) {
    listBody.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <p>조건에 맞는 시세 정보가 없습니다.</p>
            <small>검색어 또는 지역 필터를 변경해보세요.</small>
        </div>`;
    sentinel.style.display = 'none';
    return;
}

loadMore();
window.scrollTo({ top: 0, behavior: 'smooth' });
```

}

function loadMore() {
const listBody = document.getElementById(‘listBody’);
const sentinel = document.getElementById(‘scrollSentinel’);

```
const next   = Math.min(loadedCount + LOAD_STEP, filteredGroups.length);
const slice  = filteredGroups.slice(loadedCount, next);

if (slice.length > 0) {
    listBody.insertAdjacentHTML('beforeend', slice.map(createGroupHTML).join(''));
}

loadedCount = next;
sentinel.style.display = loadedCount >= filteredGroups.length ? 'none' : 'block';
```

}

function setupScrollObserver() {
const sentinel = document.getElementById(‘scrollSentinel’);
scrollObserver = new IntersectionObserver(
entries => { if (entries[0].isIntersecting) loadMore(); },
{ rootMargin: ‘300px’ }
);
if (sentinel) scrollObserver.observe(sentinel);
}