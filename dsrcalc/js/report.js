/* =============================================================================
   js/report.js — 리포트 링크 빌드 + HMAC OTL 유틸 + 공유 로직
   · _buildReportData : 리포트 데이터 객체 조립
   · _otlSign / _otlIssue : HMAC-SHA256 서명 유틸 (share.html 1회성 링크용)
   · _generateReportShareToken : 리포트 최초수신자 검증 토큰 발급
   · copyResultText  : 전화번호 모달 → 리포트 URL 생성 → 공유
   · initCopyBtn     : 발급 카운터 뱃지 초기화
   ─────────────────────────────────────────────────────────────────────────────
   ★ _OTL_SIGN_KEY 는 share.js / report.html 의 값과 반드시 동일해야 합니다
   · 변경 시: js/report.js + js/share.js(복사본) + report.html 세 곳 동시 수정
   ============================================================================= */

// ─── HMAC 서명 키 ─────────────────────────────────────────────────────────────
// ★ share.js 의 _OTL_SIGN_KEY 와 동기화 — 두 파일 항상 같이 변경하세요
const _OTL_SIGN_KEY = 'KB_DSR_OTL_SIGN_2026';

// ─── HMAC-SHA256 서명 유틸 ───────────────────────────────────────────────────
async function _otlSign(payload) {
  const keyBuf    = new TextEncoder().encode(_OTL_SIGN_KEY);
  const dataBuf   = new TextEncoder().encode(JSON.stringify(payload));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf    = await crypto.subtle.sign('HMAC', cryptoKey, dataBuf);
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _otlIssue(targetUrl, ttlMs) {
  const payload = { url: targetUrl, exp: Date.now() + ttlMs, nonce: crypto.randomUUID().slice(0, 12) };
  const sig     = await _otlSign(payload);
  return btoa(unescape(encodeURIComponent(JSON.stringify({ ...payload, sig }))));
}

// ─── 리포트 최초수신자 검증 토큰 발급 ────────────────────────────────────────
async function _generateReportShareToken(reportNonce, exp) {
  const payload = { nonce: reportNonce, exp };
  const sig     = await _otlSign(payload);
  return btoa(unescape(encodeURIComponent(JSON.stringify({ ...payload, sig }))));
}

// ─── 일일 발급 카운터 ─────────────────────────────────────────────────────────
const _COPY_KEY = 'dsr_copy_count';
function _getTodayKey()  { return new Date().toISOString().slice(0, 100); }
function _getCopyCount() {
  try { return JSON.parse(localStorage.getItem(_COPY_KEY) || '{}')[_getTodayKey()] || 0; }
  catch { return 0; }
}
function _incCopyCount() {
  try {
    const today = _getTodayKey(), raw = JSON.parse(localStorage.getItem(_COPY_KEY) || '{}');
    raw[today] = (raw[today] || 0) + 1;
    Object.keys(raw).forEach(k => {
      if (k < new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)) delete raw[k];
    });
    localStorage.setItem(_COPY_KEY, JSON.stringify(raw)); return raw[today];
  } catch { return 1; }
}

function initCopyBtn() {
  const btn = document.getElementById('btnCopyReport');
  const count = _getCopyCount(), limit = _C.REPORT_COPY_DAILY_LIMIT;
  if (!btn) return;
  if (count >= limit) {
    btn.disabled = true;
    btn.innerHTML = `📋 DSR 진단 리포트 복사 <span class="copy-count-badge">${count}/${limit} 사용 완료</span>`;
    btn.classList.add('btn-copy--exhausted');
  } else if (count > 0) {
    btn.innerHTML = `📋 DSR 진단 리포트 복사 <span class="copy-count-badge">${count}/${limit} 사용중</span>`;
  }
}

