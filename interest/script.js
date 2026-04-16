/* ======================================================
   KB 금리표 · script.js  v0781_5
   ====================================================== */

/* ======================================================
   0. 앱 버전 — sw.js의 VERSION과 반드시 동일하게 유지
      배포 시 두 파일 모두 같이 올릴 것
      버전이 바뀌면 → 이번 주 공지 닫기 설정이 초기화됨
   ====================================================== */
const APP_VERSION = 'kb-interest-v6';

/* ======================================================
   1. 금리 데이터
   ====================================================== */
const r = {
    base: {
        mor5:    3.82,
        mor2:    3.47,
        ncofix:  2.81,
        scofix:  2.45,
        primeOn: 1.10,
        primeOff:0.90
    },
    stress: {
        m5_cycle: 1.15,
        m5_mix:   1.50,
        v_6_12:   2.87
    },
    add: {
        mort: { m5: 2.20, n6: 2.57, n12: 2.53, s6: 2.91, s12: 3.04 },
        hf:   { m2: 2.07, n6: 2.33, n12: 2.43, s6: 2.58, s12: 2.96 },
        hug:  { m2: 2.13, n6: 2.36, n12: 2.33, s6: 2.61, s12: 2.86 },
        sgi:  { m2: 2.44, n6: 2.45, n12: 2.56, s6: 2.90, s12: 3.02 }
    }
};

/** 기준 + 가산 - 우대 */
const calc = (b, a, p) => parseFloat((b + a - p).toFixed(2));

/* ======================================================
   2. 상단 서머리 바
   ====================================================== */
function renderSummary() {
    const ga = r.add.mort;

    const varRates = [
        calc(r.base.ncofix, ga.n6,  r.base.primeOn),
        calc(r.base.ncofix, ga.n12, r.base.primeOn),
        calc(r.base.scofix, ga.s6,  r.base.primeOn),
        calc(r.base.scofix, ga.s12, r.base.primeOn)
    ];
    const minVar = Math.min(...varRates);

    const items = [
        // 시장 지표
        { l: '금융채5Y',    v: r.base.mor5   },
        { l: '신규COFIX',   v: r.base.ncofix },
        { l: '신잔액',      v: r.base.scofix },
        // 스트레스 가산율 (노란색)
        { l: 'ST가산(5Y주기)',  v: r.stress.m5_cycle, stBase: true },
        { l: 'ST가산(5Y혼합)',  v: r.stress.m5_mix,   stBase: true },
        { l: 'ST가산(변동형)',  v: r.stress.v_6_12,   stBase: true },
        // 스트레스 최종 실행 금리 (빨간색)
        { l: 'ST 주기형(5Y)', v: calc(r.base.mor5, ga.m5 + r.stress.m5_cycle, r.base.primeOn), s: true },
        { l: 'ST 혼합형(5Y)', v: calc(r.base.mor5, ga.m5 + r.stress.m5_mix,   r.base.primeOn), s: true },
        { l: 'ST 변동형(최저)', v: parseFloat((minVar + r.stress.v_6_12).toFixed(2)),           s: true }
    ];

    document.getElementById('top-summary').innerHTML = items.map(i => {
        const cls   = i.s ? 'stress-item' : i.stBase ? 'st-base-item' : '';
        const unit  = i.stBase ? '%p' : '%';
        return `<div class="summary-item ${cls}">${i.l}<span>${i.v.toFixed(2)}${unit}</span></div>`;
    }).join('');
}

/* ======================================================
   3. 메인 카드 렌더링
   ====================================================== */
