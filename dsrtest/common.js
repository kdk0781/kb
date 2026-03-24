/* =============================================================================
   [DSR 정밀 진단 계산기 - 통합 관리 마스터 스크립트]
   파일명: common.js / 업데이트: 2026. 03. 25.
   수정사항: 전 구간 유효성 검사(Validation) 및 모바일 포커스 엔진 통합
   ============================================================================= */

// [1] 전역 설정 및 초기화
const NOTICE_VERSION = "0781_2"; 
let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;
let currentScheduleType = 'P';

window.onload = function() {
    applySystemTheme();
    initNotice();
    addLoan(); // 실행 시 기본 1개 생성
    
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* [2] 시스템 테마 및 공지사항 제어 */
function applySystemTheme() {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('white', !isDarkMode);
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (!noticePopup) return;
    const savedVersion = localStorage.getItem('hideNoticeVersion');
    if (savedVersion !== NOTICE_VERSION || localStorage.getItem('hideStressNotice') !== 'true') {
        noticePopup.style.display = 'flex';
    }
}
function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() {
    localStorage.setItem('hideStressNotice', 'true');
    localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
    closeNotice();
}

/* [3] 유효성 검사 및 알림 제어 (핵심 수정) */
function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    if (!modal) return;
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; 
    proceedOnConfirm = allowProceed;
    modal.style.display = 'flex';
}

/**
 * 모달 확인 버튼 클릭 시 모바일 키보드 강제 활성화 로직
 */
function handleModalConfirm() {
    const modal = document.getElementById('customModal');
    if (modal) modal.style.display = 'none';
    
    if (proceedOnConfirm) {
        calculateLogic(); // 금리 미입력 경고 후 계산 진행
    } else if (lastFocusId) {
        const targetEl = document.getElementById(lastFocusId);
        if (targetEl) {
            targetEl.focus(); // 1차 포커스 (iOS 대응)
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                targetEl.focus(); // 2차 확정 포커스
                if (targetEl.tagName === 'INPUT') {
                    targetEl.click();
                    targetEl.setSelectionRange(0, targetEl.value.length);
                }
            }, 300);
        }
    }
}

/* [4] 계산 실행 전 전수 유효성 체크 */
function calculateTotalDSR() {
    // 1. 소득 체크
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) {
        showAlert("<b>연간 세전 소득</b>을 입력해주세요.", "income");
        return;
    }

    // 2. 부채 항목 존재 여부 체크
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) {
        showAlert("분석할 <b>부채 항목</b>을 최소 하나 이상 추가해주세요.");
        return;
    }

    // 3. 개별 항목 상세 체크
    let missingRate = false;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const idx = item.id.split('_')[1];
        const pVal = getNum(item.querySelector('.l-p').value);
        const rVal = item.querySelector('.l-r').value;
        const mVal = getNum(item.querySelector('.l-m').value);

        if (pVal <= 0) {
            showAlert(`대출 항목의 <b>원금(잔액)</b>을 입력해주세요.`, `lp_${idx}`);
            return;
        }
        if (mVal <= 0) {
            showAlert(`대출 항목의 <b>상환 기간</b>을 입력해주세요.`, `lm_${idx}`);
            return;
        }
        if (Number(rVal || 0) <= 0) missingRate = true;
    }

    // 4. 금리 미입력 시 안내 후 진행, 모두 입력 시 즉시 계산
    if (missingRate) {
        showAlert("금리 미입력 항목은 시스템 <b>표준 금리</b>가 자동 적용됩니다.", null, "ℹ️", true);
    } else {
        calculateLogic();
    }
}

/* [5] 입력 엔진 및 동적 UI */
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
            <div><label>대출 종류</label>
                <select class="l-category" onchange="applyPolicy(${loanCount})">
                    <option value="mortgage_level">주택담보 (원리금)</option>
                    <option value="mortgage_prin">주택담보 (원금)</option>
                    <option value="jeonse">전세대출 (만기)</option>
                    <option value="officetel">오피스텔 (원리금)</option>
                    <option value="credit">신용대출 (원리금)</option>
                    <option value="cardloan">카드론 (원리금)</option>
                </select>
            </div>
            <div><label>원금/잔액 (원)</label><input type="text" id="lp_${loanCount}" class="l-p" inputmode="numeric" onkeyup="formatComma(this)" placeholder="0"></div>
            <div><label>금리 (%)</label><input type="text" id="lr_${loanCount}" class="l-r" inputmode="decimal" placeholder="4.5"></div>
            <div><label>스트레스 금리</label>
                <select class="l-sr-select">
                    <option value="1.15" selected>60개월변동 (1.15%)</option>
                    <option value="2.87">6,12개월변동 (2.87%)</option>
                    <option value="0.0">해당없음 (0.0%)</option>
                </select>
            </div>
            <div><label>기간 (개월)</label><input type="text" id="lm_${loanCount}" class="l-m" inputmode="numeric" value="360"></div>
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

/* [6] 정밀 계산 및 결과 출력 */
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

    // UI 업데이트
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('dsrVal').innerText = dsr.toFixed(2) + '%';
    document.getElementById('absMaxPrin').innerText = Math.floor(maxP).toLocaleString() + ' 원';
    document.getElementById('absMaxLevel').innerText = Math.floor(maxL).toLocaleString() + ' 원';
    
    // 진행바 업데이트 (40% 기준)
    const bar = document.getElementById('dsrBar');
    if(bar) {
        const barWidth = Math.min(dsr, 100);
        bar.style.width = barWidth + '%';
        bar.style.backgroundColor = dsr > 40 ? '#e74c3c' : '#2ecc71';
    }

    document.getElementById('recDesc').innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> 원금균등 방식을 권장합니다." : "<b>✅ 자금 건전성 양호:</b> 원리금균등 방식을 권장합니다.";
    
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}
