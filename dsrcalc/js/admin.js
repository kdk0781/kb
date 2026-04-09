/* =============================================================================
   DSR 계산기 — 관리자 로그인 · admin.js  VER 2026.06
   ─────────────────────────────────────────────────────────────────────────────
   ★ 자동 로그인 / 기억하기 고도화 흐름

   [A] 자동 로그인 체크박스 ON + 로그인 성공
       → kb_admin_autologin 에 { id, pw, enabled:true } 저장
       → 다음 접속 시 페이지 로드되자마자 자동 로그인

   [B] 자동 로그인 체크박스 OFF + 로그인 성공
       → kb_admin_autologin 삭제
       → 다음 접속 시 빈 화면

   [C] 로그아웃 (common.js proceedAdminLogout 호출)
       → kb_admin_init_state 에 { id, pw, autoCheck:true } 저장 후 admin.html 이동
       → 로그인 페이지 로드 시 해당 값으로 필드·체크박스 복원

   [D] 관리자 설정 변경 완료
       → 기존 세션 종료 + kb_admin_init_state 에 새 id/pw 저장 후 admin.html 이동
       → 로그인 페이지 로드 시 새 자격증명으로 필드 채움 + 체크박스 체크
   ============================================================================= */

const _AUTOLOGIN_KEY  = 'kb_admin_autologin';   // { id, pw, enabled }
const _INIT_STATE_KEY = 'kb_admin_init_state';   // { id, pw, autoCheck } — 1회용

// ─── 관리자 설정 ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  id:      'admin',
  pw:      'admin',
  mainUrl: 'index.html',
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

function showAlert(msg, icon = '⚠️', callback = null) {
  const modal = document.getElementById('customModal');
  document.getElementById('modalMsg').innerHTML = msg.replace(/\n/g, '<br>');
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
    const raw = localStorage.getItem(_AUTOLOGIN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.enabled ? data : null;
  } catch { return null; }
}

