const NOTICE_VERSION = "0781_FIXED"; 
let loanCount = 0;
let lastFocusId = null;
let currentScheduleType = 'P';

window.onload = function() {
    initNotice();
    addLoan();
    document.getElementById('modalConfirm').onclick = handleModalConfirm;
};

/* 공지사항 & 모달 */
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

function showAlert(msg, focusId = null) {
    document.getElementById('modalMsg').innerHTML = msg;
    lastFocusId = focusId;
    document.getElementById('customModal').style.display = 'flex';
}
function handleModalConfirm() {
    document.getElementById('customModal').style.display = 'none';
    if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => { el.focus(); el.click(); }, 500); }
    }
}

/* 부채 로직 */
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val ? Number(val).toLocaleString() : "";
}
function getNum(v) { return Number(v.toString().replace(/,/g, "")) || 0; }

function addLoan() {
    loanCount++;
    const html = `<div class="input-card" id="loan_${loanCount}">
        <button class="btn-remove" style="position:absolute;top:-10px;right:-10px;width:30px;height:30px;border-radius:50%;border:1px solid #ddd;background:#fff;cursor:pointer;" onclick="document.getElementById('loan_${loanCount}').remove()">×</button>
        <div class="grid-row">
            <div><label>종류</label><select class="l-category"><option value="mortgage">주택담보</option><option value="credit">신용대출</option></select></div>
            <div><label>금액(원)</label><input type="text" id="lp_${loanCount}" class="l-p" onkeyup="formatComma(this)" placeholder="0"></div>
            <div><label>금리(%)</label><input type="text" class="l-r" placeholder="4.5"></div>
            <div><label>스트레스</label><select class="l-sr"><option value="1.15">1.15%</option><option value="0">0%</option></select></div>
            <div><label>기간(월)</label><input type="text" class="l-m" value="360"></div>
        </div>
    </div>`;
    document.getElementById('loanList').insertAdjacentHTML('beforeend', html);
}

/* 계산 및 버튼 노출 */
function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) return showAlert("연소득을 입력하세요.", "income");
    
    // 연산 실행 후 버튼 노출
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('btnShowSchedule').style.display = 'block'; 
    
    // [연산 결과 대입 로직 생략 - 기존 마스터본 적용]
    document.getElementById('dsrVal').innerText = "분석완료"; 
    
    if(document.getElementById('scheduleSection').style.display === 'block') generateSchedule();
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
            yearDiv.innerText = `📅 실행 ${(i - 1) / 12}년 경과`;
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
