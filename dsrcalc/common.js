/* =============================================================================
   DSR CORE SYSTEM — KB 브랜드 VER 2026.05-B
   파일명: common.js
   ============================================================================= */

// ═══════════════════════════════════════════════════════════════════════════════
//  📋 APP 설정 — 이 블록만 수정하면 앱 전체에 즉시 적용됩니다
// ═══════════════════════════════════════════════════════════════════════════════
const APP_CONFIG = {

  APP_VERSION:    '2026.05-B',
  NOTICE_VERSION: '0781_6',

  // ── DSR 구간 기준 (%) ───────────────────────────────────────────────────────
  DSR_LIMIT_PCT:   40,
  DSR_WARN_PCT:    36,
  DSR_CAUTION_PCT: 25,

  // ── 연소득 최소값 (원) ─────────────────────────────────────────────────────
  MIN_INCOME: 1_000_000,

  // ── 스케줄 허용 기간 (개월) ────────────────────────────────────────────────
  SCH_MIN_MONTHS: 180,
  SCH_MAX_MONTHS: 600,

  // ── 대출 종류별 기본 금리 % (금리 미입력 시 자동 적용) ──────────────────────
  DEFAULT_RATES: {
    mortgage_level: 4.5,
    mortgage_prin:  4.5,
    jeonse:         4.2,
    officetel:      5.5,
    credit:         6.0,
    cardloan:       14.0,
  },

  // ── DSR 산정 가상 만기 (개월) ──────────────────────────────────────────────
  DSR_VIRTUAL_MONTHS: {
    credit:   60,
    cardloan: 36,
  },

  // ── 대출 종류 한글 레이블 ──────────────────────────────────────────────────
  CAT_LABELS: {
    mortgage_level: '주택담보 (원리금)',
    mortgage_prin:  '주택담보 (원금)',
    jeonse:         '전세대출 (만기)',
    officetel:      '오피스텔 (원리금)',
    credit:         '신용대출 (원리금)',
    cardloan:       '카드론 (원리금)',
  },

  // ── 이모티콘 ──────────────────────────────────────────────────────────────
  CAT_EMOJIS: {
    mortgage_level:'🏠', mortgage_prin:'🏠',
    jeonse:'🔑', officetel:'🏢', credit:'💳', cardloan:'💰',
  },

  // ── 오피스텔 구입자금 분류 최소 기간 ──────────────────────────────────────
  OFFICETEL_PURCHASE_MIN_MONTHS: 180,

  // ── 주담대 기본 스트레스 금리 ─────────────────────────────────────────────
  DEFAULT_STRESS_RATE_MORTGAGE: 1.15,

  // ── 스케줄 최대 높이 (px) ──────────────────────────────────────────────────
  SCHEDULE_MAX_HEIGHT_PX: 480,

  // ═══════════════════════════════════════════════════════════════════════════
  //  🔗 임시 리포트 링크 설정
  // ═══════════════════════════════════════════════════════════════════════════
  REPORT_LINK_EXPIRY_DAYS:  7,     // 링크 유효 기간 (일)
  REPORT_COPY_DAILY_LIMIT:  5,     // 하루 최대 복사 횟수 — 변경 가능
  REPORT_PAGE_PATH: 'report.html', // 리포트 뷰어 페이지 경로
  SHORTENER_API: 'https://is.gd/create.php?format=simple&url=', // URL 단축 API

  // ── KB 담보대출 유형별 금리 % (폴백값 — kb_rates.js 에서 자동 갱신) ─────────
  KB_MORTGAGE_RATES: {
    mortgage_level: {
      '5년변동':  3.82,   // ← 이 숫자만 변경하면 즉시 반영 (자동 갱신되면 덮어씀)
      '5년혼합':  3.65,
      '6_12변동': 4.02,
      '직접입력': null,
    },
    mortgage_prin: {
      '5년변동':  3.72,
      '5년혼합':  3.58,
      '6_12변동': 3.92,
      '직접입력': null,
    },
  },
};
// ═══════════════════════════════════════════════════════════════════════════════

const _C     = APP_CONFIG;
const _RATE  = _C.DEFAULT_RATES;
const _LABEL = _C.CAT_LABELS;
const _EMOJI = _C.CAT_EMOJIS;

let loanCount           = 0;
let currentScheduleType = 'P';
let lastFocusId         = null;
let proceedOnConfirm    = false;

// 모달 큐
let _modalQueue  = [];
let _onQueueDone = null;
let _inQueueMode = false;

