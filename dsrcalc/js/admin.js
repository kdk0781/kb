/* =================================================================
   admin.js — admin.html 전용 로그인 / 설정 변경 로직
   원본 admin-login.js 구조 기반 + ES 호환성 수정본
   · _adminAlert 는 이 파일 고유 시그니처 (msg, icon, callback)
     → common.js 의 _adminAlert(msg, focusId, icon) 와 다른 파일임
     → admin.html 은 common.js 를 로드하지 않으므로 충돌 없음
   · DOMContentLoaded + 정적 <script src> → 타이밍 문제 없음
   ================================================================= */

// ─── 설정 ─────────────────────────────────────────────────────────
var DEFAULT_CONFIG = {
  id:      'admin',
  pw:      'admin',
  mainUrl: 'index.html',
  phone:   ''
};

function getAdminConfig() {
  try {
    var s = localStorage.getItem('kb_admin_config');
    return s ? JSON.parse(s) : DEFAULT_CONFIG;
  } catch(e) { return DEFAULT_CONFIG; }
}
function saveAdminConfig(config) {
  localStorage.setItem('kb_admin_config', JSON.stringify(config));
}

// ─── 모달 (admin.html 전용 — common.js showAlert 와 충돌 없음) ────
var _modalCallback = null;

function _adminAlert(msg, icon, callback) {
  // icon 기본값: 경고 이모지 (유니코드 이스케이프)
  icon     = (icon !== undefined && icon !== null) ? icon : '\u26a0\ufe0f';
  callback = callback || null;
  var modal = document.getElementById('customModal');
  if (!modal) return;
  document.getElementById('modalMsg').innerHTML  = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText = icon;
  _modalCallback = callback;
  modal.style.display = 'flex';
}

// ─── 자동 로그인 ──────────────────────────────────────────────────
var _AK = 'kb_admin_autologin';
var _IK = 'kb_admin_init_state';

function saveAutoLogin(id, pw) {
  localStorage.setItem(_AK, JSON.stringify({ id: id, pw: pw, enabled: true }));
}
function clearAutoLogin() { localStorage.removeItem(_AK); }
function getAutoLogin() {
  try {
    var r = localStorage.getItem(_AK);
    if (!r) return null;
    var d = JSON.parse(r);
    return (d && d.enabled) ? d : null;
  } catch(e) { return null; }
}
function getInitState() {
  try {
    var r = localStorage.getItem(_IK);
    return r ? JSON.parse(r) : null;
  } catch(e) { return null; }
}
function clearInitState() { localStorage.removeItem(_IK); }

// ─── 폼 채우기 ────────────────────────────────────────────────────
function _fillForm(id, pw, chk) {
  var a = document.getElementById('adminId');
  var b = document.getElementById('adminPw');
  var c = document.getElementById('autoLoginChk');
  if (a) a.value   = id  || '';
  if (b) b.value   = pw  || '';
  if (c) c.checked = !!chk;
}

// ─── 자동 로그인 실행 ─────────────────────────────────────────────
function _triggerAutoLogin(id, pw) {
  var card = document.querySelector('.admin-card');
  var btn  = document.querySelector('.btn-login');
  if (card && btn) {
    var badge = document.createElement('div');
    badge.className = 'admin-auto-badge';
    badge.innerHTML = '\u26a1 자동 로그인 중...';
    card.insertBefore(badge, btn);
  }
  setTimeout(function() { _doLogin(id, pw); }, 700);
}

// ─── 로그인 ───────────────────────────────────────────────────────
function attemptLogin() {
  _doLogin(
    document.getElementById('adminId').value.trim(),
    document.getElementById('adminPw').value.trim()
  );
}

function _doLogin(id, pw) {
  var cfg  = getAdminConfig();
  var ckEl = document.getElementById('autoLoginChk');
  var chk  = ckEl ? ckEl.checked : false;

  if (id === cfg.id && pw === cfg.pw) {
    if (chk) { saveAutoLogin(id, pw); } else { clearAutoLogin(); }
    localStorage.removeItem('kb_guest_mode');
    localStorage.setItem('kb_admin_session', JSON.stringify({
      isAuth:  true,
      expires: Date.now() + 86400000,
      mainUrl: cfg.mainUrl
    }));
    _adminAlert(
      '로그인이 완료되었습니다.<br>대표 페이지로 이동합니다.',
      '\u2705',
      function() { window.location.href = cfg.mainUrl; }
    );
  } else {
    var badge = document.querySelector('.admin-auto-badge');
    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
    _adminAlert('아이디 또는 비밀번호가 일치하지 않습니다.', '\uD83D\uDEAB');
  }
}

