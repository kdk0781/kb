/* ─────────────────────────────────────────────
   아파트 시세표 | app.js  v3.0
   최적화 포인트
   ① searchKey를 파싱 시점 1회 생성 (검색마다 rowsText 재조합 제거)
   ② 시/도 지역 칩 필터 (지역별 즉시 좁히기)
   ③ 가격 범위 미리보기 (아코디언 열기 전 일반가 최저~최고 노출)
   ④ 면적 타입 suffix 배지 (T=테라스, P=펜트하우스, C=코너 등)
   ⑤ 결과 카운트 표시
   ⑥ 정렬 기능 (기본/가나다/가격 낮은순/높은순)
───────────────────────────────────────────── */

let allGroups     = [];
let filteredGroups = [];
let activeRegion  = '전체';
let activeSort    = 'default';
let loadedCount   = 0;
const LOAD_STEP   = 20;
let searchDebounceTimer = null;
let scrollObserver = null;

// 면적 타입 suffix → 한글 레이블 매핑
const SUFFIX_MAP = {
    'T': '테라스', 'P': '펜트', 'C': '코너', 'A': '타입A',
    'B': '타입B', 'D': '타입D', 'E': '타입E',
};

/* ══════════════ 초기화 ══════════════ */
document.addEventListener('DOMContentLoaded', () => {

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
            setTimeout(() => {
                const rect = item.getBoundingClientRect();
                if (rect.top < 130 || rect.bottom > window.innerHeight) {
                    window.scrollTo({
                        top: item.getBoundingClientRect().top + window.scrollY - 130,
                        behavior: 'smooth',
                    });
                }
            }, 300);
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

    setupScrollObserver();
    loadData();
});


/* ══════════════ 데이터 로딩 ══════════════ */
function loadData() {
    fetch('excel/map.csv?t=' + Date.now())
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
        })
        .then(buf => {
            parseCSV(new TextDecoder('euc-kr').decode(buf));
            setTimeout(() => {
                const splash = document.getElementById('splashOverlay');
                if (splash) splash.classList.add('hide');
            }, 400);
        })
        .catch(err => {
            console.error('[loadData]', err);
            const splash = document.getElementById('splashOverlay');
            if (splash) {
                splash.innerHTML = `
                    <div class="splash-error">
                        <span style="font-size:2rem">⚠️</span>
                        <p>데이터를 불러올 수 없습니다.</p>
                        <small>네트워크를 확인하고 새로고침 해주세요.</small>
                        <button onclick="window.location.reload(true)" class="refresh-btn" style="margin-top:16px">
                            <span>다시 시도</span>
                        </button>
                    </div>`;
            }
        });
}


/* ══════════════ CSV 파싱 ══════════════ */
function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);

    /* ── 기준일 추출 ── */
    let baseDateText = '';
    for (let i = 0; i < Math.min(15, lines.length); i++) {
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
        const n = parseFloat(val.replace(/,/g, ''));
        if (isNaN(n)) return val;
        // 소수점 2자리까지, 끝 0 제거
        return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
    };
    // 면적 suffix 추출 (숫자·점·쉼표 이후 문자열)
    const getSuffix = (val) => {
        const raw = val.trim().replace(/^[\d.,]+/, '');
        if (!raw) return '';
        // 한글 포함 → 그대로 (짧게 자름)
        if (/[가-힣]/.test(raw)) return raw.slice(0, 6);
        // 영문 약어 → 매핑 or 원문
        const upper = raw.toUpperCase();
        if (SUFFIX_MAP[upper]) return SUFFIX_MAP[upper];
        // 여러 글자 영문 (ABD 등) → 그대로
        return raw.slice(0, 6);
    };

    /* ── 행 파싱 ── */
    const flatData = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (SKIP.some(k => line.includes(k))) continue;

        // CSV 분리 (따옴표 내 쉼표 보호)
        const col = line
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map(v => v.replace(/^"|"$/g, '').trim());

        if (col.length < 11 || !col[0]) continue;
        if (col[3] === '아파트' || col[3] === '단지명') continue;

        const sido    = col[0].trim();
        const sigungu = col[1].trim();
        const dong    = col[2].trim();
        const apt     = col[3].trim();
        if (!apt) continue;

        // col[4] = 주택형(공급), col[5] = 전용, col[6] = 주택형(clean), col[7] = 평형
        const areaSuffix = getSuffix(col[4]);
        const supply  = toArea(col[6] || col[4]);
        const excl    = toArea(col[5]);
        const low     = toPrice(col[8]);
        const mid     = toPrice(col[9]);
        const high    = toPrice(col[10]);
        const midRaw  = toRawPrice(col[9]);

        flatData.push({
            시도: sido, 시군구: sigungu, 동: dong,
            지역: `${sido} ${sigungu} ${dong}`.replace(/\s+/g, ' '),
            아파트: apt,
            공급면적: supply, 전용면적: excl,
            suffix: areaSuffix,
            하한가: low, 일반가: mid, 상한가: high,
            일반가Raw: midRaw,
        });
    }

    /* ── 그룹화 ── */
    const map = new Map();
    flatData.forEach(row => {
        const key = `${row.시도}|${row.시군구}|${row.동}|${row.아파트}`;
        if (!map.has(key)) {
            map.set(key, {
                시도: row.시도, 시군구: row.시군구, 동: row.동,
                지역: row.지역, 아파트: row.아파트,
                rows: [],
                minPrice: Infinity, maxPrice: 0,
            });
        }
        const g = map.get(key);
        g.rows.push(row);
        if (row.일반가Raw > 0) {
            g.minPrice = Math.min(g.minPrice, row.일반가Raw);
            g.maxPrice = Math.max(g.maxPrice, row.일반가Raw);
        }
    });

    // searchKey 1회 생성 (파싱 시점) → 검색마다 재조합 불필요
    allGroups = Array.from(map.values()).map(g => {
        if (g.minPrice === Infinity) g.minPrice = 0;
        g.searchKey = `${g.지역} ${g.아파트}`.toLowerCase();
        return g;
    });

    /* ── 지역 칩 생성 ── */
    const regions = ['전체', ...new Set(allGroups.map(g => g.시도).sort())];
    buildRegionChips(regions);

    filteredGroups = allGroups;
    renderInitial();
}