// ─── [1] 초기화 ──────────────────────────────────────────────────────────────
window.onload = async function () {
  applySystemTheme();
  initNotice();
  addLoan();
  document.getElementById('modalConfirm').onclick = handleModalConfirm;
  document.documentElement.style.setProperty('--schedule-max-height', _C.SCHEDULE_MAX_HEIGHT_PX + 'px');
  initCopyBtn();

  // KB 금리 자동 로드 (kb_rates.js 가 로드되어 있으면)
  if (typeof applyKBRatesToConfig === 'function') {
    await applyKBRatesToConfig();
    _syncRateTypeLabels(); // 셀렉트 옵션 텍스트 갱신
  }
};

// ─── [1-1] 테마 엔진 ──────────────────────────────────────────────────────────
function applySystemTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark',  isDark);
  document.body.classList.toggle('white', !isDark);
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

/** 금리유형 셀렉트 옵션 텍스트를 현재 KB_MORTGAGE_RATES 값으로 동기화 */
function _syncRateTypeLabels() {
  const baseRates = _C.KB_MORTGAGE_RATES.mortgage_level;
  document.querySelectorAll('.l-rate-type').forEach(sel => {
    [...sel.options].forEach(opt => {
      const v = opt.value;
      if (v === '직접입력') return;
      const rate = baseRates[v];
      if (rate != null) {
        const map = { '5년변동': '5년변동', '5년혼합': '5년혼합', '6_12변동': '6,12개월변동' };
        opt.textContent = `${map[v] || v} (${rate}%)`;
      }
    });
  });
}

// ─── [2] 유효성 검증 & 금리 경고 ─────────────────────────────────────────────
function getDefaultRate(cat) { return _RATE[cat] ?? 4.5; }

function markRateWarning(rInput) {
  rInput.classList.add('rate-missing');
  const card = rInput.closest('.input-card');
  if (!card) return;
  card.classList.add('rate-warning-card');
  if (!card.querySelector('.rate-missing-banner')) {
    const cat    = card.querySelector('.l-category').value;
    const rate   = getDefaultRate(cat);
    const label  = _LABEL[cat] || '해당 대출';
    const banner = document.createElement('div');
    banner.className = 'rate-missing-banner';
    banner.innerHTML =
      `<span class="rmb-icon">⚠️</span>` +
      `<span class="rmb-text">금리 미입력 — <b>${label}</b> 기본금리 <b class="rmb-rate">${rate}%</b> 자동 적용</span>`;
    card.appendChild(banner);
  }
}

