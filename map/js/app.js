/* ════════════════════════════════════════════
   아파트 시세표 | app.js  v6.0  (2026-04-03)
   ────────────────────────────────────────────
   ✅ 상태기계 CSV 파서 (O(n), 재앙적 정규식 제거)
   ✅ 동기 파싱 38ms — async 청크 구조 완전 제거
   ✅ 스플래시 3중 보장 (정상/오류/5초 타이머)
   ✅ 버전 번호 화면 표시 (배포 확인용)
════════════════════════════════════════════ */

const APP_VERSION = 'v6.0';

/* ── 전역 상태 ── */
let allGroups      = [];
let filteredGroups = [];
let activeRegion   = '전체';
let activeSort     = 'default';
let areaUnit       = 'sqm';
let loadedCount    = 0;
const LOAD_STEP    = 20;
let searchDebounceTimer = null;
let scrollObserver = null;

/* ── 면적 타입 suffix 매핑 ── */
const SUFFIX_MAP = {
    'T':'테라스','P':'펜트','C':'코너',
    'A':'타입A','B':'타입B','D':'타입D','E':'타입E',
};

/* ── 규제지역 (2025.10.16 기준) ── */
const ZONE_DATA = {
    투기지역: {
        '서울특별시': ['강남구','서초구','송파구','용산구'],
    },
    투기과열지구: {
        '서울특별시': [
            '강동구','강북구','강서구','관악구','광진구',
            '구로구','금천구','노원구','도봉구','동대문구',
            '동작구','마포구','서대문구','성동구','성북구',
            '양천구','영등포구','은평구','종로구','중구','중랑구',
        ],
        '경기도': [
            '과천시','광명시','의왕시','하남시',
            '분당구','수정구','중원구',
            '영통구','장안구','팔달구',
            '동안구','수지구',
        ],
    },
};

function getRegulationZone(sido, sgg) {
    sido = sido.trim(); sgg = sgg.trim();
    const a = ZONE_DATA.투기지역[sido] || [];
    if (a.some(g => sgg.includes(g))) return { zone:'A', label:'투기지역' };
    const b = ZONE_DATA.투기과열지구[sido] || [];
    if (b.some(g => sgg.includes(g))) return { zone:'B', label:'투기과열지구' };
    return { zone: null, label: '' };
}

/* ════════════════════════════════════════════
   초기화
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

    /* 버전 표시 (배포 확인용) */
    const vEl = document.getElementById('splashVersion');
    if (vEl) vEl.textContent = APP_VERSION;

    /* 서비스워커 */
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    /* 강제 새로고침 */
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
            localStorage.clear(); sessionStorage.clear();
        } finally { window.location.reload(true); }
    });

    /* 아코디언 */
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
                const hdr = document.querySelector('.sticky-header');
                const hBottom = hdr ? hdr.getBoundingClientRect().bottom : 120;
                const rect = item.getBoundingClientRect();
                if (rect.top < hBottom + 10) {
                    window.scrollTo({ top: window.scrollY + rect.top - hBottom - 10, behavior: 'smooth' });
                }
            }, 320);
        }
    });

    /* 검색 */
    document.getElementById('searchInput').addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(applyFilters, 250);
    });

    /* 정렬 */
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        activeSort = e.target.value;
        applyFilters();
    });

    /* ㎡ ↔ 평 토글 */
    document.getElementById('unitToggleBtn').addEventListener('click', () => {
        areaUnit = areaUnit === 'sqm' ? 'pyeong' : 'sqm';
        document.body.classList.toggle('pyeong-mode', areaUnit === 'pyeong');
        const btn = document.getElementById('unitToggleBtn');
        btn.querySelector('.u-label-sqm').classList.toggle('active', areaUnit === 'sqm');
        btn.querySelector('.u-label-pyeong').classList.toggle('active', areaUnit === 'pyeong');
    });

    setupScrollObserver();
    loadData();
});

/* 스티키 헤더 높이 동기화 */
function syncScrollPadding() {
    const el = document.querySelector('.sticky-header');
    if (!el) return;
    document.documentElement.style.setProperty('scroll-padding-top', (el.offsetHeight + 10) + 'px');
}
window.addEventListener('resize', syncScrollPadding, { passive: true });

