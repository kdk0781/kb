/* =============================================================================
   [DSR 정밀 진단 계산기 - 260323_F 마스터 로직 완전 복구본]
   파일명: common.js / 업데이트: 2026. 03. 25.
   수정사항: 연간 상환액 산식 교정, 한도 역산 엔진 복구, UI ID 매칭 완결
   ============================================================================= */

// [1] 전역 초기화 및 시스템 설정
const NOTICE_VERSION = "0781_2"; 
let lastFocusId = null, proceedOnConfirm = false, loanCount = 0;
let currentScheduleType = 'P'; // P: 원금균등, L: 원리금균등

window.onload = function() {
    applySystemTheme();
    initNotice();
    addLoan(); // 기본 1개 생성
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

function applySystemTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('white', !isDark);
}

/* [2] 유효성 검사 및 모바일 포커스 제어 */
function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; proceedOnConfirm = allowProceed;
    modal.style.display = 'flex';
}

function handleModalConfirm() {
    document.getElementById('customModal').style.display = 'none';
    if (proceedOnConfirm) { calculateLogic(); } 
    else if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) {
            el.focus(); // iOS 키보드 호출용 동기 포커스
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { el.focus(); if(el.tagName === 'INPUT') el.click(); }, 300);
        }
    }
}

/* [3] 입력 유틸리티 */
function getNum(val) { return Number(val.toString().replace(/,/g, "")) || 0; }
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

/* [4] 메인 계산 엔진 (로직 깨짐 전면 수정) */
function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) { showAlert("연간 세전 소득을 입력해주세요.", "income"); return; }
    
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) { showAlert("부채 항목을 추가해주세요."); return; }

    let missingRate = false;
    items.forEach(item => {
        if (getNum(item.querySelector('.l-p').value) <= 0) {
            showAlert("대출 금액을 입력해주세요.", item.querySelector('.l-p').id);
            return;
        }
        if (Number(item.querySelector('.l-r').value || 0) <= 0) missingRate = true;
    });

    if (missingRate) showAlert("금리 미입력 항목은 <b>표준 금리</b>가 적용됩니다.", null, "ℹ️", true);
    else calculateLogic();
}

