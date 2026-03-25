/* =============================================================================
   [DSR CORE SYSTEM - PREMIMUM ENHANCED VER 2026.03.25]
   1. 시스템 설정 및 테마 엔진 (Theme & Setup)
   2. 정밀 유효성 검증 및 시각 피드백 (Validation & Warning)
   3. 부채 항목 동적 관리 및 정책 바인딩 (Dynamic Management)
   4. 고도화된 DSR 연산 엔진 (Calculation Engine)
   5. [FIX] 데스크탑/모바일 통합 스크롤 로직 최적화 (UI & Scroll)
   6. [NEW] 상환스케줄 순서 변경 및 N년차 잔액 디자인 고도화 (Schedule UI)
   7. 시스템 알림 및 리포트 제어 (System Interface)
   ============================================================================= */

// [1] 시스템 설정 및 초기 상태
const NOTICE_VERSION = "0781_0"; 
const CONFIG = {
    DEFAULT_RATE: 4.5,
    DSR_LIMIT: 40,
    MIN_INCOME: 1000000
};
let loanCount = 0; 
let currentScheduleType = 'P'; 
let lastFocusId = null; 
let proceedOnConfirm = false; 

window.onload = function() {
    applySystemTheme(); 
    initNotice(); 
    addLoan(); 
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm; 
};

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

// [2] 정밀 유효성 검증 및 시각 피드백
function setWarning(id, isError) {
    const el = document.getElementById(id);
    if (el) {
        isError ? el.classList.add('input-warning') : el.classList.remove('input-warning');
    }
}

function calculateTotalDSR() {
    document.querySelectorAll('.input-warning').forEach(el => el.classList.remove('input-warning'));
    const incomeVal = document.getElementById('income');
    const income = getNum(incomeVal.value);
    
    if (income < CONFIG.MIN_INCOME) {
        setWarning('income', true);
        showAlert("연간 세전 소득을 100만원 이상 입력해주세요.", "income"); 
        return; 
    }

    const items = document.querySelectorAll('[id^="loan_"]');
    if (items.length === 0) { showAlert("부채 항목을 최소 하나 이상 추가해주세요."); return; }

    let hasFatalError = false;
    let missingRateFields = []; 

    for (let item of items) {
        const pEl = item.querySelector('.l-p');
        const mEl = item.querySelector('.l-m');
        const rInput = item.querySelector('.l-r');

        if (getNum(pEl.value) <= 0) {
            setWarning(pEl.id, true);
            showAlert("대출 금액을 입력해주세요.", pEl.id);
            hasFatalError = true; break; 
        }
        if (getNum(mEl.value) < 1) {
            setWarning(mEl.id, true);
            showAlert("대출 기간을 입력해주세요.", mEl.id);
            hasFatalError = true; break;
        }
        if (!rInput.value.trim()) {
            missingRateFields.push(rInput);
        }
    }

    if (hasFatalError) return;

    if (missingRateFields.length > 0) {
        missingRateFields.forEach(field => field.classList.add('input-warning'));
        showAlert("금리 미입력 항목은 표준 금리가 적용됩니다.", null, "ℹ️", true);
    } else {
        calculateLogic();
    }
}

