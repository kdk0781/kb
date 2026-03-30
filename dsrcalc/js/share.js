/* =============================================================================
   js/share.js — 앱 설치 / 임시 접속 링크 게이트 v3
   ─────────────────────────────────────────────────────────────────────────────
   접근 제어 로직:
   ① 관리자 기기 (kb_admin_session 유효) → 무제한 접속
   ② 최초 클릭 기기 → 기기 바인딩 후 유효기간 동안 다회 접속 허용
   ③ 다른 기기에서 복사된 링크 클릭 → 에러 메시지
   ─────────────────────────────────────────────────────────────────────────────
   ★ 유효시간 변경: js/admin.js 의 SHARE_LINK_TTL_MS 값을 수정하세요
      1시간  →   1 * 60 * 60 * 1000
      6시간  →   6 * 60 * 60 * 1000
     24시간  →  24 * 60 * 60 * 1000  ← 현재값
     48시간  →  48 * 60 * 60 * 1000
   ★ _OTL_SIGN_KEY 는 js/report.js 와 반드시 동일해야 합니다
   ============================================================================= */

// ─── 설정 ─────────────────────────────────────────────────────────────────────
const _OTL_SIGN_KEY      = 'KB_DSR_OTL_SIGN_2026';
const _GRANT_PREFIX      = 'share_grant_';    // 기기 바인딩 nonce 키 접두사
const _ACTIVE_NONCE_KEY  = 'share_active';    // 현재 기기의 활성 nonce

let deferredPrompt;

// ─── 관리자 기기 판별 ─────────────────────────────────────────────────────────
function _isAdminDevice() {
  try {
    const s = JSON.parse(localStorage.getItem('kb_admin_session') || 'null');
    return s?.isAuth && Date.now() < s.expires;
  } catch { return false; }
}

// ─── HMAC-SHA256 서명 검증 ────────────────────────────────────────────────────
async function _verifySign(payload, sigToCheck) {
  const keyBuf    = new TextEncoder().encode(_OTL_SIGN_KEY);
  const dataBuf   = new TextEncoder().encode(JSON.stringify(payload));
  const ck = await crypto.subtle.importKey('raw', keyBuf, { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
  const b64 = sigToCheck.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return crypto.subtle.verify('HMAC', ck, buf, dataBuf);
}

// ─── 기기 바인딩 유틸 ─────────────────────────────────────────────────────────
/** 이 기기에 nonce 가 바인딩되어 있고 아직 유효한지 확인 */
function _isGrantedToThisDevice(nonce) {
  try {
    const raw = localStorage.getItem(_GRANT_PREFIX + nonce);
    if (!raw) return false;
    const { expiry } = JSON.parse(raw);
    return Date.now() < expiry;
  } catch { return false; }
}

/** nonce 를 이 기기에 바인딩 (url·expiry 함께 저장해 토큰 없이도 재접속 가능) */
function _bindNonceToDevice(nonce, url, expiry) {
  try {
    localStorage.setItem(_GRANT_PREFIX + nonce,
      JSON.stringify({ url, expiry, grantedAt: Date.now() }));
    localStorage.setItem(_ACTIVE_NONCE_KEY, nonce); // 활성 nonce 기록
  } catch {}
}

/** 저장된 바인딩 데이터 조회 */
function _getGrant(nonce) {
  try { return JSON.parse(localStorage.getItem(_GRANT_PREFIX + nonce) || 'null'); }
  catch { return null; }
}

/** 만료된 바인딩 청소 */
function _cleanExpiredGrants() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(_GRANT_PREFIX)) continue;
      try {
        const { expiry } = JSON.parse(localStorage.getItem(key));
        if (Date.now() > expiry) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  } catch {}
}

// ─── UI 카드 전환 ─────────────────────────────────────────────────────────────
function _showCard(cardId) {
  ['cardLoading','cardMain','cardExpired','cardUsed','cardInvalid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === cardId);
  });
}

// ─── 정상 카드 셋업 (버튼 이벤트 + 뱃지 업데이트) ────────────────────────────
function _setupMainCard(url, expiry) {
  // 유효기간 뱃지
  const expDate = new Date(expiry).toLocaleString('ko-KR', {
    month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'
  });
  const badge = document.getElementById('expiryBadge');
  if (badge) badge.textContent = `⏱ ${expDate}까지 유효`;

  // 1회성 접속 버튼
  document.getElementById('btnOneTime')?.addEventListener('click', () => {
    localStorage.setItem('kb_guest_mode', 'true');
    window.location.href = url;
  }, { once: true });
}