/* ══════════════ 지역 칩 ══════════════ */
function buildRegionChips(regions) {
    const wrap = document.getElementById('regionFilter');
    wrap.innerHTML = regions.map(r =>
        `<button class="region-chip${r === '전체' ? ' active' : ''}" data-region="${r}">${r}</button>`
    ).join('');

    wrap.addEventListener('click', (e) => {
        const chip = e.target.closest('.region-chip');
        if (!chip) return;
        activeRegion = chip.dataset.region;
        wrap.querySelectorAll('.region-chip').forEach(c => c.classList.toggle('active', c === chip));
        applyFilters();
    });
}


/* ══════════════ 필터 + 정렬 적용 ══════════════ */
function applyFilters() {
    const raw   = document.getElementById('searchInput').value.trim().toLowerCase();
    const terms = raw ? raw.split(/\s+/) : [];

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
}


/* ══════════════ HTML 생성 ══════════════ */
function getPriceRange(g) {
    if (!g.minPrice && !g.maxPrice) return '';
    if (g.minPrice === g.maxPrice) return `${g.minPrice.toLocaleString('ko-KR')}만`;
    return `${g.minPrice.toLocaleString('ko-KR')} ~ ${g.maxPrice.toLocaleString('ko-KR')}만`;
}

function createGroupHTML(g) {
    const priceRange = getPriceRange(g);
    const rowCnt     = g.rows.length;

    let rowsHTML = '';
    g.rows.forEach(row => {
        const suffixBadge = row.suffix
            ? `<span class="area-suffix">${row.suffix}</span>`
            : '';

        rowsHTML += `
        <div class="inner-row">
            <div class="inner-area">
                <span class="area-val">${row.공급면적}㎡</span>
                <span class="area-divider">/</span>
                <span class="area-val exclusive">${row.전용면적}㎡</span>
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
    <div class="group-item">
        <div class="accordion-btn">
            <div class="group-title-wrap">
                <span class="group-apt">${g.아파트}</span>
                <span class="group-region">${g.지역}</span>
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
                <span class="header-area">면적 (공급 / 전용)</span>
                <span class="header-unit">(단위: 만원)</span>
            </div>
            ${rowsHTML}
        </div>
    </div>`;
}


/* ══════════════ 렌더링 ══════════════ */
function renderInitial() {
    const listBody  = document.getElementById('listBody');
    const sentinel  = document.getElementById('scrollSentinel');
    const countEl   = document.getElementById('resultCount');

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
}

function loadMore() {
    const listBody = document.getElementById('listBody');
    const sentinel = document.getElementById('scrollSentinel');

    const next   = Math.min(loadedCount + LOAD_STEP, filteredGroups.length);
    const slice  = filteredGroups.slice(loadedCount, next);

    if (slice.length > 0) {
        listBody.insertAdjacentHTML('beforeend', slice.map(createGroupHTML).join(''));
    }

    loadedCount = next;
    sentinel.style.display = loadedCount >= filteredGroups.length ? 'none' : 'block';
}

function setupScrollObserver() {
    const sentinel = document.getElementById('scrollSentinel');
    scrollObserver = new IntersectionObserver(
        entries => { if (entries[0].isIntersecting) loadMore(); },
        { rootMargin: '300px' }
    );
    if (sentinel) scrollObserver.observe(sentinel);
}