function renderContent() {
    const groups = [
        {
            title: '주택담보대출',
            desc: '부동산 담보 대출 · 잔금일 기준(포함) <strong>50일 전</strong>부터 접수',
            warn: true,
            id: 'mort'
        },
        {
            title: '전세 (HF 주택금융공사)',
            desc: '공사 보증 전세자금대출 · 잔금일 기준(포함) <strong>50일 전</strong>부터 접수',
            warn: true,
            id: 'hf'
        },
        {
            title: '전세 (HUG 주택도시보증)',
            desc: '안심전세 보증금 반환보증 · 잔금일 기준(포함) <strong>30일 전</strong>부터 접수',
            warn: true,
            id: 'hug'
        },
        {
            title: '전세 (SGI 서울보증보험)',
            desc: '고액 전세자금 SGI 보증 · 잔금일 기준(포함) <strong>45일 전</strong>부터 접수',
            warn: true,
            id: 'sgi'
        }
    ];

    let html = '';

    groups.forEach(g => {
        const ga = r.add[g.id];
        const isMort = g.id === 'mort';

        const items = [
            {
                n: isMort ? '금융채 5년 (혼합형)' : '금융채 2년 (고정형)',
                c: isMort ? '5년 고정' : '2년 고정',
                b: isMort ? r.base.mor5 : r.base.mor2,
                a: ga.m2 || ga.m5
            },
            ...(isMort ? [{ n: '금융채 5년 (변동형)', c: '5년 변동', b: r.base.mor5, a: ga.m5 }] : []),
            { n: '신규 코픽스 6개월',   c: '6개월 변동',  b: r.base.ncofix, a: ga.n6  },
            { n: '신규 코픽스 12개월',  c: '12개월 변동', b: r.base.ncofix, a: ga.n12 },
            { n: '신잔액 코픽스 6개월', c: '6개월 변동',  b: r.base.scofix, a: ga.s6  },
            { n: '신잔액 코픽스 12개월',c: '12개월 변동', b: r.base.scofix, a: ga.s12 }
        ];

        const rates = items.map(i => calc(i.b, i.a, r.base.primeOn));
        const minVal = Math.min(...rates);

        html += `
        <section class="group-wrapper">
            <div class="section-header">
                <h3>${g.title}</h3>
                <p>${g.desc}</p>
                ${g.warn ? `<p class="cache-warn">⚠️ 이전 금리가 표시되면 우측 하단 새로고침 버튼을 눌러주세요</p>` : ''}
            </div>
            <div class="card-list">
        `;

        items.forEach((i, idx) => {
            const onVal  = rates[idx];
            const offVal = calc(i.b, i.a, r.base.primeOff);
            const isBest = onVal === minVal;

            html += `
            <article class="rate-card ${isBest ? 'best-rate' : ''}">
                ${isBest ? '<div class="best-label">BEST</div>' : ''}
                <div class="card-top">
                    <span class="product-name">${i.n}</span>
                    <span class="cycle-tag">${i.c}</span>
                </div>
                <div class="price-grid">
                    <div class="price-box ${isBest ? 'target' : ''}">
                        <span class="label">전자계약 O</span>
                        <span class="value">${onVal.toFixed(2)}<small>%</small></span>
                        <span class="formula">${i.b} + ${i.a} − 1.10</span>
                    </div>
                    <div class="price-box">
                        <span class="label">전자계약 X</span>
                        <span class="value">${offVal.toFixed(2)}<small>%</small></span>
                        <span class="formula">${i.b} + ${i.a} − 0.90</span>
                    </div>
                </div>
            </article>`;
        });

        html += `</div></section>`;
    });

    document.getElementById('main-content').innerHTML = html;
}

/* ======================================================
   4. 실시간 시계
   ====================================================== */