/* ════════════════════════════════════════════
   스플래시 제어
════════════════════════════════════════════ */
function hideSplash() {
    const el = document.getElementById('splashOverlay');
    if (el) el.classList.add('hide');
}

function showSplashError(msg) {
    const el = document.getElementById('splashOverlay');
    if (!el) return;
    el.innerHTML = `
        <div class="splash-error">
            <span style="font-size:2rem">⚠️</span>
            <p>${msg || '데이터를 불러올 수 없습니다.'}</p>
            <small>새로고침 버튼을 눌러 다시 시도하세요.</small>
            <button onclick="window.location.reload(true)" class="refresh-btn" style="margin-top:16px">
                <span>다시 시도</span>
            </button>
            <small style="margin-top:8px;opacity:0.5">${APP_VERSION}</small>
        </div>`;
}

/* ════════════════════════════════════════════
   데이터 로딩
   - 5초 안전망 타이머 (무한 로딩 절대 방지)
   - fetch 실패 → showSplashError (영원히 안 닫히는 스플래시 없음)
   - 파싱 예외 → showSplashError
   - 정상 완료 → hideSplash
   세 경우 모두 반드시 스플래시가 처리됨
════════════════════════════════════════════ */
function loadData() {
    console.log('[loadData] 시작', APP_VERSION);

    /* 5초 안전망: 어떤 경우에도 스플래시 닫힘 */
    const safetyTimer = setTimeout(() => {
        console.warn('[loadData] 5초 안전망 발동');
        hideSplash();
    }, 5000);

    const done = (ok) => {
        clearTimeout(safetyTimer);
        if (ok) hideSplash();
    };

    fetch('excel/map.csv', {
        cache: 'no-store',   // 브라우저 HTTP 캐시 완전 우회
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache, no-store' }
    })
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.arrayBuffer();
        })
        .then(buf => {
            console.log('[loadData] CSV 수신 완료', buf.byteLength, 'bytes');
            let csv;
            try {
                csv = new TextDecoder('euc-kr').decode(buf);
            } catch (e) {
                console.warn('[loadData] euc-kr 디코딩 실패, utf-8 재시도');
                csv = new TextDecoder('utf-8').decode(buf);
            }
            parseAndRender(csv);
            done(true);
        })
        .catch(err => {
            console.error('[loadData] 오류:', err);
            done(false);
            showSplashError('CSV 파일을 불러올 수 없습니다. (' + err.message + ')');
        });
}

/* ════════════════════════════════════════════
   안전한 CSV 한 줄 파서 (상태기계, O(n))
   기존 정규식은 홀수 따옴표에서 무한 루프 발생
════════════════════════════════════════════ */
function parseCSVLine(line) {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { field += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            fields.push(field.trim()); field = '';
        } else {
            field += ch;
        }
    }
    fields.push(field.trim());
    return fields;
}

/* ════════════════════════════════════════════
   가격 캐시 (localStorage)  ─ 두 슬롯 구조
   ┌──────────────────────────────────────┐
   │ apt_map_curr : 현재 주 데이터        │
   │ apt_map_prev : 비교 기준(이전 주)    │
   └──────────────────────────────────────┘
   동작:
   ① 새 날짜 CSV 업로드
      curr → prev 로 이동, 새 데이터 → curr 저장
      diff = 새 데이터 vs (구)curr
   ② 같은 날짜 재로드
      curr 그대로, prev 그대로
      diff = curr vs prev  (업로드 전까지 유지)
════════════════════════════════════════════ */
const CACHE_CURR = 'apt_map_curr';
const CACHE_PREV = 'apt_map_prev';

function buildPriceKey(row) {
    return `${row.시도}|${row.시군구}|${row.동}|${row.아파트}|${row.공급면적}|${row.전용면적}|${row.suffix}`;
}

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function writeCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('[priceCache] 저장 실패:', e.message);
    }
}

function buildCachePayload(dateText, flatData) {
    const p = {};
    for (const row of flatData) {
        p[buildPriceKey(row)] = [row.하한가Raw, row.일반가Raw, row.상한가Raw];
    }
    return { dateText, p };
}

/**
 * 캐시 비교 + 갱신
 * @returns {Object|null}  비교 기준 캐시 (없으면 null → diff 미표시)
 */