// ─── 메인 토큰 검증 ───────────────────────────────────────────────────────────
async function validateToken() {
  _cleanExpiredGrants();

  const raw    = new URLSearchParams(location.search).get('t');
  const active = localStorage.getItem(_ACTIVE_NONCE_KEY);

  // ══ 관리자 기기 우선 처리 ══════════════════════════════════════════════════
  if (_isAdminDevice()) {
    if (raw) {
      // 토큰이 있으면 파싱해서 URL 추출
      try {
        const token = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (token?.url && token?.exp && Date.now() < token.exp) {
          window.history.replaceState(null, '', 'share.html');
          _setupMainCard(token.url, token.exp);
          _showCard('cardMain');
          return;
        }
      } catch {}
    } else if (active) {
      // 저장된 바인딩에서 URL 복원
      const grant = _getGrant(active);
      if (grant) {
        _setupMainCard(grant.url, grant.expiry);
        _showCard('cardMain');
        return;
      }
    }
    // 관리자라도 토큰이 완전히 없으면 invalid 표시
    _showCard('cardInvalid');
    return;
  }

  // ══ 일반 사용자 ════════════════════════════════════════════════════════════

  // ── Case A: 토큰 없음 → 이 기기에 바인딩된 기록이 있는지 확인 ──────────────
  if (!raw) {
    if (active && _isGrantedToThisDevice(active)) {
      const grant = _getGrant(active);
      _setupMainCard(grant.url, grant.expiry);
      _showCard('cardMain');
    } else {
      // 바인딩 기록 없음 = 다른 기기에서 복사된 링크
      _showCard('cardInvalid');
    }
    return;
  }

  // ── Case B: 토큰 있음 ─────────────────────────────────────────────────────
  let token;
  try { token = JSON.parse(decodeURIComponent(escape(atob(raw)))); }
  catch { _showCard('cardInvalid'); return; }

  const { url, exp, nonce, sig } = token;
  if (!url || !exp || !nonce || !sig) { _showCard('cardInvalid'); return; }

  // 만료 체크
  if (Date.now() > exp) { _showCard('cardExpired'); return; }

  // 서명 검증
  let sigOk = false;
  try { sigOk = await _verifySign({ url, exp, nonce }, sig); } catch {}
  if (!sigOk) { _showCard('cardInvalid'); return; }

  // 이미 이 기기에 바인딩된 경우 → 다회 접속 허용
  if (_isGrantedToThisDevice(nonce)) {
    window.history.replaceState(null, '', 'share.html');
    _setupMainCard(url, exp);
    _showCard('cardMain');
    return;
  }

  // 최초 접속 → 기기 바인딩
  _bindNonceToDevice(nonce, url, exp);
  window.history.replaceState(null, '', 'share.html');
  _setupMainCard(url, exp);
  _showCard('cardMain');
}

// ─── window.onload ────────────────────────────────────────────────────────────
window.onload = function () {
  if (checkInAppBrowser()) return;
  validateToken();

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });

  document.getElementById('btnInstall').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { deferredPrompt = null; showInstallSuccess(); }
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) alert('아이폰 하단의 [공유(네모에 화살표)] 버튼을 누른 후\n[홈 화면에 추가]를 선택하여 설치해주세요.');
      else alert("브라우저 설정 메뉴(우측 상단 ⁝)에서\n'앱 설치' 또는 '홈 화면에 추가'를 선택해주세요.");
    }
  });
};

// ─── 설치 성공 화면 ───────────────────────────────────────────────────────────
function showInstallSuccess() {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:var(--bg-page);text-align:center;">
      <div style="font-size:60px;margin-bottom:20px;">✅</div>
      <h2 style="font-size:22px;font-weight:800;color:var(--text-primary);margin-bottom:12px;">앱 설치가 시작되었습니다!</h2>
      <p style="font-size:15px;color:var(--text-secondary);line-height:1.6;word-break:keep-all;">이제 현재 브라우저 창을 닫으셔도 됩니다.<br><br>기기 홈 화면(바탕화면)에 생성된<br><b>'DSR 계산기'</b> 아이콘을 통해 접속해주세요.</p>
    </div>`;
}

// ─── 인앱 브라우저 감지 ───────────────────────────────────────────────────────
function checkInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  const isKakao = ua.includes('kakaotalk');
  const isInApp = isKakao || ua.includes('line') || ua.includes('inapp') ||
                  ua.includes('instagram') || ua.includes('facebook');
  if (!isInApp) return false;

  const currentUrl = location.href;
  if (ua.includes('android') && isKakao) {
    location.href = 'intent://' + currentUrl.replace(/https?:\/\//i, '') +
                    '#Intent;scheme=https;package=com.android.chrome;end';
    return true;
  }
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:#F4F6FB;text-align:center;">
      <div style="font-size:50px;margin-bottom:20px;">🧭</div>
      <h2 style="font-size:20px;font-weight:800;color:#12203A;margin-bottom:12px;">기본 브라우저로 열어주세요</h2>
      <p style="font-size:14px;color:#485070;line-height:1.6;word-break:keep-all;margin-bottom:24px;">앱 내 브라우저에서는 <b>앱 설치</b>가 지원되지 않습니다.<br><br>우측 하단의 <b>[나침반(사파리)]</b> 또는 <b>[⁝]</b>을 눌러<br><b style="color:#3B82F6;">'다른 브라우저로 열기'</b>를 선택해주세요.</p>
      <button onclick="copyAndAlert('${currentUrl}')" style="padding:14px 24px;background:#1A2B5A;color:#fff;border-radius:12px;font-weight:700;border:none;box-shadow:0 4px 12px rgba(26,43,90,0.2);">🔗 현재 링크 복사하기</button>
    </div>`;
  window.copyAndAlert = url => {
    const t = document.createElement('textarea');
    document.body.appendChild(t); t.value = url; t.select();
    document.execCommand('copy'); document.body.removeChild(t);
    alert('링크가 복사되었습니다.\n사파리(Safari)나 크롬 주소창에 붙여넣어 주세요.');
  };
  return true;
}