function clearRateWarnings() {
  document.querySelectorAll('.rate-missing').forEach(el => el.classList.remove('rate-missing'));
  document.querySelectorAll('.rate-warning-card').forEach(el => el.classList.remove('rate-warning-card'));
  document.querySelectorAll('.rate-missing-banner').forEach(el => el.remove());
}

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
function showRateMissingQueue(missingItems, onAllConfirmed) {
  const total = missingItems.length;
  _modalQueue = missingItems.map((item, i) => {
    const rate  = getDefaultRate(item.cat);
    const label = _LABEL[item.cat] || '해당 대출';
    const emoji = _EMOJI[item.cat]  || '📌';
    const ctr   = total > 1 ? `<span class="modal-queue-counter">${i + 1} / ${total}개 항목</span>` : '';
    return {
      icon: '⚠️',
      msg:  `${ctr}<b class="modal-rate-title">${emoji} ${item.loanIdx}번째 대출 — ${label}</b>` +
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
  document.getElementById('modalMsg').innerHTML  = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText = icon;
  document.getElementById('customModal').style.display = 'flex';
}

// ─── [2-2] 메인 검증 흐름 ────────────────────────────────────────────────────
function calculateTotalDSR() {
  document.querySelectorAll('.input-warning').forEach(el => el.classList.remove('input-warning'));
  clearRateWarnings();

  const income = getNum(document.getElementById('income').value);
  if (income < _C.MIN_INCOME) {
    setWarning('income', true); showAlert("연간 세전 소득을 100만원 이상 입력해주세요.", "income"); return;
  }
  const items = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) { showAlert("부채 항목을 최소 하나 이상 추가해주세요."); return; }

  for (let item of items) {
    const pEl  = item.querySelector('.l-p');
    const mEl  = item.querySelector('.l-m');
    const cat  = item.querySelector('.l-category').value;
    const rType = item.querySelector('.l-rate-type')?.value;

    if (getNum(pEl.value) <= 0) { setWarning(pEl.id, true); showAlert("대출 금액을 입력해주세요.", pEl.id); return; }
    if (getNum(mEl.value) < 1)  { setWarning(mEl.id, true); showAlert("대출 기간을 입력해주세요.", mEl.id); return; }

    // 오피스텔(보유분) + 담보 금리유형 선택 시 경고
    if (cat === 'officetel' && rType && rType !== '직접입력') {
      showAlert("오피스텔 구입자금은 주택담보로 설정 후 다시 입력해주세요.", null, "⚠️");
      return;
    }
  }

  const missingRates = [];
  items.forEach((item, idx) => {
    const rInput = item.querySelector('.l-r');
    const cat    = item.querySelector('.l-category').value;
    if (!rInput.value.trim()) { markRateWarning(rInput); missingRates.push({ loanIdx: idx + 1, cat }); }
  });

  if (missingRates.length > 0) { showRateMissingQueue(missingRates, calculateLogic); }
  else { calculateLogic(); }
}

// ─── [3] 부채 항목 동적 관리 ─────────────────────────────────────────────────
function addLoan() {
  loanCount++;
  const loanList = document.getElementById('loanList');
  if (!loanList) return;

  // 금리유형 옵션 텍스트 (현재 KB 금리 반영)
  const rateMap = _C.KB_MORTGAGE_RATES.mortgage_level;
  const r5v  = rateMap['5년변동']  != null ? ` (${rateMap['5년변동']}%)`  : '';
  const r5h  = rateMap['5년혼합']  != null ? ` (${rateMap['5년혼합']}%)`  : '';
  const r612 = rateMap['6_12변동'] != null ? ` (${rateMap['6_12변동']}%)` : '';

  loanList.insertAdjacentHTML('beforeend', `
  <div class="input-card" id="loan_${loanCount}">
    <button class="btn-remove" onclick="removeLoan(${loanCount})">×</button>
    <div class="grid-row">

      <!-- ① 금리유형(담보) — 항상 노출, 비담보일 때 disabled -->
      <div>
        <label>금리 유형 (담보)</label>
        <select class="l-rate-type" id="lrt_${loanCount}" onchange="applyKbRate(${loanCount})">
          <option value="직접입력">직접 입력</option>
          <option value="5년변동">5년변동${r5v}</option>
          <option value="5년혼합">5년혼합${r5h}</option>
          <option value="6_12변동">6,12개월변동${r612}</option>
        </select>
      </div>

      <!-- ② 대출 종류 -->
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

      <!-- ③ 금리(%) -->
      <div>
        <label>금리 (%)</label>
        <input type="text" id="lr_${loanCount}" class="l-r" inputmode="decimal"
               placeholder="4.5" oninput="onRateInput(this)">
      </div>

      <!-- ④ 원금/잔액 -->
      <div>
        <label>원금/잔액 (원)</label>
        <input type="text" id="lp_${loanCount}" class="l-p" inputmode="numeric"
               onkeyup="formatComma(this)" placeholder="0">
      </div>

      <!-- ⑤ 스트레스 금리 -->
      <div>
        <label>스트레스 금리</label>
        <select class="l-sr-select">
          <option value="1.15" selected>60개월변동 (1.15%)</option>
          <option value="2.87">6,12개월변동 (2.87%)</option>
          <option value="0.0">해당없음 (0.0%)</option>
        </select>
      </div>

      <!-- ⑥ 기간(개월) -->
      <div>
        <label>기간 (개월)</label>
        <input type="text" id="lm_${loanCount}" class="l-m" inputmode="numeric" value="360">
      </div>

    </div>
    <div class="dynamic-guide" id="guide_${loanCount}" style="display:none;"></div>
  </div>`);
}

// ─── [3-1] KB 담보대출 금리 자동 적용 ────────────────────────────────────────
function applyKbRate(id) {
  const card      = document.getElementById(`loan_${id}`);
  if (!card) return;
  const cat       = card.querySelector('.l-category').value;
  const typeEl    = card.querySelector('.l-rate-type');
  const rInput    = card.querySelector('.l-r');
  const srSelect  = card.querySelector('.l-sr-select');
  if (!typeEl || !rInput) return;

  const rateType = typeEl.value;
  const rateMap  = _C.KB_MORTGAGE_RATES[cat];
  if (!rateMap) return;

  const rate = rateMap[rateType];
  if (rate !== null && rate !== undefined) {
    rInput.value = String(rate);
    onRateInput(rInput);
  } else {
    rInput.value = '';
    rInput.placeholder = String(_RATE[cat] ?? '4.5');
  }

  // 스트레스 금리 연동
  srSelect.value = rateType === '6_12변동'
    ? '2.87'
    : String(_C.DEFAULT_STRESS_RATE_MORTGAGE);
}

function applyPolicy(id) {
  const card = document.getElementById(`loan_${id}`);
  if (!card) return;
  const cat       = card.querySelector('.l-category').value;
  const m         = card.querySelector('.l-m');
  const r         = card.querySelector('.l-r');
  const srSelect  = card.querySelector('.l-sr-select');
  const guide     = card.querySelector('.dynamic-guide');
  const rateType  = card.querySelector('.l-rate-type');

  guide.className     = 'dynamic-guide';
  guide.style.display = 'none';
  guide.innerHTML     = '';

  // 담보 여부
  const isMortgage = cat === 'mortgage_level' || cat === 'mortgage_prin';

  // 금리유형 활성/비활성 (display:none 대신 disabled + 시각적 비활성화)
  if (rateType) {
    rateType.disabled = !isMortgage;
    rateType.classList.toggle('rate-type--disabled', !isMortgage);
    if (!isMortgage) {
      rateType.value = '직접입력'; // 비담보이면 직접입력으로 초기화
    }
  }

  switch (cat) {
    case 'officetel':
      guide.classList.add('dynamic-guide--warn');
      guide.style.display = 'block';
      guide.innerHTML =
        `🏢 <b>오피스텔 체크포인트</b><br>` +
        `· 구입 자금인 경우 <b>'주택담보'</b> 선택이 정확합니다.<br>` +
        `· 보유분은 <b>8년(96개월) 상환 규정</b>이 적용됩니다.`;
      m.value = "96"; r.placeholder = "5.5"; srSelect.value = "0.0";
      break;
    case 'cardloan':
      guide.classList.add('dynamic-guide--danger');
      guide.style.display = 'block';
      guide.innerHTML =
        `⛔ <b>카드론 DSR 주의</b><br>` +
        `· DSR 산정 시 가상 만기 <b>3년(36개월)</b> 고정 적용<br>` +
        `· 실제 만기와 무관, DSR에 강한 부담을 줍니다.`;
      m.value = "36"; r.placeholder = "14.0"; srSelect.value = "0.0";
      break;
    case 'credit':
      m.value = "60"; r.placeholder = "6.0"; srSelect.value = "0.0"; break;
    case 'jeonse':
      m.value = "24"; r.placeholder = "4.2"; srSelect.value = "0.0"; break;
    default:
      m.value = "360"; r.placeholder = "4.5";
      srSelect.value = String(_C.DEFAULT_STRESS_RATE_MORTGAGE);
      if (isMortgage && rateType && rateType.value !== '직접입력') applyKbRate(id);
      break;
  }
}

// ─── [4] DSR 핵심 연산 엔진 ──────────────────────────────────────────────────
function isPurchaseLoan(cat, n) {
  return cat === 'mortgage_level' || cat === 'mortgage_prin' ||
         (cat === 'officetel' && n >= _C.OFFICETEL_PURCHASE_MIN_MONTHS);
}

function calculateLogic() {
  const income = getNum(document.getElementById('income').value);
  if (income <= 0) { showAlert("연소득을 입력해주세요.", "income"); return; }

  const items = document.querySelectorAll('[id^="loan_"]');
  let totalAnnPayment = 0, combinedP = 0;
  let bR = _RATE.mortgage_level, bSR = _C.DEFAULT_STRESS_RATE_MORTGAGE, bM = 360;

  items.forEach((item, idx) => {
    const cat = item.querySelector('.l-category').value;
    const P   = getNum(item.querySelector('.l-p').value);
    const R   = Number(item.querySelector('.l-r').value) || getDefaultRate(cat);
    const SR  = Number(item.querySelector('.l-sr-select')?.value || 0);
    const n   = getNum(item.querySelector('.l-m').value) || 360;
    if (idx === 0) { bR = R; bSR = SR; bM = n; }
    if (P <= 0) return;
    const r_dsr = (R + SR) / 1200;
    if (cat === 'jeonse') { totalAnnPayment += P * (R / 1200) * 12; return; }
    if (isPurchaseLoan(cat, n)) {
      combinedP += P;
      if (cat === 'mortgage_prin') {
        totalAnnPayment += (P / n) * 12 + (P * r_dsr * (n + 1) / 2) / (n / 12);
      } else { totalAnnPayment += calcPMT(P, r_dsr, n) * 12; }
    } else {
      totalAnnPayment += calcPMT(P, r_dsr, _C.DSR_VIRTUAL_MONTHS[cat] ?? n) * 12;
    }
  });

  const dsr = (totalAnnPayment / income) * 100;
  const isOver = dsr > _C.DSR_LIMIT_PCT;
  const resultArea = document.getElementById('resultArea');
  resultArea.style.display = 'block';

  const dsrView = document.getElementById('dsrVal');
  dsrView.innerText   = dsr.toFixed(2) + "%";
  dsrView.style.color = isOver ? "var(--danger)" : dsr > _C.DSR_WARN_PCT ? "var(--warn)" : "var(--safe)";

  const barView = document.getElementById('dsrBar');
  if (barView) {
    barView.style.width           = Math.min(dsr, 100) + "%";
    barView.style.backgroundColor = dsrView.style.color;
  }

  const targetAnnPay = income * (_C.DSR_LIMIT_PCT / 100);
  const r_lim   = (bR + bSR) / 1200;
  const maxPrin  = calcMaxPrincipal(targetAnnPay, r_lim, bM);
  const maxLevel = calcMaxLevel(targetAnnPay, r_lim, bM);
  const f = v => (Math.floor(Math.max(0, v) / 10000) * 10000).toLocaleString() + " 원";

  const prinView = document.getElementById('absMaxPrin'), levelView = document.getElementById('absMaxLevel');
  const prinCard = document.getElementById('prinCard'),   levelCard = document.getElementById('levelCard');

  if (isOver) {
    prinView.innerHTML  = `<span style="font-size:11px;color:var(--text-muted);display:block;">권장 신청액</span><span style="color:var(--danger);font-size:16px;font-weight:800;">${f(maxPrin)} 이하</span>`;
    levelView.innerHTML = `<span style="color:var(--danger);font-weight:800;">한도 초과</span>`;
    prinCard.classList.add('recommended'); levelCard.classList.remove('recommended');
  } else {
    prinView.innerText = f(maxPrin); levelView.innerText = f(maxLevel);
    prinView.style.color = ""; levelView.style.color = "";
    const pb = maxPrin >= maxLevel;
    prinCard.classList.toggle('recommended', pb); levelCard.classList.toggle('recommended', !pb);
  }

  const remainLimit = isOver ? 0 : Math.max(0, maxPrin - combinedP);
  const remainView  = document.getElementById('remainingLimit');
  if (remainView) {
    remainView.innerText   = f(remainLimit);
    remainView.style.color = isOver ? "var(--danger)" : dsr > _C.DSR_WARN_PCT ? "var(--warn)" : "var(--safe)";
  }

  const recDesc = document.getElementById('recDesc');
  if (recDesc) recDesc.innerHTML = buildRecommendText(dsr, isOver, remainLimit, maxPrin, maxLevel, f);

  // 스케줄 닫기 + 버튼 초기화
  document.getElementById('scheduleSection').classList.remove('schedule-visible');
  document.getElementById('scheduleSection').classList.add('schedule-section-hidden');
  document.getElementById('btnShowSchedule').innerText = "📊 전체 상환 스케줄 상세 보기";

  // 스크롤
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const header  = document.querySelector('.header');
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const rect    = resultArea.getBoundingClientRect();
    window.scrollTo({ top: window.pageYOffset + rect.top - headerH - 4, behavior: 'smooth' });
  }));
}

