/* =============================================================================
   DSR CORE SYSTEM — KB 브랜드 고도화 VER 2026.04-B
   [신규/수정]
   - 금리 미입력 N개 → 개별 순차 모달 팝업 (큐 방식)
   - 대출 종류별 기본 금리 배너 문구 (담보 4.5%, 오피스텔 5.5%, 카드론 14.0% 등)
   - dynamic-guide 빨간 계열로 강조 (CSS 클래스 분리)
   - 스케줄 상단: 전체 대출 요약 목록 줄바꿈 형태 표시
   - 스케줄 컬럼 정렬 완전 수정 (px 고정 + tabular-nums)
   ============================================================================= */

// ─── [1] 시스템 설정 ─────────────────────────────────────────────────────────

const NOTICE_VERSION = "0781_3";
const CONFIG = {
  DSR_LIMIT:      40,
  MIN_INCOME:     1000000,
  SCH_MIN_MONTHS: 180,   // 15년
  SCH_MAX_MONTHS: 600,   // 50년
};

/* 대출 종류별 기본 금리 (placeholder = 미입력 시 적용값) */
const DEFAULT_RATE_MAP = {
  mortgage_level: 4.5,
  mortgage_prin:  4.5,
  jeonse:         4.2,
  officetel:      5.5,
  credit:         6.0,
  cardloan:       14.0,
};

/* 대출 종류 → 한글 레이블 */
const CAT_LABEL = {
  mortgage_level: '주택담보 (원리금)',
  mortgage_prin:  '주택담보 (원금)',
  jeonse:         '전세대출 (만기)',
  officetel:      '오피스텔 (원리금)',
  credit:         '신용대출 (원리금)',
  cardloan:       '카드론 (원리금)',
};

/* 대출 종류 → 이모티콘 */
const CAT_EMOJI = {
  mortgage_level: '🏠',
  mortgage_prin:  '🏠',
  jeonse:         '🔑',
  officetel:      '🏢',
  credit:         '💳',
  cardloan:       '💰',
};

let loanCount           = 0;
let currentScheduleType = 'P';
let lastFocusId         = null;
let proceedOnConfirm    = false;

/* ── 모달 큐 ──────────────────────────────────────────────────────────────── */
let _modalQueue    = [];   // [{ msg, icon }]
let _onQueueDone   = null; // 큐 소진 후 콜백
let _inQueueMode   = false;

window.onload = function () {
  applySystemTheme();
  initNotice();
  addLoan();
  document.getElementById('modalConfirm').onclick = handleModalConfirm;
};

// ─── [1-1] 테마 엔진 ──────────────────────────────────────────────────────────

function applySystemTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark',  isDark);
  document.body.classList.toggle('white', !isDark);
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

// ─── [2] 유효성 검증 & 금리 경고 ─────────────────────────────────────────────

/** 카테고리에서 기본 금리 가져오기 */
function getDefaultRate(cat) {
  return DEFAULT_RATE_MAP[cat] ?? 4.5;
}

/** 금리 미입력 → 카드 경고 라인 + 종류별 배너 표시 */
function markRateWarning(rInput) {
  rInput.classList.add('rate-missing');
  const card = rInput.closest('.input-card');
  if (!card) return;
  card.classList.add('rate-warning-card');
  if (!card.querySelector('.rate-missing-banner')) {
    const cat   = card.querySelector('.l-category').value;
    const rate  = getDefaultRate(cat);
    const label = CAT_LABEL[cat] || '해당 대출';
    const banner = document.createElement('div');
    banner.className = 'rate-missing-banner';
    banner.innerHTML =
      `⚠️ 금리 미입력 — <b>${label}</b> 기본 금리 <b>${rate}%</b> 자동 적용`;
    card.appendChild(banner);
  }
}

function clearRateWarnings() {
  document.querySelectorAll('.rate-missing').forEach(el => el.classList.remove('rate-missing'));
  document.querySelectorAll('.rate-warning-card').forEach(el => el.classList.remove('rate-warning-card'));
  document.querySelectorAll('.rate-missing-banner').forEach(el => el.remove());
}

/** 금리 직접 입력 시 경고 즉시 해제 */
function onRateInput(input) {
  if (input.value.trim()) {
    input.classList.remove('rate-missing');
    const card = input.closest('.input-card');
    if (card) {
      card.classList.remove('rate-warning-card');
      card.querySelector('.rate-missing-banner')?.remove();
    }
  }
}

