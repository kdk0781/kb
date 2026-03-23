/* =============================================================================
   [DSR 정밀 진단 계산기 - 통합 관리 마스터 스크립트]
   파일명: common.js
   최종 업데이트: 2026. 03. 23.
   수정사항: 부채 금액 미입력 시 팝업 알림 및 포커스 자동 이동 로직 강화
   ============================================================================= */

/* ---------------------------------------------------------
   [1. 전역 설정 및 초기화]
   --------------------------------------------------------- */
const NOTICE_VERSION = "1"; 
let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;

window.onload = function() {
    initNotice(); 
    addLoan();    
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* ---------------------------------------------------------
   [2. 공지사항 및 유틸리티]
   --------------------------------------------------------- */
function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (!noticePopup) return;
    const savedVersion = localStorage.getItem('hideNoticeVersion');
    const isHidden = localStorage.getItem('hideStressNotice') === 'true';
    if (savedVersion !== NOTICE_VERSION) {
        localStorage.removeItem('hideStressNotice');
        noticePopup.style.display = 'flex';
    } else if (!isHidden) {
        noticePopup.style.display = 'flex';
    }
}

function closeNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (noticePopup) noticePopup.style.display = 'none';
}

function closeNoticeForever() {
    localStorage.setItem('hideStressNotice', 'true');
    localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
    closeNotice();
}

function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

function getNum(val) {
    if (!val) return 0;
    return Number(val.toString().replace(/,/g, "")) || 0;
}

/* ---------------------------------------------------------
   [3. 부채 항목 제어]
   --------------------------------------------------------- */
function addLoan() {
    loanCount++;
    const loanList = document.getElementById('loanList');
    if (!loanList) return;

    const html = `
    <div class="input-card" id="loan_${loanCount}">
        <button class="btn-remove" onclick="removeLoan(${loanCount})">×</button>
        <div class="grid-row">
            <div>
                <label>대출 종류</label>
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
            <div>
                <label>스트레스 금리</label>
                <select class="l-sr-select">
                    <option value="1.15" selected>60개월변동 (1.15%)</option>
                    <option value="2.87">6,12개월변동 (2.87%)</option>
                    <option value="0.0">해당없음 (0.0%)</option>
                </select>
            </div>
            <div><label>기간 (개월)</label><input type="text" class="l-m" inputmode="numeric" value="360"></div>
        </div>
        <div class="dynamic-guide" id="guide_${loanCount}"></div>
    </div>`;
    loanList.insertAdjacentHTML('beforeend', html);
}

function removeLoan(id) {
    const el = document.getElementById(`loan_${id}`);
    if (el) el.remove();
}

function applyPolicy(id) {
    const card = document.getElementById(`loan_${id}`);
    const cat = card.querySelector('.l-category').value;
    const m = card.querySelector('.l-m'); 
    const r = card.querySelector('.l-r');
    const srSelect = card.querySelector('.l-sr-select');
    const guide = card.querySelector('.dynamic-guide');

    if (cat === 'officetel' || cat === 'cardloan') {
        guide.style.display = 'block';
        if (cat === 'officetel') {
            guide.innerHTML = "⚠️ <b>오피스텔 긴급 체크포인트:</b><br>- 신규 구입인 경우 반드시 '주택담보대출' 항목을 선택하여 정확한 한도를 산출하시기 바랍니다.";
            m.value = "96"; r.placeholder = "5.5"; srSelect.value = "0.0";
        } else {
            guide.innerHTML = "⚠️ <b>카드론(장기카드대출) 안내:</b><br>- 카드론은 가상 만기가 3년(36개월)으로 고정 산정되어 DSR 수치가 급격히 상승할 수 있습니다.";
            m.value = "36"; r.placeholder = "13.0"; srSelect.value = "0.0";
        }
    } else {
        guide.style.display = 'none';
        srSelect.value = cat.includes('mortgage') ? "1.15" : "0.0";
        if (cat === 'credit') { m.value = "60"; r.placeholder = "6.0"; }
        else if (cat === 'jeonse') { m.value = "24"; r.placeholder = "4.2"; }
        else { m.value = "360"; r.placeholder = "4.5"; }
    }
}

