/* =============================================================================
   [DSR 정밀 진단 계산기 - 260323_F 통합 마스터 스크립트]
   파일명: common.js / 업데이트: 2026. 03. 25.
   수정사항: 함수 중복 제거, 괄호 오류 수정, 모바일 키보드 팝업 최적화
   ============================================================================= */

// [1] 전역 변수 및 초기 설정
const NOTICE_VERSION = "0781_2"; 
let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;
let currentScheduleType = 'P'; // P: 원금균등, L: 원리금균등

window.onload = function() {
    applySystemTheme(); // 테마 적용
    initNotice();       // 공지사항 체크
    addLoan();          // 기본 대출 항목 추가
    
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* [2] 시스템 테마 제어 */
function applySystemTheme() {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const body = document.body;
    if (isDarkMode) {
        body.classList.add('dark'); body.classList.remove('white');
    } else {
        body.classList.add('white'); body.classList.remove('dark');
    }
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

/* [3] 공지사항 및 모달 로직 */
function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (!noticePopup) return;
    const savedVersion = localStorage.getItem('hideNoticeVersion');
    if (savedVersion !== NOTICE_VERSION) {
        localStorage.removeItem('hideStressNotice');
        localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
        noticePopup.style.display = 'flex';
    } else if (localStorage.getItem('hideStressNotice') !== 'true') {
        noticePopup.style.display = 'flex';
    }
}

function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() {
    localStorage.setItem('hideStressNotice', 'true');
    localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
    closeNotice();
}

function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    if (!modal) return;
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; 
    proceedOnConfirm = allowProceed;
    modal.style.display = 'flex';
}

function handleModalConfirm() {
    const modal = document.getElementById('customModal');
    if (modal) modal.style.display = 'none';
    if (proceedOnConfirm) {
        calculateLogic();
    } else if (lastFocusId) {
        const targetEl = document.getElementById(lastFocusId);
        if (targetEl) {
            targetEl.focus(); // iOS 키보드 대응 동기 호출
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                targetEl.focus();
                if (targetEl.tagName === 'INPUT') {
                    targetEl.click();
                    targetEl.setSelectionRange(0, targetEl.value.length);
                }
            }, 300);
        }
    }
}

/* [4] 유틸리티 및 입력 제어 */
function getNum(val) { return Number(val.toString().replace(/,/g, "")) || 0; }
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

function addLoan() {
    loanCount++;
    const html = `
    <div class="input-card" id="loan_${loanCount}">
        <button class="btn-remove" onclick="removeLoan(${loanCount})">×</button>
        <div class="grid-row">
            <div><label>대출 종류</label><select class="l-category" onchange="applyPolicy(${loanCount})">
                <option value="mortgage_level">주택담보 (원리금)</option>
                <option value="mortgage_prin">주택담보 (원금)</option>
                <option value="jeonse">전세대출 (만기)</option>
                <option value="officetel">오피스텔 (원리금)</option>
                <option value="credit">신용대출 (원리금)</option>
                <option value="cardloan">카드론 (원리금)</option>
            </select></div>
            <div><label>원금/잔액 (원)</label><input type="text" id="lp_${loanCount}" class="l-p" inputmode="numeric" onkeyup="formatComma(this)" placeholder="0"></div>
            <div><label>금리 (%)</label><input type="text" id="lr_${loanCount}" class="l-r" inputmode="decimal" placeholder="4.5"></div>
            <div><label>스트레스 금리</label><select class="l-sr-select">
                <option value="1.15" selected>60개월변동 (1.15%)</option>
                <option value="2.87">6,12개월변동 (2.87%)</option>
                <option value="0.0">해당없음 (0.0%)</option>
            </select></div>
            <div><label>기간 (개월)</label><input type="text" class="l-m" inputmode="numeric" value="360"></div>
        </div>
        <div class="dynamic-guide" id="guide_${loanCount}" style="display:none;"></div>
    </div>`;
    document.getElementById('loanList').insertAdjacentHTML('beforeend', html);
}

function removeLoan(id) { document.getElementById(`loan_${id}`).remove(); }

