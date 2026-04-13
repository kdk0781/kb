/* =============================================================================
   js/admin.js — 메인 페이지 관리자 기능 모듈
   ─────────────────────────────────────────────────────────────────────────────
   ★ 이 파일은 index.html 이 로드하는 관리자 기능 모음입니다.
      admin.html 의 로그인 페이지 스크립트(admin.html 전용 admin.js)와 다릅니다.

   포함 기능:
   · checkAdminAuth()          — 세션 확인 후 adminShareContainer 노출
   · generateAdminShareLink()  — 24시간 임시 고객 배포 링크 생성 + 단축
   · adminLogout()             — 로그아웃 확인 모달 표시
   · closeLogoutModal()        — 로그아웃 모달 닫기
   · proceedAdminLogout()      — 로그아웃 실행 + 자동로그인 복원 init_state 설정
   · _shortenUrl()             — is.gd URL 단축 헬퍼
   · _forceCopy()              — 클립보드 복사 헬퍼 (iOS 포함)
   ─────────────────────────────────────────────────────────────────────────────
   의존: config.js (_C, APP_CONFIG), modal.js (showAlert)
   ============================================================================= */

// ─── 관리자 세션 확인 ────────────────────────────────────────────────────────
/**
 * 페이지 로드 시 관리자 세션 유효성 검사.
 * · 유효 → adminShareContainer 노출
 * · 만료 → 세션 삭제
 * · kb_guest_mode = 'true' → 고객 낙인, 관리자 UI 강제 숨김
 */
function checkAdminAuth() {
  // 고객 낙인이 있으면 관리자 UI 완전 차단
  if (localStorage.getItem('kb_guest_mode') === 'true') return;

  const sessionStr = localStorage.getItem('kb_admin_session');
  if (!sessionStr) return;

  try {
    const session = JSON.parse(sessionStr);
    if (session.isAuth && Date.now() < session.expires) {
      const adminUI = document.getElementById('adminShareContainer');
      if (adminUI) adminUI.style.display = 'block';
    } else {
      localStorage.removeItem('kb_admin_session');
    }
  } catch {}
}

// ─── 로그아웃 ────────────────────────────────────────────────────────────────
function adminLogout() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'flex';
}

function closeLogoutModal() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'none';
}

/**
 * 로그아웃 실행
 * · 세션 삭제
 * · 자동 로그인 정보가 있으면 kb_admin_init_state 에 저장 (로그인 페이지 복원용)
 * · admin.html 로 이동
 */
function proceedAdminLogout() {
  closeLogoutModal();
  localStorage.removeItem('kb_admin_session');

  // 자동 로그인 정보가 있으면 1회용 init_state 저장
  // → 로그인 페이지가 해당 값으로 필드·체크박스를 복원하고 자동 로그인 실행
  try {
    const _AL_KEY   = 'kb_admin_autologin';
    const _INIT_KEY = 'kb_admin_init_state';
    const autoRaw   = localStorage.getItem(_AL_KEY);
    if (autoRaw) {
      const auto = JSON.parse(autoRaw);
      if (auto?.enabled) {
        localStorage.setItem(_INIT_KEY, JSON.stringify({
          id:        auto.id,
          pw:        auto.pw,
          autoCheck: true,   // 체크박스 켜진 채로 복원
          autoLogin: true,   // 로드 즉시 자동 로그인
        }));
      }
    }
  } catch {}

  const currentUrl = window.location.href.split('?')[0].split('#')[0];
  const baseUrl    = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
  window.location.href = baseUrl + 'admin.html';
}

// ─── 고객 배포용 임시 링크 생성 ──────────────────────────────────────────────
/*
  흐름:
  1. 하루 발급 한도 (REPORT_COPY_DAILY_LIMIT) 체크
  2. 24시간 만료 토큰 생성 → URL-safe base64
  3. share.html?t=TOKEN 링크 구성
  4. is.gd 로 단축 URL 생성 (실패 시 긴 URL 그대로 사용)
  5. 모바일 → navigator.share() / PC → 클립보드 복사
  6. 성공 모달 표시

  share.html 검증 로직 (share.js):
    payload = JSON.parse(decodeURIComponent(atob(token)))
    payload.exp > Date.now() 이면 유효
*/