/* ---------------------------------------------------------
   [4. 핵심 연산 및 검증 로직 - 수정됨]
   --------------------------------------------------------- */
function calculateTotalDSR() {
    // 1. 연소득 검증
    const incomeVal = document.getElementById('income').value;
    const income = getNum(incomeVal);
    if (income <= 0) { 
        showAlert("연간 세전 소득을 입력해주세요.", "income"); 
        return; 
    }
    
    // 2. 부채 항목 검증 (강화됨)
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) { 
        showAlert("부채 항목을 최소 하나 이상 추가해주세요."); 
        return; 
    }
    
    let missingAmount = false;
    let missingRate = false;

    // 순차 검증 루프
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const idx = item.id.split('_')[1];
        const pInput = item.querySelector('.l-p');
        const rInput = item.querySelector('.l-r');
        
        const pVal = getNum(pInput.value);
        const rVal = Number(rInput.value || 0);

        // 금액 미입력 시 즉시 중단 및 포커스
        if (pVal <= 0) {
            showAlert(`부채 항목의 <b>대출 금액</b>을 입력해주세요.`, `lp_${idx}`);
            return; // 함수 전체 종료
        }
        
        // 금리 미입력 여부만 체크 (나중에 한꺼번에 알림)
        if (rVal <= 0) missingRate = true;
    }

    // 금리 미입력 시 안내 후 진행 여부 결정
    if (missingRate) {
        showAlert("금리 미입력 항목은 시스템 <b>표준 금리</b>가 자동 적용됩니다.<br><br><span class='sub-text'>정확한 진단을 원하시면 실제 금리를 입력해 주세요.</span>", null, "ℹ️", true);
    } else {
        calculateLogic();
    }
}

function calculateLogic() {
    const income = getNum(document.getElementById('income').value);
    const items = document.querySelectorAll('[id^="loan_"]');
    let totalS = 0; let sumP = 0; let sumI_P = 0; let sumI_L = 0; let maxN = 0;
    let bR = 4.5; let bSR = 1.15; let bM = 360;

    items.forEach((item, index) => {
        const cat = item.querySelector('.l-category').value;
        const P = getNum(item.querySelector('.l-p').value);
        const R = Number(item.querySelector('.l-r').value || item.querySelector('.l-r').placeholder);
        const SR = Number(item.querySelector('.l-sr-select').value);
        const n = getNum(item.querySelector('.l-m').value);
        if (index === 0) { bR = R; bSR = SR; bM = n; }
        const r_s = (R + SR) / 1200; const r_real = R / 1200;
        if (P > 0) {
            if (cat === 'jeonse') totalS += P * (R / 100);
            else totalS += ((P * r_s * Math.pow(1+r_s, n)) / (Math.pow(1+r_s, n)-1)) * 12;
            if ((cat.includes('mortgage') || cat === 'officetel') && n >= 180 && n <= 600) {
                sumP += P; sumI_P += (P * r_real * (n + 1) / 2);
                const mPMT = (P * r_real * Math.pow(1+r_real, n)) / (Math.pow(1+r_real, n)-1);
                sumI_L += (mPMT * n) - P; if (n > maxN) maxN = n;
            }
        }
    });

    const dsr = (totalS / income) * 100;
    const r_lim = (bR + bSR) / 1200;
    const maxP = (income * 0.4 / 12) / (1 / bM + (r_lim * 0.5));
    const addLim = (income * 0.4 - totalS) > 0 ? (income * 0.4 - totalS) / 12 / (1 / bM + (r_lim * 0.5)) : 0;

    document.getElementById('resultArea').style.display = 'block';
    const dsrView = document.getElementById('dsrVal');
    const barView = document.getElementById('dsrBar');
    dsrView.innerText = dsr.toFixed(2) + "%";
    dsrView.className = dsr > 40 ? "dsr-main-val dsr-danger" : "dsr-main-val dsr-safe";
    barView.style.backgroundColor = dsr > 40 ? "var(--danger)" : "var(--safe)";
    barView.style.width = Math.min(dsr, 100) + "%";

    document.getElementById('absMaxPrin').innerText = (Math.floor(maxP/10000)*10000).toLocaleString() + " 원";
    document.getElementById('absMaxLevel').innerText = (Math.floor((((income*0.4/12)*(Math.pow(1+r_lim,bM)-1))/(r_lim*Math.pow(1+r_lim,bM)))/10000)*10000).toLocaleString() + " 원";
    document.getElementById('remainingLimit').innerText = (Math.floor(addLim/10000)*10000).toLocaleString() + " 원";

    const prinCard = document.getElementById('prinCard');
    const levelCard = document.getElementById('levelCard');
    if (dsr > 32) { prinCard.classList.add('recommended'); levelCard.classList.remove('recommended'); }
    else { levelCard.classList.add('recommended'); prinCard.classList.remove('recommended'); }

    const f = (v) => Math.floor(v).toLocaleString() + "원";
    const divM = maxN || 360;
    const updateUI = (type, sI) => {
        document.getElementById(`vis_m_p_${type}`).innerText = f(sumP / divM);
        document.getElementById(`vis_m_i_${type}`).innerText = f(sI / divM);
        document.getElementById(`vis_m_t_${type}`).innerText = f((sumP + sI) / divM);
        document.getElementById(`vis_t_i_${type}`).innerText = f(sI);
        document.getElementById(`vis_total_full_${type}`).innerText = f(sumP + sI);
    };
    updateUI('p', sumI_P); updateUI('l', sumI_L);
    
    document.getElementById('recDesc').innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> DSR이 임계치입니다. <b>원금균등</b> 방식을 권장합니다." : "<b>✅ 자금 건전성 양호:</b> 현재 적정 수준입니다. <b>원리금균등</b> 방식을 권장합니다.";
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

/* ---------------------------------------------------------
   [5. 알림 및 리포트 복사]
   --------------------------------------------------------- */
function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; 
    proceedOnConfirm = allowProceed;
    if (modal) modal.style.display = 'flex';
}