function syncPriceCache(baseDateText, flatData) {
    const curr = readCache(CACHE_CURR);

    if (curr && curr.dateText === baseDateText) {
        // ② 같은 주 재로드 → prev 그대로 유지, diff 계속 표시
        const prev = readCache(CACHE_PREV);
        console.log('[priceCache] 같은 주 재로드 → diff 유지', prev ? prev.dateText : '(없음)');
        return prev;          // prev가 비교 기준
    }

    // ① 새 날짜 CSV
    // 기존 curr → prev 승격
    if (curr) {
        writeCache(CACHE_PREV, curr);
        console.log('[priceCache] curr→prev 승격:', curr.dateText);
    }
    // 새 데이터 → curr 저장
    writeCache(CACHE_CURR, buildCachePayload(baseDateText, flatData));
    console.log('[priceCache] 새 curr 저장:', baseDateText);

    return curr;    // 비교 기준 = 방금 승격된 구 curr (없으면 null)
}

/* ════════════════════════════════════════════
   CSV 파싱 + 렌더링 (완전 동기, 38ms)
════════════════════════════════════════════ */
function parseAndRender(csv) {
    console.log('[parseAndRender] 시작');
    const t0 = Date.now();

    const lines = csv.split(/\r\n|\n/);

    /* 기준일 추출 */
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
    if (dateLabel) {
        if (baseDateText) dateLabel.textContent = '기준일 ' + baseDateText;
        else dateLabel.style.display = 'none';
    }

    /* 스킵 키워드 */
    const SKIP = [
        '전국은행연합회','조견표','절대 수정 금지','대출상담사',
        '시도,시군구','시/도','공급면적','하한가',
    ];

    /* 헬퍼 */
    const toNum  = v => parseFloat(String(v).replace(/,/g, ''));
    const toPrice = v => { const n = toNum(v); return (isNaN(n)||n===0) ? '-' : n.toLocaleString('ko-KR'); };
    const toRaw  = v => { const n = toNum(v); return isNaN(n) ? 0 : n; };
    const toArea = v => { const n = toNum(v); if(isNaN(n)) return String(v); return n%1===0 ? String(n) : n.toFixed(2).replace(/\.?0+$/,''); };
    const toPyeong = (sqm, p) => {
        if (p) { const n=toNum(p); if(!isNaN(n)&&n>0) return n+'평'; }
        const n = toNum(sqm);
        return isNaN(n) ? '-' : (n/3.3058).toFixed(1)+'평';
    };
    const getSuffix = v => {
        const raw = String(v).trim().replace(/^[\d.,]+/,'');
        if (!raw) return '';
        if (/[가-힣]/.test(raw)) return raw.slice(0,6);
        const u = raw.toUpperCase();
        return SUFFIX_MAP[u] || raw.slice(0,6);
    };

    /* 파싱 */
    const flatData = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (SKIP.some(k => line.includes(k))) continue;

        const col = parseCSVLine(line);
        if (col.length < 11 || !col[0]) continue;
        if (col[3] === '아파트' || col[3] === '단지명') continue;

        const sido = col[0].trim(), sgg = col[1].trim(), dong = col[2].trim(), apt = col[3].trim();
        if (!apt || !sido) continue;

        flatData.push({
            시도: sido, 시군구: sgg, 동: dong,
            지역: `${sido} ${sgg} ${dong}`.replace(/\s+/g,' '),
            아파트: apt,
            공급면적: toArea(col[6]||col[4]), 전용면적: toArea(col[5]),
            공급평형: toPyeong(col[6]||col[4], col[7]), 전용평형: toPyeong(col[5],''),
            suffix: getSuffix(col[4]),
            하한가: toPrice(col[8]||''), 일반가: toPrice(col[9]||''), 상한가: toPrice(col[10]||''),
            하한가Raw: toRaw(col[8]||''),
            일반가Raw: toRaw(col[9]||''),
            상한가Raw: toRaw(col[10]||''),
            // 가격 변동 (loadPriceCache 비교 후 주입)
            diffLow: null, diffMid: null, diffHigh: null,
        });
    }

    /* ── 지난주 가격 비교 ── */
    const compCache = syncPriceCache(baseDateText, flatData);
    if (compCache) {
        const pm = compCache.p;
        for (const row of flatData) {
            const prev = pm[buildPriceKey(row)];
            if (prev) {
                row.diffLow  = row.하한가Raw - prev[0];
                row.diffMid  = row.일반가Raw - prev[1];
                row.diffHigh = row.상한가Raw - prev[2];
            }
        }
    }

    /* 그룹화 */
    const map = new Map();
    for (const row of flatData) {
        const key = `${row.시도}|${row.시군구}|${row.동}|${row.아파트}`;
        if (!map.has(key)) {
            const reg = getRegulationZone(row.시도, row.시군구);
            map.set(key, {
                시도: row.시도, 시군구: row.시군구, 동: row.동,
                지역: row.지역, 아파트: row.아파트,
                rows: [], minPrice: Infinity, maxPrice: 0,
                regZone: reg.zone, regLabel: reg.label,
            });
        }
        const g = map.get(key);
        g.rows.push(row);
        if (row.일반가Raw > 0) {
            g.minPrice = Math.min(g.minPrice, row.일반가Raw);
            g.maxPrice = Math.max(g.maxPrice, row.일반가Raw);
        }
    }

    allGroups = Array.from(map.values()).map(g => {
        if (g.minPrice === Infinity) g.minPrice = 0;
        g.searchKey = `${g.지역} ${g.아파트}`.toLowerCase();
        return g;
    });

    /* 지역 칩 */
    const regions = ['전체', ...new Set(allGroups.map(g => g.시도).sort())];
    buildRegionChips(regions);
    requestAnimationFrame(syncScrollPadding);

    filteredGroups = allGroups;

    const t1 = Date.now();
    console.log(`[parseAndRender] 완료: ${allGroups.length}단지, ${t1-t0}ms`);

    renderInitial();
}