function startClock() {
    const el = document.getElementById('clock');
    if (!el) return;

    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
        const d = new Date();
        el.textContent =
            `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ` +
            `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    tick();
    setInterval(tick, 1000);
}

/* ======================================================
   5. 강력 새로고침 (캐시 완전 삭제 + 강제 리로드)
   ====================================================== */
async function refreshData() {
    const overlay = document.getElementById('loading-overlay');
    const fabBtn  = document.getElementById('fab-refresh');
    const navBtn  = document.getElementById('nav-refresh');

    // ── 버튼 회전 시작
    [fabBtn, navBtn].forEach(btn => {
        if (!btn) return;
        btn.classList.add('spinning');
        btn.disabled = true;
    });

    // ── 로딩 오버레이 표시
    if (overlay) overlay.classList.add('visible');

    // ── 단계 1: 서비스 워커 업데이트 + 캐시 삭제
    setStep(1);
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.update()));
        }
    } catch (e) { console.warn('SW update:', e); }

    // ── 단계 2: Cache Storage 전체 삭제
    setStep(2);
    try {
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
        }
    } catch (e) { console.warn('Cache clear:', e); }

    // sessionStorage / localStorage 캐시 키 정리
    try {
        sessionStorage.clear();
        // notice key는 유지 (사용자 설정이므로)
    } catch (e) { /* ignore */ }

    // ── 단계 3: 강제 리로드
    setStep(3);
    await sleep(600);

    // index.html 없는 클린 URL 생성
    var cleanPath = window.location.pathname
        .replace(/\/index\.html$/, '/');  // index.html 제거
    // 끝이 /로 끝나지 않으면 붙임 (디렉토리 URL 보장)
    if (!cleanPath.endsWith('/')) cleanPath += '/';

    const newUrl = window.location.origin + cleanPath + '?v=' + Date.now();
    window.location.replace(newUrl);
}

function setStep(n) {
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`ls${i}`);
        if (!el) continue;
        el.className = 'loading-step' + (i < n ? ' done' : i === n ? ' active' : '');
    }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

/* ======================================================
   6. 공지사항 팝업
   ====================================================== */
const NOTICE_KEY   = 'kb_notice_next_monday';
const VERSION_KEY  = 'kb_notice_version';   // 마지막으로 공지를 본 버전 저장

function showNotice() {
    const overlay = document.getElementById('notice-overlay');
    if (!overlay) return;

    const stored        = localStorage.getItem(NOTICE_KEY);
    const lastSeenVer   = localStorage.getItem(VERSION_KEY);

    // ── 버전이 바뀌었으면 → 닫기 설정 무조건 초기화하고 공지 표시
    if (lastSeenVer !== APP_VERSION) {
        localStorage.removeItem(NOTICE_KEY);
        localStorage.setItem(VERSION_KEY, APP_VERSION);
        console.log(`공지: 새 버전(${APP_VERSION}) 감지 → 공지 초기화`);
        // 공지 표시로 진행
    } else {
        // ── 같은 버전이면 주간 닫기 설정 존중
        if (stored && isSameWeek(new Date(), new Date(parseInt(stored)))) {
            console.log('공지: 이번 주 닫기 유지');
            return;
        }
        localStorage.removeItem(NOTICE_KEY);
    }

    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
}

function isSameWeek(a, b) {
    const mondayOf = d => {
        const day = d.getDay() || 7; // 일요일=7
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 1);
    };
    return mondayOf(a).getTime() === mondayOf(b).getTime();
}

function closeNoticeTemporarily() {
    localStorage.setItem(NOTICE_KEY, Date.now().toString());
    hideNotice();
}

function closeNoticeNextWeek() {
    closeNoticeTemporarily();
}

function hideNotice() {
    const overlay = document.getElementById('notice-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
}

/* 오버레이 배경 클릭 시 닫기 */
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('notice-overlay');
    if (overlay) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeNoticeTemporarily();
        });
    }
});

/* ======================================================
   7. PWA 서비스 워커 등록
      ⚠️ sw.js를 <script src="sw.js"> 로 로드하면 안 됨
         반드시 register() 로만 등록할 것
   ====================================================== */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW 등록:', reg.scope))
            .catch(err => console.warn('SW 등록 실패:', err));
    });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
});

/* ======================================================
   8. 초기 실행 (단일 진입점)
   ====================================================== */
document.addEventListener('DOMContentLoaded', () => {
    renderSummary();
    renderContent();
    startClock();
    showNotice();
    console.log('KB 금리표 로드 완료');
});