/** URL-safe base64 (SMS·카카오톡 '+' 깨짐 방지) */
function _toUrlSafeB64(str) {
  return btoa(encodeURIComponent(str))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 하루 발급 카운트 localStorage 키 */
function _shareDailyKey() {
  const d = new Date();
  return `kb_share_cnt_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

/** 발급 한도 확인 + 카운트 증가 */
function _checkShareLimit() {
  const limit = _C?.REPORT_COPY_DAILY_LIMIT ?? 10;
  const key   = _shareDailyKey();
  const cnt   = parseInt(localStorage.getItem(key) || '0', 10);
  if (cnt >= limit) return { ok: false, cnt, limit };
  localStorage.setItem(key, String(cnt + 1));
  return { ok: true, cnt: cnt + 1, limit };
}

/** is.gd URL 단축 (실패 시 원본 URL 반환) */
async function _shortenUrl(longUrl) {
  try {
    const api = _C?.SHORTENER_API || 'https://is.gd/create.php?format=simple&url=';
    const res = await fetch(api + encodeURIComponent(longUrl));
    if (!res.ok) throw new Error();
    const s = (await res.text()).trim();
    if (s.startsWith('http')) return s;
    throw new Error();
  } catch { return longUrl; }
}

/** 클립보드 복사 (iOS 폴백 포함) */
function _forceCopy(text, successMsg) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => { if (successMsg) showAlert(successMsg, '✅'); })
      .catch(() => _fcFallback(text, successMsg));
  } else {
    _fcFallback(text, successMsg);
  }
}

function _fcFallback(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.value = text; ta.focus(); ta.select();
  try {
    document.execCommand('copy');
    if (successMsg) showAlert(successMsg, '✅');
  } catch {
    showAlert('복사에 실패했습니다.<br>직접 복사해 주세요.<br><br>' + text, '⚠️');
  }
  document.body.removeChild(ta);
}

/** 고객 배포용 링크 생성 (btnAdminShare onclick) */
async function generateAdminShareLink() {
  // ── 하루 발급 한도 체크
  const limitCheck = _checkShareLimit();
  if (!limitCheck.ok) {
    showAlert(
      `오늘 발급 한도(${limitCheck.limit}회)를 초과했습니다.<br>` +
      '<span style="font-size:12px;">내일 자정에 초기화됩니다.</span>',
      '🚫'
    );
    return;
  }

  // ── 버튼 로딩 상태
  const btn = document.getElementById('btnAdminShare');
  const origHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<div class="admin-share-icon">⏳</div>' +
      '<div class="admin-share-text"><span class="share-title-main">링크 생성 중...</span></div>';
  }

  try {
    // ── 24시간 만료 토큰 생성
    const payload  = { exp: Date.now() + 24 * 60 * 60 * 1000 };
    const token    = _toUrlSafeB64(JSON.stringify(payload));

    // ── share.html 링크 구성
    const base     = window.location.href.split('?')[0].split('#')[0];
    const baseDir  = base.substring(0, base.lastIndexOf('/') + 1);
    const longUrl  = `${baseDir}share.html?t=${token}`;

    // ── URL 단축
    const shortUrl = await _shortenUrl(longUrl);

    // ── 성공 메시지
    const remaining = limitCheck.limit - limitCheck.cnt;
    const msg =
      `🔗 <b>고객용 앱 설치 링크가 복사되었습니다.</b><br><br>` +
      `<span style="font-size:12px; display:block;">` +
      `• 발급 후 <b>24시간 동안만 유효</b>합니다.<br>` +
      `• 오늘 남은 발급 횟수: <b>${remaining}회</b></span>`;

    // ── 모바일 → 네이티브 공유 / PC → 클립보드 복사
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      navigator.share({
        title: 'KB DSR 계산기 (고객용)',
        text:  'DSR 계산기 간편 접속 및 앱 설치 링크입니다. (24시간 유효)',
        url:   shortUrl,
      }).catch(e => {
        if (e.name !== 'AbortError') _forceCopy(shortUrl, msg);
      });
    } else {
      _forceCopy(shortUrl, msg);
    }

  } catch (e) {
    console.error('[AdminShare] 링크 생성 실패:', e);
    showAlert('링크 생성 중 오류가 발생했습니다.', '⚠️');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (origHtml) btn.innerHTML = origHtml;
    }
  }
}