// ─── [4-1] 추천 문구 ─────────────────────────────────────────────────────────
function buildRecommendText(dsr, isOver, remainLimit, maxPrin, maxLevel, f) {
  const d = dsr.toFixed(1);
  if (isOver) {
    return `<b style="color:var(--danger)">⛔ DSR 규제선(${_C.DSR_LIMIT_PCT}%) 초과 — 현재 ${d}% (초과 ${(dsr-_C.DSR_LIMIT_PCT).toFixed(1)}%p)</b>
    <br><span style="font-size:12px;line-height:1.8;">신규 주택담보대출 실행이 제한됩니다. 고금리 부채 우선 상환 또는 만기 연장으로 월 상환부담을 줄이세요.
    권장 목표 원금: <b style="color:var(--kb-yellow-deep)">${f(maxPrin)} 이하</b></span>`;
  }
  if (dsr >= _C.DSR_WARN_PCT) {
    return `<b style="color:var(--warn)">⚠️ DSR 경계 구간 — 현재 ${d}%</b>
    <br><span style="font-size:12px;line-height:1.8;">규제선까지 여유 <b>${(_C.DSR_LIMIT_PCT - dsr).toFixed(1)}%p</b>. 변동금리 상승 시 초과 위험이 있습니다.
    추가 대출이 필요하다면 <b>원금균등 방식</b>으로 빠른 원금 감소를 권장합니다.<br>추가 여력: <b style="color:var(--warn)">${f(remainLimit)}</b></span>`;
  }
  if (dsr >= _C.DSR_CAUTION_PCT) {
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
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const header  = document.querySelector('.header');
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const rect    = sec.getBoundingClientRect();
      window.scrollTo({ top: window.pageYOffset + rect.top - headerH - 8, behavior: 'smooth' });
    }));
  } else {
    sec.classList.add('schedule-section-hidden');
    sec.classList.remove('schedule-visible');
    btn.innerText = "📊 전체 상환 스케줄 상세 보기";
  }
}

