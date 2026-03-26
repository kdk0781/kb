/* ======================================================
   1. 데이터 설정
   ====================================================== */
const r = {
    base: { mor5: 3.87, mor2: 3.40, ncofix: 2.82, scofix: 2.47,
			primeOn: 1.10, primeOff: 0.90 },
    stress: { m5_cycle: 1.15, m5_mix: 1.72, v_6_12: 2.87 },
    add: {
        mort: { m5: 2.17, n6: 2.74, n12: 2.69, s6: 3.08, s12: 3.20 },
        hf:   { m2: 2.20, n6: 2.43, n12: 2.54, s6: 2.68, s12: 3.07 },
        hug:  { m2: 2.26, n6: 2.46, n12: 2.44, s6: 2.71, s12: 2.97 },
        sgi:  { m2: 2.56, n6: 2.55, n12: 2.67, s6: 3.00, s12: 3.13 }
    }
};

const calc = (b, a, p) => parseFloat((b + a - p).toFixed(2));

/* ======================================================
   2. 상단 서머리 렌더링 (최저 변동형 스트레스 금리 반영)
   ====================================================== */
function renderSummary() {
	const ga = r.add.mort;

	// 6, 12개월 변동형 모든 조합 중 최저 금리 찾기 (신규/신잔액 포함)
    const varRates = [
        calc(r.base.ncofix, ga.n6, r.base.primeOn),  // 신규 6M
        calc(r.base.ncofix, ga.n12, r.base.primeOn), // 신규 12M
        calc(r.base.scofix, ga.s6, r.base.primeOn),  // 신잔액 6M
        calc(r.base.scofix, ga.s12, r.base.primeOn)  // 신잔액 12M
    ];

    const minVarRate = Math.min(...varRates); // 가장 낮은 변동 금리값
    const items = [
        {l:'금융채5Y', v:r.base.mor5}, {l:'금융채2Y', v:r.base.mor2},
        {l:'신규COFIX', v:r.base.ncofix}, {l:'신잔액', v:r.base.scofix},
        {l:'ST 주기형(5Y)', v: calc(r.base.mor5, r.add.mort.m5 + r.stress.m5_cycle, r.base.primeOn), s: true},
        {l:'ST 혼합형(5Y)', v: calc(r.base.mor5, r.add.mort.m5 + r.stress.m5_mix, r.base.primeOn), s: true},
        {l:'ST 변동형(최저)', v: parseFloat((minVarRate + r.stress.v_6_12).toFixed(2)), s: true}
    ];
    document.getElementById('top-summary').innerHTML = items.map(i => `
        <div class="summary-item ${i.s ? 'stress-item' : ''}">${i.l}<span>${i.v.toFixed(2)}%</span></div>
    `).join('');
}

