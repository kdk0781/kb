/* =============================================================================
   [시스템 테마 감지 및 클래스 제어] 
   사용자의 OS 설정에 따라 body에 .dark 또는 .white 클래스를 자동으로 주입합니다.
   ============================================================================= */

function applySystemTheme() {
    // 1. 브라우저의 시스템 테마 설정 확인 (matches가 true면 다크모드)
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const body = document.body;

    if (isDarkMode) {
        // 시스템이 다크모드일 경우
        body.classList.add('dark');
        body.classList.remove('white');
        console.log("시스템 설정: 다크 모드 (.dark 클래스 적용)");
    } else {
        // 시스템이 라이트모드일 경우
        body.classList.add('white');
        body.classList.remove('dark');
        console.log("시스템 설정: 라이트 모드 (.white 클래스 적용)");
    }
}

// 2. 페이지 로드 시 즉시 실행
applySystemTheme();

// 3. [고도화] 사용자가 이용 중에 시스템 설정을 바꾸면 실시간으로 감지하여 반영
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    applySystemTheme();
});





/* =============================================================================
   [DSR 정밀 진단 계산기 - 통합 관리 마스터 스크립트]
   파일명: common.js
   최종 업데이트: 2026. 03. 23.
   수정사항: 캐시 및 버전 체크 로직 강화 (모바일 즉시 반영용)
   ============================================================================= */

// [1] 공지사항 버전 설정 (HTML의 ?v= 값과 맞추면 더 확실합니다)
const NOTICE_VERSION = "0781_2"; 

let lastFocusId = null;
let proceedOnConfirm = false;
let loanCount = 0;

window.onload = function() {
    initNotice(); 
    addLoan();    
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

// [2] 공지사항 제어 (강제 초기화 로직 강화)
function initNotice() {
    const noticePopup = document.getElementById('noticePopup');
    if (!noticePopup) return;

    const savedVersion = localStorage.getItem('hideNoticeVersion');
    
    // 현재 코드의 버전과 브라우저 저장 버전이 다르면 강제 초기화
    if (savedVersion !== NOTICE_VERSION) {
        localStorage.removeItem('hideStressNotice');
        localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
        noticePopup.style.display = 'flex';
    } else {
        // 버전이 같을 때만 '다시 보지 않기' 상태 확인
        const isHidden = localStorage.getItem('hideStressNotice') === 'true';
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
    localStorage.setItem('hideStressNotice', 'true');
    localStorage.setItem('hideNoticeVersion', NOTICE_VERSION);
    closeNotice();
}

/* ---------------------------------------------------------
   [이하 기존 마스터 로직 동일 (getNum, addLoan, calculateLogic 등)]
   --------------------------------------------------------- */
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

function getNum(val) {
    return Number(val.toString().replace(/,/g, "")) || 0;
}

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
        if (cat === 'credit') m.value = "60";
        else if (cat === 'jeonse') m.value = "24";
        else m.value = "360";
    }
}

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
    if (dsr > 32) { document.getElementById('prinCard').classList.add('recommended'); document.getElementById('levelCard').classList.remove('recommended'); }
    else { document.getElementById('levelCard').classList.add('recommended'); document.getElementById('prinCard').classList.remove('recommended'); }
    document.getElementById('recDesc').innerHTML = dsr > 32 ? "<b>🚨 한도 확보 긴급:</b> 현재 DSR이 임계치입니다. <b>원금균등</b> 방식을 권장합니다." : "<b>✅ 자금 건전성 양호:</b> 현재 부채 비율이 적정합니다. <b>원리금균등</b> 방식을 권장합니다.";
	refreshScheduleUI();
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

/* ---------------------------------------------------------
   [MOD] 알림창 및 모바일 포커스 제어 로직 (0781_1 기준)
   --------------------------------------------------------- */

/**
 * 커스텀 모달 알림창 호출
 * @param {string} msg - 표시할 메시지
 * @param {string} focusId - 확인 후 포커스를 이동할 요소의 ID
 */
function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
    const modal = document.getElementById('customModal');
    if (!modal) return;

    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    
    // 전역 변수에 포커스 타겟 저장
    lastFocusId = focusId; 
    proceedOnConfirm = allowProceed;
    
    // 모달 표시
    modal.style.display = 'flex';
}

/* =============================================================================
   [DSR 정밀 진단 계산기 - 모바일 입력 최적화 스크립트]
   수정사항: iOS/안드로이드 모달 확인 후 키보드 강제 팝업 로직 보강
   ============================================================================= */

/**
 * 모달 [확인] 버튼 클릭 시 처리
 * 모바일 브라우저 보안 정책(User Gesture) 대응 로직
 */
