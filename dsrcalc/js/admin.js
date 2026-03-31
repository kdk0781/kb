/* =============================================================================
   js/admin.js — 관리자 인증 + 배포 링크 생성 + 로그아웃
   · checkAdminAuth       : 세션 확인 → 관리자 UI 표시
   · generateAdminShareLink: HMAC OTL 토큰으로 앱 설치 링크 생성
   · adminLogout / closeLogoutModal / proceedAdminLogout
   · 의존: config.js, report.js (_otlIssue, _forceCopy, showAlert)
   ============================================================================= */

function checkAdminAuth() {
  // 고객 낙인이 있으면 관리자 UI 강제 차단
  if (localStorage.getItem('kb_guest_mode') === 'true') return;

  try {
    const session = JSON.parse(localStorage.getItem('kb_admin_session') || 'null');
    if (session?.isAuth && Date.now() < session.expires) {
      const adminUI = document.getElementById('adminShareContainer');
      if (adminUI) adminUI.style.display = 'block';
    } else {
      localStorage.removeItem('kb_admin_session');
    }
  } catch {}
}

// ─── 배포용 앱 설치 링크 생성 ────────────────────────────────────────────────
async function generateAdminShareLink() {
  const btn = document.getElementById('btnAdminShare');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '🔗 링크 생성 중...'; btn.disabled = true;

  try {
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    const baseUrl    = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);

    // ★ 링크 유효 시간 설정 ────────────────────────────────────────────────────
    // 단위: 밀리초(ms) — 아래 숫자 하나만 바꾸면 됩니다
    //   1시간  →   1 * 60 * 60 * 1000  =    3_600_000
    //   6시간  →   6 * 60 * 60 * 1000  =   21_600_000
    //  12시간  →  12 * 60 * 60 * 1000  =   43_200_000
    //  24시간  →  24 * 60 * 60 * 1000  =   86_400_000  ← 현재값
    //  48시간  →  48 * 60 * 60 * 1000  =  172_800_000
    const SHARE_LINK_TTL_MS = 24 * 60 * 60 * 1000; // ← 여기만 수정
    // ──────────────────────────────────────────────────────────────────────────

    const encodedPayload = await _otlIssue(currentUrl, SHARE_LINK_TTL_MS);
    const longShareUrl   = `${baseUrl}share.html?t=${encodedPayload}`;
    // 외부 단축 서비스 미사용 — 앱 설치 링크는 길이가 짧아 직접 공유 가능
    const shortUrl = longShareUrl;

    const msg = `🔗 <b>계산기 앱 설치 링크가 복사되었습니다.</b><br><br>` +
                `<span style="font-size:12px; display:block; margin-top:8px;">` +
                `• 이 링크는 발급 시간 기준 <b>24시간 동안만 유효</b>합니다.<br>` +
                `• 접속 시 PWA 자동 설치 안내 페이지로 연결됩니다.</span>`;

    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      navigator.share({ title: 'DSR 계산기 앱웹', text: 'DSR 계산기 간편 접속 및 앱 설치 링크입니다. (24시간 유효)', url: shortUrl })
        .catch(err => { if (err.name !== 'AbortError') _forceCopy(shortUrl, msg); });
    } else {
      _forceCopy(shortUrl, msg);
    }
  } catch (e) {
    console.error(e);
    showAlert('링크 생성 중 오류가 발생했습니다.', null, '⚠️');
  } finally {
    btn.innerHTML = origHtml; btn.disabled = false;
  }
}

// ─── 로그아웃 ─────────────────────────────────────────────────────────────────
function adminLogout() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'flex';
}
function closeLogoutModal() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'none';
}
function proceedAdminLogout() {
  closeLogoutModal();
  localStorage.removeItem('kb_admin_session');
  const currentUrl = window.location.href.split('?')[0].split('#')[0];
  const baseUrl    = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
  window.location.href = baseUrl + 'admin.html';
}
