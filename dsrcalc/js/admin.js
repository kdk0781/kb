/* =============================================================================
   admin.js — 관리자 로그인 페이지 전용 스크립트
   로드 위치: admin.html <script src="admin.js">
   ─────────────────────────────────────────────────────────────────────────────
   * 이 파일은 admin.html(로그인 페이지) 전용입니다.
      index.html 이 로드하는 ./js/admin.js 와 완전히 다른 파일입니다.

   포함 기능:
   - 자동 로그인 체크박스 (자동로그인 ON 시 다음 접속에 자동 로그인)
   - 로그아웃 후 로그인 페이지 복귀 시 필드 자동 복원
   - 관리자 설정 변경 (비밀번호 / 대표 페이지 URL)
   ============================================================================= */

// ─── localStorage 키 상수 ─────────────────────────────────────────────────────
var _AUTOLOGIN_KEY  = 'kb_admin_autologin';
var _INIT_STATE_KEY = 'kb_admin_init_state';

// ─── 아이콘 상수 (BMP: \uXXXX / SMP: 서로게이트 페어) ─────────────────────────
// ✅ U+2705  BMP  → \u2705
// 🚫 U+1F6AB SMP  → 서로게이트 페어 \uD83D\uDEAB
// ⚠️ U+26A0  BMP  → \u26A0 + variation selector \uFE0F
// ⚡ U+26A1  BMP  → \u26A1
var _IC_OK   = '\u2705';           // ✅ check mark
var _IC_ERR  = '\uD83D\uDEAB';    // 🚫 prohibited (surrogate pair)
var _IC_WARN = '\u26A0\uFE0F';    // ⚠️ warning
var _IC_BOLT = '\u26A1';          // ⚡ bolt

// ─── 관리자 설정 ─────────────────────────────────────────────────────────────
var DEFAULT_CONFIG = {
  id:      'admin',
  pw:      'admin',
  mainUrl: 'index.html',
  phone:   ''
};