// ─── 리포트 데이터 빌드 ───────────────────────────────────────────────────────
function _buildReportData(phone = null) {
  const items  = document.querySelectorAll('[id^="loan_"]');
  const loans  = [];
  const income = getNum(document.getElementById('income').value);
  let totalAnnPayment = 0, totalPrin = 0;

  items.forEach(item => {
    const cat    = item.querySelector('.l-category').value;
    const P      = getNum(item.querySelector('.l-p').value);
    const R      = Number(item.querySelector('.l-r').value) || getDefaultRate(cat);
    const SR_key = item.querySelector('.l-sr-select')?.value || '0';
    const SR     = getStressRate(SR_key);
    const n      = getNum(item.querySelector('.l-m').value) || 360;
    const rt     = item.querySelector('.l-rate-type')?.value || '직접입력';
    if (P <= 0) return;

    const r_dsr = (R + SR) / 1200;
    let loanAnnPmt = 0;
    if (cat === 'jeonse') {
      loanAnnPmt = P * (R / 1200) * 12;
    } else if (isPurchaseLoan(cat, n)) {
      loanAnnPmt = cat === 'mortgage_prin'
        ? (P / n) * 12 + (P * r_dsr * (n + 1) / 2) / (n / 12)
        : calcPMT(P, r_dsr, n) * 12;
    } else {
      loanAnnPmt = calcPMT(P, r_dsr, _C.DSR_VIRTUAL_MONTHS[cat] ?? n) * 12;
    }
    totalAnnPayment += loanAnnPmt;
    totalPrin       += P;
    loans.push({ cat, P, R, SR: SR_key, n, rt, annPmt: Math.round(loanAnnPmt), dsrCont: income > 0 ? (loanAnnPmt / income) * 100 : 0 });
  });

  const dsr           = income > 0 ? (totalAnnPayment / income) * 100 : 0;
  const isOver        = dsr > _C.DSR_LIMIT_PCT;
  const targetDSR     = 35;
  // ★ 핵심: reqIncome = totalAnnPayment / 0.35 (income 으로 나누는 게 아님)
  const reqIncome     = totalAnnPayment > 0 ? totalAnnPayment / (targetDSR / 100) : 0;
  const excessPmt     = Math.max(0, totalAnnPayment - income * (targetDSR / 100));
  const avgPmtRatio   = totalPrin > 0 ? totalAnnPayment / totalPrin : 0;
  const estReducePrin = avgPmtRatio > 0 ? excessPmt / avgPmtRatio : 0;

  // 상담사 연락처: 파라미터 우선, 없으면 admin config fallback
  const consultant = (() => {
    const p = phone || (() => {
      try { return JSON.parse(localStorage.getItem('kb_admin_config') || '{}').phone || ''; } catch { return ''; }
    })();
    return p ? { phone: p } : null;
  })();

  return {
    v: _C.APP_VERSION, income, loans,
    dsrText:   document.getElementById('dsrVal')?.innerText         || '-',
    remainTxt: document.getElementById('remainingLimit')?.innerText || '-',
    maxPTxt:   document.getElementById('absMaxPrin')?.innerText     || '-',
    maxLTxt:   document.getElementById('absMaxLevel')?.innerText    || '-',
    dsr: Math.round(dsr * 100) / 100, isOver,
    totalAnnPayment: Math.round(totalAnnPayment),
    reqIncome:       Math.ceil(reqIncome / 10000) * 10000,
    excessPmt:       Math.round(excessPmt),
    estReducePrin:   Math.ceil(estReducePrin / 10000) * 10000,
    targetDSR, consultant,
    reportNonce: crypto.randomUUID().slice(0, 12),
    expiry:      Date.now() + _C.REPORT_LINK_EXPIRY_DAYS * 86400000,
    createdAt:   new Date().toISOString()
  };
}

// ─── URL 단축 ─────────────────────────────────────────────────────────────────
async function _shortenUrl(longUrl) {
  try {
    const r = await fetch(_C.SHORTENER_API + encodeURIComponent(longUrl));
    if (!r.ok) throw new Error();
    const s = (await r.text()).trim();
    if (s.startsWith('http')) return s;
    throw new Error();
  } catch { return longUrl; }
}

