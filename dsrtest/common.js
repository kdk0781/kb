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

	/* =============================================================================
	   [DSR 정밀 진단 계산기 - 2026. 03. 25 통합 마스터]
	   ============================================================================= */

		function calculateLogic() {
			// [0] 기초 데이터 및 연소득 취득
			const incomeInput = document.getElementById('income');
			const income = getNum(incomeInput.value);
			const items = document.querySelectorAll('[id^="loan_"]');
			
			if (income <= 0) { 
				showAlert("연소득을 입력해주세요.", "income"); 
				return; 
			}

			// [1] 초기화: 경고 테두리 및 누적 변수 설정
			document.querySelectorAll('.input-warning').forEach(el => el.classList.remove('input-warning'));
			
			let totalAnnPayment = 0;  // DSR 계산용 총 연간상환액
			let combinedP = 0;       // 상세 리포트용 합산 원금 (주담대 + 15년이상 오피스텔)
			let bR = 4.5, bSR = 1.15, bM = 360; // 첫 번째 항목 기준값

			// [2] 단일 루프: 유효성 검사, DSR 산출, 구입자금 합산 통합 처리
			items.forEach((item, index) => {
				const pInput = item.querySelector('.l-p');
				const rInput = item.querySelector('.l-r');
				const mInput = item.querySelector('.l-m');
				const cat = item.querySelector('.l-category').value;

				// 미입력 필드 시각화
				if (!pInput.value.trim()) pInput.classList.add('input-warning');
				if (!rInput.value.trim()) rInput.classList.add('input-warning');
				if (!mInput.value.trim()) mInput.classList.add('input-warning');

				const P = getNum(pInput.value);
				const R = Number(rInput.value || 4.5);
				const SR = Number(item.querySelector('.l-sr-select')?.value || 0);
				let n = getNum(mInput.value || 360);

				// 첫 번째 항목의 금리/기간을 기준값으로 설정 (한도 역산용)
				if (index === 0) { bR = R; bSR = SR; bM = n; }
				
				const r_dsr = (R + SR) / 1200;

				if (P > 0) {
					// A. 구입자금 판별 (주담대 전체 또는 오피스텔 180개월 이상)
					const isPurchaseLoan = cat.includes('mortgage') || (cat === 'officetel' && n >= 180);

					if (isPurchaseLoan) {
						combinedP += P; // 상세 리포트 합산 대상
						
						if (cat.includes('_prin')) {
							// 원금균등 DSR 산식
							totalAnnPayment += (P / n * 12) + (P * r_dsr * (n + 1) / 2) / (n / 12);
						} else {
							// 원리금균등 DSR 산식
							const mPMT = (P * r_dsr * Math.pow(1 + r_dsr, n)) / (Math.pow(1 + r_dsr, n) - 1);
							totalAnnPayment += mPMT * 12;
						}
					} else if (cat === 'officetel' && n < 180) {
						// B. 오피스텔 보유분 (8년 고정 규제 상환액 적용)
						const mPMT = (P * r_dsr * Math.pow(1 + r_dsr, 96)) / (Math.pow(1 + r_dsr, 96) - 1);
						totalAnnPayment += mPMT * 12;
					} else {
						// C. 기타 대출 (신용대출 등 입력된 n 기준)
						const mPMT = (P * r_dsr * Math.pow(1 + r_dsr, n)) / (Math.pow(1 + r_dsr, n) - 1);
						totalAnnPayment += mPMT * 12;
					}
				}
			});

			// [3] DSR 결과 및 게이지 바 업데이트
			const dsr = (totalAnnPayment / income) * 100;
			const isOver = dsr > 40;
			const dsrView = document.getElementById('dsrVal');
			const barView = document.getElementById('dsrBar');
			
			document.getElementById('resultArea').style.display = 'block';
			dsrView.innerText = dsr.toFixed(2) + "%";
			dsrView.style.color = isOver ? "#e74c3c" : "#2ecc71";

			if (barView) {
				barView.style.width = Math.min(dsr, 100) + "%";
				barView.style.backgroundColor = isOver ? "#e74c3c" : "#2ecc71";
				barView.style.boxShadow = isOver ? "0 0 10px rgba(231, 76, 60, 0.5)" : "none";
			}

			// [4] 방식별 최대한도 역산 및 테마 대응
			const targetAnnPay = income * 0.4;
			const r_lim = (bR + bSR) / 1200;
			const maxPrin = targetAnnPay / ((12 / bM) + (r_lim * (bM + 1) * 6 / bM));
			const maxLevel = (targetAnnPay / 12) * (Math.pow(1 + r_lim, bM) - 1) / (r_lim * Math.pow(1 + r_lim, bM));

			const f = (v) => (Math.floor(v / 10000) * 10000).toLocaleString() + " 원";
			const prinView = document.getElementById('absMaxPrin');
			const levelView = document.getElementById('absMaxLevel');

			const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			const themeDangerColor = isDarkMode ? "#ff8787" : "#e74c3c";
			const themeSubTextColor = isDarkMode ? "#ccc" : "#666";

			if (isOver) {
				prinView.innerHTML = `<span style="font-size:13px; color:${themeSubTextColor}; display:block;">권장 신청액</span><span style="color:${themeDangerColor}; font-size:18px;">${f(maxPrin)} 이하</span>`;
				levelView.innerHTML = `<span style="color:${themeDangerColor};">한도 초과</span>`;
			} else {
				prinView.innerText = f(maxPrin);
				levelView.innerText = f(maxLevel);
				prinView.style.color = ""; levelView.style.color = "";
			}

			// [5] 추가 가능 대출액 계산
			let remainLimit = isOver ? 0 : Math.max(0, maxPrin - combinedP);
			const remainingLimitView = document.getElementById('remainingLimit');
			if (remainingLimitView) {
				remainingLimitView.innerText = f(remainLimit);
				remainingLimitView.style.color = isOver ? "#e74c3c" : (dsr > 36 ? "#f39c12" : "#3498db");
			}

			// [6] 추천 메시지 업데이트
			const recDesc = document.getElementById('recDesc');
			const prinCard = document.getElementById('prinCard');
			const levelCard = document.getElementById('levelCard');
			prinCard.classList.remove('recommended');
			levelCard.classList.remove('recommended');

			if (isOver || dsr > 30) {
				prinCard.classList.add('recommended');
				recDesc.innerHTML = `<span style="display:block; margin-bottom:4px;">🎯 <b>원금균등 방식</b> 추천</span><span style="font-size:13px; color:${themeSubTextColor};">추가 여력: <b style="color:#ffcc00;">${f(remainLimit)}</b></span>`;
			} else {
				levelCard.classList.add('recommended');
				recDesc.innerHTML = `<span style="display:block; margin-bottom:4px;">✅ <b>자금 여유</b></span><span style="font-size:13px; color:${themeSubTextColor};">안정적인 대출 운용이 가능합니다.</span>`;
			}

			// [7] 상세 리포트 호출 (합산된 combinedP 사용)
			if (typeof updateDetailVisualization === 'function') {
				updateDetailVisualization(combinedP, bR, bM); 
			}

			// [8] 부드러운 스크롤
			const resArea = document.getElementById('resultArea');
			if (resArea) window.scrollTo({ top: resArea.offsetTop - 20, behavior: 'smooth' });
		}


	/**
	 * [별도 함수] 실제 금리 기준 상환액 상세 시각화
	 */
	function updateDetailVisualization(P, R, n) {
		const r = R / 1200;
		const f = (v) => Math.floor(v).toLocaleString() + "원";

		// --- 원금균등 (p) ---
		const mP_p = P / n;
		const totalInt_p = P * r * (n + 1) / 2;
		const mI_p = totalInt_p / n;

		document.getElementById('vis_m_p_p').innerText = f(mP_p);
		document.getElementById('vis_m_i_p').innerText = f(mI_p);
		document.getElementById('vis_m_t_p').innerText = f(mP_p + mI_p);
		document.getElementById('vis_y_p_p').innerText = f(mP_p * 12);
		document.getElementById('vis_y_i_p').innerText = f(mI_p * 12);
		document.getElementById('vis_y_t_p').innerText = f((mP_p + mI_p) * 12);
		document.getElementById('vis_t_p_p').innerText = f(P);
		document.getElementById('vis_t_i_p').innerText = f(totalInt_p);
		document.getElementById('vis_total_full_p').innerText = f(P + totalInt_p);

		// --- 원리금균등 (l) ---
		const mPMT_l = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
		const totalInt_l = (mPMT_l * n) - P;
		const mI_l = totalInt_l / n;
		const mP_l = P / n;

		document.getElementById('vis_m_p_l').innerText = f(mP_l);
		document.getElementById('vis_m_i_l').innerText = f(mI_l);
		document.getElementById('vis_m_t_l').innerText = f(mPMT_l);
		document.getElementById('vis_y_p_l').innerText = f(mP_l * 12);
		document.getElementById('vis_y_i_l').innerText = f(mI_l * 12);
		document.getElementById('vis_y_t_l').innerText = f(mPMT_l * 12);
		document.getElementById('vis_t_p_l').innerText = f(P);
		document.getElementById('vis_t_i_l').innerText = f(totalInt_l);
		document.getElementById('vis_total_full_l').innerText = f(P + totalInt_l);
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
 * [7] 상환 스케줄 생성 (기간 유동화 및 수치 분리 완벽 반영)
 */
function generateSchedule(mode = 'P') {
    const listContainer = document.getElementById('scheduleList');
    if (!listContainer) return;
    listContainer.innerHTML = ''; 

    // [7-1] 기간 실시간 반영: 사용자가 입력한 현재 값(l-m)을 읽어옴
    const firstLoan = document.querySelector('.l-p')?.closest('[id^="loan_"]') || document.querySelector('[id^="loan_"]');
    if (!firstLoan) return;

    const P = safeGetNum(firstLoan.querySelector('.l-p')?.value);
    const R = parseFloat(firstLoan.querySelector('.l-r')?.value) || 4.5;
    const n = parseInt(firstLoan.querySelector('.l-m')?.value) || 360; 
    const r = R / 1200;

    if (P <= 0 || n <= 0) return;

    let balance = P;
    const pmt = (r > 0) ? (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : P / n;

    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= n; i++) {
        let mP, mI;

        // [7-2] 방식별 수치 분리: 원금 vs 원리금 수치 오류 해결
        if (mode === 'L') { 
            mI = balance * r; 
            mP = pmt - mI; 
        } else { 
            mP = P / n; 
            mI = balance * r; 
        }
        
        const mTotal = mP + mI; // 원금+이자 합계
        balance -= mP; // 잔액 차감

        const row = document.createElement('div');
        row.className = 'schedule-item';
        row.innerHTML = `
            <div>${i}회</div>
            <div>${Math.floor(mP).toLocaleString()}원</div>
            <div>${Math.floor(mI).toLocaleString()}원</div>
            <div class="col-total" style="font-weight:bold; color:var(--blue);">${Math.floor(mTotal).toLocaleString()}원</div>
        `;
        fragment.appendChild(row);

        // [7-3] 1년 주기 잔액 요약 (image_8bb1a0 대응)
        if (i % 12 === 0 || i === n) {
            const summary = document.createElement('div');
            summary.className = 'year-summary-box';
            const displayBal = (i === n) ? 0 : Math.max(0, Math.floor(balance));
            summary.innerHTML = `
                <div class="summary-label"><span>${Math.ceil(i/12)}년차</span> 잔액</div>
                <div class="summary-value">${displayBal.toLocaleString()} 원</div>
            `;
            fragment.appendChild(summary);
        }
    }
    listContainer.appendChild(fragment);
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
