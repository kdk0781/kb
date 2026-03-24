/* [DSR 정밀 진단 계산기 - 통합 관리 마스터 스크립트] */
const NOTICE_VERSION = "0781_1"; 
let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;
let currentScheduleType = 'P';

window.onload = function() {
    initNotice(); 
    addLoan();    
    initThemeObserver(); // 테마 감시 추가
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

/* [기존 로직 동일] */
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

function getNum(val) { return Number(val.toString().replace(/,/g, "")) || 0; }

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
                    <option value="1.15" selected>60개월 (1.15%)</option>
                    <option value="2.87">6개월 (2.87%)</option>
                    <option value="0.0">해당없음</option>
                </select>
            </div>
            <div><label>기간 (개월)</label><input type="text" class="l-m" inputmode="numeric" value="360"></div>
        </div>
        <div class="dynamic-guide" id="guide_${loanCount}"></div>
    </div>`;
    loanList.insertAdjacentHTML('beforeend', html);
}

// ... (calculateTotalDSR, calculateLogic, generateSchedule 등 기존의 모든 함수 전체 포함)

/* [추가] 시스템 테마 감시 */
function initThemeObserver() {
    const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (isDark) => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#121212' : '#f4f7f9');
    };
    updateTheme(themeMedia.matches);
    themeMedia.addEventListener('change', e => updateTheme(e.matches));
}