function validateSchedule() {
  const items = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) return { ok: false, msg: "부채 항목이 없습니다." };
  const first    = items[0];
  const firstCat = first.querySelector('.l-category').value;
  const firstN   = getNum(first.querySelector('.l-m').value);
  if (!isPurchaseLoan(firstCat, firstN)) {
    if (firstN < _C.SCH_MIN_MONTHS || firstN > _C.SCH_MAX_MONTHS) {
      const minY = _C.SCH_MIN_MONTHS / 12, maxY = _C.SCH_MAX_MONTHS / 12;
      return { ok: false, msg: `첫 번째 부채가 구입자금(주택담보·오피스텔)이 아니며,\n대출 기간(${firstN}개월)이 스케줄 산출 범위(${minY}년~${maxY}년)를 벗어났습니다.\n\n구입자금 항목을 첫 번째로 이동하거나\n기간을 ${minY}년 이상으로 조정해 주세요.` };
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

function generateSchedule() {
  const items  = document.querySelectorAll('[id^="loan_"]');
  if (!items.length) return;
  const listEl = document.getElementById('scheduleList');
  if (!listEl) return;
  listEl.innerHTML = "";

  const allLoans = [];
  items.forEach(item => {
    const cat = item.querySelector('.l-category').value;
    const P   = getNum(item.querySelector('.l-p').value);
    const R   = Number(item.querySelector('.l-r').value) || getDefaultRate(cat);
    const n   = getNum(item.querySelector('.l-m').value) || 360;
    if (P > 0) allLoans.push({ cat, P, R, n });
  });

  if (allLoans.length > 0) {
    const card = document.createElement('div');
    card.className = 'sch-summary-card';
    const rows = allLoans.map(l =>
      `<div class="sch-summary-row">
        <div class="sch-summary-top">
          <span class="sch-summary-emoji">${_EMOJI[l.cat] || '📌'}</span>
          <span class="sch-summary-label">${_LABEL[l.cat] || l.cat}</span>
        </div>
        <div class="sch-summary-bottom">
          <span class="sch-summary-amount">${Math.round(l.P).toLocaleString()}원</span>
          <span class="sch-summary-divider">|</span>
          <span class="sch-summary-rate">${l.R.toFixed(2)}%</span>
          <span class="sch-summary-divider">|</span>
          <span class="sch-summary-term">${l.n}개월</span>
        </div>
      </div>`
    ).join('');
    card.innerHTML = `<div class="sch-summary-title">📋 대출 항목 현황</div>${rows}`;
    listEl.appendChild(card);
  }

  const purchaseLoans = allLoans.filter(l => isPurchaseLoan(l.cat, l.n));
  let schedLoans;
  if (purchaseLoans.length >= 2) {
    const totalP    = purchaseLoans.reduce((s, l) => s + l.P, 0);
    const weightedR = purchaseLoans.reduce((s, l) => s + l.R * l.P, 0) / totalP;
    const maxN      = Math.max(...purchaseLoans.map(l => l.n));
    schedLoans = [{ P: totalP, R: weightedR, n: maxN, label: '통합 구입자금', merged: true, parts: purchaseLoans }];
  } else if (purchaseLoans.length === 1) {
    schedLoans = [{ ...purchaseLoans[0], label: _LABEL[purchaseLoans[0].cat], merged: false }];
  } else {
    const first = allLoans[0]; if (!first) return;
    schedLoans = [{ ...first, label: _LABEL[first.cat] || first.cat, merged: false }];
  }
  schedLoans.forEach(loan => renderLoanSchedule(listEl, loan));
}

function renderLoanSchedule(listEl, loan) {
  const { P, R, n, label, merged, parts } = loan;
  const r = R / 1200;
  if (!P || !n) return;

  const schedHeader = document.createElement('div');
  schedHeader.className = 'sch-calc-header';
  schedHeader.innerHTML = merged
    ? `<span class="sch-calc-title">🏠 통합 구입자금 상환 스케줄</span>
       <span class="sch-calc-meta">합산 ${Math.round(P).toLocaleString()}원 | 가중평균 ${R.toFixed(2)}% | ${n}개월</span>`
    : `<span class="sch-calc-title">${_EMOJI[loan.cat] || '🏠'} ${label} 상환 스케줄</span>
       <span class="sch-calc-meta">${Math.round(P).toLocaleString()}원 | ${R.toFixed(2)}% | ${n}개월</span>`;
  listEl.appendChild(schedHeader);

  // 서브론 마일스톤 맵
  const milestoneMap = {};
  if (merged && parts) {
    parts.forEach(part => {
      if (part.n < n) {
        (milestoneMap[part.n] = milestoneMap[part.n] || []).push(part);
      }
    });
  }

  const isLevel  = currentScheduleType === 'L';
  const mP_prin  = P / n;
  const mPMT_lvl = calcPMT(P, r, n);
  let balance = P, yearCumP = 0, yearCumI = 0, totalCumP = 0, totalInterest = 0;

  for (let i = 1; i <= n; i++) {
    let curP, curI;
    if (isLevel) { curI = balance * r; curP = mPMT_lvl - curI; }
    else         { curI = balance * r; curP = mP_prin; }
    if (i === n) { curP = balance; curI = balance * r; }

    balance -= curP; yearCumP += curP; yearCumI += curI;
    totalCumP += curP; totalInterest += curI;

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

    if (milestoneMap[i]) {
      milestoneMap[i].forEach(part => {
        const mc      = document.createElement('div');
        mc.className  = 'year-summary-card loan-milestone-card';
        const pRatio  = part.P / P;
        const eCumP   = Math.round(totalCumP * pRatio);
        const eCumI   = Math.round(totalInterest * pRatio);
        mc.innerHTML =
          `<div class="card-title-row">
            <span class="card-title">${_EMOJI[part.cat] || '📌'} ${_LABEL[part.cat]} 잔금 상환 완료</span>
            <span class="milestone-badge">종료</span>
          </div>
          <div class="milestone-body">
            <div class="milestone-row"><span class="milestone-key">대출 원금</span><span class="milestone-val">${Math.round(part.P).toLocaleString()}원</span></div>
            <div class="milestone-row"><span class="milestone-key">상환 기간</span><span class="milestone-val">${part.n}개월 (${Math.round(part.n/12)}년)</span></div>
            <div class="milestone-row"><span class="milestone-key">누적 상환원금 (추정)</span><span class="milestone-val stat-prin">${eCumP.toLocaleString()}원</span></div>
            <div class="milestone-row"><span class="milestone-key">누적 이자 (추정)</span><span class="milestone-val stat-int">${eCumI.toLocaleString()}원</span></div>
            <div class="milestone-row milestone-row--total"><span class="milestone-key">원금+이자 합계</span><span class="milestone-val">${(eCumP + eCumI).toLocaleString()}원</span></div>
          </div>
          <div class="card-balance-row">
            <span class="balance-label">전체 잔액 (통합 기준)</span>
            <span class="balance-value">${Math.max(0, Math.round(balance)).toLocaleString()}원</span>
          </div>`;
        listEl.appendChild(mc);
      });
    }
  }

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
  if (localStorage.getItem('hideNotice_' + _C.NOTICE_VERSION) !== 'true')
    document.getElementById('noticePopup').style.display = 'flex';
}
function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() {
  localStorage.setItem('hideNotice_' + _C.NOTICE_VERSION, 'true');
  closeNotice();
}

// ─── [7] 모달 & 공통 유틸 ────────────────────────────────────────────────────
function handleModalConfirm() {
  const modal = document.getElementById('customModal');
  if (modal) modal.style.display = 'none';
  if (_inQueueMode) { _dequeueModal(); return; }
  if (proceedOnConfirm) { proceedOnConfirm = false; calculateLogic(); }
  else if (lastFocusId) {
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
function getNum(val)  { return Number(String(val).replace(/,/g, "")) || 0; }
function removeLoan(id) { document.getElementById(`loan_${id}`)?.remove(); }

// ─── [8] 임시 리포트 링크 시스템 ─────────────────────────────────────────────
/*
 * ── 운영 설정 (APP_CONFIG 에서 변경) ──────────────────────────────────────────
 *   REPORT_COPY_DAILY_LIMIT  : 하루 최대 복사 횟수 (기본 5)
 *   REPORT_LINK_EXPIRY_DAYS  : 링크 유효 기간 일수 (기본 7)
 *   SHORTENER_API            : URL 단축 API 주소
 * ── 동작 방식 ─────────────────────────────────────────────────────────────────
 *   1. 리포트 데이터 (입력값 전체) → JSON → base64url → URL hash
 *   2. is.gd API 로 단축 → 클립보드 복사
 *   3. localStorage 날짜별 카운트 관리
 */

const _COPY_KEY = 'dsr_copy_count';

function _getTodayKey()  { return new Date().toISOString().slice(0, 10); }
function _getCopyCount() {
  try {
    return JSON.parse(localStorage.getItem(_COPY_KEY) || '{}')[_getTodayKey()] || 0;
  } catch { return 0; }
}
function _incCopyCount() {
  try {
    const today = _getTodayKey();
    const raw   = JSON.parse(localStorage.getItem(_COPY_KEY) || '{}');
    raw[today]  = (raw[today] || 0) + 1;
    Object.keys(raw).forEach(k => {
      if (k < new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)) delete raw[k];
    });
    localStorage.setItem(_COPY_KEY, JSON.stringify(raw));
    return raw[today];
  } catch { return 1; }
}

function initCopyBtn() {
  const btn   = document.getElementById('btnCopyReport');
  const count = _getCopyCount();
  const limit = _C.REPORT_COPY_DAILY_LIMIT;
  if (!btn) return;
  if (count >= limit) {
    btn.disabled = true;
    btn.innerHTML = `📋 DSR 진단 리포트 복사 <span class="copy-count-badge">${count}/${limit} 사용 완료</span>`;
    btn.classList.add('btn-copy--exhausted');
  } else if (count > 0) {
    btn.innerHTML = `📋 DSR 진단 리포트 복사 <span class="copy-count-badge">${count}/${limit} 사용중</span>`;
  }
}

/** 리포트 데이터 빌드 (입력값 전체 포함 — 단, 스케줄은 리포트 페이지에서 재계산) */
function _buildReportData() {
  const items = document.querySelectorAll('[id^="loan_"]');
  const loans = [];
  items.forEach(item => {
    const cat = item.querySelector('.l-category').value;
    const P   = getNum(item.querySelector('.l-p').value);
    const R   = Number(item.querySelector('.l-r').value) || getDefaultRate(cat);
    const SR  = Number(item.querySelector('.l-sr-select')?.value || 0);
    const n   = getNum(item.querySelector('.l-m').value) || 360;
    const rt  = item.querySelector('.l-rate-type')?.value || '직접입력';
    if (P > 0) loans.push({ cat, P, R, SR, n, rt });
  });

  const income    = getNum(document.getElementById('income').value);
  const dsrText   = document.getElementById('dsrVal')?.innerText || '-';
  const remainTxt = document.getElementById('remainingLimit')?.innerText || '-';
  const maxPTxt   = document.getElementById('absMaxPrin')?.innerText || '-';
  const maxLTxt   = document.getElementById('absMaxLevel')?.innerText || '-';
  const recHtml   = document.getElementById('recDesc')?.innerHTML || '';
  const expiry    = Date.now() + _C.REPORT_LINK_EXPIRY_DAYS * 86400000;
  const createdAt = new Date().toISOString();

  return { v: _C.APP_VERSION, income, loans, dsrText, remainTxt, maxPTxt, maxLTxt, recHtml, expiry, createdAt };
}

/** is.gd로 URL 단축 */
async function _shortenUrl(longUrl) {
  try {
    const apiUrl = _C.SHORTENER_API + encodeURIComponent(longUrl);
    const resp   = await fetch(apiUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const short  = (await resp.text()).trim();
    if (short.startsWith('http')) return short;
    throw new Error('Invalid response: ' + short);
  } catch (e) {
    console.warn('[URL단축] 실패, 원본 사용:', e.message);
    return longUrl;
  }
}

async function copyResultText() {
  const limit = _C.REPORT_COPY_DAILY_LIMIT;
  const count = _getCopyCount();

  if (count >= limit) {
    showAlert(
      `금일 임시 링크 복사를 모두 사용하셨습니다.<br>` +
      `<span style="font-size:12px;">(${count}/${limit}회 사용 완료 — 내일 초기화됩니다)</span>`,
      null, "🚫"
    );
    return;
  }

  if (document.getElementById('resultArea')?.style.display === 'none') {
    showAlert("먼저 DSR 분석을 실행해주세요.", null, "ℹ️"); return;
  }

  const btn       = document.getElementById('btnCopyReport');
  const origHtml  = btn?.innerHTML;
  if (btn) { btn.innerHTML = '🔗 링크 생성 중...'; btn.disabled = true; }

  const data    = _buildReportData();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const base    = window.location.href.replace(/[^/]*(\?.*)?$/, '');
  const longUrl = `${base}${_C.REPORT_PAGE_PATH}#${encoded}`;
  const shortUrl = await _shortenUrl(longUrl);

  if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }

  const newCount  = _incCopyCount();
  const remaining = limit - newCount;
  const expDate   = new Date(data.expiry).toLocaleDateString('ko-KR', { month:'long', day:'numeric' });

  // 배지 업데이트
  if (btn) {
    if (remaining <= 0) {
      btn.disabled = true;
      btn.innerHTML = `📋 DSR 진단 리포트 복사 <span class="copy-count-badge">${newCount}/${limit} 사용 완료</span>`;
      btn.classList.add('btn-copy--exhausted');
    } else {
      btn.innerHTML = `📋 DSR 진단 리포트 복사 <span class="copy-count-badge">${newCount}/${limit} 사용중</span>`;
    }
  }

  const msg = `🔗 임시 링크가 복사되었습니다!<br>` +
    `<span style="font-size:12px;line-height:1.8;display:block;margin-top:8px;">` +
    `• 링크는 <b>${expDate}</b>까지 유효합니다<br>` +
    `• ${remaining > 0 ? `오늘 남은 복사 횟수: <b>${remaining}회</b>` : '오늘 복사 횟수를 모두 사용하셨습니다'}<br>` +
    `• 링크 만료 전 미리 확인하세요</span>`;

  const copyFn = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shortUrl).then(() => showAlert(msg, null, "✅")).catch(() => _fallbackCopy(shortUrl, msg));
    } else { _fallbackCopy(shortUrl, msg); }
  };
  copyFn();
}

function _fallbackCopy(text, msg) {
  const t = document.createElement("textarea");
  t.style.cssText = "position:fixed;top:-9999px;opacity:0;";
  document.body.appendChild(t);
  t.value = text; t.focus(); t.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(t);
  showAlert(msg, null, "✅");
}
