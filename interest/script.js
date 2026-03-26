/* ======================================================
   1. 데이터 설정
   ====================================================== */
const r = {
    base: { mor5: 4.06, mor2: 3.40, ncofix: 2.82, scofix: 2.47,
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
        { title: "주택담보대출", desc: "부동산 담보 대출 금리 리포트 <br/> <b style='color:var(--red);'>이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'mort' },
        { title: "전세 (HF 주택금융공사)", desc: "공사 보증 전세자금대출 <br/> 접수 가능 기간 : 잔금일 기준(포함) 50일 전부터 <br/> <b style='color:var(--red);'>이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'hf' },
        { title: "전세 (HUG 주택도시보증)", desc: "안심전세 보증금 반환보증 <br/> 접수 가능 기간 : 잔금일 기준(포함) 30일 전부터 <br/><b style='color:var(--red);'>이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'hug' },
        { title: "전세 (SGI 서울보증보험)", desc: "고액 전세자금 SGI 보증 <br/> 접수 가능 기간 : 잔금일 기준(포함) 45일 전부터 <br/><b style='color:var(--red);'>이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'sgi' }
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

/* ======================================================
   4. 새로고침 로직 (상단 이동 추가)
   ====================================================== */
function refreshData() {
    console.log("새로고침 및 상단 이동 시작...");
    
    // 1. 즉시 최상단으로 부드럽게 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const fab = document.getElementById('fab-refresh');
    
    // 2. 시각적 피드백 (버튼 회전)
    if (fab) {
        fab.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        fab.style.transform = "rotate(360deg)";
    }

    // 3. 데이터 재렌더링
    try {
        renderSummary(); 
        renderContent(); 
    } catch (error) {
        console.error("렌더링 중 오류 발생:", error);
    }

    // 4. 애니메이션 초기화
    setTimeout(() => {
        if (fab) {
            fab.style.transition = "none";
            fab.style.transform = "rotate(0deg)";
        }
    }, 600);
}

// 브라우저 자체 새로고침 시에도 상단으로 이동하도록 설정
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

window.addEventListener('beforeunload', () => {
    window.scrollTo(0, 0);
});

/* ======================================================
   5. PWA 앱 설치 및 서비스 워커 등록
   ====================================================== */
if ('serviceWorker' in navigator) {
    // 로컬호스트 환경에 대응하기 위해 ./sw.js 사용
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('서비스 워커 등록 성공:', reg.scope))
        .catch(err => console.log('서비스 워커 등록 실패:', err));
}

// [수정] 변수 선언은 한 번만 수행해야 합니다.
let deferredPrompt; 
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("'beforeinstallprompt' 이벤트 발생 - 설치 가능");
});

// 앱 모드 확인
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log("현재 앱 모드로 실행 중입니다.");
}

/* ======================================================
   6. 초기 로드 통합
   ====================================================== */
window.onload = () => {
    console.log("페이지 로드 완료");
    renderSummary();
    renderContent();
    startClock();
};