function calculateLogic() {
    const income = getNum(document.getElementById('income').value);
    const items = document.querySelectorAll('[id^="loan_"]');
    
    let totalAnnPay = 0; 
    let bR = 4.5, bSR = 1.15, bM = 360; // 기준값 (첫 번째 항목)

    items.forEach((item, index) => {
        const cat = item.querySelector('.l-category').value;
        const P = getNum(item.querySelector('.l-p').value);
        const R = Number(item.querySelector('.l-r').value || item.querySelector('.l-r').placeholder);
        const SR = Number(item.querySelector('.l-sr-select').value);
        const n = getNum(item.querySelector('.l-m').value);
        
        if (index === 0) { bR = R; bSR = SR; bM = n; }
        const r_m = (R + SR) / 1200; // 월이율 (스트레스 포함)

        if (P > 0) {
            let annPay = 0;
            if (cat === 'mortgage_prin') {
                // [정밀 산식] 원금균등: (1년치 원금) + (연평균 이자)
                annPay = (P / n * 12) + (P * r_m * (n + 1) / 2) / (n / 12);
            } else if (cat === 'jeonse') {
                // 전세: 순수 이자만 연간 상환액으로 산정
                annPay = P * (R / 100);
            } else {
                // 원리금균등 (PMT 공식): 주담대(원리금), 신용, 오피스텔, 카드론 통합
                annPay = ((P * r_m * Math.pow(1 + r_m, n)) / (Math.pow(1 + r_m, n) - 1)) * 12;
            }
            totalAnnPay += annPay;
        }
    });

    const dsr = (totalAnnPay / income) * 100;
    const targetAnnPay = income * 0.4; // DSR 40% 법정 한도
    const r_lim = (bR + bSR) / 1200;
    
    // [핵심] 방식별 최대 한도 역산 로직
    const maxL = (targetAnnPay / 12) * (Math.pow(1 + r_lim, bM) - 1) / (r_lim * Math.pow(1 + r_lim, bM));
    const maxP = targetAnnPay / ((12 / bM) + (r_lim * (bM + 1)));
    
    // [핵심] 현재 추가 가능 대출액 (40% 여유분 기반)
    const addLimAnn = Math.max(0, targetAnnPay - totalAnnPay);
    const addLim = (addLimAnn / 12) * (Math.pow(1 + r_lim, bM) - 1) / (r_lim * Math.pow(1 + r_lim, bM));

    // UI 데이터 바인딩
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('dsrVal').innerText = dsr.toFixed(2) + '%';
    document.getElementById('remainingLimit').innerText = Math.floor(addLimit).toLocaleString() + ' 원';
    document.getElementById('absMaxPrin').innerText = Math.floor(maxP).toLocaleString() + ' 원';
    document.getElementById('absMaxLevel').innerText = Math.floor(maxL).toLocaleString() + ' 원';
    
    // 진행바 상태 업데이트
    const bar = document.getElementById('dsrBar');
    if(bar) {
        bar.style.width = Math.min(dsr, 100) + '%';
        bar.style.backgroundColor = dsr > 40 ? '#e74c3c' : '#2ecc71';
    }

    document.getElementById('recDesc').innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> 원금균등 방식을 권장합니다." : "<b>✅ 자금 건전성 양호:</b> 원리금균등 방식을 권장합니다.";
    
    if (document.getElementById('btnShowSchedule')) document.getElementById('btnShowSchedule').style.display = 'block';
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

/* [5] 상환 스케줄 및 리포트 복사 */
function toggleSchedule() {
    const sec = document.getElementById('scheduleSection'), btn = document.getElementById('btnShowSchedule');
    if (sec.style.display === 'none' || sec.style.display === '') {
        generateSchedule(); sec.style.display = 'block'; btn.innerText = "🔼 스케줄 접기";
    } else {
        sec.style.display = 'none'; btn.innerText = "📊 전체 상환 스케줄 상세 보기";
    }
}

function generateSchedule() {
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) return;
    const target = items[0], P = getNum(target.querySelector('.l-p').value), R = Number(target.querySelector('.l-r').value || 4.5), n = getNum(target.querySelector('.l-m').value);
    const r = R / 1200, listEl = document.getElementById('scheduleList');
    listEl.innerHTML = "";
    let bal = P, mP = P/n, mPMT = (P*r*Math.pow(1+r, n))/(Math.pow(1+r, n)-1);
    
    for (let i = 1; i <= n; i++) {
        let curI = bal * r, curP = (currentScheduleType === 'P') ? mP : mPMT - curI;
        bal -= curP;
        const div = document.createElement('div');
        div.className = 'schedule-item';
        div.innerHTML = `<div class="sch-num">${i}회</div><div>${Math.floor(curP).toLocaleString()}</div><div>${Math.floor(curI).toLocaleString()}</div><div>${Math.max(0, Math.floor(bal)).toLocaleString()}</div>`;
        listEl.appendChild(div);
    }
}

function copyResultText() {
    const reportText = `[📊 DSR 정밀 진단 리포트]\n● 현재 종합 DSR: ${document.getElementById('dsrVal').innerText}\n● 추가 가능 대출: ${document.getElementById('remainingLimit').innerText}\n🎯 방식별 최대 한도\n- 원금균등: ${document.getElementById('absMaxPrin').innerText}\n- 원리금균등: ${document.getElementById('absMaxLevel').innerText}`;
    const temp = document.createElement("textarea"); document.body.appendChild(temp);
    temp.value = reportText; temp.select(); document.execCommand("copy"); document.body.removeChild(temp);
    showAlert("리포트가 복사되었습니다!", null, "✅");
}