function renderContent() {
    const groups = [
        { title: "주택담보대출", desc: "부동산 담보 대출 금리 리포트", id: 'mort' },
        { title: "전세 (HF 주택금융공사)", desc: "공사 보증 전세자금대출 | 접수 가능 기간 : 잔금일 기준(포함) 50일 전부터", id: 'hf' },
        { title: "전세 (HUG 주택도시보증)", desc: "안심전세 보증금 반환보증 | 접수 가능 기간 : 잔금일 기준(포함) 30일 전부터", id: 'hug' },
        { title: "전세 (SGI 서울보증보험)", desc: "고액 전세자금 SGI 보증 | 접수 가능 기간 : 잔금일 기준(포함) 45일 전부터", id: 'sgi' }
    ];

    let finalHtml = "";
    groups.forEach(g => {
        const ga = r.add[g.id];
        const items = [
            { n: (g.id === 'mort' ? "금융채 5년 (혼합)" : "금융채 2년 (고정)"), c: (g.id === 'mort' ? "5년 고정" : "2년 고정"), b: (g.id === 'mort' ? r.base.mor5 : r.base.mor2), a: ga.m2 || ga.m5 },
            ...(g.id === 'mort' ? [{ n: "금융채 5년 (변동)", c: "5년 변동", b: r.base.mor5, a: ga.m5 }] : []),
            { n: "신규 코픽스 6개월", c: "6개월 변동", b: r.base.ncofix, a: ga.n6 },
            { n: "신규 코픽스 12개월", c: "12개월 변동", b: r.base.ncofix, a: ga.n12 },
            { n: "신잔액 코픽스 6개월", c: "6개월 변동", b: r.base.scofix, a: ga.s6 },
            { n: "신잔액 코픽스 12개월", c: "12개월 변동", b: r.base.scofix, a: ga.s12 }
        ].filter(i => !i.hide);

        const minVal = Math.min(...items.map(i => calc(i.b, i.a, r.base.primeOn)));
        let groupHtml = `<section class="group-wrapper"><div class="section-header"><h3>${g.title}</h3><p>${g.desc}</p></div><div class="card-list">`;
        items.forEach(i => {
            const onVal = calc(i.b, i.a, r.base.primeOn);
            const isBest = onVal === minVal;
            groupHtml += `
                <article class="rate-card ${isBest ? 'best-rate' : ''}">
                    <div class="best-label">BEST</div>
                    <div class="card-top">
                        <span class="product-name">${i.n}</span>
                        <span class="cycle-tag">${i.c}</span>
                    </div>
                    <div class="price-grid">
                        <div class="price-box ${isBest ? 'target' : ''}">
                            <span class="label">전자계약 O</span>
                            <span class="value">${onVal.toFixed(2)}%</span>
                            <span class="formula">${i.b}+${i.a}-1.1</span>
                        </div>
                        <div class="price-box">
                            <span class="label">전자계약 X</span>
                            <span class="value">${calc(i.b, i.a, r.base.primeOff).toFixed(2)}%</span>
                            <span class="formula">${i.b}+${i.a}-0.9</span>
                        </div>
                    </div>
                </article>`;
        });
        groupHtml += `</div></section>`;
        finalHtml += groupHtml;
    });
    document.getElementById('main-content').innerHTML = finalHtml;
}

function startClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    const tick = () => {
        const n = new Date();
        clockEl.innerText = `${n.getFullYear()}/${String(n.getMonth() + 1).padStart(2, '0')}/${String(n.getDate()).padStart(2, '0')} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`;
    };
    tick();
    setInterval(tick, 1000);
}

window.onload = () => { renderSummary(); renderContent(); startClock(); };

/* ======================================================
   5. PWA 앱 설치 및 서비스 워커 등록
   ====================================================== */

// 서비스 워커 등록 (오프라인 캐싱 및 앱 작동 지원)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('PWA 서비스 워커 등록 완료');
        }).catch(err => {
            console.log('서비스 워커 등록 실패:', err);
        });
    });
}

// 설치 권장 팝업 제어 (안드로이드/크롬 전용)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 여기에 '앱 설치하기' 버튼을 노출하는 로직을 추가할 수 있습니다.
});

// 앱 모드로 실행 중인지 확인 (CSS 분기 처리 등에 활용 가능)
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log("현재 앱 모드로 실행 중입니다.");
    // 앱 모드일 때만 푸터 문구를 변경하는 등의 작업 가능
}

/* ======================================================
   6. 새로고침 로직 (Button & Pull-to-Refresh)
   ====================================================== */

function refreshData() {
    const fab = document.getElementById('fab-refresh');
    // 버튼 회전 애니메이션
    fab.style.transition = "transform 0.5s ease";
    fab.style.transform = "rotate(360deg)";
    
    // 데이터 갱신
    renderSummary();
    renderContent();
    
    setTimeout(() => {
        fab.style.transform = "rotate(0deg)";
        fab.style.transition = "none";
        // 성공 알림 (선택 사항)
        console.log("금리 데이터가 최신화되었습니다.");
    }, 500);
}

// 2. 모바일 '당겨서 새로고침' 구현
let startY = 0;
const pullIndicator = document.getElementById('pull-indicator');

window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) startY = e.touches[0].pageY;
}, {passive: true});

window.addEventListener('touchmove', (e) => {
    const y = e.touches[0].pageY;
    const pullDistance = y - startY;
    
    if (window.scrollY === 0 && pullDistance > 80) {
        pullIndicator.classList.add('visible');
    }
}, {passive: true});

window.addEventListener('touchend', () => {
    if (pullIndicator.classList.contains('visible')) {
        refreshData();
        setTimeout(() => {
            pullIndicator.classList.remove('visible');
        }, 1000);
    }
});