// ─── 클립보드 복사 ────────────────────────────────────────────────────────────
function _forceCopy(text, successMsg) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (successMsg) showAlert(successMsg, null, '✅');
    }).catch(() => _fcFallback(text, successMsg));
  } else {
    _fcFallback(text, successMsg);
  }
}
function _fcFallback(text, successMsg) {
  const t = document.createElement('textarea');
  t.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
  document.body.appendChild(t); t.value = text; t.focus(); t.select();
  try {
    document.execCommand('copy');
    if (successMsg) showAlert(successMsg, null, '✅');
  } catch {
    if (successMsg) showAlert('복사에 실패했습니다. 모바일 공유하기 버튼을 이용해주세요.', null, '⚠️');
  }
  document.body.removeChild(t);
}

// ─── 리포트 공유 메인 함수 ───────────────────────────────────────────────────
/**
 * 전화번호 모달 → 리포트 데이터 빌드 → HMAC 접근 토큰 생성 → URL 단축 → 공유
 * · phone === false  : X 클릭 → 공유 취소
 * · phone === null   : 닫기(일반 공유) → 워터마크 없이 공유
 * · phone === string : 전화번호 입력 → 워터마크 포함 공유
 */
async function copyResultText() {
  const limit = _C.REPORT_COPY_DAILY_LIMIT, count = _getCopyCount();
  if (count >= limit) {
    showAlert(`금일 리포트 발급을 모두 사용하셨습니다.<br><span style="font-size:12px;">(${count}/${limit}회 완료 — 내일 초기화됩니다)</span>`, null, '🚫');
    return;
  }
  if (document.getElementById('resultArea')?.style.display === 'none') {
    showAlert('먼저 DSR 분석을 실행해주세요.', null, 'ℹ️'); return;
  }

  const phone = await _showPhoneModal();
  if (phone === false) return; // X 클릭 → 완전 취소

  const btn = document.getElementById('btnCopyReport'), origHtml = btn?.innerHTML;
  if (btn) { btn.innerHTML = '🔗 리포트 생성 중...'; btn.disabled = true; }

  try {
    const data    = _buildReportData(phone);
    const stToken = await _generateReportShareToken(data.reportNonce, data.expiry);
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const base    = window.location.href.replace(/[^/]*(\?.*)?$/, '');
    const longUrl = `${base}${_C.REPORT_PAGE_PATH}?st=${stToken}#${encoded}`;
    const shortUrl= await _shortenUrl(longUrl);

    const newCount  = _incCopyCount(), remaining = limit - newCount;
    const expDate   = new Date(data.expiry).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

    if (btn) {
      if (remaining <= 0) { btn.disabled = true; btn.innerHTML = `📋 진단 리포트 공유 <span class="copy-count-badge">${newCount}/${limit} 완료</span>`; btn.classList.add('btn-copy--exhausted'); }
      else btn.innerHTML = `📋 진단 리포트 공유 <span class="copy-count-badge">${newCount}/${limit}회 남음</span>`;
    }

    const msg = `📊 <b>진단 리포트 링크가 복사되었습니다!</b><br><span style="font-size:12px;line-height:1.8;display:block;margin-top:8px;">• 고객의 정보 보호를 위해 <b>${expDate}</b>까지만 유효합니다.<br>• 오늘 남은 발급 횟수: <b>${remaining}회</b></span>`;

    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      navigator.share({ title: 'DSR 진단 리포트', text: '고객님의 DSR 진단 리포트가 준비되었습니다. 아래 링크를 확인해주세요.', url: shortUrl })
        .catch(err => { if (err.name !== 'AbortError') _forceCopy(shortUrl, msg); });
    } else {
      _forceCopy(shortUrl, msg);
    }
  } catch {
    showAlert('링크 생성 중 오류가 발생했습니다.', null, '⚠️');
  } finally {
    if (btn && !btn.disabled) { btn.innerHTML = origHtml; btn.disabled = false; }
  }
}