// [3] 부채 항목 동적 관리 및 다이나믹 가이드 복구
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
            <div><label>기간 (개월)</label><input type="text" id="lm_${loanCount}" class="l-m" inputmode="numeric" value="360"></div>
        </div>
        <div class="dynamic-guide" id="guide_${loanCount}"></div>
    </div>`;
    loanList.insertAdjacentHTML('beforeend', html);
}

function applyPolicy(id) {
    const card = document.getElementById(`loan_${id}`);
    const cat = card.querySelector('.l-category').value;
    const m = card.querySelector('.l-m'); 
    const r = card.querySelector('.l-r');
    const srSelect = card.querySelector('.l-sr-select');
    const guide = card.querySelector('.dynamic-guide');

    guide.style.display = 'none';

    if (cat === 'officetel' || cat === 'cardloan') {
        guide.style.display = 'block';
        if (cat === 'officetel') {
            guide.innerHTML = "⚠️ 오피스텔 보유분은 8년 상환 규정이 적용됩니다.";
            m.value = "96"; r.placeholder = "5.5"; srSelect.value = "0.0";
        } else {
            guide.innerHTML = "⚠️ 카드론은 가상 만기 3년이 고정 적용됩니다.";
            m.value = "36"; r.placeholder = "13.0"; srSelect.value = "0.0";
        }
    } else {
        srSelect.value = cat.includes('mortgage') ? "1.15" : "0.0";
        m.value = cat === 'credit' ? "60" : (cat === 'jeonse' ? "24" : "360");
    }
}

// [4] 핵심 연산 및 스크롤 고도화
function calculateLogic() {
    const income = getNum(document.getElementById('income').value);
    const items = document.querySelectorAll('[id^="loan_"]');
    let totalAnnPayment = 0;
    let combinedP = 0;
    let bR = 4.5, bSR = 1.15, bM = 360;

    items.forEach((item, index) => {
        const P = getNum(item.querySelector('.l-p').value);
        const R = Number(item.querySelector('.l-r').value || CONFIG.DEFAULT_RATE);
        const SR = Number(item.querySelector('.l-sr-select')?.value || 0);
        let n = getNum(item.querySelector('.l-m').value || 360);
        const cat = item.querySelector('.l-category').value;

        if (index === 0) { bR = R; bSR = SR; bM = n; }
        const r_dsr = (R + SR) / 1200;

        if (P > 0) {
            const isPurchase = cat.includes('mortgage') || (cat === 'officetel' && n >= 180);
            if (isPurchase) {
                combinedP += P;
                if (cat.includes('_prin')) {
                    totalAnnPayment += (P / n * 12) + (P * r_dsr * (n + 1) / 2) / (n / 12);
                } else {
                    const mPMT = (P * r_dsr * Math.pow(1 + r_dsr, n)) / (Math.pow(1 + r_dsr, n) - 1);
                    totalAnnPayment += mPMT * 12;
                }
            } else {
                const targetN = (cat === 'officetel' && n < 180) ? 96 : (cat === 'jeonse' ? 1 : n);
                if (cat === 'jeonse') totalAnnPayment += (P * (R / 100));
                else {
                    const mPMT = (P * r_dsr * Math.pow(1 + r_dsr, targetN)) / (Math.pow(1 + r_dsr, targetN) - 1);
                    totalAnnPayment += mPMT * 12;
                }
            }
        }
    });

    const dsr = (totalAnnPayment / income) * 100;
    updateResultsUI(dsr, income, combinedP, bR, bSR, bM);
}

// [5] Desktop/Mobile 통합 스크롤 버그 수정
function updateResultsUI(dsr, income, combinedP, bR, bSR, bM) {
    const isOver = dsr > CONFIG.DSR_LIMIT;
    const resultArea = document.getElementById('resultArea');
    
    // 결과창 노출
    resultArea.style.display = 'block';
    
    const dsrView = document.getElementById('dsrVal');
    dsrView.innerText = dsr.toFixed(2) + "%";
    dsrView.style.color = isOver ? "#e74c3c" : "#2ecc71";
    
    const dsrBar = document.getElementById('dsrBar');
    dsrBar.style.width = Math.min(dsr, 100) + "%";
    dsrBar.style.backgroundColor = isOver ? "#e74c3c" : "#2ecc71";

    const targetAnnPay = income * 0.4;
    const r_lim = (bR + bSR) / 1200;
    const maxPrin = targetAnnPay / ((12 / bM) + (r_lim * (bM + 1) * 6 / bM));
    const maxLevel = (targetAnnPay / 12) * (Math.pow(1 + r_lim, bM) - 1) / (r_lim * Math.pow(1 + r_lim, bM));
    const f = (v) => (Math.floor(v / 10000) * 10000).toLocaleString() + " 원";

    const prinCard = document.getElementById('prinCard');
    const levelCard = document.getElementById('levelCard');
    const absMaxLevel = document.getElementById('absMaxLevel');

    document.getElementById('absMaxPrin').innerText = f(maxPrin);
    if (isOver) {
        absMaxLevel.innerText = "한도초과";
        absMaxLevel.style.color = "#e74c3c";
        levelCard.classList.remove('recommended');
        prinCard.classList.add('recommended'); 
    } else {
        absMaxLevel.innerText = f(maxLevel);
        absMaxLevel.style.color = "#e67e22"; 
        levelCard.classList.add('recommended'); 
        prinCard.classList.remove('recommended');
    }

    document.getElementById('remainingLimit').innerText = f(isOver ? 0 : Math.max(0, maxPrin - combinedP));

    updateDetailVisualization(combinedP, bR, bM);

    // [중요] 스크롤 미작동 해결: requestAnimationFrame과 정확한 좌표 계산 조합
    requestAnimationFrame(() => {
        setTimeout(() => {
            const rect = resultArea.getBoundingClientRect();
            const winTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPos = rect.top + winTop - 30; // 상단 30px 여유
            
            window.scrollTo({
                top: targetPos,
                behavior: 'smooth'
            });
        }, 100);
    });
}

// [6] 상환 스케줄 고도화 (요청 순서: 회차 | 원금 | 이자 | 합계)
function generateSchedule() {
    const items = document.querySelectorAll('[id^="loan_"]');
    const target = items[0];
    const P = getNum(target.querySelector('.l-p').value);
    const R = Number(target.querySelector('.l-r').value || CONFIG.DEFAULT_RATE);
    const n = getNum(target.querySelector('.l-m').value);
    const r = R / 1200;

    const listEl = document.getElementById('scheduleList');
    listEl.innerHTML = ""; 

    let balance = P;
    const mP = P / n; 
    const mPMT = (P * r * Math.pow(1+r, n)) / (Math.pow(1+r, n)-1);

    let yearCumP = 0; let yearCumI = 0;

    for (let i = 1; i <= n; i++) {
        let curP, curI;
        if (currentScheduleType === 'P') {
            curI = balance * r; curP = mP; balance -= curP;
        } else {
            curI = balance * r; curP = mPMT - curI; balance -= curP;
        }

        yearCumP += curP; yearCumI += curI;
        const totalPay = Math.floor(curP + curI); 

        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        // 요청하신 순서: 회차 | 원금 | 이자 | 합계
        itemDiv.innerHTML = `
            <div class="sch-idx">${i}회</div>
            <div class="sch-val">${Math.floor(curP).toLocaleString()}</div>
            <div class="sch-val">${Math.floor(curI).toLocaleString()}</div>
            <div class="sch-total" style="font-weight:700; color:#2c3e50;">${totalPay.toLocaleString()}</div>
        `;
        listEl.appendChild(itemDiv);

        // [N년차 스타일 고도화 - 잔액 정보 포함]
        if (i % 12 === 0 || i === n) {
            const yearNum = Math.ceil(i / 12);
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'year-summary-card';
            summaryDiv.style.cssText = `
                background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f5 100%);
                padding: 15px; margin: 12px 0 25px 0; border-radius: 12px;
                border-left: 6px solid #3498db; box-shadow: 0 4px 10px rgba(0,0,0,0.08);
            `;
            summaryDiv.innerHTML = `
                <div style="font-weight:800; font-size:14px; color:#2c3e50; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📅 ${yearNum}년차 누적 상환 요약</span>
                    <span style="font-size:11px; background:#3498db; color:#fff; padding:2px 8px; border-radius:10px;">${(i/12).toFixed(0)}년 경과</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px; color:#495057;">
                    <div>누적원금: <b style="color:#2ecc71;">${Math.floor(yearCumP).toLocaleString()}</b></div>
                    <div>누적이자: <b style="color:#e74c3c;">${Math.floor(yearCumI).toLocaleString()}</b></div>
                </div>
                <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #ced4da; text-align:right; font-size:14px;">
                    현재 대출 잔액: <b style="color:#34495e; font-size:16px;">${Math.max(0, Math.floor(balance)).toLocaleString()}원</b>
                </div>
            `;
            listEl.appendChild(summaryDiv);
            yearCumP = 0; yearCumI = 0; 
        }
    }
}

// [7] 시스템 알림 및 공통 기능
function handleModalConfirm() {
    const modal = document.getElementById('customModal');
    if (modal) modal.style.display = 'none';

    if (proceedOnConfirm) {
        proceedOnConfirm = false;
        calculateLogic(); 
    } else if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    if (!modal) return;
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; proceedOnConfirm = allowProceed;
    modal.style.display = 'flex';
}

function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
    obj.classList.remove('input-warning');
}

function getNum(val) { return Number(val.toString().replace(/,/g, "")) || 0; }
function removeLoan(id) { document.getElementById(`loan_${id}`)?.remove(); }
function toggleSchedule() {
    const sec = document.getElementById('scheduleSection');
    const btn = document.getElementById('btnShowSchedule');
    const isShow = (sec.style.display === 'none' || sec.style.display === '');
    sec.style.display = isShow ? 'block' : 'none';
    btn.innerText = isShow ? "🔼 스케줄 접기" : "📊 전체 상환 스케줄 상세 보기";
    if (isShow) generateSchedule();
}
function switchSchedule(type) {
    currentScheduleType = type;
    document.getElementById('tabPrin').classList.toggle('active', type === 'P');
    document.getElementById('tabLevel').classList.toggle('active', type === 'L');
    generateSchedule();
}
function initNotice() { if (localStorage.getItem('hideStressNotice') !== 'true') document.getElementById('noticePopup').style.display = 'flex'; }
function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() { localStorage.setItem('hideStressNotice', 'true'); closeNotice(); }

function updateDetailVisualization(P, R, n) {
    const r = R / 1200;
    const f = (v) => Math.floor(v).toLocaleString() + "원";
    const totalInt_p = P * r * (n + 1) / 2;
    const mPMT_l = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    document.getElementById('vis_m_p_p').innerText = f(P / n);
    document.getElementById('vis_m_i_p').innerText = f(totalInt_p / n);
    document.getElementById('vis_m_t_p').innerText = f((P / n) + (totalInt_p / n)); 
    document.getElementById('vis_total_full_p').innerText = f(P + totalInt_p);
    document.getElementById('vis_m_t_l').innerText = f(mPMT_l);
    document.getElementById('vis_total_full_l').innerText = f(mPMT_l * n);
}

function copyResultText() {
    const dsr = document.getElementById('dsrVal').innerText;
    const limit = document.getElementById('remainingLimit').innerText;
    const reportText = `[📊 DSR 진단 리포트] \n● 종합 DSR: ${dsr} \n● 추가 대출 여력: ${limit}`;
    const temp = document.createElement("textarea");
    document.body.appendChild(temp);
    temp.value = reportText; temp.select(); document.execCommand("copy");
    document.body.removeChild(temp);
    showAlert("리포트가 복사되었습니다!", null, "✅");
}
