/* =============================================================================
   js/report-page.js — report.html 전용 렌더러
   · HMAC 서명 검증 (재공유 차단)
   · countUp 애니메이션 + 실시간 카운트다운
   · 리포트 섹션 순서대로 조합 → DOM 렌더링
   · 의존: css/report.css (스타일)
   ============================================================================= */

/* ════════════════════════════════════════════════════════════════════════════
   report.html — DSR 진단 리포트 렌더러 v4
   · 최초 수신자 검증 (st 토큰 1회 소비 → localStorage 낙인)
   · 재공유 차단 (낙인 없는 기기에서 st 없이 접속 → 차단)
   · 상담사 연락처 워터마크 배너
   · X일 Y시간 실시간 카운트다운
   · body.white / body.dark 완전 분리 테마
════════════════════════════════════════════════════════════════════════════ */

// ── 상수 ──────────────────────────────────────────────────────────────────
// ★ common.js 의 _OTL_SIGN_KEY 와 반드시 동일해야 합니다
const _RPT_SIGN_KEY   = 'KB_DSR_OTL_SIGN_2026';
const _RPT_NONCE_PFX  = 'rpt_viewed_';   // localStorage 낙인 키 접두사

// ── 유틸 ──────────────────────────────────────────────────────────────────
const won = v => Math.round(v).toLocaleString() + '원';
const pct = v => v.toFixed(2) + '%';
const CAT_LABELS = {
  mortgage_level:'주택담보 (원리금)', mortgage_prin:'주택담보 (원금)',
  jeonse:'전세대출 (만기)', officetel:'오피스텔 (원리금)',
  credit:'신용대출 (원리금)', cardloan:'카드론 (원리금)',
};
const CAT_EMOJI = {
  mortgage_level:'🏠', mortgage_prin:'🏠', jeonse:'🔑',
  officetel:'🏢', credit:'💳', cardloan:'💰',
};
function dsrColor(v) {
  if (v > 40) return 'var(--rp-danger)'; if (v > 36) return 'var(--rp-warn)';
  if (v > 25) return 'var(--rp-yellow-deep)'; return 'var(--rp-safe)';
}
function rankClass(i) { return ['rank-1','rank-2','rank-3'][i] ?? 'rank-n'; }