// ─── [2-1] 금리 미입력 순차 모달 큐 ─────────────────────────────────────────

/**
 * 금리 미입력 항목들을 순차적으로 모달 팝업으로 안내한 뒤 콜백 실행.
 * @param {Array<{loanIdx, cat, rInput}>} missingItems
 * @param {Function} onAllConfirmed  - 모든 팝업 확인 후 실행
 */
function showRateMissingQueue(missingItems, onAllConfirmed) {
  const total = missingItems.length;
  _modalQueue = missingItems.map((item, i) => {
    const rate    = getDefaultRate(item.cat);
    const label   = CAT_LABEL[item.cat] || '해당 대출';
    const emoji   = CAT_EMOJI[item.cat] || '📌';
    const counter = total > 1
      ? `<span class="modal-queue-counter">${i + 1} / ${total}</span>` : '';
    return {
      icon: '⚠️',
      msg:
        `${counter}` +
        `<b class="modal-rate-title">${emoji} ${item.loanIdx}번째 대출 — ${label}</b>` +
        `<span class="modal-rate-body">금리가 입력되지 않았습니다.<br>` +
        `<span class="modal-rate-default">기본 금리 <b>${rate}%</b> 자동 적용됩니다.</span></span>`,
    };
  });
  _onQueueDone = onAllConfirmed;
  _inQueueMode = true;
  _dequeueModal();
}

function _dequeueModal() {
  if (!_modalQueue.length) {
    _inQueueMode = false;
    if (_onQueueDone) { _onQueueDone(); _onQueueDone = null; }
    return;
  }
  const { msg, icon } = _modalQueue.shift();
  const modal = document.getElementById('customModal');
  document.getElementById('modalMsg').innerHTML  = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText = icon;
  modal.style.display = 'flex';
}

// ─── [2-2] 메인 검증 흐름 ────────────────────────────────────────────────────

function calculateTotalDSR() {
  document.querySelectorAll('.input-warning').forEach(el => el.classList.remove('input-warning'));
  clearRateWarnings();

  const income = getNum(document.getElementById('income').value);
  if (income < CONFIG.MIN_INCOME) {
    setWarning('income', true);
    showAlert("연간 세전 소득을 100만원 이상 입력해주세요.", "income");
    return;
  }

  const items = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) { showAlert("부채 항목을 최소 하나 이상 추가해주세요."); return; }

  // 필수 항목(금액·기간) 검사
  for (let item of items) {
    const pEl = item.querySelector('.l-p');
    const mEl = item.querySelector('.l-m');
    if (getNum(pEl.value) <= 0) {
      setWarning(pEl.id, true); showAlert("대출 금액을 입력해주세요.", pEl.id); return;
    }
    if (getNum(mEl.value) < 1) {
      setWarning(mEl.id, true); showAlert("대출 기간을 입력해주세요.", mEl.id); return;
    }
  }

  // 금리 미입력 항목 수집
  const missingRates = [];
  items.forEach((item, idx) => {
    const rInput = item.querySelector('.l-r');
    const cat    = item.querySelector('.l-category').value;
    if (!rInput.value.trim()) {
      markRateWarning(rInput);
      missingRates.push({ loanIdx: idx + 1, cat, rInput });
    }
  });

  if (missingRates.length > 0) {
    // 순차 팝업 → 모두 확인 후 계산 실행
    showRateMissingQueue(missingRates, calculateLogic);
  } else {
    calculateLogic();
  }
}

// ─── [3] 부채 항목 동적 관리 ─────────────────────────────────────────────────

function addLoan() {
  loanCount++;
  const loanList = document.getElementById('loanList');
  if (!loanList) return;

  loanList.insertAdjacentHTML('beforeend', `
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
        <input type="text" id="lp_${loanCount}" class="l-p" inputmode="numeric"
               onkeyup="formatComma(this)" placeholder="0">
      </div>
      <div>
        <label>금리 (%)</label>
        <input type="text" id="lr_${loanCount}" class="l-r" inputmode="decimal"
               placeholder="4.5" oninput="onRateInput(this)">
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
    <div class="dynamic-guide dynamic-guide--warn" id="guide_${loanCount}" style="display:none;"></div>
  </div>`);
}