function handleModalConfirm() {
    const modal = document.getElementById('customModal');
    if (modal) modal.style.display = 'none';

    if (proceedOnConfirm) {
        calculateLogic();
    } else if (lastFocusId) {
        const targetEl = document.getElementById(lastFocusId);
        if (targetEl) {
            // [핵심 1] 동기 포커스: 클릭 이벤트가 살아있을 때 즉시 실행해야 iOS 키보드가 열립니다.
            targetEl.focus();
            
            // [핵심 2] 스크롤 이동: 해당 입력창이 화면 중앙에 오도록 부드럽게 이동
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // [핵심 3] 비동기 보정: 스크롤 애니메이션 종료 후 포커스 유지 및 가상 클릭
            setTimeout(() => {
                targetEl.focus();
                
                // input 태그인 경우 클릭 이벤트 트리거 및 기존 값 선택
                if (targetEl.tagName === 'INPUT') {
                    targetEl.click(); 
                    if(targetEl.value.length > 0) {
                        // 기존 숫자가 있다면 전체 선택하여 바로 수정 가능하게 함
                        targetEl.setSelectionRange(0, targetEl.value.length);
                    }
                }
            }, 300);
        }
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
    const reportText = `[📊 DSR 정밀 진단 리포트] \n● 나의 소득 상황: ${inc}원 \n● 현재 종합 DSR: ${dsr} \n● 추가 대출 여력: ${addLim} \n---------------------------- \n🎯 방식별 최대 대출 한도 \n- 원금균등 방식: ${maxP} \n- 원리금균등 방식: ${maxL} \n---------------------------- \n💸 총 이자 지출 비교 (예상) \n- 원금균등 시 총 이자: ${tiP} \n- 원리금균등 시 총 이자: ${tiL}		\n---------------------------- \n💡 전문가 분석 의견\n"${recMsg}" \n* 위 결과는 산출 예상치이며, 실제 심사 결과와 다를 수 있습니다.`;
    const temp = document.createElement("textarea");
    document.body.appendChild(temp);
    temp.value = reportText; temp.select(); document.execCommand("copy"); document.body.removeChild(temp);
    showAlert("분석 리포트가 복사되었습니다!", null, "✅");
}

/* [추가 전역 변수] */
let currentScheduleType = 'P'; // P: 원금균등, L: 원리금균등

/**
 * [MOD] 기존 calculateLogic 함수의 가장 마지막 줄에 추가
 * 계산이 완료된 후 상세 스케줄 버튼을 노출하고 데이터를 갱신합니다.
 */
function refreshScheduleUI() {
    const btn = document.getElementById('btnShowSchedule');
    if (btn) btn.style.display = 'block';

    const sec = document.getElementById('scheduleSection');
    // 섹션이 이미 열려있는 상태라면 데이터 자동 갱신
    if (sec && sec.style.display === 'block') {
        generateSchedule();
    }
}

/**
 * [NEW] 전체 상환 스케줄 생성 (12개월 구분선 로직 포함)
 */
function generateSchedule() {
    const items = document.querySelectorAll('[id^="loan_"]');
    let target = null;
    
    // 주담대 또는 오피스텔 항목을 우선적으로 스케줄 대상으로 선정
    items.forEach(item => {
        const cat = item.querySelector('.l-category').value;
        if(cat.includes('mortgage') || cat === 'officetel') target = item;
    });
    if(!target) target = items[0]; // 항목이 없으면 첫 번째 항목 기준

    const P = getNum(target.querySelector('.l-p').value);
    const R = Number(target.querySelector('.l-r').value || target.querySelector('.l-r').placeholder);
    const n = getNum(target.querySelector('.l-m').value);
    const r = R / 1200;

    const listEl = document.getElementById('scheduleList');
    listEl.innerHTML = ""; // 리스트 초기화

    let balance = P;
    const mP = P / n; // 원금균등 매달 원금
    const mPMT = (P * r * Math.pow(1+r, n)) / (Math.pow(1+r, n)-1); // 원리금균등 매달 상환액

    for (let i = 1; i <= n; i++) {
        // 12개월(1년) 단위로 연차 구분선 삽입
        if (i > 1 && (i - 1) % 12 === 0) {
            const yearDiv = document.createElement('div');
            yearDiv.className = 'year-divider';
            yearDiv.innerText = `📅 대출 실행 ${(i - 1) / 12}년 경과 (현재 잔액: ${Math.floor(balance).toLocaleString()}원)`;
            listEl.appendChild(yearDiv);
        }

        let curP, curI;
        if (currentScheduleType === 'P') {
            curI = balance * r;
            curP = mP;
            balance -= curP;
        } else {
            curI = balance * r;
            curP = mPMT - curI;
            balance -= curP;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        itemDiv.innerHTML = `
            <div class="sch-num">${i}회</div>
            <div class="sch-prin">${Math.floor(curP).toLocaleString()}</div>
            <div class="sch-int">${Math.floor(curI).toLocaleString()}</div>
            <div class="sch-bal">${Math.max(0, Math.floor(balance)).toLocaleString()}</div>
        `;
        listEl.appendChild(itemDiv);
    }
}




/**
 * 상세 스케줄 섹션 토글
 */
function toggleSchedule() {
    const sec = document.getElementById('scheduleSection');
    const btn = document.getElementById('btnShowSchedule');
    
    if (sec.style.display === 'none' || sec.style.display === '') {
        generateSchedule();
        sec.style.display = 'block';
        btn.innerText = "🔼 스케줄 접기";
    } else {
        sec.style.display = 'none';
        btn.innerText = "📊 전체 상환 스케줄 상세 보기";
    }
}

/**
 * 상환 방식 탭 전환
 */
function switchSchedule(type) {
    currentScheduleType = type;
    document.getElementById('tabPrin').classList.toggle('active', type === 'P');
    document.getElementById('tabLevel').classList.toggle('active', type === 'L');
    generateSchedule();
}

// input value color
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        if (document.body.classList.contains('dark')) {
            this.style.color = '#ffffff'; // 다크모드일 때 글자색 강제 주입
        }
    });
});
