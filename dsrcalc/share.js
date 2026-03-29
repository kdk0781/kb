/* =============================================================================
   share.js — 1회성 링크 게이트 (HMAC-SHA256 서명 검증 + nonce 소인)
   ─────────────────────────────────────────────────────────────────────────────
   ★ _OTL_SIGN_KEY 는 common.js 의 값과 반드시 동일해야 합니다
   ============================================================================= */

// ─── 설정 ─────────────────────────────────────────────────────────────────────
// ★ common.js 의 _OTL_SIGN_KEY 와 동기화 — 두 파일 항상 같이 변경하세요
const _OTL_SIGN_KEY = 'KB_DSR_OTL_SIGN_2026';

// nonce 를 localStorage 에 보관할 기간 (ms) — 링크 유효시간보다 길게 유지 권장
//   7일  →   7 * 24 * 60 * 60 * 1000  =    604_800_000
//  30일  →  30 * 24 * 60 * 60 * 1000  =  2_592_000_000  ← 현재값
//  60 * 1000 = 1분
const _NONCE_KEEP_MS = 0.01 * 24 * 60 * 60 * 1000; // ← 여기만 수정
// ──────────────────────────────────────────────────────────────────────────────

let deferredPrompt;
const _NONCE_KEY_PREFIX = 'otl_used_';

// ─── HMAC-SHA256 서명 검증 ────────────────────────────────────────────────────
async function _verifySign(payload, sigToCheck) {
  const keyBuf    = new TextEncoder().encode(_OTL_SIGN_KEY);
  const dataBuf   = new TextEncoder().encode(JSON.stringify(payload));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const b64    = sigToCheck.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const sigBuf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) sigBuf[i] = binary.charCodeAt(i);
  return crypto.subtle.verify('HMAC', cryptoKey, sigBuf, dataBuf);
}

// ─── nonce localStorage 유틸 ─────────────────────────────────────────────────
function _isNonceUsed(nonce) {
  try { return localStorage.getItem(_NONCE_KEY_PREFIX + nonce) !== null; }
  catch { return false; }
}

function _markNonceUsed(nonce) {
  try {
    localStorage.setItem(
      _NONCE_KEY_PREFIX + nonce,
      JSON.stringify({ usedAt: Date.now(), keepUntil: Date.now() + _NONCE_KEEP_MS })
    );
  } catch { /* localStorage 쓰기 실패 시 무시 */ }
}

function _cleanOldNonces() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(_NONCE_KEY_PREFIX)) continue;
      try {
        const { keepUntil } = JSON.parse(localStorage.getItem(key));
        if (Date.now() > keepUntil) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  } catch { /* 무시 */ }
}

// ─── UI 카드 전환 ─────────────────────────────────────────────────────────────
function _showCard(cardId) {
  ['cardLoading', 'cardMain', 'cardExpired', 'cardUsed', 'cardInvalid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === cardId);
  });
}

// ─── 토큰 검증 (기존 validateToken 교체) ─────────────────────────────────────
async function validateToken() {
  _cleanOldNonces(); // 만료된 소인 청소

  const raw = new URLSearchParams(location.search).get('t');
  if (!raw) { _showCard('cardInvalid'); return; }

  // 1. Base64 → JSON 파싱
  let token;
  try {
    token = JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    _showCard('cardInvalid'); return;
  }

  const { url, exp, nonce, sig } = token;
  if (!url || !exp || !nonce || !sig) { _showCard('cardInvalid'); return; }

  // 2. ★ 만료 시각 검증 (ms 타임스탬프 직접 비교)
  if (Date.now() > exp) { _showCard('cardExpired'); return; }

  // 3. ★ HMAC-SHA256 서명 검증 (exp·url·nonce 조작 시 불일치로 차단)
  let sigOk = false;
  try { sigOk = await _verifySign({ url, exp, nonce }, sig); }
  catch { sigOk = false; }
  if (!sigOk) { _showCard('cardInvalid'); return; }

  // 4. ★ 1회성 nonce 소인 검사 (같은 기기 재접속 차단)
  if (_isNonceUsed(nonce)) { _showCard('cardUsed'); return; }

  // ✅ 모든 검증 통과 → 소인 기록
  _markNonceUsed(nonce);

  // 주소창 세탁 (토큰 URL 노출 제거)
  window.history.replaceState(null, '', 'share.html');

  // 유효기간 뱃지 업데이트
  const expDate = new Date(exp).toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const badge = document.getElementById('expiryBadge');
  if (badge) badge.textContent = `⏱ ${expDate}까지 유효`;

  // 1회성 접속 버튼 — 토큰의 url 로 이동 (하드코딩 제거)
  document.getElementById('btnOneTime')?.addEventListener('click', () => {
    localStorage.setItem('kb_guest_mode', 'true'); // 고객 낙인 → 관리자 UI 차단
    window.location.href = url;
  });

  _showCard('cardMain');
}