function applyPolicy(id) {
  const card = document.getElementById(`loan_${id}`);
  if (!card) return;
  const cat      = card.querySelector('.l-category').value;
  const m        = card.querySelector('.l-m');
  const r        = card.querySelector('.l-r');
  const srSelect = card.querySelector('.l-sr-select');
  const guide    = card.querySelector('.dynamic-guide');

  // 동적 가이드 타입 초기화
  guide.classList.remove('dynamic-guide--warn', 'dynamic-guide--danger');
  guide.style.display = 'none';
  guide.innerHTML = '';

  switch (cat) {
    case 'officetel':
      guide.classList.add('dynamic-guide--warn');
      guide.style.display = 'block';
      guide.innerHTML =
        `🏢 <b>오피스텔 체크포인트</b><br>` +
        `· 구입 자금인 경우 <b>'주택담보'</b> 선택이 정확합니다.<br>` +
        `· 보유분은 <b>8년 상환 규정</b>이 적용됩니다.`;
      m.value = "96"; r.placeholder = "5.5"; srSelect.value = "0.0";
      break;
    case 'cardloan':
      guide.classList.add('dynamic-guide--danger');
      guide.style.display = 'block';
      guide.innerHTML =
        `⛔ <b>카드론 DSR 주의</b><br>` +
        `· DSR 산정 시 가상 만기 <b>3년(36개월)</b>이 고정 적용됩니다.<br>` +
        `· 실제 만기와 무관하게 최단 기간 기준으로 원리금이 산정되어<br>` +
        `&nbsp;&nbsp;DSR에 강한 부담을 줍니다.`;
      m.value = "36"; r.placeholder = "14.0"; srSelect.value = "0.0";
      break;
    case 'credit':
      m.value = "60"; r.placeholder = "6.0"; srSelect.value = "0.0";
      break;
    case 'jeonse':
      m.value = "24"; r.placeholder = "4.2"; srSelect.value = "0.0";
      break;
    default:
      m.value = "360"; r.placeholder = "4.5"; srSelect.value = "1.15";
      break;
  }
}

// ─── [4] DSR 핵심 연산 엔진 ──────────────────────────────────────────────────

function isPurchaseLoan(cat, n) {
  return cat === 'mortgage_level' || cat === 'mortgage_prin' ||
         (cat === 'officetel' && n >= 180);
}