function handleModalConfirm() {
    document.getElementById('customModal').style.display = 'none';
    if (proceedOnConfirm) {
        calculateLogic();
    } else if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { el.focus(); if (el.tagName === 'INPUT') el.click(); }, 500);
        }
    }
}

function copyResultText() {
    const income = document.getElementById('income').value;
    const dsr = document.getElementById('dsrVal').innerText;
    const addLim = document.getElementById('remainingLimit').innerText;
    const maxP = document.getElementById('absMaxPrin').innerText;
    const maxL = document.getElementById('absMaxLevel').innerText;
    const tiP = document.getElementById('vis_t_i_p').innerText;
    const tiL = document.getElementById('vis_t_i_l').innerText;
    const recMsgRaw = document.getElementById('recDesc').innerText;
    const recMsg = recMsgRaw.includes(':') ? recMsgRaw.split(':')[1].trim() : recMsgRaw;

    const reportText = `[📊 DSR 정밀 분석 결과 리포트]\n\n● 연간 세전 소득: ${income}원\n● 현재 종합 DSR: ${dsr}\n● 추가 대출 여력: ${addLim}\n-------------------------------\n🎯 방식별 최대 대출 한도\n- 원금균등 방식 : ${maxP}\n- 원리금균등 방식 : ${maxL}\n-------------------------------\n💸 총 이자 지출 비교 (예상)\n- 원금균등 시 총 이자: ${tiP}\n- 원리금균등 시 총 이자: ${tiL}\n-------------------------------\n💡 분석 의견\n"${recMsg}"\n\n* 위 결과는 산출 예상치이며 실제와 다를 수 있습니다.`;

    const tempTextArea = document.createElement("textarea");
    document.body.appendChild(tempTextArea);
    tempTextArea.value = reportText;
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
    showAlert("분석 리포트가 복사되었습니다!", null, "✅");
}
