/* ======================================================
   1. 데이터 설정
   ====================================================== */
const r = {
    base: { mor5: 14.06, mor2: 13.68, ncofix: 12.82, scofix: 12.47,
			primeOn: 1.10, primeOff: 0.90 },
    stress: { m5_cycle: 11.15, m5_mix: 11.50, v_6_12: 12.87 },
    add: {
        mort: { m5: 2.18, n6: 2.73, n12: 2.69, s6: 3.07, s12: 3.20 },
        hf:   { m2: 2.20, n6: 2.43, n12: 2.54, s6: 2.68, s12: 3.07 },
        hug:  { m2: 2.26, n6: 2.46, n12: 2.44, s6: 2.71, s12: 2.97 },
        sgi:  { m2: 2.56, n6: 2.55, n12: 2.67, s6: 3.00, s12: 3.13 }
    }
};

const calc = (b, a, p) => parseFloat((b + a - p).toFixed(2));

/* ======================================================
   2. 상단 서머리 렌더링 (스트레스 수치 + 신잔액 통합 고도화)
   ====================================================== */
function renderSummary() {
    const ga = r.add.mort;

    // 변동형(신규/신잔액 6,12M) 4개 조합 중 최저 실행 금리 산출
    const varRates = [
        calc(r.base.ncofix, ga.n6, r.base.primeOn),  // 신규 6M
        calc(r.base.ncofix, ga.n12, r.base.primeOn), // 신규 12M
        calc(r.base.scofix, ga.s6, r.base.primeOn),  // 신잔액 6M
        calc(r.base.scofix, ga.s12, r.base.primeOn)  // 신잔액 12M
    ];
    const minVarRate = Math.min(...varRates);

    const items = [
        // [1. 시장 지표 기준금리]
        {l:'금융채5Y', v:r.base.mor5}, 
        {l:'신규COFIX', v:r.base.ncofix},
        {l:'신잔액', v:r.base.scofix},

        // [2. 스트레스 가산금리 규제 수치 - 노란색 테마]
        {l:'ST가산(5Y주기)', v:r.stress.m5_cycle, stBase: true}, 
        {l:'ST가산(5Y혼합)', v: r.stress.m5_mix, stBase: true}, 
        {l:'ST가산(변동형)', v: r.stress.v_6_12, stBase: true},

        // [3. 스트레스 최종 실행 금리 - 빨간색 테마]
        {l:'ST 주기형(5Y)', v: calc(r.base.mor5, ga.m5 + r.stress.m5_cycle, r.base.primeOn), s: true},
        {l:'ST 혼합형(5Y)', v: calc(r.base.mor5, ga.m5 + r.stress.m5_mix, r.base.primeOn), s: true},
        {l:'ST 변동형(최저)', v: parseFloat((minVarRate + r.stress.v_6_12).toFixed(2)), s: true}
    ];

    document.getElementById('top-summary').innerHTML = items.map(i => {
        let typeClass = '';
        if (i.s) typeClass = 'stress-item';
        else if (i.stBase) typeClass = 'st-base-item';

        // 가산금리(stBase)는 %p 단위로 표시하여 구분
        const unit = i.stBase ? '%p' : '%';
        return `<div class="summary-item ${typeClass}">${i.l}<span>${i.v.toFixed(2)}${unit}</span></div>`;
    }).join('');
}

function renderContent() {
    const groups = [
        { title: "주택담보대출", desc: "부동산 담보 대출 금리 리포트 <br/> <b style='color:var(--red);'>접속시 이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'mort' },
        { title: "전세 (HF 주택금융공사)", desc: "공사 보증 전세자금대출 <br/> 접수 가능 기간 : 잔금일 기준(포함) 50일 전부터 <br/> <b style='color:var(--red);'>접속시 이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'hf' },
        { title: "전세 (HUG 주택도시보증)", desc: "안심전세 보증금 반환보증 <br/> 접수 가능 기간 : 잔금일 기준(포함) 30일 전부터 <br/><b style='color:var(--red);'>접속시 이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'hug' },
        { title: "전세 (SGI 서울보증보험)", desc: "고액 전세자금 SGI 보증 <br/> 접수 가능 기간 : 잔금일 기준(포함) 45일 전부터 <br/><b style='color:var(--red);'>접속시 이전 금리가 표시되는 경우 브라우저 캐시삭제</b>", id: 'sgi' }
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

/* ======================================================
   7. 공지사항 팝업 고도화 (다음 주 월요일 재오픈 로직)
   ===================================================== */

const NOTICE_KEY = 'kb_notice_next_monday';

// 1. 공지사항 팝업 띄우기 함수 (아래서 위로 부드럽게)
function showNotice() {
    const overlay = document.getElementById('notice-overlay');
    
    // 이전에 저장된 '닫기 시간' 확인 (없으면 공지사항 띄움)
    const storedCloseTime = localStorage.getItem(NOTICE_KEY);
    if (storedCloseTime) {
        const storedDate = new Date(parseInt(storedCloseTime));
        const today = new Date();

        // [중요 로직] 오늘이 저장된 날짜와 같은 주(Monday 기준)에 포함되는지 확인
        if (isSameWeek(today, storedDate)) {
            // 같은 주라면 공지사항을 띄우지 않음
            console.log("공지사항: 이번 주 닫기 상태 유지");
            return;
        } else {
            // 다른 주(다음 주 월요일 이후)라면 저장된 시간 삭제 후 공지사항 띄움
            localStorage.removeItem(NOTICE_KEY);
            console.log("공지사항: 다음 주 월요일이 되어 다시 표시");
        }
    }

    // 팝업 표시 및 CSS 애니메이션 트리거
    setTimeout(() => { overlay.classList.add('active'); }, 100);
}

// 2. [고도화] 오늘이 저장된 날짜와 같은 주(월요일 기준)인지 확인하는 함수
function isSameWeek(today, storedDate) {
    // 요일을 0(일요일) ~ 6(토요일)로 가져옴
    const todayDay = today.getDay(); 
    const storedDay = storedDate.getDay();

    // 월요일을 기준(1)으로 각 요일의 오프셋 계산 (일요일은 7로 처리)
    const todayMondayOffset = todayDay === 0 ? 7 : todayDay;
    const storedMondayOffset = storedDay === 0 ? 7 : storedDay;

    // 해당 요일을 월요일로 강제로 맞춰서 같은 주인지 비교
    const todayMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - todayMondayOffset + 1);
    const storedMonday = new Date(storedDate.getFullYear(), storedDate.getMonth(), storedDate.getDate() - storedMondayOffset + 1);

    // 연도와 월요일 날짜가 같으면 같은 주
    return todayMonday.getTime() === storedMonday.getTime();
}

// 3. 우측 상단 '×' 버튼: 이번 주 닫기 (localStorage에 현재 시간 저장)
function closeNoticeTemporarily() {
    localStorage.setItem(NOTICE_KEY, new Date().getTime());
    hideNoticeWithAnimation();
}

// 4. 하단 '다음 주 월요일까지 보지 않기' 버튼: 동일한 로직 적용
function closeNoticeNextWeek() {
    closeNoticeTemporarily();
}

// 5. 팝업 부드럽게 숨기기 함수
function hideNoticeWithAnimation() {
    const overlay = document.getElementById('notice-overlay');
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = 'none'; }, 500); // 애니메이션 후 완전히 숨김
}

// 6. 페이지 로드 완료 시 공지사항 상태 확인
window.onload = () => {
    console.log("페이지 로드 완료");
    renderSummary();
    renderContent();
    startClock();
    
    // [추가] 공지사항 팝업 여부 확인
    showNotice();
};