// ─── 설정 변경 ────────────────────────────────────────────────────
function changeAdminSettings() {
  var cfg = getAdminConfig();
  document.getElementById('setCurId').value  = '';
  document.getElementById('setCurPw').value  = '';
  document.getElementById('setNewPw').value  = '';
  document.getElementById('setNewUrl').value = cfg.mainUrl;
  var pEl = document.getElementById('setNewPhone');
  if (pEl) pEl.value = cfg.phone || '';
  document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}
function saveSettingsFromModal() {
  var cfg   = getAdminConfig();
  var curId = document.getElementById('setCurId').value.trim();
  var curPw = document.getElementById('setCurPw').value.trim();
  var newPw = document.getElementById('setNewPw').value.trim();
  var newUrl= document.getElementById('setNewUrl').value.trim();
  var pEl   = document.getElementById('setNewPhone');
  var phone = pEl ? pEl.value.trim() : '';

  if (curId !== cfg.id || curPw !== cfg.pw) {
    _adminAlert('현재 아이디 또는 비밀번호가 일치하지 않습니다.', '\uD83D\uDEAB');
    return;
  }
  if (phone && !/^010-\d{4}-\d{4}$/.test(phone)) {
    _adminAlert('연락처 형식이 올바르지 않습니다.<br><span style="font-size:12px;">예: 010-1234-5678</span>', '\u26a0\ufe0f');
    return;
  }

  var newCfg = {
    id:      cfg.id,
    pw:      newPw   || cfg.pw,
    mainUrl: newUrl  || cfg.mainUrl,
    phone:   phone   || cfg.phone || ''
  };
  saveAdminConfig(newCfg);
  localStorage.removeItem('kb_admin_session');

  var al = getAutoLogin();
  if (al) saveAutoLogin(newCfg.id, newCfg.pw);

  localStorage.setItem(_IK, JSON.stringify({
    id: newCfg.id, pw: newCfg.pw, autoCheck: true, autoLogin: true
  }));

  closeSettingsModal();
  _adminAlert(
    '설정이 변경되었습니다.<br>변경된 계정으로 자동 로그인합니다.',
    '\u2705',
    function() {
      window.location.href = window.location.href.split('?')[0].split('#')[0];
    }
  );
}

// ─── DOMContentLoaded ─────────────────────────────────────────────
// 정적 <script src="admin.js"> + body 끝 로드 구조에서
// DOMContentLoaded 는 스크립트 실행 직후 발동 → 타이밍 문제 없음
document.addEventListener('DOMContentLoaded', function() {
  // 고객 낙인 해제
  localStorage.removeItem('kb_guest_mode');

  // 확인 버튼 — addEventListener 로 등록 (onclick 충돌 방지)
  var confirmBtn = document.getElementById('modalConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function() {
      document.getElementById('customModal').style.display = 'none';
      if (_modalCallback) {
        var cb = _modalCallback;
        _modalCallback = null;
        cb();
      }
    });
  }

  // 엔터키 로그인
  document.addEventListener('keypress', function(e) {
    if ((e.key || e.keyCode) !== 'Enter' && e.keyCode !== 13) return;
    var cm = document.getElementById('customModal');
    var sm = document.getElementById('settingsModal');
    if ((cm && cm.style.display === 'flex') ||
        (sm && sm.style.display === 'flex')) return;
    attemptLogin();
  });

  // 1회용 초기 상태 (로그아웃/설정 변경 직후 복원)
  var init = getInitState();
  if (init) {
    clearInitState();
    _fillForm(init.id, init.pw, init.autoCheck !== false);
    if (init.autoLogin) { _triggerAutoLogin(init.id, init.pw); }
    return;
  }

  // 자동 로그인
  var auto = getAutoLogin();
  if (auto) {
    _fillForm(auto.id, auto.pw, true);
    _triggerAutoLogin(auto.id, auto.pw);
  }
});
