const NOTICE_VERSION = "0781_ROLLBACK"; 
let loanCount = 0;
let lastFocusId = null;
let proceedOnConfirm = false;
let currentScheduleType = 'P';

window.onload = function() {
    initNotice();
    addLoan();
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* --- 공지사항 및 모달 --- */
function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    const saved = localStorage.getItem('hideNoticeVersion');
    if (saved !== NOTICE_VERSION) {
        localStorage.removeItem('hideStressNotice');
        localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
        noticePopup.style.display = 'flex';
    } else if (localStorage.getItem('hideStressNotice') !== 'true') {
        noticePopup.style.display = 'flex';
    }
}
function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() { localStorage.setItem('hideStressNotice', 'true'); closeNotice(); }

function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    lastFocusId = focusId; proceedOnConfirm = allowProceed;
    document.getElementById('customModal').style.display = 'flex';
}

function handleModalConfirm() {
    document.getElementById('customModal').style.display = 'none';
    if (proceedOnConfirm) calculateLogic();
    else if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { el.focus(); el.click(); }, 500);
        }
    }
}

/* --- 부채 관리 --- */
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val ? Number(val).toLocaleString() : "";
}
function getNum(v) { return Number(v.toString().replace(/,/g, "")) || 0; }

function addLoan() {
    loanCount++;
    const html = `<div class="input-card" id="loan_${loanCount}">
        <button class="btn-remove" onclick="document.getElementById('loan_${loanCount}').remove()">×</button>
        <div class="grid-row">
            <div><label>대출 종류</label><select class="l-category" onchange="applyPolicy(${loanCount})">
                <option value="mortgage_level">주택담보(원리금)</option><option value="mortgage_prin">주택담보(원금)</option>
                <option value="jeonse">전세(만기)</option><option value="officetel">오피스텔</option>
                <option value="credit">신용대출</option><option value="cardloan">카드론</option>
            </select></div>
            <div><label>대출금액(원)</label><input type="text" id="lp_${loanCount}" class="l-p" onkeyup="formatComma(this)" placeholder="0"></div>
            <div><label>금리(%)</label><input type="text" id="lr_${loanCount}" class="l-r" placeholder="4.5"></div>
            <div><label>스트레스</label><select class="l-sr-select"><option value="1.15">1.15%</option><option value="0">0%</option></select></div>
            <div><label>기간(월)</label><input type="text" class="l-m" value="360"></div>
        </div>
    </div>`;
    document.getElementById('loanList').insertAdjacentHTML('beforeend', html);
}

/* --- 연산 및 스케줄 --- */
function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) return showAlert("연소득을 입력하세요.", "income");
    calculateLogic();
}

function calculateLogic() {
    const income = getNum(document.getElementById('income').value);
    const items = document.querySelectorAll('[id^="loan_"]');
    let totalS = 0; let sumP = 0, sumI_P = 0, sumI_L = 0, maxN = 0;

    items.forEach((item, index) => {
        const P = getNum(item.querySelector('.l-p').value);
        const R = Number(item.querySelector('.l-r').value || 4.5);
        const SR = Number(item.querySelector('.l-sr-select').value);
        const n = getNum(item.querySelector('.l-m').value);
        const r_s = (R + SR) / 1200; const r_real = R / 1200;
        
        if (P > 0) {
            totalS += ((P * r_s * Math.pow(1+r_s, n)) / (Math.pow(1+r_s, n)-1)) * 12;
            sumP += P; sumI_P += (P * r_real * (n + 1) / 2);
            const mPMT = (P * r_real * Math.pow(1+r_real, n)) / (Math.pow(1+r_real, n)-1);
            sumI_L += (mPMT * n) - P; if(n > maxN) maxN = n;
        }
    });

    const dsr = (totalS / income) * 100;
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('btnShowSchedule').style.display = 'block';
    document.getElementById('dsrVal').innerText = dsr.toFixed(2) + "%";
    document.getElementById('dsrBar').style.width = Math.min(dsr, 100) + "%";
    document.getElementById('dsrBar').style.backgroundColor = dsr > 40 ? "var(--danger)" : "var(--safe)";
    
    if (document.getElementById('scheduleSection').style.display === 'block') generateSchedule();
}

function generateSchedule() {
    const target = document.querySelectorAll('[id^="loan_"]')[0];
    if(!target) return;
    const P = getNum(target.querySelector('.l-p').value);
    const R = Number(target.querySelector('.l-r').value || 4.5);
    const n = getNum(target.querySelector('.l-m').value);
    const r = R / 1200;
    const listEl = document.getElementById('scheduleList');
    listEl.innerHTML = "";
    let balance = P;
    const mP = P / n; const mPMT = (P * r * Math.pow(1+r, n)) / (Math.pow(1+r, n)-1);

    for (let i = 1; i <= n; i++) {
        if (i > 1 && (i - 1) % 12 === 0) {
            const yearDiv = document.createElement('div');
            yearDiv.className = 'year-divider';
            yearDiv.innerText = `📅 실행 ${(i - 1) / 12}년 경과 (잔액: ${Math.floor(balance).toLocaleString()}원)`;
            listEl.appendChild(yearDiv);
        }
        let curP, curI;
        if (currentScheduleType === 'P') { curI = balance * r; curP = mP; balance -= curP; }
        else { curI = balance * r; curP = mPMT - curI; balance -= curP; }
        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        itemDiv.innerHTML = `<div>${i}회</div><div>${Math.floor(curP).toLocaleString()}</div><div>${Math.floor(curI).toLocaleString()}</div><div>${Math.max(0, Math.floor(balance)).toLocaleString()}</div>`;
        listEl.appendChild(itemDiv);
    }
}

function toggleSchedule() {
    const sec = document.getElementById('scheduleSection');
    const btn = document.getElementById('btnShowSchedule');
    if (sec.style.display === 'none' || sec.style.display === '') {
        generateSchedule(); sec.style.display = 'block'; btn.innerText = "🔼 스케줄 접기";
    } else {
        sec.style.display = 'none'; btn.innerText = "📊 전체 상환 스케줄 상세 보기";
    }
}

function switchSchedule(type) {
    currentScheduleType = type;
    document.getElementById('tabPrin').classList.toggle('active', type === 'P');
    document.getElementById('tabLevel').classList.toggle('active', type === 'L');
    generateSchedule();
}