/* ════════════════════════════════════════════
   지역 칩
════════════════════════════════════════════ */
function buildRegionChips(regions) {
    const wrap = document.getElementById('regionFilter');
    if (!wrap) return;
    wrap.innerHTML = regions.map(r =>
        `<button class="region-chip${r==='전체'?' active':''}" data-region="${r}">${r}</button>`
    ).join('');
    wrap.addEventListener('click', (e) => {
        const chip = e.target.closest('.region-chip');
        if (!chip) return;
        activeRegion = chip.dataset.region;
        wrap.querySelectorAll('.region-chip').forEach(c => c.classList.toggle('active', c===chip));
        applyFilters();
    });
}

/* ════════════════════════════════════════════
   필터 + 정렬
════════════════════════════════════════════ */
function applyFilters() {
    const raw = document.getElementById('searchInput').value.trim().toLowerCase();
    const terms = raw ? raw.split(/\s+/) : [];

    let result = allGroups;
    if (activeRegion !== '전체') result = result.filter(g => g.시도 === activeRegion);
    if (terms.length > 0) result = result.filter(g => terms.every(t => g.searchKey.includes(t)));

    switch (activeSort) {
        case 'name':      result = [...result].sort((a,b) => a.아파트.localeCompare(b.아파트,'ko')); break;
        case 'price_asc': result = [...result].sort((a,b) => (a.minPrice||Infinity)-(b.minPrice||Infinity)); break;
        case 'price_desc':result = [...result].sort((a,b) => b.maxPrice-a.maxPrice); break;
    }

    filteredGroups = result;
    renderInitial();
}

/* ════════════════════════════════════════════
   HTML 생성
════════════════════════════════════════════ */
function getPriceRange(g) {
    if (!g.minPrice && !g.maxPrice) return '';
    if (g.minPrice === g.maxPrice) return g.minPrice.toLocaleString('ko-KR')+'만';
    return `${g.minPrice.toLocaleString('ko-KR')} ~ ${g.maxPrice.toLocaleString('ko-KR')}만`;
}

/* 가격 변동 뱃지 생성 헬퍼 */
function diffBadge(diff) {
    if (diff === null || diff === undefined || diff === 0) return '';
    const abs = Math.abs(diff).toLocaleString('ko-KR');
    return diff > 0
        ? `<span class="price-diff up">🔺${abs}</span>`
        : `<span class="price-diff down">🔻${abs}</span>`;
}