function calculateLogic() {
  const income = getNum(document.getElementById('income').value);
  if (income <= 0) { showAlert("연소득을 입력해주세요.", "income"); return; }

  const items = document.querySelectorAll('[id^="loan_"]');
  let totalAnnPayment = 0;
  let combinedP       = 0;
  let bR  = DEFAULT_RATE_MAP.mortgage_level;
  let bSR = 1.15;
  let bM  = 360;

  items.forEach((item, idx) => {
    const cat = item.querySelector('.l-category').value;
    const P   = getNum(item.querySelector('.l-p').value);
    const R   = Number(item.querySelector('.l-r').value) || getDefaultRate(cat);
    const SR  = Number(item.querySelector('.l-sr-select')?.value || 0);
    const n   = getNum(item.querySelector('.l-m').value) || 360;

    if (idx === 0) { bR = R; bSR = SR; bM = n; }
    if (P <= 0) return;

    const r_dsr = (R + SR) / 1200;

    if (cat === 'jeonse') {
      totalAnnPayment += P * (R / 1200) * 12; return;
    }
    if (isPurchaseLoan(cat, n)) {
      combinedP += P;
      if (cat === 'mortgage_prin') {
        totalAnnPayment += (P / n) * 12 + (P * r_dsr * (n + 1) / 2) / (n / 12);
      } else {
        totalAnnPayment += calcPMT(P, r_dsr, n) * 12;
      }
    } else {
      const tN = cat === 'cardloan' ? 36 : cat === 'credit' ? 60 : n;
      totalAnnPayment += calcPMT(P, r_dsr, tN) * 12;
    }
  });

  const dsr    = (totalAnnPayment / income) * 100;
  const isOver = dsr > CONFIG.DSR_LIMIT;

  const resultArea = document.getElementById('resultArea');
  resultArea.style.display = 'block';

  // DSR 수치 & 게이지
  const dsrView = document.getElementById('dsrVal');
  dsrView.innerText   = dsr.toFixed(2) + "%";
  dsrView.style.color = isOver ? "var(--danger)" : dsr > 30 ? "var(--warn)" : "var(--safe)";

  const barView = document.getElementById('dsrBar');
  if (barView) {
    barView.style.width           = Math.min(dsr, 100) + "%";
    barView.style.backgroundColor = isOver ? "var(--danger)" : dsr > 30 ? "var(--warn)" : "var(--safe)";
  }

  // 한도 역산
  const targetAnnPay = income * (CONFIG.DSR_LIMIT / 100);
  const r_lim   = (bR + bSR) / 1200;
  const maxPrin  = calcMaxPrincipal(targetAnnPay, r_lim, bM);
  const maxLevel = calcMaxLevel(targetAnnPay, r_lim, bM);
  const f = v => (Math.floor(Math.max(0, v) / 10000) * 10000).toLocaleString() + " 원";

  const prinView  = document.getElementById('absMaxPrin');
  const levelView = document.getElementById('absMaxLevel');
  const prinCard  = document.getElementById('prinCard');
  const levelCard = document.getElementById('levelCard');

  if (isOver) {
    prinView.innerHTML  = `<span style="font-size:11px;color:var(--text-muted);display:block;">권장 신청액</span><span style="color:var(--danger);font-size:16px;font-weight:800;">${f(maxPrin)} 이하</span>`;
    levelView.innerHTML = `<span style="color:var(--danger);font-weight:800;">한도 초과</span>`;
    prinCard.classList.add('recommended'); levelCard.classList.remove('recommended');
  } else {
    prinView.innerText = f(maxPrin); levelView.innerText = f(maxLevel);
    prinView.style.color = ""; levelView.style.color = "";
    const prinBetter = maxPrin >= maxLevel;
    prinCard.classList.toggle('recommended',  prinBetter);
    levelCard.classList.toggle('recommended', !prinBetter);
  }

  // 추가 여력
  const remainLimit = isOver ? 0 : Math.max(0, maxPrin - combinedP);
  const remainView  = document.getElementById('remainingLimit');
  if (remainView) {
    remainView.innerText   = f(remainLimit);
    remainView.style.color = isOver ? "var(--danger)" : dsr > 36 ? "var(--warn)" : "var(--safe)";
  }

  // 추천 문구
  const recDesc = document.getElementById('recDesc');
  if (recDesc) recDesc.innerHTML = buildRecommendText(dsr, isOver, remainLimit, maxPrin, maxLevel, f);

  // 스케줄 초기화
  document.getElementById('scheduleSection').classList.remove('schedule-visible');
  document.getElementById('scheduleSection').classList.add('schedule-section-hidden');
  document.getElementById('btnShowSchedule').innerText = "📊 전체 상환 스케줄 상세 보기";

  // 스크롤
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const rect = resultArea.getBoundingClientRect();
    window.scrollTo({ top: window.pageYOffset + rect.top - 20, behavior: 'smooth' });
  }));
}

// ─── [4-1] 추천 문구 (전문화) ────────────────────────────────────────────────

function buildRecommendText(dsr, isOver, remainLimit, maxPrin, maxLevel, f) {
  const d = dsr.toFixed(1);
  if (isOver) {
    const ex = (dsr - 40).toFixed(1);
    return `<b style="color:var(--danger)">⛔ DSR 규제선(40%) 초과 — 현재 ${d}% (초과 ${ex}%p)</b>
    <br><span style="font-size:12px;line-height:1.8;">신규 주택담보대출 실행이 제한됩니다. 고금리 부채를 우선 상환하거나 만기를 연장해 월 상환부담을 줄이세요.
    권장 목표 대출원금: <b style="color:var(--kb-yellow-deep)">${f(maxPrin)} 이하</b></span>`;
  }
  if (dsr >= 36) {
    return `<b style="color:var(--warn)">⚠️ DSR 경계 구간 — 현재 ${d}%</b>
    <br><span style="font-size:12px;line-height:1.8;">규제선(40%)까지 여유 <b>${(40-dsr).toFixed(1)}%p</b>. 변동금리 상승 시 초과 위험이 있습니다.
    추가 대출이 필요하다면 <b>원금균등 방식</b>으로 빠른 원금 감소를 권장합니다.<br>추가 여력: <b style="color:var(--warn)">${f(remainLimit)}</b></span>`;
  }
  if (dsr >= 25) {
    return `<b style="color:var(--kb-yellow-deep)">✅ 안정 구간 — 현재 ${d}%</b>
    <br><span style="font-size:12px;line-height:1.8;">부채 구조 양호. 추가 대출 여력 <b style="color:var(--safe)">${f(remainLimit)}</b>.
    장기 보유 목적이면 <b>원금균등</b>, 초기 현금흐름 안정이라면 <b>원리금균등</b>을 고려하세요.</span>`;
  }
  return `<b style="color:var(--safe)">💚 우량 구간 — 현재 ${d}%</b>
  <br><span style="font-size:12px;line-height:1.8;">부채 건전성 매우 양호. 추가 여력 <b style="color:var(--safe)">${f(remainLimit)}</b>.
  중도상환 병행 및 고정금리 전환으로 장기 리스크 헤지를 권장합니다.</span>`;
}

