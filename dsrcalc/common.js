/* =============================================================================
   [DSR CORE SYSTEM - PREMIUM ENHANCED VER 2026.03.25 - FIXED & OPTIMIZED]
   1. 시스템 설정 및 테마 엔진 (Theme & Setup)
   2. 정밀 유효성 검증 및 시각 피드백 (Validation & Warning)
   3. 부채 항목 동적 관리 및 정책 바인딩 (Dynamic Management)
   4. 고도화된 DSR 연산 엔진 (Calculation Engine)
   5. Desktop/Mobile 통합 스크롤 최적화 (UI & Scroll)
   6. 상환스케줄 순서 변경 및 N년차 잔액 디자인 고도화 (Schedule UI)
   7. 시스템 알림 및 리포트 제어 (System Interface)

   [FIX LOG]
   - calculateLogic() 중복 정의 및 중괄호 구조 붕괴 → 단일 함수로 통합 재작성
   - updateDetailVisualization() 내 미정의 변수(listBody, mP_p) 참조 오류 → 제거 및 재구성
   - updateResultsUI() 중복 로직 함수 제거 → calculateLogic() 내 인라인 처리
   - vis_m_p_p 등 존재하지 않는 DOM ID 참조 → innerHTML 기반 동적 렌더링으로 전환
   - 탭/스페이스 혼용 들여쓰기로 인한 스코프 오류 → 전체 스페이스 2칸 통일
   - scheduleSection 초기 display 상태 불일치 → CSS 클래스 기반으로 통일
   - toggleSchedule() 조건식 오류('' 비교) → 클래스 기반 토글로 수정
   ============================================================================= */

// ─── [1] 시스템 설정 및 초기 상태 ───────────────────────────────────────────

const NOTICE_VERSION = "0781_1";
const CONFIG = {
  DEFAULT_RATE: 4.5,
  DSR_LIMIT: 40,
  MIN_INCOME: 1000000
};

let loanCount = 0;
let currentScheduleType = 'P';
let lastFocusId = null;
let proceedOnConfirm = false;

window.onload = function () {
  applySystemTheme();
  initNotice();
  addLoan();
  const confirmBtn = document.getElementById('modalConfirm');
  if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

// ─── [1-1] 테마 엔진 ──────────────────────────────────────────────────────────

function applySystemTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('white', !isDark);
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

// ─── [2] 정밀 유효성 검증 및 시각 피드백 ─────────────────────────────────────

function setWarning(id, isError) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('input-warning', isError);
}

/**
 * [FIX] 금리 미입력 시 경고 후 calculateLogic() 호출하는 플로우를 명확히 분리.
 * 기존: missingRate 경고 후 calculateLogic() 미호출 버그 존재 → proceedOnConfirm 플래그로 해결
 */
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
  if (items.length === 0) {
    showAlert("부채 항목을 최소 하나 이상 추가해주세요.");
    return;
  }

  let hasFatalError = false;
  let missingRateFields = [];

  for (let item of items) {
    const pEl = item.querySelector('.l-p');
    const mEl = item.querySelector('.l-m');
    const rInput = item.querySelector('.l-r');

    if (getNum(pEl.value) <= 0) {
      setWarning(pEl.id, true);
      showAlert("대출 금액을 입력해주세요.", pEl.id);
      hasFatalError = true;
      break;
    }
    if (getNum(mEl.value) < 1) {
      setWarning(mEl.id, true);
      showAlert("대출 기간을 입력해주세요.", mEl.id);
      hasFatalError = true;
      break;
    }
    if (!rInput.value.trim()) {
      missingRateFields.push(rInput);
    }
  }

  if (hasFatalError) return;

  if (missingRateFields.length > 0) {
    missingRateFields.forEach(f => f.classList.add('input-warning'));
    // [FIX] allowProceed=true → 확인 버튼 클릭 시 calculateLogic() 실행
    showAlert("금리 미입력 항목은 기본 금리(4.5%)가 적용됩니다. 계속 진행하시겠습니까?", null, "ℹ️", true);
  } else {
    calculateLogic();
  }
}