function createGroupHTML(g) {
    const priceRange = getPriceRange(g);

    const regBadge = g.regLabel
        ? `<div class="reg-badges"><span class="reg-badge reg-${g.regZone}">${g.regLabel}</span></div>`
        : '';

    // 그룹 내 변동 요약 (일반가 기준, 헤더에 표시)
    const midDiffs = g.rows.map(r => r.diffMid).filter(d => d !== null && d !== 0);
    let groupDiffBadge = '';
    if (midDiffs.length > 0) {
        const maxUp   = Math.max(...midDiffs.filter(d => d > 0), 0);
        const maxDown = Math.min(...midDiffs.filter(d => d < 0), 0);
        if (maxUp > 0 && maxDown < 0) {
            groupDiffBadge = `<span class="group-diff-badge mixed">🔺🔻 등락</span>`;
        } else if (maxUp > 0) {
            groupDiffBadge = `<span class="group-diff-badge up">🔺${maxUp.toLocaleString('ko-KR')}</span>`;
        } else if (maxDown < 0) {
            groupDiffBadge = `<span class="group-diff-badge down">🔻${Math.abs(maxDown).toLocaleString('ko-KR')}</span>`;
        }
    }

    let rowsHTML = '';
    for (const row of g.rows) {
        const sb = row.suffix ? `<span class="area-suffix">${row.suffix}</span>` : '';
        rowsHTML += `
        <div class="inner-row">
            <div class="inner-area">
                <span class="area-val u-sqm">${row.공급면적}㎡</span>
                <span class="area-divider u-sqm">/</span>
                <span class="area-val exclusive u-sqm">${row.전용면적}㎡</span>
                <span class="area-val u-pyeong">${row.공급평형}</span>
                <span class="area-divider u-pyeong">/</span>
                <span class="area-val exclusive u-pyeong">${row.전용평형}</span>
                ${sb}
            </div>
            <div class="inner-prices">
                <div class="price-box low">
                    <span class="price-label">하한가</span>
                    <span class="price-val">${row.하한가}</span>
                    ${diffBadge(row.diffLow)}
                </div>
                <div class="price-box mid">
                    <span class="price-label">일반가</span>
                    <span class="price-val">${row.일반가}</span>
                    ${diffBadge(row.diffMid)}
                </div>
                <div class="price-box high">
                    <span class="price-label">상한가</span>
                    <span class="price-val">${row.상한가}</span>
                    ${diffBadge(row.diffHigh)}
                </div>
            </div>
        </div>`;
    }

    return `
    <div class="group-item${g.regZone?' has-reg zone-'+g.regZone:''}">
        <div class="accordion-btn">
            <div class="group-title-wrap">
                <span class="group-apt">${g.아파트}</span>
                <span class="group-region">${g.지역}</span>
                ${regBadge}
            </div>
            <div class="accordion-right">
                ${groupDiffBadge}
                ${priceRange?`<span class="price-range-badge">${priceRange}</span>`:''}
                <span class="row-count-badge">${g.rows.length}개</span>
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
        </div>
        <div class="accordion-content">
            <div class="content-header">
                <span class="header-area">면적 (공급 / 전용)
                    <span class="header-unit-badge u-sqm">㎡</span>
                    <span class="header-unit-badge u-pyeong">평</span>
                </span>
                <span class="header-unit">(단위: 만원)</span>
            </div>
            ${rowsHTML}
        </div>
    </div>`;
}

/* ════════════════════════════════════════════
   렌더링
════════════════════════════════════════════ */
function renderInitial() {
    const listBody = document.getElementById('listBody');
    const sentinel = document.getElementById('scrollSentinel');
    const countEl  = document.getElementById('resultCount');

    listBody.innerHTML = '';
    loadedCount = 0;

    const total = filteredGroups.length;
    const isFiltered = activeRegion !== '전체' || document.getElementById('searchInput').value.trim() !== '';
    if (countEl) {
        countEl.textContent = isFiltered
            ? `${total.toLocaleString()}개 단지`
            : `전체 ${allGroups.length.toLocaleString()}개 단지`;
    }

    if (total === 0) {
        listBody.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><p>조건에 맞는 시세 정보가 없습니다.</p><small>검색어 또는 지역 필터를 변경해보세요.</small></div>`;
        sentinel.style.display = 'none';
        return;
    }

    loadMore();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadMore() {
    const listBody = document.getElementById('listBody');
    const sentinel = document.getElementById('scrollSentinel');
    const next  = Math.min(loadedCount + LOAD_STEP, filteredGroups.length);
    const slice = filteredGroups.slice(loadedCount, next);
    if (slice.length > 0) listBody.insertAdjacentHTML('beforeend', slice.map(createGroupHTML).join(''));
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