// ─── [수학 유틸] ──────────────────────────────────────────────────────────────

function calcPMT(P, r, n) {
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}
function calcMaxPrincipal(tAnn, r, n) {
  const d = (12 / n) + (r * 6 * (n + 1) / n);
  return d > 0 ? tAnn / d : 0;
}
function calcMaxLevel(tAnn, r, n) {
  if (r === 0) return (tAnn / 12) * n;
  return (tAnn / 12) * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
}

// ─── [5] 상환 스케줄 ─────────────────────────────────────────────────────────

function toggleSchedule() {
  const sec = document.getElementById('scheduleSection');
  const btn = document.getElementById('btnShowSchedule');
  if (!sec) return;

  if (sec.classList.contains('schedule-section-hidden')) {
    const v = validateSchedule();
    if (!v.ok) { showAlert(v.msg, null, "⚠️"); return; }
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

function validateSchedule() {
  const items = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) return { ok: false, msg: "부채 항목이 없습니다." };
  const first  = items[0];
  const firstCat = first.querySelector('.l-category').value;
  const firstN   = getNum(first.querySelector('.l-m').value);
  if (!isPurchaseLoan(firstCat, firstN)) {
    if (firstN < CONFIG.SCH_MIN_MONTHS || firstN > CONFIG.SCH_MAX_MONTHS) {
      const minY = CONFIG.SCH_MIN_MONTHS / 12, maxY = CONFIG.SCH_MAX_MONTHS / 12;
      return {
        ok: false,
        msg: `첫 번째 부채가 구입자금(주택담보·오피스텔)이 아니며,\n대출 기간(${firstN}개월)이 스케줄 산출 범위(${minY}년~${maxY}년)를 벗어났습니다.\n\n구입자금 항목을 첫 번째로 이동하거나\n기간을 ${minY}년 이상으로 조정해 주세요.`
      };
    }
  }
  return { ok: true };
}

function switchSchedule(type) {
  currentScheduleType = type;
  document.getElementById('tabPrin').classList.toggle('active', type === 'P');
  document.getElementById('tabLevel').classList.toggle('active', type === 'L');
  generateSchedule();
}

/**
 * 스케줄 생성
 * ① 상단: 전체 대출 항목 요약 (줄바꿈 목록)
 * ② 구입자금 복수 → 합산 스케줄 / 단일 → 그대로 / 없으면 첫 항목
 */
function generateSchedule() {
  const items  = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) return;
  const listEl = document.getElementById('scheduleList');
  if (!listEl) return;
  listEl.innerHTML = "";

  // ── ① 전체 대출 항목 요약 카드 ─────────────────────────────────────────
  const allLoans = [];
  items.forEach((item, idx) => {
    const cat  = item.querySelector('.l-category').value;
    const P    = getNum(item.querySelector('.l-p').value);
    const R    = Number(item.querySelector('.l-r').value) || getDefaultRate(cat);
    const n    = getNum(item.querySelector('.l-m').value) || 360;
    if (P > 0) allLoans.push({ cat, P, R, n, idx });
  });

  if (allLoans.length > 0) {
    const summaryCard = document.createElement('div');
    summaryCard.className = 'sch-summary-card';
    const rows = allLoans.map((l, i) =>
      `<div class="sch-summary-row">
        <span class="sch-summary-emoji">${CAT_EMOJI[l.cat] || '📌'}</span>
        <span class="sch-summary-label">${CAT_LABEL[l.cat] || l.cat}</span>
        <span class="sch-summary-sep">—</span>
        <span class="sch-summary-amount">${Math.round(l.P).toLocaleString()}원</span>
        <span class="sch-summary-divider">|</span>
        <span class="sch-summary-rate">${l.R.toFixed(2)}%</span>
        <span class="sch-summary-divider">|</span>
        <span class="sch-summary-term">${l.n}개월</span>
      </div>`
    ).join('');
    summaryCard.innerHTML =
      `<div class="sch-summary-title">📋 대출 항목 현황</div>${rows}`;
    listEl.appendChild(summaryCard);
  }

  // ── ② 구입자금 수집 → 스케줄 계산 ────────────────────────────────────
  const purchaseLoans = allLoans.filter(l => isPurchaseLoan(l.cat, l.n));

  let schedLoans;
  if (purchaseLoans.length >= 2) {
    const totalP    = purchaseLoans.reduce((s, l) => s + l.P, 0);
    const weightedR = purchaseLoans.reduce((s, l) => s + l.R * l.P, 0) / totalP;
    const maxN      = Math.max(...purchaseLoans.map(l => l.n));
    schedLoans = [{
      P: totalP, R: weightedR, n: maxN,
      label: '통합 구입자금',
      merged: true, parts: purchaseLoans
    }];
  } else if (purchaseLoans.length === 1) {
    schedLoans = [{ ...purchaseLoans[0], label: CAT_LABEL[purchaseLoans[0].cat], merged: false }];
  } else {
    const first = allLoans[0];
    if (!first) return;
    schedLoans = [{ ...first, label: CAT_LABEL[first.cat], merged: false }];
  }

  schedLoans.forEach(loan => renderLoanSchedule(listEl, loan));
}

