/* =============================================================================
   [DSR 정밀 진단 계산기 - 통합 관리 마스터 스크립트]
   파일명: common.js
   최종 업데이트: 2026. 03. 23.
   수정사항: 모바일 공지사항 버전 변경 시 즉시 반영되지 않는 오류 해결
   ============================================================================= */

/* ---------------------------------------------------------
   [1. 전역 설정 및 초기화]
   --------------------------------------------------------- */
// 공지 내용 변경 시 이 숫자를 2, 3 등으로 올리면 무조건 다시 뜹니다.
const NOTICE_VERSION = "2"; 

let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;

window.onload = function() {
    initNotice(); // 공지사항 체크 및 로드
    addLoan();    // 첫 번째 부채 항목 자동 생성
    
    // 모달 확인 버튼 이벤트 연결
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* ---------------------------------------------------------
   [2. 공지사항 제어 - 오류 수정 버전]
   --------------------------------------------------------- */
function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (!noticePopup) return;

    // 저장된 버전 정보와 숨김 처리 여부 확인
    const savedVersion = localStorage.getItem('hideNoticeVersion');
    const isHidden = localStorage.getItem('hideStressNotice') === 'true';

    /**
     * [FIX] 버전 변경 시 즉시 노출 로직
     * 1. 저장된 버전이 현재 버전과 다르면 무조건 팝업 노출 (데이터 초기화 포함)
     * 2. 버전은 같지만 숨김 처리를 하지 않은 상태여도 팝업 노출
     */
    if (savedVersion !== NOTICE_VERSION) {
        // 버전이 다르면 '다시 보지 않기' 기록을 초기화하여 공지를 강제로 띄움
        localStorage.removeItem('hideStressNotice');
        localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
        noticePopup.style.display = 'flex';
    } else {
        // 버전이 같은 경우에만 기존의 숨김 설정을 따름
        if (!isHidden) {
            noticePopup.style.display = 'flex';
        }
    }
}

function closeNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (noticePopup) noticePopup.style.display = 'none';
}

function closeNoticeForever() {
    // 현재 버전을 저장하고 영구 숨김 처리
    localStorage.setItem('hideStressNotice', 'true');
    localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
    closeNotice();
}

/* ---------------------------------------------------------
   [3. 유틸리티 함수]
   --------------------------------------------------------- */
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

function getNum(val) {
    if (!val) return 0;
    return Number(val.toString().replace(/,/g, "")) || 0;
}

/* ---------------------------------------------------------
   [4. 부채 항목 제어 로직]
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
            guide.innerHTML = "⚠️ <b>오피스텔 긴급 체크포인트:</b><br>- 신규 구입인 경우 반드시 '주택담보대출' 항목을 선택하여 정확한 한도를 산출하시기 바랍니다.<br>- 이미 소유 중인 오피스텔 담보대출을 보유한 경우에만 이 항목(8년 상환 가정)을 유지하십시오.";
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
   [5. 핵심 연산 및 UI 시각화]
   --------------------------------------------------------- */
function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) { showAlert("연간 세전 소득을 입력해주세요.", "income"); return; }
    
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) { showAlert("부채 항목을 최소 하나 이상 추가해주세요."); return; }
    
    let missingRate = false;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const idx = item.id.split('_')[1];
        if (getNum(item.querySelector('.l-p').value) <= 0) {
            showAlert(`부채 항목의 <b>대출 금액</b>을 입력해주세요.`, `lp_${idx}`);
            return;
        }
        if (Number(item.querySelector('.l-r').value || 0) <= 0) missingRate = true;
    }

    if (missingRate) showAlert("금리 미입력 항목은 시스템 <b>표준 금리</b>가 자동 적용됩니다.", null, "ℹ️", true);
    else calculateLogic();
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

    const f = (v) => Math.floor(v).toLocaleString() + "원";
    const divM = maxN || 360;
    const updateUI = (type, sI) => {
        const mP = sumP / divM; const mI = sI / divM;
        document.getElementById(`vis_m_p_${type}`).innerText = f(mP);
        document.getElementById(`vis_m_i_${type}`).innerText = f(mI);
        document.getElementById(`vis_m_t_${type}`).innerText = f(mP + mI);
        document.getElementById(`vis_y_p_${type}`).innerText = f(mP * 12);
        document.getElementById(`vis_y_i_${type}`).innerText = f(mI * 12);
        document.getElementById(`vis_y_t_${type}`).innerText = f((mP + mI) * 12);
        document.getElementById(`vis_t_p_${type}`).innerText = f(sumP);
        document.getElementById(`vis_t_i_${type}`).innerText = f(sI);
        document.getElementById(`vis_total_full_${type}`).innerText = f(sumP + sI);
    };
    updateUI('p', sumI_P); updateUI('l', sumI_L);
    
    if (dsr > 32) { 
        document.getElementById('prinCard').classList.add('recommended'); 
        document.getElementById('levelCard').classList.remove('recommended'); 
    } else { 
        document.getElementById('levelCard').classList.add('recommended'); 
        document.getElementById('prinCard').classList.remove('recommended'); 
    }

    document.getElementById('recDesc').innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> 현재 DSR이 임계치에 도달했습니다. <b>한도가 약 10% 더 유리한 '원금균등'</b> 방식을 통해 여력을 확보하시길 강력 추천합니다." : "<b>✅ 자금 건전성 양호:</b> 현재 소득 대비 부채 비율이 적정합니다. <b>안정적인 가계 지출이 가능한 '원리금균등'</b> 방식을 권장합니다.";
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

/* ---------------------------------------------------------
   [6. 알림 및 리포트 복사]
   --------------------------------------------------------- */
function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; proceedOnConfirm = allowProceed;
    if (modal) modal.style.display = 'flex';
}

function handleModalConfirm() {
    document.getElementById('customModal').style.display = 'none';
    if (proceedOnConfirm) calculateLogic();
    else if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 500); }
    }
}

function copyResultText() {
    const inc = document.getElementById('income').value;
    const dsr = document.getElementById('dsrVal').innerText;
    const addLim = document.getElementById('remainingLimit').innerText;
    const maxP = document.getElementById('absMaxPrin').innerText;
    const maxL = document.getElementById('absMaxLevel').innerText;
    const tiP = document.getElementById('vis_t_i_p').innerText;
    const tiL = document.getElementById('vis_t_i_l').innerText;
    const recMsgRaw = document.getElementById('recDesc').innerText;
    const recMsg = recMsgRaw.includes(':') ? recMsgRaw.split(':')[1].trim() : recMsgRaw;

    const reportText = `[📊 DSR 정밀 진단 리포트]\n\n● 나의 소득 상황: ${inc}원\n● 현재 종합 DSR: ${dsr}\n● 추가 대출 여력: ${addLim}\n----------------------------\n🎯 방식별 최대 대출 한도\n- 원금균등 방식: ${maxP}\n- 원리금균등 방식: ${maxL}\n----------------------------\n💸 총 이자 지출 비교 (예상)\n- 원금균등 시 총 이자: ${tiP}\n- 원리금균등 시 총 이자: ${tiL}\n----------------------------\n💡 전문가 분석 의견\n"${recMsg}"\n\n* 위 결과는 산출 예상치이며, 실제 심사 결과와 다를 수 있습니다.`;

    const temp = document.createElement("textarea");
    document.body.appendChild(temp);
    temp.value = reportText;
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    showAlert("정밀 분석 리포트가 복사되었습니다!<br>원하는 곳에 붙여넣기 하세요.", null, "✅");
}
