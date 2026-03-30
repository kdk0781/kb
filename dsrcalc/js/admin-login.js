/* =============================================================================
   js/admin-login.js — admin.html 전용 로그인 / 설정 변경 로직
   · getAdminConfig / saveAdminConfig : localStorage 기반 설정 저장
   · attemptLogin                     : 아이디·비밀번호 검증 → 세션 생성
   · changeAdminSettings              : 설정 변경 모달 열기
   · saveSettingsFromModal            : 비밀번호·URL·연락처 저장
   ★ 이 파일은 admin.html 에서만 사용합니다 (index.html 에는 js/admin.js 사용)
   ============================================================================= */

// ─── 초기 설정값 ─────────────────────────────────────────────────────────────
// ★ 배포 전 반드시 pw 를 변경하세요 (admin.html 설정 변경 모달에서도 변경 가능)
const DEFAULT_CONFIG = {
  id:      'admin',
  pw:      'admin',
  mainUrl: 'index.html',
  // 상담사 연락처: 입력 시 DSR 리포트에 워터마크로 삽입 / 빈 문자열이면 워터마크 없음
  phone:   ''
};

function getAdminConfig() {
  const stored = localStorage.getItem('kb_admin_config');
  return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
}
function saveAdminConfig(config) {
  localStorage.setItem('kb_admin_config', JSON.stringify(config));
}

// ─── 모달 유틸 ────────────────────────────────────────────────────────────────
let _modalCallback = null;

function showAlert(msg, icon = '⚠️', callback = null) {
  const modal = document.getElementById('customModal');
  document.getElementById('modalMsg').innerHTML   = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText  = icon;
  _modalCallback = callback;
  modal.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalConfirm').addEventListener('click', () => {
    document.getElementById('customModal').style.display = 'none';
    if (_modalCallback) { _modalCallback(); _modalCallback = null; }
  });
});

// ─── 로그인 ───────────────────────────────────────────────────────────────────
function attemptLogin() {
  const inputId = document.getElementById('adminId').value.trim();
  const inputPw = document.getElementById('adminPw').value.trim();
  const config  = getAdminConfig();

  if (inputId === config.id && inputPw === config.pw) {
    localStorage.removeItem('kb_guest_mode'); // 고객 낙인 초기화

    const sessionData = {
      isAuth:  true,
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24시간
      mainUrl: config.mainUrl
    };
    localStorage.setItem('kb_admin_session', JSON.stringify(sessionData));
    showAlert('관리자 로그인이 완료되었습니다.<br>대표 페이지로 이동합니다.', '✅',
      () => { window.location.href = config.mainUrl; });
  } else {
    showAlert('아이디 또는 비밀번호가 일치하지 않습니다.', '🚫');
  }
}

// 엔터키 로그인 지원
document.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    const customOpen   = document.getElementById('customModal')?.style.display   === 'flex';
    const settingsOpen = document.getElementById('settingsModal')?.style.display === 'flex';
    if (!customOpen && !settingsOpen) attemptLogin();
  }
});

// ─── 설정 변경 모달 ───────────────────────────────────────────────────────────
function changeAdminSettings() {
  const config = getAdminConfig();
  document.getElementById('setCurId').value   = '';
  document.getElementById('setCurPw').value   = '';
  document.getElementById('setNewPw').value   = '';
  document.getElementById('setNewUrl').value  = config.mainUrl;
  const phoneEl = document.getElementById('setNewPhone');
  if (phoneEl) phoneEl.value = config.phone || '';
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveSettingsFromModal() {
  const config   = getAdminConfig();
  const curId    = document.getElementById('setCurId').value.trim();
  const curPw    = document.getElementById('setCurPw').value.trim();
  const newPw    = document.getElementById('setNewPw').value.trim();
  const newUrl   = document.getElementById('setNewUrl').value.trim();
  const newPhone = document.getElementById('setNewPhone')?.value.trim() ?? '';
  const phoneOk  = newPhone === '' || /^010-\d{4}-\d{4}$/.test(newPhone);

  if (curId === config.id && curPw === config.pw) {
    if (newPhone && !phoneOk) {
      showAlert('연락처 형식이 올바르지 않습니다.<br><span style="font-size:12px;">예: 010-1234-5678</span>', '⚠️');
      return;
    }
    saveAdminConfig({
      id:      config.id,
      pw:      newPw    || config.pw,
      mainUrl: newUrl   || config.mainUrl,
      phone:   newPhone !== '' ? newPhone : (config.phone || '')
    });
    closeSettingsModal();
    showAlert('관리자 설정이 성공적으로 변경되었습니다.', '✅');
  } else {
    showAlert('현재 아이디 또는 비밀번호가 일치하지 않습니다.', '🚫');
  }
}