function renderLoanSchedule(listEl, loan) {
  const { P, R, n, label, merged, parts } = loan;
  const r = R / 1200;
  if (!P || !n) return;

  // 스케줄 계산 헤더 (분리선)
  const schedHeader = document.createElement('div');
  schedHeader.className = 'sch-calc-header';
  if (merged) {
    const partsText = parts.map(p =>
      `${CAT_EMOJI[p.cat]} ${CAT_LABEL[p.cat]} ${Math.round(p.P).toLocaleString()}원 @ ${p.R.toFixed(2)}%`
    ).join(' + ');
    schedHeader.innerHTML =
      `<span class="sch-calc-title">🏠 통합 구입자금 상환 스케줄</span>` +
      `<span class="sch-calc-meta">합산 ${Math.round(P).toLocaleString()}원 | 가중평균 ${R.toFixed(2)}% | ${n}개월</span>` +
      `<span class="sch-calc-parts">${partsText}</span>`;
  } else {
    schedHeader.innerHTML =
      `<span class="sch-calc-title">${CAT_EMOJI[loan.cat] || '🏠'} ${label} 상환 스케줄</span>` +
      `<span class="sch-calc-meta">${Math.round(P).toLocaleString()}원 | ${R.toFixed(2)}% | ${n}개월</span>`;
  }
  listEl.appendChild(schedHeader);

  const isLevel  = currentScheduleType === 'L';
  const mP_prin  = P / n;
  const mPMT_lvl = calcPMT(P, r, n);

  let balance       = P;
  let yearCumP      = 0;
  let yearCumI      = 0;
  let totalInterest = 0;

  for (let i = 1; i <= n; i++) {
    let curP, curI;
    if (isLevel) {
      curI = balance * r; curP = mPMT_lvl - curI;
    } else {
      curI = balance * r; curP = mP_prin;
    }
    if (i === n) { curP = balance; curI = balance * r; }

    balance       -= curP;
    yearCumP      += curP;
    yearCumI      += curI;
    totalInterest += curI;

    const row = document.createElement('div');
    row.className = 'schedule-item';
    row.innerHTML =
      `<div class="sch-idx">${i}회</div>` +
      `<div class="sch-val">${Math.round(curP).toLocaleString()}</div>` +
      `<div class="sch-val">${Math.round(curI).toLocaleString()}</div>` +
      `<div class="sch-total">${Math.round(curP + curI).toLocaleString()}</div>`;
    listEl.appendChild(row);

    if (i % 12 === 0 || i === n) {
      const yearNum = Math.ceil(i / 12);
      const card    = document.createElement('div');
      card.className = 'year-summary-card';
      card.innerHTML =
        `<div class="card-title-row">
          <span class="card-title">📅 ${yearNum}년차 누적 요약</span>
          <span class="year-badge">${yearNum}년 경과</span>
        </div>
        <div class="card-stats">
          <div>누적원금: <b class="stat-prin">${Math.round(yearCumP).toLocaleString()}원</b></div>
          <div>누적이자: <b class="stat-int">${Math.round(yearCumI).toLocaleString()}원</b></div>
        </div>
        <div class="card-balance-row">
          <span class="balance-label">잔액</span>
          <span class="balance-value">${Math.max(0, Math.round(balance)).toLocaleString()}원</span>
        </div>`;
      listEl.appendChild(card);
      yearCumP = 0; yearCumI = 0;
    }
  }

  // 총계 카드
  const total = document.createElement('div');
  total.className = 'year-summary-card total-card';
  total.innerHTML =
    `<div class="card-title-row"><span class="card-title">📊 ${label} 상환 총계</span></div>
    <div class="card-stats">
      <div>총 원금: <b class="stat-prin">${Math.round(P).toLocaleString()}원</b></div>
      <div>총 이자: <b class="stat-int">${Math.round(totalInterest).toLocaleString()}원</b></div>
    </div>
    <div class="card-balance-row">
      <span class="balance-label">총 납입액</span>
      <span class="balance-value">${Math.round(P + totalInterest).toLocaleString()}원</span>
    </div>`;
  listEl.appendChild(total);
}