function applyPolicy(id) {
    const card = document.getElementById(`loan_${id}`);
    const cat = card.querySelector('.l-category').value;
    const m = card.querySelector('.l-m'), r = card.querySelector('.l-r'), sr = card.querySelector('.l-sr-select'), g = card.querySelector('.dynamic-guide');
    if (cat === 'officetel' || cat === 'cardloan') {
        g.style.display = 'block';
        if (cat === 'officetel') { g.innerHTML = "⚠️ 오피스텔 담보 보유자용 (8년 상환 가정)"; m.value = "96"; r.placeholder = "5.5"; sr.value = "0.0"; }
        else { g.innerHTML = "⚠️ 카드론 가상 만기 3년 적용"; m.value = "36"; r.placeholder = "13.0"; sr.value = "0.0"; }
    } else {
        g.style.display = 'none'; sr.value = cat.includes('mortgage') ? "1.15" : "0.0";
        if (cat === 'credit') m.value = "60"; else if (cat === 'jeonse') m.value = "24"; else m.value = "360";
    }
}

/* [5] 정밀 계산 로직 (사용자 제시 산식 통합) */
function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) { showAlert("연간 세전 소득을 입력해주세요.", "income"); return; }
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) { showAlert("부채 항목을 추가해주세요."); return; }
    
    let missingRate = false;
    items.forEach(item => { if (Number(item.querySelector('.l-r').value || 0) <= 0) missingRate = true; });
    
    if (missingRate) showAlert("금리 미입력 항목은 <b>시스템 표준 금리</b>가 적용됩니다.", null, "ℹ️", true);
    else calculateLogic();
}

function calculateLogic() {
    const income = getNum(document.getElementById('income').value);
    const items = document.querySelectorAll('[id^="loan_"]');
    let totalAnnPay = 0, bR = 4.5, bSR = 1.15, bM = 360;

    items.forEach((item, index) => {
        const cat = item.querySelector('.l-category').value, P = getNum(item.querySelector('.l-p').value);
        const R = Number(item.querySelector('.l-r').value || item.querySelector('.l-r').placeholder);
        const SR = Number(item.querySelector('.l-sr-select').value), n = getNum(item.querySelector('.l-m').value);
        if (index === 0) { bR = R; bSR = SR; bM = n; }
        const r_m = (R + SR) / 1200;
        if (P > 0) {
            let annPay = (cat === 'mortgage_prin') ? (P/n*12) + (P*r_m*(n+1)/2)/(n/12) : 
                         (cat === 'jeonse') ? P*(R/100) : 
                         ((P*r_m*Math.pow(1+r_m, n))/(Math.pow(1+r_m, n)-1))*12;
            totalAnnPay += annPay;
        }
    });

    const dsr = (totalAnnPay / income) * 100;
    const r_lim = (bR + bSR) / 1200;
    const maxL = (income*0.4/12)*(Math.pow(1+r_lim, bM)-1)/(r_lim*Math.pow(1+r_lim, bM));
    const maxP = (income*0.4)/((12/bM)+(r_lim*(bM+1)));

    // 결과 표시 UI 업데이트
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('dsrVal').innerText = dsr.toFixed(2) + '%';
    document.getElementById('absMaxPrin').innerText = Math.floor(maxP).toLocaleString() + ' 원';
    document.getElementById('absMaxLevel').innerText = Math.floor(maxL).toLocaleString() + ' 원';
    
    const recDesc = document.getElementById('recDesc');
    recDesc.innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> 원금균등 방식을 권장합니다." : "<b>✅ 자금 건전성 양호:</b> 원리금균등 방식을 권장합니다.";
    
    refreshScheduleUI();
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

/* [6] 상환 스케줄 제어 */
function refreshScheduleUI() {
    const btn = document.getElementById('btnShowSchedule');
    if (btn) btn.style.display = 'block';
}

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
    const target = items[0], P = getNum(target.querySelector('.l-p').value), R = Number(target.querySelector('.l-r').value || 4.5), n = getNum(target.querySelector('.l-m').value), r = R / 1200;
    const listEl = document.getElementById('scheduleList');
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

function switchSchedule(type) {
    currentScheduleType = type;
    document.getElementById('tabPrin').classList.toggle('active', type === 'P');
    document.getElementById('tabLevel').classList.toggle('active', type === 'L');
    generateSchedule();
}
