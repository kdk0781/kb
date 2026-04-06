const _V = 'v9.0';
const _SEM = {
icon: '🔒',
title: '링크가 만료되었습니다',
desc: '접속량이 많아 유효한 페이지가 아닙니다.',
sub: '담당자분께 링크를 다시 요청하세요.',
};
const _SS = 'kdk_apt_2026_!@#'; // ← 원하는 값으로 변경
const _SP = 'k';
const _SCT = (url) =>
`[KB 아파트 시세표]
아래 링크를 클릭하면 주간 시세를 확인하실 수 있습니다.
실시간 수도권지역 시세를 확인하실 수 있습니다.
${url}`;
function _sE(payload) {
const key = _SS;
const bytes = Array.from(new TextEncoder().encode(JSON.stringify(payload)));
const enc = bytes.map((b, i)=>b ^ key.charCodeAt(i % key.length));
return btoa(String.fromCharCode(...enc))
.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function _sD(token) {
const key = _SS;
const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
const bytes = Array.from(atob(b64), c=>c.charCodeAt(0));
const dec = bytes.map((b, i)=>b ^ key.charCodeAt(i % key.length));
return JSON.parse(new TextDecoder().decode(new Uint8Array(dec)));
}
function _cSL() {
const SS_TOKEN = '_shr_t';
const SS_URL = '_shr_u';
const SS_BLOCKED = '_shr_blocked';
try {
if (sessionStorage.getItem(SS_BLOCKED)) {
_sEAB();
return false;
}
} catch (_) {}
let token = null;
let origUrl = null;
let fromUrl = false;
const urlToken = new URLSearchParams(location.search).get(_SP);
if (urlToken) {
token = urlToken;
origUrl = location.href;
fromUrl = true;
} else {
try {
token = sessionStorage.getItem(SS_TOKEN);
origUrl = sessionStorage.getItem(SS_URL);
} catch (_) {}
}
if (!token) return true; // 공유 링크 아님 → 정상 실행
let isValid = false;
try {
const { exp } = _sD(token);
isValid = Date.now() < exp;
} catch (_) {}
if (isValid) {
if (fromUrl) {
try { history.replaceState(null, '', location.pathname); } catch (_) {}
try {
sessionStorage.setItem(SS_TOKEN, token);
sessionStorage.setItem(SS_URL, origUrl);
} catch (_) {}
}
window.addEventListener('beforeinstallprompt', e=>{
e.preventDefault();
e.stopImmediatePropagation();
}, { capture: true });
window._shareOrigUrl = origUrl;
return true;
}
try {
sessionStorage.removeItem(SS_TOKEN);
sessionStorage.removeItem(SS_URL);
sessionStorage.setItem(SS_BLOCKED, '1');
} catch (_) {}
_sEAB();
return false;
}
function _sEAB() {
document.addEventListener('DOMContentLoaded', ()=>{
const splash = document.getElementById('splashOverlay');
if (!splash) return;
splash.style.opacity = '1';
splash.style.visibility = 'visible';
splash.innerHTML = `
<div class="share-expired-page">
<div class="sep-icon">${_SEM.icon}</div>
<h2 class="sep-title">${_SEM.title}</h2>
<p class="sep-desc">${_SEM.desc}</p>
<p class="sep-sub">${_SEM.sub}</p>
</div>`;
});
}
const _sV = _cSL();
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
const isReg = regZone==='A'||regZone==='B';
const ltvRate = isReg ? 0.40 : 0.70;
const ltvPct = isReg ? 40 : 70;
const ltvAmt = Math.floor(priceRaw * ltvRate / 100) * 100;
const ref = midRaw||priceRaw;
let policyLimit;
if (ref<=150000) policyLimit = 60000;
else if (ref<=250000) policyLimit = 40000;
else policyLimit = 20000;
const finalAmt = Math.min(ltvAmt, policyLimit);
const isLtvLimit = finalAmt===ltvAmt&&ltvAmt < policyLimit;
function fmtAmt(man) {
const eok = Math.floor(man / 10000);
const rest = man % 10000;
if (eok > 0&&rest > 0)
return `${eok}억 ${rest.toLocaleString('ko-KR')}만`;
if (eok > 0)
return `${eok}억`;
return `${rest.toLocaleString('ko-KR')}만`;
}
const amtStr = fmtAmt(finalAmt);
let cls;
if (isLtvLimit) {
cls = isReg ? 'loan-ltv-reg' : 'loan-ltv-gen';
} else {
if (policyLimit===60000) cls = 'loan-pol-a';
else if (policyLimit===40000) cls = 'loan-pol-b';
else cls = 'loan-pol-c';
}
return { amtStr, ltvPct, isLtvLimit, cls };
}
document.addEventListener('DOMContentLoaded', ()=>{
if (!_sV) return; // 만료 링크면 앱 초기화 중단
const vEl = document.getElementById('splashVersion');
if (vEl) vEl.textContent = _V;
const _isShared = !!new URLSearchParams(location.search).get(_SP)
|| !!window._shareOrigUrl;
if ('serviceWorker' in navigator&&!_isShared) {
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
_sSB();
if (window._showSharePreview) {
showSharePreview();
return; // _lD는 startApp()에서 호출
}
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
if (diff===null||diff===undefined||diff===0)
return `<span class="price-diff none">-</span>`;
const abs = Math.abs(diff).toLocaleString('ko-KR');
return diff > 0
? `<span class="price-diff up">🔺${abs}</span>`
: `<span class="price-diff down">🔽${abs}</span>`;
}
function _cGH(g) {
const priceRange = _gPR(g);
const ltvPct = (g.regZone==='A'||g.regZone==='B') ? 40 : 70;
const ltvChip = `<span class="ltv-chip ltv-${ltvPct}">LTV ${ltvPct}%</span>`;
const regBadge = g.regLabel
? `<div class="reg-badges">
<span class="reg-badge reg-${g.regZone}">${g.regLabel}</span>
${ltvChip}
</div>`
: `<div class="reg-badges">${ltvChip}</div>`;
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
? `<span class="loan-badge ${loanLow.cls}">대출 ${loanLow.amtStr}</span>`
: '';
const loanMid = _gLL(row.일반가Raw, g.regZone, row.일반가Raw);
const loanMidBadge = loanMid
? `<span class="loan-badge ${loanMid.cls}">대출 ${loanMid.amtStr}</span>`
: '';
const loanRowHTML = (loanLow||loanMid) ? `
<div class="loan-info-row">
<span class="loan-info-label">대출 가능액 :</span>
<div class="loan-tags">
${loanLow ? `<span class="loan-tag ${loanLow.cls}"><em class="loan-tag-label">1층</em>${loanLow.amtStr}</span>` : ''}
${loanMid ? `<span class="loan-tag ${loanMid.cls}"><em class="loan-tag-label">일반</em>${loanMid.amtStr}</span>` : ''}
</div>
</div>` : '';
rowsHTML += `
<div class="inner-row">
<div class="inner-main">
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
</div>
<div class="price-box mid">
<span class="price-label">일반가</span>
<span class="price-val">${row.일반가}</span>
${_dB(row.diffMid)}
</div>
<div class="price-box high">
<span class="price-label">상한가</span>
<span class="price-val">${row.상한가}</span>
${_dB(row.diffHigh)}
</div>
</div>
</div>
${loanRowHTML}
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
function _sSB() {
const openBtn = document.getElementById('shareBtnOpen');
const modal = document.getElementById('shareModal');
const closeBtn = document.getElementById('shareCloseBtn');
const genBtn = document.getElementById('shareGenBtn');
const copyBtn = document.getElementById('shareCopyBtn');
const linkInput = document.getElementById('shareLinkInput');
const resultBox = document.getElementById('shareResultBox');
const copyMsg = document.getElementById('shareCopyMsg');
if (!openBtn) return;
const _eT = !!window._shareOrigUrl; // _cSL() 에서 설정
if (_eT) {
openBtn.addEventListener('click', async ()=>{
const originalUrl = window._shareOrigUrl||location.href;
try {
await navigator.clipboard.writeText(originalUrl);
} catch (_) {
const tmp = document.createElement('textarea');
tmp.value = originalUrl;
document.body.appendChild(tmp);
tmp.select(); document.execCommand('copy');
document.body.removeChild(tmp);
}
const span = openBtn.querySelector('span');
const orig = span ? span.textContent : '';
if (span) span.textContent = '복사됨!';
openBtn.style.background = 'var(--primary-color)';
openBtn.style.color = '#1a1f24';
setTimeout(()=>{
if (span) span.textContent = orig;
openBtn.style.background = '';
openBtn.style.color = '';
}, 2000);
});
return;
}
openBtn.addEventListener('click', ()=>{
modal.classList.add('open');
resultBox.style.display = 'none';
copyMsg.style.display = 'none';
});
closeBtn.addEventListener('click', ()=>modal.classList.remove('open'));
modal.addEventListener('click', e=>{
if (e.target===modal) modal.classList.remove('open');
});
genBtn.addEventListener('click', async ()=>{
const dur = Math.max(1, parseInt(document.getElementById('shareDuration').value)||1);
const unit = parseInt(document.getElementById('shareUnit').value);
const exp = Date.now() + dur * unit;
const token = _sE({ exp });
const baseUrl = new URL(location.href);
baseUrl.search = '?' + _SP + '=' + token;
baseUrl.hash = '';
const longUrl = baseUrl.toString();
resultBox.style.display = 'flex';
copyMsg.style.display = 'none';
linkInput.value = '링크 생성 중...';
copyBtn.disabled = true;
const d = new Date(exp);
document.getElementById('shareExpLabel').textContent =
'만료: ' + d.toLocaleDateString('ko-KR') + ' ' +
d.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' });
let finalUrl = longUrl;
try {
const res = await fetch(
'https://tinyurl.com/api-create.php?url=' + encodeURIComponent(longUrl)
);
const tiny = await res.text();
if (tiny.startsWith('http')) finalUrl = tiny;
} catch (_) { }
const msgText = _SCT(finalUrl);
linkInput.value = msgText; // textarea에 전체 메시지 표시
copyBtn.disabled = false;
window._shareOrigUrl = finalUrl; // 수신자 재공유용
});
copyBtn.addEventListener('click', async ()=>{
const text = linkInput.value;
try {
await navigator.clipboard.writeText(text);
} catch (_) {
linkInput.select();
document.execCommand('copy');
}
copyMsg.style.display = 'block';
setTimeout(()=>{ copyMsg.style.display = 'none'; }, 2500);
});
}
const PREVIEW_SEC = 10;
function showSharePreview() {
const splash = document.getElementById('splashOverlay');
if (!splash) { startApp(); return; }
splash.classList.remove('hide');
splash.style.opacity = '1';
splash.style.visibility = 'visible';
splash.innerHTML = `
<div class="share-preview-page">
<p class="spp-badge">임시 공유 링크</p>
<div class="spp-icon">📊</div>
<h2 class="spp-title">아파트 시세표</h2>
<p class="spp-desc">
Preview를 클릭하거나<br>
<span id="shareCountdown">${PREVIEW_SEC}</span>초 뒤 페이지가<br>
자동으로 이동됩니다.
</p>
<button id="sharePreviewBtn" class="spp-btn">Preview →</button>
<p class="spp-notice">⏱ 유효 기간이 있는 임시 링크입니다</p>
</div>`;
let started = false;
const go = ()=>{
if (started) return;
started = true;
clearInterval(timer);
startApp();
};
let count = PREVIEW_SEC;
const timer = setInterval(()=>{
count--;
const el = document.getElementById('shareCountdown');
if (el) el.textContent = count;
if (count<=0) go();
}, 1000);
document.getElementById('sharePreviewBtn')
.addEventListener('click', go, { once: true });
}
function startApp() {
_hS();
_lD();
}