// ─── [3] 부채 항목 동적 관리 ─────────────────────────────────────────────────

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
      <div>
        <label>원금/잔액 (원)</label>
        <input type="text" id="lp_${loanCount}" class="l-p" inputmode="numeric" onkeyup="formatComma(this)" placeholder="0">
      </div>
      <div>
        <label>금리 (%)</label>
        <input type="text" id="lr_${loanCount}" class="l-r" inputmode="decimal" placeholder="4.5">
      </div>
      <div>
        <label>스트레스 금리</label>
        <select class="l-sr-select">
          <option value="1.15" selected>60개월변동 (1.15%)</option>
          <option value="2.87">6,12개월변동 (2.87%)</option>
          <option value="0.0">해당없음 (0.0%)</option>
        </select>
      </div>
      <div>
        <label>기간 (개월)</label>
        <input type="text" id="lm_${loanCount}" class="l-m" inputmode="numeric" value="360">
      </div>
    </div>
    <div class="dynamic-guide" id="guide_${loanCount}" style="display:none;"></div>
  </div>`;

  loanList.insertAdjacentHTML('beforeend', html);
}

function applyPolicy(id) {
  const card = document.getElementById(`loan_${id}`);
  if (!card) return;

  const cat = card.querySelector('.l-category').value;
  const m = card.querySelector('.l-m');
  const r = card.querySelector('.l-r');
  const srSelect = card.querySelector('.l-sr-select');
  const guide = card.querySelector('.dynamic-guide');

  guide.style.display = 'none';
  guide.innerHTML = '';

  // 카테고리별 정책 자동 적용
  switch (cat) {
    case 'officetel':
      guide.style.display = 'block';
      guide.innerHTML = "🏢 <b>오피스텔 체크포인트:</b><br>- 구입 자금인 경우 '주택담보' 선택이 정확합니다.<br>- 보유분은 8년 상환 규정이 적용됩니다.";
      m.value = "96";
      r.placeholder = "5.5";
      srSelect.value = "0.0";
      break;
    case 'cardloan':
      guide.style.display = 'block';
      guide.innerHTML = "⚠️ 카드론은 가상 만기 3년이 고정 적용됩니다.";
      m.value = "36";
      r.placeholder = "14.0";
      srSelect.value = "0.0";
      break;
    case 'credit':
      m.value = "60";
      r.placeholder = "6.0";
      srSelect.value = "0.0";
      break;
    case 'jeonse':
      m.value = "24";
      r.placeholder = "4.2";
      srSelect.value = "0.0";
      break;
    case 'mortgage_level':
    case 'mortgage_prin':
    default:
      m.value = "360";
      r.placeholder = "4.5";
      srSelect.value = "1.15";
      break;
  }
}

// ─── [4] DSR 핵심 연산 엔진 (통합 재작성) ─────────────────────────────────────

/**
 * [FIX] 기존 코드에서 calculateLogic() 함수가 두 부분으로 분리되어
 * 중괄호가 맞지 않고 updateResultsUI()와 로직이 중복됨.
 * → 단일 함수로 완전 재통합. updateResultsUI() 제거.
 */
function calculateLogic() {
  const income = getNum(document.getElementById('income').value);
  if (income <= 0) {
    showAlert("연소득을 입력해주세요.", "income");
    return;
  }

  document.querySelectorAll('.input-warning').forEach(el => el.classList.remove('input-warning'));

  const items = document.querySelectorAll('[id^="loan_"]');
  let totalAnnPayment = 0;
  let combinedP = 0;

  // 첫 번째 항목 기준 금리/기간 (한도 역산용)
  let bR = CONFIG.DEFAULT_RATE;
  let bSR = 1.15;
  let bM = 360;

  items.forEach((item, index) => {
    const pInput = item.querySelector('.l-p');
    const rInput = item.querySelector('.l-r');
    const mInput = item.querySelector('.l-m');
    const cat = item.querySelector('.l-category').value;
    const srSelect = item.querySelector('.l-sr-select');

    const P = getNum(pInput.value);
    const R = Number(rInput.value) || CONFIG.DEFAULT_RATE;
    const SR = Number(srSelect?.value || 0);
    let n = getNum(mInput.value) || 360;

    if (index === 0) { bR = R; bSR = SR; bM = n; }

    if (P <= 0) return; // 금액 미입력 항목은 DSR 합산 제외

    const r_dsr = (R + SR) / 1200;

    // [FIX] 전세대출: 원금 상환 제외, 이자만 DSR 합산
    if (cat === 'jeonse') {
      totalAnnPayment += P * (R / 1200) * 12;
      return;
    }

    // 주담대 / 오피스텔(구입) → 구입자금 합산
    const isPurchaseLoan = cat.includes('mortgage') || (cat === 'officetel' && n >= 180);

    if (isPurchaseLoan) {
      combinedP += P;
      if (cat === 'mortgage_prin') {
        // 원금균등 DSR 연간 상환액
        const annPrin = (P / n) * 12;
        const annInt = P * r_dsr * (n + 1) / 2 / (n / 12);
        totalAnnPayment += annPrin + annInt;
      } else {
        // 원리금균등 DSR
        const mPMT = calcPMT(P, r_dsr, n);
        totalAnnPayment += mPMT * 12;
      }
    } else {
      // 신용대출: 가상 5년, 카드론: 가상 3년, 오피스텔 보유분: 8년
      const targetN = cat === 'cardloan' ? 36 : cat === 'credit' ? 60 : n;
      const mPMT = calcPMT(P, r_dsr, targetN);
      totalAnnPayment += mPMT * 12;
    }
  });

  // ── [3] DSR 계산 및 UI 업데이트 ──────────────────────────────────────────

  const dsr = (totalAnnPayment / income) * 100;
  const isOver = dsr > CONFIG.DSR_LIMIT;

  const resultArea = document.getElementById('resultArea');
  resultArea.style.display = 'block';

  // DSR 수치 및 게이지
  const dsrView = document.getElementById('dsrVal');
  dsrView.innerText = dsr.toFixed(2) + "%";
  dsrView.style.color = isOver ? "#e74c3c" : dsr > 30 ? "#f39c12" : "#2ecc71";

  const barView = document.getElementById('dsrBar');
  if (barView) {
    barView.style.width = Math.min(dsr, 100) + "%";
    barView.style.backgroundColor = isOver ? "#e74c3c" : dsr > 30 ? "#f39c12" : "#2ecc71";
  }

  // ── [4] 방식별 최대 한도 역산 ─────────────────────────────────────────────

  const targetAnnPay = income * (CONFIG.DSR_LIMIT / 100);
  const r_lim = (bR + bSR) / 1200;

  // 원금균등 최대 한도 (역산)
  const maxPrin = calcMaxPrincipal(targetAnnPay, r_lim, bM);
  // 원리금균등 최대 한도 (역산)
  const maxLevel = calcMaxLevel(targetAnnPay, r_lim, bM);

  const f = (v) => (Math.floor(Math.max(0, v) / 10000) * 10000).toLocaleString() + " 원";
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tDanger = isDark ? "#ff8787" : "#e74c3c";
  const tSub = isDark ? "#ccc" : "#666";

  const prinView = document.getElementById('absMaxPrin');
  const levelView = document.getElementById('absMaxLevel');
  const prinCard = document.getElementById('prinCard');
  const levelCard = document.getElementById('levelCard');

  if (isOver) {
    prinView.innerHTML = `
      <span style="font-size:12px;color:${tSub};display:block;">권장 신청액</span>
      <span style="color:${tDanger};font-size:18px;font-weight:800;">${f(maxPrin)} 이하</span>`;
    levelView.innerHTML = `<span style="color:${tDanger};font-weight:800;">한도 초과</span>`;
    prinCard.classList.add('recommended');
    levelCard.classList.remove('recommended');
  } else {
    prinView.innerText = f(maxPrin);
    levelView.innerText = f(maxLevel);
    prinView.style.color = "";
    levelView.style.color = "";

    // 원금균등이 더 유리한 경우 추천 배지 강조
    if (maxPrin >= maxLevel) {
      prinCard.classList.add('recommended');
      levelCard.classList.remove('recommended');
    } else {
      levelCard.classList.add('recommended');
      prinCard.classList.remove('recommended');
    }
  }

  // ── [5] 추가 가능 대출액 ──────────────────────────────────────────────────

  const remainLimit = isOver ? 0 : Math.max(0, maxPrin - combinedP);
  const remainView = document.getElementById('remainingLimit');
  if (remainView) {
    remainView.innerText = f(remainLimit);
    remainView.style.color = isOver ? "#e74c3c" : dsr > 36 ? "#f39c12" : "#3498db";
  }

  // ── [6] 추천 메시지 ───────────────────────────────────────────────────────

  const recDesc = document.getElementById('recDesc');
  if (recDesc) {
    if (isOver) {
      recDesc.innerHTML = `
        <span style="display:block;margin-bottom:4px;">⚠️ <b>DSR 한도 초과</b></span>
        <span style="font-size:13px;color:${tSub};">기존 부채 조정 또는 대출 금액을 줄여주세요. 원금균등 방식으로 전환 시 한도 확장 가능.</span>`;
    } else if (dsr > 30) {
      recDesc.innerHTML = `
        <span style="display:block;margin-bottom:4px;">🎯 <b>원금균등 방식</b> 추천</span>
        <span style="font-size:13px;color:${tSub};">추가 여력: <b style="color:#ffcc00;">${f(remainLimit)}</b></span>`;
    } else {
      recDesc.innerHTML = `
        <span style="display:block;margin-bottom:4px;">✅ <b>자금 여유</b></span>
        <span style="font-size:13px;color:${tSub};">안정적 대출 운용이 가능합니다. 추가 여력: <b style="color:#2ecc71;">${f(remainLimit)}</b></span>`;
    }
  }

  // ── [7] 상환 스케줄 초기화 (결과 재계산 시 스케줄도 리셋) ──────────────────

  const scheduleSection = document.getElementById('scheduleSection');
  const btnShowSchedule = document.getElementById('btnShowSchedule');
  if (scheduleSection) {
    scheduleSection.classList.remove('schedule-visible');
    scheduleSection.classList.add('schedule-section-hidden');
  }
  if (btnShowSchedule) {
    btnShowSchedule.innerText = "📊 전체 상환 스케줄 상세 보기";
  }

  // ── [8] PC/모바일 통합 스크롤 ────────────────────────────────────────────

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const rect = resultArea.getBoundingClientRect();
      const offset = window.pageYOffset + rect.top - 20;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  });
}

// ─── [수학 유틸 함수] ─────────────────────────────────────────────────────────

/** 월 PMT (원리금균등 월 납입액) */
function calcPMT(P, r_monthly, n) {
  if (r_monthly === 0) return P / n;
  return (P * r_monthly * Math.pow(1 + r_monthly, n)) / (Math.pow(1 + r_monthly, n) - 1);
}

/** 원금균등 방식 최대 한도 역산 */
function calcMaxPrincipal(targetAnn, r, n) {
  // 원금균등 연간 상환액 = P/n*12 + P*r*(n+1)/2 / (n/12)
  // → P * (12/n + r*6*(n+1)/n) = targetAnn
  const denominator = (12 / n) + (r * 6 * (n + 1) / n);
  return denominator > 0 ? targetAnn / denominator : 0;
}

/** 원리금균등 방식 최대 한도 역산 */
function calcMaxLevel(targetAnn, r, n) {
  // PMT = P * r*(1+r)^n / ((1+r)^n - 1)
  // → P = PMT * ((1+r)^n - 1) / (r*(1+r)^n)
  if (r === 0) return (targetAnn / 12) * n;
  const mPay = targetAnn / 12;
  return mPay * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
}

// ─── [5] 상환 스케줄 고도화 ──────────────────────────────────────────────────

/**
 * [FIX] 기존 toggleSchedule()에서 sec.style.display === '' 조건이
 * schedule-section-hidden 클래스와 충돌 → CSS 클래스 기반 토글로 수정
 */
function toggleSchedule() {
  const sec = document.getElementById('scheduleSection');
  const btn = document.getElementById('btnShowSchedule');
  if (!sec) return;

  const isHidden = sec.classList.contains('schedule-section-hidden');

  if (isHidden) {
    sec.classList.remove('schedule-section-hidden');
    sec.classList.add('schedule-visible');
    btn.innerText = "🔼 스케줄 접기";
    generateSchedule();
  } else {
    sec.classList.add('schedule-section-hidden');
    sec.classList.remove('schedule-visible');
    btn.innerText = "📊 전체 상환 스케줄 상세 보기";
  }
}

function switchSchedule(type) {
  currentScheduleType = type;
  document.getElementById('tabPrin').classList.toggle('active', type === 'P');
  document.getElementById('tabLevel').classList.toggle('active', type === 'L');
  generateSchedule();
}

/**
 * [FIX] 기존 generateSchedule()은 DOM ID 참조 오류 없이 정상 동작하나
 * 연간 요약 카드의 balance 계산 시 잔액이 음수가 될 수 있음 → Math.max(0) 처리 보강
 * 또한 총 이자합계 표시 추가
 */
function generateSchedule() {
  const items = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) return;

  const target = items[0];
  const P = getNum(target.querySelector('.l-p').value);
  const R = Number(target.querySelector('.l-r').value) || CONFIG.DEFAULT_RATE;
  const n = getNum(target.querySelector('.l-m').value) || 360;
  const r = R / 1200;

  if (P <= 0 || n <= 0) return;

  const listEl = document.getElementById('scheduleList');
  if (!listEl) return;
  listEl.innerHTML = "";

  let balance = P;
  const mP_prin = P / n;                                // 원금균등 월 원금
  const mPMT_level = calcPMT(P, r, n);                  // 원리금균등 월 납입액
  const isLevel = currentScheduleType === 'L';

  let yearCumP = 0;
  let yearCumI = 0;
  let totalInterest = 0;

  for (let i = 1; i <= n; i++) {
    let curP, curI;

    if (isLevel) {
      curI = balance * r;
      curP = mPMT_level - curI;
    } else {
      curI = balance * r;
      curP = mP_prin;
    }

    // [FIX] 마지막 회차 잔액 오차 보정
    if (i === n) {
      curP = balance;
      curI = balance * r;
    }

    balance -= curP;
    yearCumP += curP;
    yearCumI += curI;
    totalInterest += curI;

    const totalPay = Math.round(curP + curI);

    const itemDiv = document.createElement('div');
    itemDiv.className = 'schedule-item';
    itemDiv.innerHTML = `
      <div class="sch-idx">${i}회</div>
      <div class="sch-val">${Math.round(curP).toLocaleString()}</div>
      <div class="sch-val">${Math.round(curI).toLocaleString()}</div>
      <div class="sch-total">${totalPay.toLocaleString()}</div>`;
    listEl.appendChild(itemDiv);

    // N년차 요약 카드 — CSS 변수 클래스 기반 (인라인 색상 하드코딩 제거)
    if (i % 12 === 0 || i === n) {
      const yearNum = Math.ceil(i / 12);
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'year-summary-card';
      summaryDiv.innerHTML = `
        <div class="card-title-row">
          <span class="card-title">📅 ${yearNum}년차 누적 상환 요약</span>
          <span class="year-badge">${yearNum}년 경과</span>
        </div>
        <div class="card-stats">
          <div>누적원금: <b class="stat-prin">${Math.round(yearCumP).toLocaleString()}원</b></div>
          <div>누적이자: <b class="stat-int">${Math.round(yearCumI).toLocaleString()}원</b></div>
        </div>
        <div class="card-balance-row">
          <span class="balance-label">현재 잔액</span>
          <span class="balance-value">${Math.max(0, Math.round(balance)).toLocaleString()}원</span>
        </div>`;
      listEl.appendChild(summaryDiv);
      yearCumP = 0;
      yearCumI = 0;
    }
  }

  // 총계 요약 카드 — total-card 클래스로 별도 스타일 적용
  const summaryTotal = document.createElement('div');
  summaryTotal.className = 'year-summary-card total-card';
  summaryTotal.innerHTML = `
    <div class="card-title-row">
      <span class="card-title">📊 전체 상환 총계</span>
    </div>
    <div class="card-stats">
      <div>총 원금: <b class="stat-prin">${Math.round(P).toLocaleString()}원</b></div>
      <div>총 이자: <b class="stat-int">${Math.round(totalInterest).toLocaleString()}원</b></div>
    </div>
    <div class="card-balance-row">
      <span class="balance-label">총 납입액</span>
      <span class="balance-value">${Math.round(P + totalInterest).toLocaleString()}원</span>
    </div>`;
  listEl.appendChild(summaryTotal);
}

// ─── [6] 공지 팝업 ────────────────────────────────────────────────────────────

function initNotice() {
  if (localStorage.getItem('hideStressNotice_' + NOTICE_VERSION) !== 'true') {
    document.getElementById('noticePopup').style.display = 'flex';
  }
}
function closeNotice() {
  document.getElementById('noticePopup').style.display = 'none';
}
function closeNoticeForever() {
  localStorage.setItem('hideStressNotice_' + NOTICE_VERSION, 'true');
  closeNotice();
}

// ─── [7] 시스템 알림 및 공통 기능 ────────────────────────────────────────────

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
  lastFocusId = focusId;
  proceedOnConfirm = allowProceed;
  modal.style.display = 'flex';
}

function formatComma(obj) {
  let val = obj.value.replace(/[^0-9]/g, "");
  obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
  obj.classList.remove('input-warning');
}

function getNum(val) {
  return Number(String(val).replace(/,/g, "")) || 0;
}

function removeLoan(id) {
  document.getElementById(`loan_${id}`)?.remove();
}

// ─── [8] 결과 복사 리포트 ────────────────────────────────────────────────────

/**
 * [FIX] 기존 copyResultText()에서 navigator.clipboard API 미사용으로
 * 모바일 환경에서 execCommand('copy') 실패 → clipboard API 우선 시도, 폴백 처리
 */
function copyResultText() {
  const dsr = document.getElementById('dsrVal')?.innerText || '-';
  const limit = document.getElementById('remainingLimit')?.innerText || '-';
  const maxP = document.getElementById('absMaxPrin')?.innerText || '-';
  const maxL = document.getElementById('absMaxLevel')?.innerText || '-';

  const reportText =
    `[📊 DSR 진단 리포트]\n` +
    `● 종합 DSR (스트레스 반영): ${dsr}\n` +
    `● 최대 한도 (원금균등): ${maxP}\n` +
    `● 최대 한도 (원리금균등): ${maxL}\n` +
    `● 추가 대출 여력: ${limit}\n\n` +
    `* 본 결과는 입력값 기준 예상 수치이며 실제와 다를 수 있습니다.`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(reportText)
      .then(() => showAlert("진단 리포트가 복사되었습니다!", null, "✅"))
      .catch(() => fallbackCopy(reportText));
  } else {
    fallbackCopy(reportText);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement("textarea");
  temp.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
  document.body.appendChild(temp);
  temp.value = text;
  temp.focus();
  temp.select();
  try {
    document.execCommand("copy");
    showAlert("진단 리포트가 복사되었습니다!", null, "✅");
  } catch (e) {
    showAlert("복사에 실패했습니다. 직접 선택하여 복사해주세요.", null, "❌");
  }
  document.body.removeChild(temp);
}
