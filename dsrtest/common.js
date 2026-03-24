/* =============================================================================
   [DSR 정밀 진단 계산기 - 통합 관리 마스터 스크립트 고도화 버전]
   파일명: common.js
   업데이트: 2026. 03. 24.
   수정사항: 시스템 테마(다크모드) 실시간 동기화 및 입력 편의성 고도화
   ============================================================================= */

const NOTICE_VERSION = "0781_1"; // 버전 업그레이드

let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;
let currentScheduleType = 'P';

window.onload = function() {
    initNotice();
    addLoan();
    initThemeObserver(); // [추가] 시스템 테마 감시 시작
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* ---------------------------------------------------------
   [1] 시스템 테마 및 UI 고도화 로직
   --------------------------------------------------------- */

/**
 * 시스템 테마(다크모드) 변경을 실시간으로 감지하여 브라우저 UI 최적화
 */
function initThemeObserver() {
    const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateThemeMeta = (isDark) => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#121212' : '#f4f7f9');
        console.log(`[시스템 추론] ${isDark ? '다크' : '라이트'} 모드 최적화 완료`);
    };

    updateThemeMeta(themeMedia.matches);
    themeMedia.addEventListener('change', (e) => updateThemeMeta(e.matches));
}

/**
 * [추가] 입력 필드 포커스 시 자동 전체 선택 (사용자 편의성)
 */
function setupInputFocus() {
    const inputs = document.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.onfocus = function() { this.select(); };
    });
}

/* ---------------------------------------------------------
   [2] 공지사항 및 기본 유틸리티 (기존 로직 보존)
   --------------------------------------------------------- */

function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (!noticePopup) return;
    const savedVersion = localStorage.getItem('hideNoticeVersion');
    if (savedVersion !== NOTICE_VERSION) {
        localStorage.removeItem('hideStressNotice');
        localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
        noticePopup.style.display = 'flex';
    } else {
        if (localStorage.getItem('hideStressNotice') !== 'true') {
            noticePopup.style.display = 'flex';
        }
    }
}

function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() {
    localStorage.setItem('hideStressNotice', 'true');
    localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
    closeNotice();
}

function formatComma(obj) {
    let val = obj.value.replace(/[^0-9.]/g, ""); // 소수점 허용
    if (val.length > 0) {
        const parts = val.split('.');
        parts[0] = Number(parts[0]).toLocaleString();
        obj.value = parts.length > 1 ? parts.join('.') : parts[0];
    } else {
        obj.value = "";
    }
}

function getNum(val) {
    return Number(val.toString().replace(/,/g, "")) || 0;
}

/* ---------------------------------------------------------
   [3] 대출 항목 관리 및 정책 적용 (기존 로직 보존)
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
    setupInputFocus(); // 신규 생성된 입력창에 포커스 로직 적용
}

function removeLoan(id) { const el = document.getElementById(`loan_${id}`); if (el) el.remove(); }

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
            guide.innerHTML = "⚠️ <b>카드론 안내:</b> 가상 만기가 3년(36개월)으로 고정 산정됩니다.";
            m.value = "36"; r.placeholder = "13.0"; srSelect.value = "0.0";
        }
    } else {
        guide.style.display = 'none';
        srSelect.value = cat.includes('mortgage') ? "1.15" : "0.0";
        if (cat === 'credit') m.value = "60";
        else if (cat === 'jeonse') m.value = "24";
        else m.value = "360";
    }
}

/* ---------------------------------------------------------
   [4] 핵심 DSR 계산 엔진 (기존 로직 보존)
   --------------------------------------------------------- */