// ─── [6] 공지 팝업 ───────────────────────────────────────────────────────────

function initNotice() {
  if (localStorage.getItem('hideNotice_' + NOTICE_VERSION) !== 'true')
    document.getElementById('noticePopup').style.display = 'flex';
}
function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() {
  localStorage.setItem('hideNotice_' + NOTICE_VERSION, 'true');
  closeNotice();
}

// ─── [7] 모달 & 공통 유틸 ────────────────────────────────────────────────────

function handleModalConfirm() {
  const modal = document.getElementById('customModal');
  if (modal) modal.style.display = 'none';

  // 큐 모드 처리
  if (_inQueueMode) { _dequeueModal(); return; }

  if (proceedOnConfirm) {
    proceedOnConfirm = false; calculateLogic();
  } else if (lastFocusId) {
    const el = document.getElementById(lastFocusId);
    if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
}

function showAlert(msg, focusId = null, icon = "⚠️", allowProceed = false) {
  const modal = document.getElementById('customModal');
  if (!modal) return;
  document.getElementById('modalMsg').innerHTML  = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText = icon;
  lastFocusId = focusId; proceedOnConfirm = allowProceed;
  modal.style.display = 'flex';
}

function setWarning(id, isError) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('input-warning', isError);
}

function formatComma(obj) {
  const val = obj.value.replace(/[^0-9]/g, "");
  obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
  obj.classList.remove('input-warning');
}

function getNum(val) { return Number(String(val).replace(/,/g, "")) || 0; }
function removeLoan(id) { document.getElementById(`loan_${id}`)?.remove(); }

// ─── [8] 리포트 복사 ─────────────────────────────────────────────────────────

function copyResultText() {
  const dsr   = document.getElementById('dsrVal')?.innerText  || '-';
  const limit = document.getElementById('remainingLimit')?.innerText || '-';
  const maxP  = document.getElementById('absMaxPrin')?.innerText  || '-';
  const maxL  = document.getElementById('absMaxLevel')?.innerText || '-';
  const text  =
    `[📊 KB DSR 진단 리포트]\n` +
    `● 종합 DSR (스트레스 반영): ${dsr}\n` +
    `● 최대 한도 (원금균등): ${maxP}\n` +
    `● 최대 한도 (원리금균등): ${maxL}\n` +
    `● 추가 대출 여력: ${limit}\n\n` +
    `* 본 결과는 입력값 기준 예상 수치이며 실제 심사 결과와 상이할 수 있습니다.`;

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showAlert("리포트가 클립보드에 복사되었습니다.", null, "✅"))
      .catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
}

function fallbackCopy(text) {
  const t = document.createElement("textarea");
  t.style.cssText = "position:fixed;top:-9999px;opacity:0;";
  document.body.appendChild(t);
  t.value = text; t.focus(); t.select();
  try { document.execCommand("copy"); showAlert("리포트가 복사되었습니다.", null, "✅"); }
  catch { showAlert("복사 실패. 직접 선택 후 복사해 주세요.", null, "❌"); }
  document.body.removeChild(t);
}