function getAdminConfig() {
  try {
    const stored = localStorage.getItem('kb_admin_config');
    return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function saveAdminConfig(config) {
  localStorage.setItem('kb_admin_config', JSON.stringify(config));
}

// ─── 커스텀 모달 ──────────────────────────────────────────────────────────────
let _modalCallback = null;

function _adminAlert(msg, icon, callback) {
  icon     = icon     || _IC_WARN; // warning icon
  callback = callback || null;
  const modal = document.getElementById('customModal');
  if (!modal) return;
  document.getElementById('modalMsg').innerHTML  = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText = icon;
  _modalCallback = callback;
  modal.style.display = 'flex';
}

// ─── 자동 로그인 저장/불러오기 ────────────────────────────────────────────────
function saveAutoLogin(id, pw) {
  localStorage.setItem(_AUTOLOGIN_KEY, JSON.stringify({ id, pw, enabled: true }));
}
function clearAutoLogin() {
  localStorage.removeItem(_AUTOLOGIN_KEY);
}
function getAutoLogin() {
  try {
    const raw  = localStorage.getItem(_AUTOLOGIN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.enabled ? data : null;
  } catch { return null; }
}

// ─── 1회용 초기 상태 (로그아웃/설정변경 후 필드 복원) ──────────────────────────
function getInitState() {
  try {
    const raw = localStorage.getItem(_INIT_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearInitState() {
  localStorage.removeItem(_INIT_STATE_KEY);
}

// ─── 폼 필드 채우기 ───────────────────────────────────────────────────────────
function _fillForm(id, pw, checkAuto) {
  const idEl  = document.getElementById('adminId');
  const pwEl  = document.getElementById('adminPw');
  const chkEl = document.getElementById('autoLoginChk');
  if (idEl)  idEl.value    = id  || '';
  if (pwEl)  pwEl.value    = pw  || '';
  if (chkEl) chkEl.checked = !!checkAuto;
}

// ─── 자동 로그인 실행 ─────────────────────────────────────────────────────────
function _triggerAutoLogin(id, pw) {
  const card     = document.querySelector('.admin-card');
  const loginBtn = document.querySelector('.btn-login');
  if (!card || !loginBtn) return;

  const badge = document.createElement('div');
  badge.className = 'admin-auto-badge';
  badge.innerHTML = '\u26a1 자동 로그인 중...'; // lightning icon
  card.insertBefore(badge, loginBtn);

  setTimeout(function() { _doLogin(id, pw); }, 700);
}

// ─── 페이지 로드 초기화 ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  // * admin.html 접속 시 고객 낙인 즉시 해제
  // admin.html 은 관리자만 접근하는 페이지이므로
  // 로그인 성공 여부와 무관하게 낙인을 먼저 제거합니다.
  localStorage.removeItem('kb_guest_mode');

  // 모달 확인 버튼 이벤트
  const confirmBtn = document.getElementById('modalConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      document.getElementById('customModal').style.display = 'none';
      if (_modalCallback) { _modalCallback(); _modalCallback = null; }
    });
  }

  // 1회용 초기 상태 처리 (로그아웃/설정변경 직후)
  var initState = getInitState();
  if (initState) {
    clearInitState();
    _fillForm(initState.id, initState.pw, initState.autoCheck !== false);
    if (initState.autoLogin) {
      _triggerAutoLogin(initState.id, initState.pw);
    }
    return;
  }

  // 자동 로그인 처리 (일반 접속)
  var auto = getAutoLogin();
  if (auto) {
    _fillForm(auto.id, auto.pw, true);
    _triggerAutoLogin(auto.id, auto.pw);
  }
});

// ─── 로그인 로직 ─────────────────────────────────────────────────────────────
function attemptLogin() {
  var id = document.getElementById('adminId').value.trim();
  var pw = document.getElementById('adminPw').value.trim();
  _doLogin(id, pw);
}

function _doLogin(id, pw) {
  var config = getAdminConfig();
  var chkEl  = document.getElementById('autoLoginChk');
  var chk    = chkEl ? chkEl.checked : false;

  if (id === config.id && pw === config.pw) {
    // 자동 로그인 저장 여부
    if (chk) { saveAutoLogin(id, pw); } else { clearAutoLogin(); }

    localStorage.removeItem('kb_guest_mode');
    localStorage.setItem('kb_admin_session', JSON.stringify({
      isAuth:  true,
      expires: Date.now() + 24 * 60 * 60 * 1000,
      mainUrl: config.mainUrl,
    }));

    _adminAlert(
      '관리자 로그인이 완료되었습니다.<br>대표 페이지로 이동합니다.',
      _IC_OK,
      function () { window.location.href = config.mainUrl; }
    );
  } else {
    // 자동 로그인 배지 제거 후 에러 표시
    var badge = document.querySelector('.admin-auto-badge');
    if (badge) badge.remove();
    _adminAlert('아이디 또는 비밀번호가 일치하지 않습니다.', _IC_ERR);
  }
}

// ─── 엔터키 로그인 ────────────────────────────────────────────────────────────
document.addEventListener('keypress', function (e) {
  if (e.key !== 'Enter') return;
  var cm = document.getElementById('customModal');
  var sm = document.getElementById('settingsModal');
  var customOpen   = cm && cm.style.display === 'flex';
  var settingsOpen = sm && sm.style.display === 'flex';
  if (customOpen || settingsOpen) return;
  attemptLogin();
});

// ─── 관리자 설정 변경 ─────────────────────────────────────────────────────────
function changeAdminSettings() {
  var config = getAdminConfig();
  document.getElementById('setCurId').value  = '';
  document.getElementById('setCurPw').value  = '';
  document.getElementById('setNewPw').value  = '';
  document.getElementById('setNewUrl').value = config.mainUrl;
  var phoneEl = document.getElementById('setNewPhone');
  if (phoneEl) phoneEl.value = config.phone || '';
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveSettingsFromModal() {
  var config    = getAdminConfig();
  var curId     = document.getElementById('setCurId').value.trim();
  var curPw     = document.getElementById('setCurPw').value.trim();
  var newPw     = document.getElementById('setNewPw').value.trim();
  var newUrl    = document.getElementById('setNewUrl').value.trim();
  var newPhoneEl = document.getElementById('setNewPhone');
  var newPhone  = newPhoneEl ? newPhoneEl.value.trim() : '';
  var phoneOk   = newPhone === '' || /^010-\d{4}-\d{4}$/.test(newPhone);

  if (curId !== config.id || curPw !== config.pw) {
    _adminAlert('현재 아이디 또는 비밀번호가 일치하지 않습니다.', _IC_ERR);
    return;
  }

  if (newPhone && !phoneOk) {
    _adminAlert('연락처 형식이 올바르지 않습니다.<br><span style="font-size:12px;">예: 010-1234-5678</span>', _IC_WARN);
    return;
  }

  var finalPw    = newPw    !== '' ? newPw    : config.pw;
  var finalUrl   = newUrl   !== '' ? newUrl   : config.mainUrl;
  var finalPhone = newPhone !== '' ? newPhone : (config.phone || '');
  var newConfig  = { id: config.id, pw: finalPw, mainUrl: finalUrl, phone: finalPhone };

  saveAdminConfig(newConfig);
  localStorage.removeItem('kb_admin_session');

  // 자동로그인이 켜져 있었다면 새 비번으로 갱신
  var autoLogin = getAutoLogin();
  if (autoLogin) { saveAutoLogin(newConfig.id, finalPw); }

  // 로그인 페이지에 1회용 초기 상태 저장 → 새 자격증명으로 자동 로그인
  localStorage.setItem(_INIT_STATE_KEY, JSON.stringify({
    id:        newConfig.id,
    pw:        finalPw,
    autoCheck: true,
    autoLogin: true,
  }));

  closeSettingsModal();
  _adminAlert(
    '관리자 설정이 성공적으로 변경되었습니다.<br>' +
    '<span style="font-size:12px;">변경된 계정으로 자동 로그인합니다.</span>',
    _IC_OK,
    function () {
      var base = window.location.href.split('?')[0].split('#')[0];
      window.location.href = base;
    }
  );
}