function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) { showAlert("연간 세전 소득을 입력해주세요.", "income"); return; }
    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) { showAlert("부채 항목을 최소 하나 이상 추가해주세요."); return; }
    
    let missingRate = false;
    items.forEach(item => {
        const idx = item.id.split('_')[1];
        if (getNum(item.querySelector('.l-p').value) <= 0) {
            showAlert(`부채 항목의 대출 금액을 입력해주세요.`, `lp_${idx}`);
            return;
        }
        if (Number(item.querySelector('.l-r').value || 0) <= 0) missingRate = true;
    });

    if (missingRate) showAlert("금리 미입력 항목은 <b>표준 금리</b>가 자동 적용됩니다.", null, "ℹ️", true);
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
        const r_s = (R + SR) / 1200;
        const r_real = R / 1200;

        if (P > 0) {
            if (cat === 'jeonse') totalS += P * (R / 100);
            else totalS += ((P * r_s * Math.pow(1+r_s, n)) / (Math.pow(1+r_s, n)-1)) * 12;

            if ((cat.includes('mortgage') || cat === 'officetel') && n >= 180) {
                sumP += P;
                sumI_P += (P * r_real * (n + 1) / 2);
                const mPMT = (P * r_real * Math.pow(1+r_real, n)) / (Math.pow(1+r_real, n)-1);
                sumI_L += (mPMT * n) - P;
                if (n > maxN) maxN = n;
            }
        }
    });

    const dsr = (totalS / income) * 100;
    const r_lim = (bR + bSR) / 1200;
    const maxP = (income * 0.4 / 12) / (1 / bM + (r_lim * 0.5));
    const addLim = (income * 0.4 - totalS) > 0 ? (income * 0.4 - totalS) / 12 / (1 / bM + (r_lim * 0.5)) : 0;

    // UI 반영
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

    const recCard = dsr > 32 ? ['prinCard', 'levelCard'] : ['levelCard', 'prinCard'];
    document.getElementById(recCard[0]).classList.add('recommended');
    document.getElementById(recCard[1]).classList.remove('recommended');
    document.getElementById('recDesc').innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> 원금균등 방식을 권장합니다." : "<b>✅ 자금 건전성 양호:</b> 원리금균등 방식을 권장합니다.";
    
    refreshScheduleUI();
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

/* ---------------------------------------------------------
   [5] 모달 및 상환 스케줄 제어 (기존 로직 보존)
   --------------------------------------------------------- */

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
    if (proceedOnConfirm) calculateLogic();
    else if (lastFocusId) {
        const targetEl = document.getElementById(lastFocusId);
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { targetEl.focus(); if (targetEl.tagName === 'INPUT') targetEl.click(); }, 300);
        }
    }
}

function copyResultText() {
    const reportText = `[📊 DSR 리포트] \n소득: ${document.getElementById('income').value}원 \nDSR: ${document.getElementById('dsrVal').innerText} \n여력: ${document.getElementById('remainingLimit').innerText}`;
    const temp = document.createElement("textarea");
    document.body.appendChild(temp); temp.value = reportText; temp.select();
    document.execCommand("copy"); document.body.removeChild(temp);
    showAlert("리포트가 복사되었습니다!", null, "✅");
}

function refreshScheduleUI() {
    const btn = document.getElementById('btnShowSchedule');
    if (btn) btn.style.display = 'block';
    if (document.getElementById('scheduleSection').style.display === 'block') generateSchedule();
}

function generateSchedule() {
    const items = document.querySelectorAll('[id^="loan_"]');
    let target = items[0];
    items.forEach(item => { if(item.querySelector('.l-category').value.includes('mortgage')) target = item; });

    const P = getNum(target.querySelector('.l-p').value);
    const R = Number(target.querySelector('.l-r').value || target.querySelector('.l-r').placeholder);
    const n = getNum(target.querySelector('.l-m').value);
    const r = R / 1200;
    const listEl = document.getElementById('scheduleList');
    listEl.innerHTML = "";

    let balance = P;
    const mP = P / n;
    const mPMT = (P * r * Math.pow(1+r, n)) / (Math.pow(1+r, n)-1);

    for (let i = 1; i <= n; i++) {
        if (i > 1 && (i - 1) % 12 === 0) {
            const yearDiv = document.createElement('div');
            yearDiv.className = 'year-divider';
            yearDiv.innerText = `📅 ${ (i - 1) / 12 }년 경과 (잔액: ${Math.floor(balance).toLocaleString()}원)`;
            listEl.appendChild(yearDiv);
        }
        let curP = currentScheduleType === 'P' ? mP : mPMT - (balance * r);
        let curI = balance * r;
        balance -= curP;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        itemDiv.innerHTML = `<div class="sch-num">${i}회</div><div>${Math.floor(curP).toLocaleString()}</div><div>${Math.floor(curI).toLocaleString()}</div><div>${Math.max(0, Math.floor(balance)).toLocaleString()}</div>`;
        listEl.appendChild(itemDiv);
    }
}

function toggleSchedule() {
    const sec = document.getElementById('scheduleSection');
    const btn = document.getElementById('btnShowSchedule');
    const isHidden = sec.style.display === 'none' || sec.style.display === '';
    if (isHidden) generateSchedule();
    sec.style.display = isHidden ? 'block' : 'none';
    btn.innerText = isHidden ? "🔼 스케줄 접기" : "📊 전체 상환 스케줄 상세 보기";
}

function switchSchedule(type) {
    currentScheduleType = type;
    document.getElementById('tabPrin').classList.toggle('active', type === 'P');
    document.getElementById('tabLevel').classList.toggle('active', type === 'L');
    generateSchedule();
}
