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

// [1] 계산 메인 로직 및 한도 역산
function calculateLogic() {
    const income = getNum(document.getElementById('income').value);
    const items = document.querySelectorAll('[id^="loan_"]');
    
    let totalAnnPay = 0; // 연간 총 원리금 상환액
    let sumP = 0;        // 기존 주담대 원금 합계
    let bR = 4.5, bSR = 1.15, bM = 360; // 기준값 (첫 번째 항목 기준)

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
                // 원금균등: (원금/만기*12) + (평균이자)
                annPay = (P / n * 12) + (P * r_m * (n + 1) / 2) / (n / 12);
            } else if (cat === 'jeonse') {
                // 전세: 이자만
                annPay = P * (R / 100);
            } else {
                // 원리금균등 및 기타: PMT 공식
                annPay = ((P * r_m * Math.pow(1 + r_m, n)) / (Math.pow(1 + r_m, n) - 1)) * 12;
            }
            totalAnnPay += annPay;
            if (cat.includes('mortgage')) sumP += P;
        }
    });

    const dsr = (totalAnnPay / income) * 100;
    const targetAnnPay = income * 0.4; // DSR 40% 법정 한도액
    const r_lim = (bR + bSR) / 1200;
    
    // [핵심 1] 방식별 최대 한도 역산 (전체 한도)
    const maxLevel = (targetAnnPay / 12) * (Math.pow(1 + r_lim, bM) - 1) / (r_lim * Math.pow(1 + r_lim, bM));
    const maxPrin = targetAnnPay / ((12 / bM) + (r_lim * (bM + 1)));

    // [핵심 2] 현재 추가 가능 대출액 (여유 한도)
    const remainAnnPay = Math.max(0, targetAnnPay - totalAnnPay);
    const addLimit = (remainAnnPay / 12) * (Math.pow(1 + r_lim, bM) - 1) / (r_lim * Math.pow(1 + r_lim, bM));

    // UI 업데이트 (ID가 HTML과 일치해야 함)
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('dsrVal').innerText = dsr.toFixed(2) + '%';
    document.getElementById('remainingLimit').innerText = Math.floor(addLimit).toLocaleString() + ' 원';
    document.getElementById('absMaxPrin').innerText = Math.floor(maxPrin).toLocaleString() + ' 원';
    document.getElementById('absMaxLevel').innerText = Math.floor(maxLevel).toLocaleString() + ' 원';
    
    // [핵심 3] 실제 금리 기준 상환액 상세 (첫 번째 대출 기준 예시)
    document.getElementById('vis_t_i_p').innerText = "분석 완료"; // 상세 이자 계산 함수 연결 필요

    refreshScheduleUI(); // 스케줄 버튼 활성화
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

// [2] 전체 상환 스케줄 상세 보기 로직
function generateSchedule() {
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) return;

    const target = items[0]; // 첫 번째 항목 기준 스케줄 생성
    const P = getNum(target.querySelector('.l-p').value);
    const R = Number(target.querySelector('.l-r').value || 4.5);
    const n = getNum(target.querySelector('.l-m').value);
    const r = R / 1200;

    const listEl = document.getElementById('scheduleList');
    listEl.innerHTML = ""; 

    let bal = P;
    const mP = P / n; 
    const mPMT = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

    for (let i = 1; i <= n; i++) {
        let curI = bal * r;
        let curP = (currentScheduleType === 'P') ? mP : mPMT - curI;
        bal -= curP;

        const div = document.createElement('div');
        div.className = 'schedule-item';
        div.innerHTML = `
            <div class="sch-num">${i}회</div>
            <div>${Math.floor(curP).toLocaleString()}</div>
            <div>${Math.floor(curI).toLocaleString()}</div>
            <div class="sch-bal">${Math.max(0, Math.floor(bal)).toLocaleString()}</div>
        `;
        listEl.appendChild(div);
    }
}

// [3] 리포트 복사하기 로직
function copyResultText() {
    const dsr = document.getElementById('dsrVal').innerText;
    const addLim = document.getElementById('remainingLimit').innerText;
    const maxP = document.getElementById('absMaxPrin').innerText;
    const maxL = document.getElementById('absMaxLevel').innerText;
    
    const reportText = `[📊 DSR 정밀 진단 리포트]
● 현재 종합 DSR: ${dsr}
● 추가 대출 가능액: ${addLim}
----------------------------
🎯 방식별 최대 대출 한도
- 원금균등 방식: ${maxP}
- 원리금균등 방식: ${maxL}
----------------------------
* 위 결과는 산출 예상치이며 실제와 다를 수 있습니다.`;

    const temp = document.createElement("textarea");
    document.body.appendChild(temp);
    temp.value = reportText;
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    
    showAlert("분석 리포트가 복사되었습니다!", null, "✅");
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