// ─── window.onload ────────────────────────────────────────────────────────────
window.onload = function() {
  if (checkInAppBrowser()) return;

  // 토큰 검증 (비동기)
  validateToken();

  // PWA 설치 프롬프트 캐싱 (기존 로직 완전 보존)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // 앱 설치 버튼 (기존 로직 완전 보존)
  document.getElementById('btnInstall').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        showInstallSuccess();
      }
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) { alert("아이폰 하단의 [공유(네모에 화살표)] 버튼을 누른 후\n[홈 화면에 추가]를 선택하여 설치해주세요."); }
      else { alert("브라우저 설정 메뉴(우측 상단 ⁝)에서\n'앱 설치' 또는 '홈 화면에 추가'를 선택해주세요."); }
    }
  });
};

// ─── 아래 두 함수는 기존 코드 완전 보존 ──────────────────────────────────────

function showInstallSuccess() {
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:var(--bg-page); text-align:center;">
      <div style="font-size:60px; margin-bottom:20px;">✅</div>
      <h2 style="font-size:22px; font-weight:800; color:var(--text-primary); margin-bottom:12px;">앱 설치가 시작되었습니다!</h2>
      <p style="font-size:15px; color:var(--text-secondary); line-height:1.6; word-break:keep-all;">이제 현재 브라우저 창을 닫으셔도 됩니다.<br><br>기기 홈 화면(바탕화면)에 생성된<br><b>'DSR 계산기'</b> 아이콘을 통해 접속해주세요.</p>
    </div>
  `;
}

function checkInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  const isKakao = ua.indexOf('kakaotalk') > -1;
  const isInApp = isKakao || ua.indexOf('line') > -1 || ua.indexOf('inapp') > -1 || ua.indexOf('instagram') > -1 || ua.indexOf('facebook') > -1;

  if (isInApp) {
    const currentUrl = location.href;
    if (ua.indexOf('android') > -1 && isKakao) { location.href = 'intent://' + currentUrl.replace(/https?:\/\//i, '') + '#Intent;scheme=https;package=com.android.chrome;end'; return true; }

    document.body.innerHTML = `
      <div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:#F4F6FB; text-align:center;">
        <div style="font-size:50px; margin-bottom:20px;">🧭</div>
        <h2 style="font-size:20px; font-weight:800; color:#12203A; margin-bottom:12px;">기본 브라우저로 열어주세요</h2>
        <p style="font-size:14px; color:#485070; line-height:1.6; word-break:keep-all; margin-bottom:24px;">앱 내 브라우저에서는 <b>앱 설치</b>가 지원되지 않습니다.<br><br>우측 하단의 <b>[나침반(사파리)]</b> 또는 <b>[⁝]</b>을 눌러<br><b style="color:#3B82F6;">'다른 브라우저로 열기'</b>를 선택해주세요.</p>
        <button onclick="copyAndAlert('${currentUrl}')" style="padding:14px 24px; background:#1A2B5A; color:#fff; border-radius:12px; font-weight:700; border:none; box-shadow:0 4px 12px rgba(26,43,90,0.2);">🔗 현재 링크 복사하기</button>
      </div>
    `;
    window.copyAndAlert = function(url) { const t = document.createElement("textarea"); document.body.appendChild(t); t.value = url; t.select(); document.execCommand("copy"); document.body.removeChild(t); alert("링크가 복사되었습니다.\n사파리(Safari)나 크롬 주소창에 붙여넣어 주세요."); };
    return true;
  }
  return false;
}
