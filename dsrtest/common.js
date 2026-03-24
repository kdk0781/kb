/* =============================================================================
   [DSR 정밀 진단 계산기 - 260323_F 마스터 순정 로직]
   파일명: common.js
   특이사항: 레이아웃 보존형 정밀 계산 엔진 및 한글 주석 적용본
   ============================================================================= */

let loanCount = 0;
let lastFocusId = null;

window.onload = function() {
    // 페이지 로드 시 기본 항목 1개 생성
    addLoan();
    
    // 모달 확인 버튼 이벤트 연결
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

// [1] 입력 유틸리티: 콤마 처리 및 숫자 추출
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

function getNum(val) {
    return Number(val.toString().replace(/,/g, "")) || 0;
}

// [2] 대출 항목 동적 추가 (260323_F 그리드 구조 준수)
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
                <select class="l-category">
                    <option value="mortgage_level">주택담보 (원리금)</option>
                    <option value="mortgage_prin">주택담보 (원금)</option>
                    <option value="jeonse">전세대출 (이자만)</option>
                    <option value="officetel">오피스텔 (원리금)</option>
                    <option value="credit">신용대출 (원리금)</option>
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
    </div>`;
    loanList.insertAdjacentHTML('beforeend', html);
}

function removeLoan(id) {
    const el = document.getElementById(`loan_${id}`);
    if (el) el.remove();
}

// [3] 핵심 계산 엔진: 상환 방식별 정밀 DSR 산식
function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    
    // 유효성 체크: 소득 미입력 시 알림
    if (income <= 0) {
        showAlert("연간 세전 소득을 입력해주세요.", "income");
        return;
    }

    const items = document.querySelectorAll('[id^="loan_"]');
    let totalAnnPay = 0;

    items.forEach((item) => {
        const cat = item.querySelector('.l-category').value;
        const P = getNum(item.querySelector('.l-p').value);
        const R = Number(item.querySelector('.l-r').value || 4.5);
        const SR = Number(item.querySelector('.l-sr-select').value);
        const n = getNum(item.querySelector('.l-m').value);

        const r_annual = (R + SR) / 100; // 스트레스 금리 포함 연이율
        const r_month = r_annual / 12;   // 월이율

        if (P > 0) {
            let annPay = 0;

            if (cat === 'mortgage_prin') {
                // 원금균등: (1년치 원금) + (연평균 이자) -> 사용자 지정 정밀 산식
                annPay = (P / n * 12) + (P * r_month * (n + 1) / 2) / (n / 12);
            } 
            else if (cat === 'jeonse') {
                // 전세대출: 이자만 반영
                annPay = P * (R / 100);
            } 
            else {
                // 원리금균등 및 기타: PMT 공식 적용
                annPay = ((P * r_month * Math.pow(1 + r_month, n)) / (Math.pow(1 + r_month, n) - 1)) * 12;
            }
            totalAnnPay += annPay;
        }
    });

    const dsr = (totalAnnPay / income) * 100;
    displayResults(dsr);
}

// [4] 결과 UI 업데이트 및 모달 제어
function displayResults(dsr) {
    const resultArea = document.getElementById('resultArea');
    const dsrVal = document.getElementById('dsrVal');
    
    if (resultArea) resultArea.style.display = 'block';
    if (dsrVal) dsrVal.innerText = dsr.toFixed(2) + '%';

    // 결과 위치로 부드럽게 스크롤
    window.scrollTo({ top: resultArea.offsetTop - 20, behavior: 'smooth' });
}

function showAlert(msg, focusId = null) {
    const modal = document.getElementById('customModal');
    const modalMsg = document.getElementById('modalMsg');
    
    if (modalMsg) modalMsg.innerHTML = msg;
    lastFocusId = focusId;
    if (modal) modal.style.display = 'flex';
}

function handleModalConfirm() {
    const modal = document.getElementById('customModal');
    if (modal) modal.style.display = 'none';
    if (lastFocusId) {
        const target = document.getElementById(lastFocusId);
        if (target) target.focus();
    }
}