// ─── 초기 상태 (1회용 — 로그아웃/설정변경 후 필드 복원) ──────────────────────
function getInitState() {
  try {
    const raw = localStorage.getItem(_INIT_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearInitState() {
  localStorage.removeItem(_INIT_STATE_KEY);
}

// ─── 페이지 로드 초기화 ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 모달 확인 버튼
  document.getElementById('modalConfirm').addEventListener('click', () => {
    document.getElementById('customModal').style.display = 'none';
    if (_modalCallback) { _modalCallback(); _modalCallback = null; }
  });

  // ── 1회용 초기 상태 처리 (로그아웃 또는 설정 변경 직후)
  const initState = getInitState();
  if (initState) {
    clearInitState(); // 1회만 사용
    _fillForm(initState.id, initState.pw, initState.autoCheck !== false);
    // 자동 로그인이 활성화돼 있던 경우 자동 시도
    if (initState.autoLogin) {
      _triggerAutoLogin(initState.id, initState.pw);
    }
    return; // 자동로그인 중복 실행 방지
  }

  // ── 자동 로그인 처리 (일반 접속)
  const auto = getAutoLogin();
  if (auto) {
    _fillForm(auto.id, auto.pw, true);
    _triggerAutoLogin(auto.id, auto.pw);
  }
});

/** 폼 필드 + 체크박스 채우기 */
function _fillForm(id, pw, checkAuto) {
  const idEl  = document.getElementById('adminId');
  const pwEl  = document.getElementById('adminPw');
  const chkEl = document.getElementById('autoLoginChk');
  if (idEl)  idEl.value   = id  || '';
  if (pwEl)  pwEl.value   = pw  || '';
  if (chkEl) chkEl.checked = !!checkAuto;
}

/** 자동 로그인 배지 표시 후 로그인 실행 */
function _triggerAutoLogin(id, pw) {
  const card = document.querySelector('.admin-card');
  if (!card) return;

  // 배지 삽입
  const badge = document.createElement('div');
  badge.className = 'admin-auto-badge';
  badge.innerHTML = '⚡ 자동 로그인 중...';
  const loginBtn = document.querySelector('.btn-login');
  if (loginBtn) card.insertBefore(badge, loginBtn);

  setTimeout(() => {
    _doLogin(id, pw);
  }, 700); // 짧은 딜레이로 배지가 보이게
}

// ─── 로그인 로직 ─────────────────────────────────────────────────────────────
function attemptLogin() {
  const id  = document.getElementById('adminId').value.trim();
  const pw  = document.getElementById('adminPw').value.trim();
  _doLogin(id, pw);
}

function _doLogin(id, pw) {
  const config = getAdminConfig();
  const chk    = document.getElementById('autoLoginChk')?.checked;

  if (id === config.id && pw === config.pw) {
    // ── 자동 로그인 저장 여부
    if (chk) {
      saveAutoLogin(id, pw);
    } else {
      clearAutoLogin();
    }

    localStorage.removeItem('kb_guest_mode');
    const sessionData = {
      isAuth: true,
      expires: Date.now() + 24 * 60 * 60 * 1000,
      mainUrl: config.mainUrl,
    };
    localStorage.setItem('kb_admin_session', JSON.stringify(sessionData));

    showAlert('관리자 로그인이 완료되었습니다.<br>대표 페이지로 이동합니다.', '✅', () => {
      window.location.href = config.mainUrl;
    });
  } else {
    // 자동 로그인 배지 제거
    document.querySelector('.admin-auto-badge')?.remove();
    showAlert('아이디 또는 비밀번호가 일치하지 않습니다.', '🚫');
  }
}

// ─── 엔터키 로그인 ────────────────────────────────────────────────────────────
document.addEventListener('keypress', function (e) {
  if (e.key !== 'Enter') return;
  const customOpen   = document.getElementById('customModal')?.style.display === 'flex';
  const settingsOpen = document.getElementById('settingsModal')?.style.display === 'flex';
  if (customOpen || settingsOpen) return;
  attemptLogin();
});

// ─── 관리자 설정 변경 ─────────────────────────────────────────────────────────
function changeAdminSettings() {
  const config = getAdminConfig();
  document.getElementById('setCurId').value  = '';
  document.getElementById('setCurPw').value  = '';
  document.getElementById('setNewPw').value  = '';
  document.getElementById('setNewUrl').value = config.mainUrl;
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveSettingsFromModal() {
  const config = getAdminConfig();
  const curId  = document.getElementById('setCurId').value.trim();
  const curPw  = document.getElementById('setCurPw').value.trim();
  const newPw  = document.getElementById('setNewPw').value.trim();
  const newUrl = document.getElementById('setNewUrl').value.trim();

  if (curId !== config.id || curPw !== config.pw) {
    showAlert('현재 아이디 또는 비밀번호가 일치하지 않습니다.', '🚫');
    return;
  }

  const finalPw  = newPw  !== '' ? newPw  : config.pw;
  const finalUrl = newUrl !== '' ? newUrl : config.mainUrl;
  const newConfig = { id: config.id, pw: finalPw, mainUrl: finalUrl };

  saveAdminConfig(newConfig);

  // ── 세션 종료 + 자동로그인 갱신
  localStorage.removeItem('kb_admin_session');

  // 자동로그인이 켜져 있었다면 새 비번으로 갱신
  const autoLogin = getAutoLogin();
  if (autoLogin) {
    saveAutoLogin(newConfig.id, finalPw);
  }

  // ── 로그인 페이지에 1회용 초기 상태 설정 (새 자격증명 + 체크박스 ON + 자동로그인 플래그)
  localStorage.setItem(_INIT_STATE_KEY, JSON.stringify({
    id:        newConfig.id,
    pw:        finalPw,
    autoCheck: true,          // 체크박스 체크된 상태로 복원
    autoLogin: true,          // 페이지 로드 시 자동 로그인 실행
  }));

  closeSettingsModal();

  showAlert(
    '관리자 설정이 변경되었습니다.<br>' +
    '<span style="font-size:12px;">변경된 계정으로 자동 로그인합니다.</span>',
    '✅',
    () => {
      // admin.html로 이동 (init_state 감지 → 자동 로그인)
      const base = window.location.href.split('?')[0].split('#')[0];
      window.location.href = base;
    }
  );
}