// ── HMAC-SHA256 서명 검증 (share.js 와 동일 로직) ─────────────────────────
async function _rptVerifySign(payload, sigToCheck) {
  const keyBuf  = new TextEncoder().encode(_RPT_SIGN_KEY);
  const dataBuf = new TextEncoder().encode(JSON.stringify(payload));
  const ck = await crypto.subtle.importKey('raw', keyBuf, { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
  const b64 = sigToCheck.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return crypto.subtle.verify('HMAC', ck, buf, dataBuf);
}

// ── countUp 애니메이션 ────────────────────────────────────────────────────
function countUp(el, target, suffix, dur = 800) {
  const start = performance.now();
  const isInt = Number.isInteger(target);
  const step  = ts => {
    const p = Math.min((ts - start) / dur, 1);
    const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = (isInt ? Math.round(target * e).toLocaleString()
                             : (target * e).toFixed(2)) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── 실시간 카운트다운 (매분 갱신) ──────────────────────────────────────────
function startCountdown(expiry, expiryFmt) {
  const update = () => {
    const diff = Math.max(0, expiry - Date.now());
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const dEl = document.getElementById('cdDays');
    const hEl = document.getElementById('cdHours');
    if (dEl) dEl.textContent = days;
    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
    if (diff <= 0) clearInterval(window._cdTimer);
  };
  update();
  window._cdTimer = setInterval(update, 60_000);
}

// ── 에러 렌더러 ──────────────────────────────────────────────────────────
function renderError(icon, title, desc) {
  document.getElementById('rpWrap').innerHTML = `
    <div class="rp-error">
      <div class="rp-error-icon">${icon}</div>
      <p class="rp-error-title">${title}</p>
      <p class="rp-error-desc">${desc}</p>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════════════════
   최초 수신자 접근 게이트 (재공유 차단)
   ─────────────────────────────────────────────────────────────────────────
   흐름:
   1. 발급된 URL: report.html?st=<signedToken>#<data>
      st 토큰 = { nonce, exp, sig } 서명 페이로드
   2. 최초 접속 (st 있음):
      · 서명 검증 → nonce 미사용 확인 → localStorage 낙인
      · replaceState 로 ?st= 제거 (URL 공유해도 st 없음)
   3. 재접속 (st 없음, 동일 기기):
      · localStorage 에 reportNonce 낙인 확인 → 통과
   4. 재공유된 링크 (st 없음, 다른 기기):
      · 낙인 없음 → 차단 메시지
   5. 구형 리포트 (reportNonce 없음): 하위 호환 — 그냥 통과
════════════════════════════════════════════════════════════════════════════ */
async function checkAccess(d) {
  const reportNonce = d.reportNonce;
  // 구형 리포트 (reportNonce 없음) → 하위 호환, 제한 없이 통과
  if (!reportNonce) return { ok: true };

  const params = new URLSearchParams(location.search);
  const st     = params.get('st');
  const usedKey = _RPT_NONCE_PFX + reportNonce;

  // ── Case A: 최초 접속 (st 있음) ─────────────────────────────────────
  if (st) {
    let token;
    try { token = JSON.parse(decodeURIComponent(escape(atob(st)))); }
    catch { return { ok: false, reason: 'invalid' }; }

    const { nonce, exp, sig } = token;
    if (!nonce || !exp || !sig) return { ok: false, reason: 'invalid' };

    // 만료 체크
    if (Date.now() > exp) return { ok: false, reason: 'expired' };

    // 서명 검증
    let sigOk = false;
    try { sigOk = await _rptVerifySign({ nonce, exp }, sig); } catch {}
    if (!sigOk) return { ok: false, reason: 'invalid' };

    // nonce 가 이미 소비됐으면 (=다른 기기에서 st 링크를 먼저 열었음) → 차단
    if (localStorage.getItem(usedKey)) return { ok: false, reason: 'reshared' };

    // ✅ 검증 통과 → 낙인 기록 (7일 보관)
    localStorage.setItem(usedKey, JSON.stringify({ grantedAt: Date.now(), exp: d.expiry }));

    // URL에서 ?st= 제거 (주소창 세탁 — 이 시점부터 URL 공유해도 st 없음)
    const cleanUrl = location.pathname + location.hash;
    history.replaceState(null, '', cleanUrl);

    return { ok: true };
  }

  // ── Case B: 재방문 (st 없음, 동일 기기) ─────────────────────────────
  if (localStorage.getItem(usedKey)) return { ok: true };

  // ── Case C: 재공유된 링크 (st 없음, 낙인 없음) ──────────────────────
  return { ok: false, reason: 'reshared' };
}

/* ════════════════════════════════════════════════════════════════════════════
   메인 렌더러
════════════════════════════════════════════════════════════════════════════ */
function renderReport(d) {
  const wrap = document.getElementById('rpWrap');

  // 만료 체크
  if (Date.now() > d.expiry) {
    renderError('⏰', '리포트 유효기간 만료',
      '이 리포트는 발급일로부터 7일간 유효합니다.<br>담당자에게 새로운 리포트를 요청해 주세요.');
    return;
  }

  const createdFmt = new Date(d.createdAt).toLocaleString('ko-KR', {
    year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'
  });
  const expiryFmt = new Date(d.expiry).toLocaleDateString('ko-KR', { month:'long', day:'numeric' });

  const sortedLoans = d.loans
    ? [...d.loans].sort((a, b) => (b.dsrCont ?? 0) - (a.dsrCont ?? 0))
    : [];
  const totalDSR = d.dsr ?? parseFloat(d.dsrText) ?? 0;
  const isOver   = d.isOver ?? (totalDSR > 40);
  const color    = dsrColor(totalDSR);
  const barPct   = Math.min(totalDSR, 100).toFixed(1);

  // ━━━ [1] 헤더 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const headerHtml = `
    <div class="rp-header">
      <div class="rp-header-glow"></div>
      <div class="rp-logo">KB DSR 진단 리포트</div>
      <div class="rp-title">📊 DSR 종합 진단 결과</div>
      <div class="rp-meta">발급일: ${createdFmt}</div>
      <div class="rp-countdown-wrap">
        <div class="rp-countdown-segments">
          <div class="cd-block"><div class="cd-num" id="cdDays">--</div><div class="cd-unit">DAYS</div></div>
          <div class="cd-sep">:</div>
          <div class="cd-block"><div class="cd-num" id="cdHours">--</div><div class="cd-unit">HOURS</div></div>
        </div>
        <div class="rp-countdown-right">
          <span class="cd-tag">EXPIRY</span>
          <span class="cd-date">${expiryFmt}까지 유효</span>
        </div>
      </div>
    </div>`;

  // ━━━ [1-1] 상담사 워터마크 배너 (phone 있을 때만) ━━━━━━━━━━━━━━━━━━━━
  let consultantHtml = '';
  if (d.consultant?.phone) {
    const ph = d.consultant.phone;
    consultantHtml = `
      <div class="consultant-banner">
        <div class="consultant-inner">
          <div class="consultant-avatar">👤</div>
          <div class="consultant-body">
            <div class="consultant-tag">CONSULTANT CONTACT</div>
            <div class="consultant-phone">${ph}</div>
            <div class="consultant-msg">담당 상담사에게 DSR 관련 궁금한 내용이 있으시면<br>상담 받아보시길 권장합니다.</div>
          </div>
        </div>
      </div>`;
  }

  // ━━━ [2] DSR 종합 카드 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const dsrCardHtml = `
    <div class="rp-card">
      <div class="rp-card-title">종합 DSR 지수 (스트레스 금리 반영)</div>
      <div class="dsr-big" id="dsrBig" style="color:${color};">0.00%</div>
      <div class="dsr-label">연소득 대비 연간 원리금 상환 비율</div>
      <div class="dsr-bar-track"><div class="dsr-bar-fill" id="dsrBar" style="background:${color};"></div></div>
      <div class="dsr-legend">
        <span>0%</span>
        <span style="color:${color}; font-weight:700;">현재 ${pct(totalDSR)}</span>
        <span>규제선 40%</span>
      </div>
    </div>`;

  // ━━━ [3] 요약 그리드 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const summaryHtml = `
    <div class="rp-card">
      <div class="rp-card-title">한도 분석 요약</div>
      <div class="summary-grid">
        <div class="summary-item"><div class="summary-item-label">연간 세전 소득</div><div class="summary-item-value">${won(d.income)}</div></div>
        <div class="summary-item"><div class="summary-item-label">연간 총 원리금</div><div class="summary-item-value">${won(d.totalAnnPayment ?? 0)}</div></div>
        <div class="summary-item">
          <div class="summary-item-label">원금균등 최대 한도</div>
          <div class="summary-item-value" style="color:${isOver?'var(--rp-danger)':'var(--rp-safe)'};">${d.maxPTxt || '-'}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">원리금균등 최대 한도</div>
          <div class="summary-item-value" style="color:${isOver?'var(--rp-danger)':''};">${isOver ? '한도 초과' : (d.maxLTxt || '-')}</div>
        </div>
        <div class="summary-item full">
          <div class="summary-item-label">현재 추가 가능 대출액</div>
          <div class="summary-item-value" style="color:${isOver?'var(--rp-danger)':'var(--rp-safe)'};">
            ${isOver ? '신규 대출 불가 (규제선 초과)' : (d.remainTxt || '-')}
          </div>
        </div>
      </div>
    </div>`;

  // ━━━ [4] 개별 부채 DSR 기여도 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let contribHtml = '';
  if (sortedLoans.length > 0) {
    const maxCont = Math.max(...sortedLoans.map(l => l.dsrCont ?? 0), 1);
    const rows = sortedLoans.map((l, i) => {
      const cont = l.dsrCont ?? 0;
      const barW = ((cont / Math.max(maxCont, totalDSR)) * 100).toFixed(1);
      const fill = i === 0 ? 'var(--rp-danger)' : i === 1 ? 'var(--rp-warn)' : 'var(--rp-yellow)';
      return `
        <div class="loan-item">
          <div class="loan-item-header">
            <div class="loan-item-name">
              <span class="rank-badge ${rankClass(i)}">${i+1}</span>
              <span>${CAT_EMOJI[l.cat]||'📌'} ${CAT_LABELS[l.cat]||l.cat}</span>
            </div>
            <div class="loan-item-pct" style="color:${fill};">${pct(cont)}</div>
          </div>
          <div class="loan-bar-track"><div class="loan-bar-fill" data-width="${barW}" style="background:${fill};"></div></div>
          <div class="loan-item-meta">
            <div class="loan-meta-row">
              <span class="loan-meta-chip">원금 ${won(l.P)}</span>
              <span class="loan-meta-chip">금리 ${l.R ? l.R.toFixed(2)+'%' : '-'}</span>
              <span class="loan-meta-chip">연 상환 ${won(l.annPmt ?? 0)}</span>
            </div>
            <div class="loan-meta-row">
              <span class="loan-meta-drop" style="color:${fill};">▼ 정리 시 DSR ${cont.toFixed(2)}%p 감소</span>
            </div>
          </div>
        </div>`;
    }).join('');
    contribHtml = `<div class="rp-card"><div class="rp-card-title">📊 개별 부채별 DSR 기여도 (기여도 높은 순)</div>${rows}</div>`;
  }

  // ━━━ [5] 역행 산출 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let reverseHtml = '';
  if (isOver && d.reqIncome) {
    const top1 = sortedLoans[0];
    const t1l  = top1 ? `${CAT_EMOJI[top1.cat]||'📌'} ${CAT_LABELS[top1.cat]||top1.cat}` : '-';
    const t1p  = top1 ? top1.dsrCont.toFixed(2) : '-';
    reverseHtml = `
      <div class="rp-card reverse-card">
        <div class="rp-card-title">⚠️ 역행 산출 — 규제선 통과 조건 (DSR ${d.targetDSR ?? 35}% 목표)</div>
        <div class="scenario-tabs">
          <div class="scenario-tab tab-income">💰 소득 증빙 시나리오</div>
          <div class="scenario-tab tab-repay">📉 부채 상환 시나리오</div>
        </div>
        <div class="rs-grid">
          <div class="rs-item hl"><div class="rs-label">필요 연소득<br>(증빙 목표)</div><div class="rs-value c-income">${won(d.reqIncome)}</div></div>
          <div class="rs-item"><div class="rs-label">줄여야 할<br>연간 상환액</div><div class="rs-value c-danger">${won(d.excessPmt ?? 0)}</div></div>
          <div class="rs-item full"><div class="rs-label">추정 상환 목표 원금 (평균 상환비율 기준)</div><div class="rs-value c-danger" style="font-size:20px;">${won(d.estReducePrin ?? 0)}</div></div>
        </div>
        <div class="rs-tip">
          💡 <b>우선 정리 추천:</b><br>
          DSR 기여도 1순위인 <b>${t1l}</b>(기여도 <b>${t1p}%p</b>)를 먼저 상환하면 DSR 감소 효율이 가장 높습니다.<br><br>
          <span style="opacity:.7;">※ 역행 산출값은 현재 부채 구조 기준 추정치이며, 실제 심사 결과와 다를 수 있습니다.</span>
        </div>
      </div>`;
  } else if (!isOver) {
    const dv = totalDSR.toFixed(1), rw = d.remainTxt || '-';
    const msg = totalDSR >= 36
      ? `<b style="color:var(--rp-warn);">⚠️ DSR 경계 구간 — 현재 ${dv}%</b><br><span style="font-size:12.5px;">규제선까지 여유 <b>${(40-totalDSR).toFixed(1)}%p</b>. 추가 대출 여력: <b>${rw}</b></span>`
      : totalDSR >= 25
      ? `<b style="color:var(--rp-yellow-deep);">✅ 안정 구간 — 현재 ${dv}%</b><br><span style="font-size:12.5px;">부채 구조 양호. 추가 대출 여력 <b>${rw}</b></span>`
      : `<b style="color:var(--rp-safe);">💚 우량 구간 — 현재 ${dv}%</b><br><span style="font-size:12.5px;">부채 건전성 매우 양호. 추가 여력 <b>${rw}</b></span>`;
    reverseHtml = `<div class="rp-card stable-card"><div class="rp-card-title">✅ 부채 건전성 진단</div><div class="rec-box">${msg}</div></div>`;
  }

  // ━━━ [6] 종합 진단 의견 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let recHtml = '';
  if (isOver && d.reqIncome) {
    const dv = totalDSR.toFixed(1), op = (totalDSR - 40).toFixed(1);
    recHtml = `
      <div class="rp-card">
        <div class="rp-card-title">📋 종합 진단 의견</div>
        <div class="rec-box">
          <span class="rec-head" style="color:var(--rp-danger);">⛔ DSR 규제선(40%) 초과 — 현재 ${dv}% (초과 ${op}%p)</span>
          신규 대출 실행이 제한됩니다.<br>안정권(${d.targetDSR ?? 35}%) 진입을 위해 아래 조건 중 하나를 충족해야 합니다.
          <div class="rec-row" style="margin-top:10px;">
            <span class="rec-dot">·</span><span class="rec-label"><b>연소득</b>이</span>
            <span class="rec-amount">${won(d.reqIncome)}</span>
            <span class="rec-label">이상 증빙되거나,</span>
          </div>
          <div class="rec-row">
            <span class="rec-dot">·</span><span class="rec-label">연간 원리금을</span>
            <span class="rec-amount" style="background:rgba(220,38,38,.1);color:var(--rp-danger);">${won(d.excessPmt ?? 0)}</span>
            <span class="rec-label">이상 줄여야 합니다.</span>
          </div>
        </div>
      </div>`;
  }

  // ━━━ [7] 푸터 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const footerHtml = `
    <div class="rp-footer">
      본 리포트는 입력값 기준 예상 수치로, 실제 금융기관 심사 결과와 다를 수 있습니다.<br>
      대출 실행 전 반드시 담당 금융기관에 확인하시기 바랍니다.<br><br>
      <b>KB DSR 계산기</b> · 리포트 유효기간 ${expiryFmt}까지
    </div>`;

  // 조합 + 렌더
  wrap.innerHTML = headerHtml + consultantHtml + dsrCardHtml + summaryHtml
                 + contribHtml + reverseHtml + recHtml + footerHtml;

  // 애니메이션 (DOM 삽입 후)
  requestAnimationFrame(() => {
    startCountdown(d.expiry, expiryFmt);
    const dsrEl = document.getElementById('dsrBig');
    if (dsrEl) countUp(dsrEl, totalDSR, '%', 900);
    const barEl = document.getElementById('dsrBar');
    if (barEl) setTimeout(() => { barEl.style.width = barPct + '%'; }, 100);
    document.querySelectorAll('.loan-bar-fill').forEach((el, i) => {
      setTimeout(() => { el.style.width = (el.dataset.width || '0') + '%'; }, 200 + i * 80);
    });
  });
}

// ── 진입점 ────────────────────────────────────────────────────────────────
(async function () {
  // 시스템 테마 → body 클래스로 완전히 제어 (common.css 충돌 방지)
  const applyTheme = isDark => {
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('white', !isDark);
  };
  applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => applyTheme(e.matches));

  // 데이터 파싱
  const hash = location.hash.slice(1);
  if (!hash) { renderError('⚠️', '리포트 데이터 없음', '올바른 링크로 접속해 주세요.'); return; }
  let d;
  try { d = JSON.parse(decodeURIComponent(escape(atob(hash)))); }
  catch { renderError('🚫', '리포트를 읽을 수 없습니다', '링크가 손상되었거나 형식이 올바르지 않습니다.'); return; }

  // 만료 사전 체크
  if (Date.now() > d.expiry) {
    renderError('⏰', '리포트 유효기간 만료', '이 리포트는 발급일로부터 7일간 유효합니다.<br>담당자에게 새로운 리포트를 요청해 주세요.');
    return;
  }

  // ★ 접근 게이트 — 최초 수신자 검증 + 재공유 차단
  const access = await checkAccess(d);
  if (!access.ok) {
    if (access.reason === 'reshared') {
      renderError('🔒', '공유 불가 링크입니다',
        '이 리포트는 최초 수신자만 열람할 수 있습니다.<br><br>' +
        '링크를 직접 전달받으신 경우, 담당자에게<br>새로운 리포트 발급을 요청해 주세요.');
    } else if (access.reason === 'expired') {
      renderError('⏰', '링크가 만료되었습니다', '담당자에게 새로운 리포트를 요청해 주세요.');
    } else {
      renderError('🚫', '유효하지 않은 링크입니다', '담당자에게 문의해 주세요.');
    }
    return;
  }

  renderReport(d);
})();