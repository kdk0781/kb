const _V = 'v8.0';
let _aG = [];
let _fG = [];
let _aR = '전체';
let _aS = 'default';
let _aU = 'sqm';
let _lC = 0;
const _lS = 20;
let _sDT = null;
let _sO = null;
const _sM = {
'T':'테라스','P':'펜트','C':'코너',
'A':'타입A','B':'타입B','D':'타입D','E':'타입E',
};
const _zD = {
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
function _gRZ(sido, sgg) {
sido = sido.trim(); sgg = sgg.trim();
const a = _zD.투기지역[sido]||[];
if (a.some(g=>sgg.includes(g))) return { zone:'A', label:'투기지역' };
const b = _zD.투기과열지구[sido]||[];
if (b.some(g=>sgg.includes(g))) return { zone:'B', label:'투기과열지구' };
return { zone: null, label: '' };
}
function _gLL(priceRaw, regZone, midRaw) {
if (!priceRaw||priceRaw<=0) return null;
const _iR = regZone==='A'||regZone==='B';
const _lR = _iR ? 0.40 : 0.70;
const _lP = _iR ? 40 : 70;
const _lA = Math.floor(priceRaw * _lR / 1000) * 1000;
const ref = midRaw||priceRaw;
let _pL;
if (ref<=150000) _pL = 60000; // 15억 이하 → 6억
else if (ref<=250000) _pL = 40000; // 25억 이하 → 4억
else _pL = 20000; // 25억 초과 → 2억
const _fA = Math.min(_lA, _pL);
const _iLL = _fA===_lA; // true = LTV가 제한 요인
const eok = _fA / 10000;
const amtStr = Number.isInteger(eok) ? eok + '억' : eok.toFixed(1) + '억';
let cls;
if (_iLL) {
cls = _iR ? 'loan-ltv-reg' : 'loan-ltv-gen';
} else {
if (_pL===60000) cls = 'loan-pol-a';
else if (_pL===40000) cls = 'loan-pol-b';
else cls = 'loan-pol-c';
}
return { amtStr, _lP, _iLL, cls };
}
document.addEventListener('DOMContentLoaded', ()=>{
const vEl = document.getElementById('splashVersion');
if (vEl) vEl.textContent = _V;
if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('sw.js').catch(()=>{});
}
document.getElementById('hardRefreshBtn').addEventListener('click', async ()=>{
document.querySelector('#hardRefreshBtn span').textContent = '업데이트 중...';
try {
if ('serviceWorker' in navigator) {
const regs = await navigator.serviceWorker.getRegistrations();
await Promise.all(regs.map(r=>r.unregister()));
}
if ('caches' in window) {
const names = await caches.keys();
await Promise.all(names.map(n=>caches.delete(n)));
}
const savedCurr = localStorage.getItem(_cC);
const savedPrev = localStorage.getItem(_cP);
localStorage.clear();
if (savedCurr) localStorage.setItem(_cC, savedCurr);
if (savedPrev) localStorage.setItem(_cP, savedPrev);
sessionStorage.clear();
} finally { window.location.reload(true); }
});
document.getElementById('listBody').addEventListener('click', (e)=>{
const btn = e.target.closest('.accordion-btn');
if (!btn) return;
const item = btn.parentElement;
const wasActive = item.classList.contains('active');
document.querySelectorAll('.group-item.active').forEach(el=>{
if (el!==item) el.classList.remove('active');
});
item.classList.toggle('active', !wasActive);
if (!wasActive) {
setTimeout(()=>{
const hdr = document.querySelector('.sticky-header');
const hBottom = hdr ? hdr.getBoundingClientRect().bottom : 120;
const rect = item.getBoundingClientRect();
if (rect.top < hBottom + 10) {
window.scrollTo({ top: window.scrollY + rect.top - hBottom - 10, behavior: 'smooth' });
}
}, 320);
}
});
document.getElementById('searchInput').addEventListener('input', ()=>{
clearTimeout(_sDT);
_sDT = setTimeout(_aF, 250);
});
document.getElementById('sortSelect').addEventListener('change', (e)=>{
_aS = e.target.value;
_aF();
});
document.getElementById('unitToggleBtn').addEventListener('click', ()=>{
_aU = _aU==='sqm' ? 'pyeong' : 'sqm';
document.body.classList.toggle('pyeong-mode', _aU==='pyeong');
const btn = document.getElementById('unitToggleBtn');
btn.querySelector('.u-label-sqm').classList.toggle('active', _aU==='sqm');
btn.querySelector('.u-label-pyeong').classList.toggle('active', _aU==='pyeong');
});
_sSO();
_sSTB();
_lD();
});
function _sSP() {
const el = document.querySelector('.sticky-header');
if (!el) return;
document.documentElement.style.setProperty('scroll-padding-top', (el.offsetHeight + 10) + 'px');
}
window.addEventListener('resize', _sSP, { passive: true });
function _hS() {
const el = document.getElementById('splashOverlay');
if (el) el.classList.add('hide');
}
function _sSE(msg) {
const el = document.getElementById('splashOverlay');
if (!el) return;
el.innerHTML = `
<div class="splash-error">
<span style="font-size:2rem">⚠️</span>
<p>${msg||'데이터를 불러올 수 없습니다.'}</p>
<small>새로고침 버튼을 눌러 다시 시도하세요.</small>
<button onclick="window.location.reload(true)" class="refresh-btn" style="margin-top:16px">
<span>다시 시도</span>
</button>
<small style="margin-top:8px;opacity:0.5">${_V}</small>
</div>`;
}
function _lD() {
console.log('[_lD] 시작', _V);
const safetyTimer = setTimeout(()=>{
console.warn('[_lD] 5초 안전망 발동');
_hS();
}, 5000);
const done = (ok)=>{
clearTimeout(safetyTimer);
if (ok) _hS();
};
fetch('excel/map.csv', {
cache: 'no-store',
headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache, no-store' }
})
.then(res=>{
if (!res.ok) throw new Error('HTTP ' + res.status);
return res.arrayBuffer();
})
.then(buf=>{
console.log('[_lD] CSV 수신 완료', buf.byteLength, 'bytes');
let csv;
try {
csv = new TextDecoder('euc-kr').decode(buf);
} catch (e) {
console.warn('[_lD] euc-kr 디코딩 실패, utf-8 재시도');
csv = new TextDecoder('utf-8').decode(buf);
}
_pAR(csv);
done(true);
})
.catch(err=>{
console.error('[_lD] 오류:', err);
done(false);
_sSE('CSV 파일을 불러올 수 없습니다. (' + err.message + ')');
});
}
function _pCL(line) {
const fields = [];
let field = '';
let inQ = false;
for (let i = 0; i < line.length; i++) {
const ch = line[i];
if (ch==='"') {
if (inQ&&line[i + 1]==='"') { field += '"'; i++; }
else inQ = !inQ;
} else if (ch===','&&!inQ) {
fields.push(field.trim()); field = '';
} else {
field += ch;
}
}
fields.push(field.trim());
return fields;
}
const _cC = 'apt_map_curr';
const _cP = 'apt_map_prev';
function _bPK(row) {
return `${row.시도}|${row.시군구}|${row.동}|${row.아파트}|${row.공급면적}|${row.전용면적}|${row.suffix}`;
}
function _rC(key) {
try {
const raw = localStorage.getItem(key);
return raw ? JSON.parse(raw) : null;
} catch { return null; }
}
function _wC(key, data) {
try {
localStorage.setItem(key, JSON.stringify(data));
} catch (e) {
console.warn('[priceCache] 저장 실패:', e.message);
}
}
function _bCP(dateText, _fD) {
const p = {};
for (const row of _fD) {
p[_bPK(row)] = [row.하한가Raw, row.일반가Raw, row.상한가Raw];
}
return { dateText, p };
}
function _sPC(_bDT, _fD) {
const curr = _rC(_cC);
if (curr&&curr.dateText===_bDT) {
const prev = _rC(_cP);
console.log('[priceCache] 같은 주 재로드 → diff 유지', prev ? prev.dateText : '(없음)');
return prev; // prev가 비교 기준
}
if (curr) {
_wC(_cP, curr);
console.log('[priceCache] curr→prev 승격:', curr.dateText);
}
_wC(_cC, _bCP(_bDT, _fD));
console.log('[priceCache] 새 curr 저장:', _bDT);
return curr; // 비교 기준 = 방금 승격된 구 curr (없으면 null)
}
function _pAR(csv) {
console.log('[_pAR] 시작');
const t0 = Date.now();
const lines = csv.split(/\r\n|\n/);
let _bDT = '';
for (let i = 0; i < Math.min(15, lines.length); i++) {
const regex = /(20\d{2})[-.년\s]+([0-1]?\d)[-.월\s]+([0-3]?\d)일?/g;
const dates = [];
let m;
while ((m = regex.exec(lines[i]))!==null) {
dates.push(`${m[1]}.${m[2].padStart(2,'0')}.${m[3].padStart(2,'0')}`);
}
if (dates.length>=2) { _bDT = `${dates[0]} ~ ${dates[1]}`; break; }
if (dates.length===1) { _bDT = dates[0]; break; }
}
const dateLabel = document.getElementById('baseDateLabel');
if (dateLabel) {
if (_bDT) dateLabel.textContent = '기준일 ' + _bDT;
else dateLabel.style.display = 'none';
}
const SKIP = [
'전국은행연합회','조견표','절대 수정 금지','대출상담사',
'시도,시군구','시/도','공급면적','하한가',
];
const toNum = v=>parseFloat(String(v).replace(/,/g, ''));
const toPrice = v=>{ const n = toNum(v); return (isNaN(n)||n===0) ? '-' : n.toLocaleString('ko-KR'); };
const toRaw = v=>{ const n = toNum(v); return isNaN(n) ? 0 : n; };
const toArea = v=>{ const n = toNum(v); if(isNaN(n)) return String(v); return n%1===0 ? String(n) : n.toFixed(2).replace(/\.?0+$/,''); };
const toPyeong = (sqm, p)=>{
if (p) { const n=toNum(p); if(!isNaN(n)&&n>0) return n+'평'; }
const n = toNum(sqm);
return isNaN(n) ? '-' : (n/3.3058).toFixed(1)+'평';
};
const getSuffix = v=>{
const raw = String(v).trim().replace(/^[\d.,]+/,'');
if (!raw) return '';
if (/[가-힣]/.test(raw)) return raw.slice(0,6);
const u = raw.toUpperCase();
return _sM[u]||raw.slice(0,6);
};
const _fD = [];
for (let i = 0; i < lines.length; i++) {
const line = lines[i].trim();
if (!line) continue;
if (SKIP.some(k=>line.includes(k))) continue;
const col = _pCL(line);
if (col.length < 11||!col[0]) continue;
if (col[3]==='아파트'||col[3]==='단지명') continue;
const sido = col[0].trim(), sgg = col[1].trim(), dong = col[2].trim(), apt = col[3].trim();
if (!apt||!sido) continue;
_fD.push({
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
diffLow: null, diffMid: null, diffHigh: null,
});
}
const compCache = _sPC(_bDT, _fD);
if (compCache) {
const pm = compCache.p;
for (const row of _fD) {
const prev = pm[_bPK(row)];
if (prev) {
row.diffLow = row.하한가Raw - prev[0];
row.diffMid = row.일반가Raw - prev[1];
row.diffHigh = row.상한가Raw - prev[2];
}
}
}
const map = new Map();
for (const row of _fD) {
const key = `${row.시도}|${row.시군구}|${row.동}|${row.아파트}`;
if (!map.has(key)) {
const reg = _gRZ(row.시도, row.시군구);
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
_aG = Array.from(map.values()).map(g=>{
if (g.minPrice===Infinity) g.minPrice = 0;
g.searchKey = `${g.지역} ${g.아파트}`.toLowerCase();
return g;
});
const regions = ['전체', ...new Set(_aG.map(g=>g.시도).sort())];
_bRC(regions);
requestAnimationFrame(_sSP);
_fG = _aG;
const t1 = Date.now();
console.log(`[_pAR] 완료: ${_aG.length}단지, ${t1-t0}ms`);
_rI();
}
function _bRC(regions) {
const wrap = document.getElementById('regionFilter');
if (!wrap) return;
wrap.innerHTML = regions.map(r =>
`<button class="region-chip${r==='전체'?' active':''}" data-region="${r}">${r}</button>`
).join('');
wrap.addEventListener('click', (e)=>{
const chip = e.target.closest('.region-chip');
if (!chip) return;
_aR = chip.dataset.region;
wrap.querySelectorAll('.region-chip').forEach(c=>c.classList.toggle('active', c===chip));
_aF();
});
}
function _aF() {
const raw = document.getElementById('searchInput').value.trim().toLowerCase();
const terms = raw ? raw.split(/\s+/) : [];
let result = _aG;
if (_aR!=='전체') result = result.filter(g=>g.시도===_aR);
if (terms.length > 0) result = result.filter(g=>terms.every(t=>g.searchKey.includes(t)));
switch (_aS) {
case 'name': result = [...result].sort((a,b)=>a.아파트.localeCompare(b.아파트,'ko')); break;
case 'price_asc': result = [...result].sort((a,b)=>(a.minPrice||Infinity)-(b.minPrice||Infinity)); break;
case 'price_desc':result = [...result].sort((a,b)=>b.maxPrice-a.maxPrice); break;
}
_fG = result;
_rI();
}
function _gPR(g) {
if (!g.minPrice&&!g.maxPrice) return '';
if (g.minPrice===g.maxPrice) return g.minPrice.toLocaleString('ko-KR')+'만';
return `${g.minPrice.toLocaleString('ko-KR')} ~ ${g.maxPrice.toLocaleString('ko-KR')}만`;
}
function _dB(diff) {
if (diff===null||diff===undefined||diff===0) return '';
const abs = Math.abs(diff).toLocaleString('ko-KR');
return diff > 0
? `<span class="price-diff up">🔺${abs}</span>`
: `<span class="price-diff down">🔽${abs}</span>`;
}
function _cGH(g) {
const priceRange = _gPR(g);
const regBadge = g.regLabel
? `<div class="reg-badges"><span class="reg-badge reg-${g.regZone}">${g.regLabel}</span></div>`
: '';
const midDiffs = g.rows.map(r=>r.diffMid).filter(d=>d!==null&&d!==0);
let groupDiffBadge = '';
if (midDiffs.length > 0) {
const maxUp = Math.max(...midDiffs.filter(d=>d > 0), 0);
const maxDown = Math.min(...midDiffs.filter(d=>d < 0), 0);
if (maxUp > 0&&maxDown < 0) {
groupDiffBadge = `<span class="group-diff-badge mixed">🔺🔽 등락</span>`;
} else if (maxUp > 0) {
groupDiffBadge = `<span class="group-diff-badge up">🔺${maxUp.toLocaleString('ko-KR')}</span>`;
} else if (maxDown < 0) {
groupDiffBadge = `<span class="group-diff-badge down">🔽${Math.abs(maxDown).toLocaleString('ko-KR')}</span>`;
}
}
let rowsHTML = '';
for (const row of g.rows) {
const sb = row.suffix ? `<span class="area-suffix">${row.suffix}</span>` : '';
const loanLow = _gLL(row.하한가Raw, g.regZone, row.일반가Raw);
const loanLowBadge = loanLow
? `<span class="loan-badge ${loanLow.cls}">
<em class="loan-floor"></em>대출 ${loanLow.amtStr}
</span>`
: '';
//<em class="loan-ltv-rate">LTV${loanLow._lP}%</em>  
const loanMid = _gLL(row.일반가Raw, g.regZone, row.일반가Raw);
const loanMidBadge = loanMid
? `<span class="loan-badge ${loanMid.cls}">
대출 ${loanMid.amtStr}
</span>`
: '';
//<em class="loan-ltv-rate">LTV${loanMid._lP}%</em>
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
${_dB(row.diffLow)}
${loanLowBadge}
</div>
<div class="price-box mid">
<span class="price-label">일반가</span>
<span class="price-val">${row.일반가}</span>
${_dB(row.diffMid)}
${loanMidBadge}
</div>
<div class="price-box high">
<span class="price-label">상한가</span>
<span class="price-val">${row.상한가}</span>
${_dB(row.diffHigh)}
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
function _rI() {
const listBody = document.getElementById('listBody');
const sentinel = document.getElementById('scrollSentinel');
const countEl = document.getElementById('resultCount');
listBody.innerHTML = '';
_lC = 0;
const total = _fG.length;
const isFiltered = _aR!=='전체'||document.getElementById('searchInput').value.trim()!=='';
if (countEl) {
countEl.textContent = isFiltered
? `${total.toLocaleString()}개 단지`
: `전체 ${_aG.length.toLocaleString()}개 단지`;
}
if (total===0) {
listBody.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><p>조건에 맞는 시세 정보가 없습니다.</p><small>검색어 또는 지역 필터를 변경해보세요.</small></div>`;
sentinel.style.display = 'none';
return;
}
_lM();
window.scrollTo({ top: 0, behavior: 'smooth' });
}
function _lM() {
const listBody = document.getElementById('listBody');
const sentinel = document.getElementById('scrollSentinel');
const next = Math.min(_lC + _lS, _fG.length);
const slice = _fG.slice(_lC, next);
if (slice.length > 0) listBody.insertAdjacentHTML('beforeend', slice.map(_cGH).join(''));
_lC = next;
sentinel.style.display = _lC>=_fG.length ? 'none' : 'block';
}
function _sSO() {
const sentinel = document.getElementById('scrollSentinel');
_sO = new IntersectionObserver(
entries=>{ if (entries[0].isIntersecting) _lM(); },
{ rootMargin: '300px' }
);
if (sentinel) _sO.observe(sentinel);
}
const _sTT = 300;
function _sSTB() {
const btn = document.getElementById('scrollTopBtn');
if (!btn) return;
window.addEventListener('scroll', ()=>{
if (window.scrollY > _sTT) {
btn.classList.add('visible');
} else {
btn.classList.remove('visible');
}
}, { passive: true });
btn.addEventListener('click', ()=>{
window.scrollTo({ top: 0, behavior: 'smooth' });
});
}
