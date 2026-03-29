// 초기 관리자 설정값 (localStorage에 없으면 기본값 사용)
const DEFAULT_CONFIG = {
  id: 'Admin',
  pw: '0781',
  mainUrl: 'index.html' // 절대경로에서 상대경로로 유지
};

function getAdminConfig() {
  const stored = localStorage.getItem('kb_admin_config');
  return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
}

function saveAdminConfig(config) {
  localStorage.setItem('kb_admin_config', JSON.stringify(config));
}

// ─── 커스텀 모달 알림 로직 ───
let _modalCallback = null;

function showAlert(msg, icon = "⚠️", callback = null) {
  const modal = document.getElementById('customModal');
  document.getElementById('modalMsg').innerHTML = msg.replace(/\n/g, '<br>');
  document.getElementById('modalIcon').innerText = icon;
  _modalCallback = callback;
  modal.style.display = 'flex';
}

// 공통 모달 확인 버튼 이벤트
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalConfirm').addEventListener('click', () => {
    document.getElementById('customModal').style.display = 'none';
    if (_modalCallback) {
      _modalCallback();
      _modalCallback = null;
    }
  });
});

// ─── 로그인 로직 ───
function attemptLogin() {
  const inputId = document.getElementById('adminId').value.trim();
  const inputPw = document.getElementById('adminPw').value.trim();
  const config = getAdminConfig();

 if (inputId === config.id && inputPw === config.pw) {
    localStorage.removeItem('kb_guest_mode'); // ★ 이 한 줄 꼭 추가!
    
    const sessionData = { isAuth: true, expires: Date.now() + (24 * 60 * 60 * 1000), mainUrl: config.mainUrl };

    localStorage.setItem('kb_admin_session', JSON.stringify(sessionData));
    showAlert('관리자 로그인이 완료되었습니다.<br>대표 페이지로 이동합니다.', '✅', () => { window.location.href = config.mainUrl; });
  } else {
    showAlert('아이디 또는 비밀번호가 일치하지 않습니다.', '🚫');
  }
}

// 엔터키 로그인 지원
document.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    // 모달이 열려있을 땐 엔터키로 로그인 시도 방지
    if (document.getElementById('customModal').style.display === 'flex' || 
        document.getElementById('settingsModal').style.display === 'flex') return;
    attemptLogin();
  }
});

// ─── 관리자 설정 변경 로직 (모달 폼) ───
function changeAdminSettings() {
  const config = getAdminConfig();
  
  // 모달 입력창 초기화
  document.getElementById('setCurId').value = '';
  document.getElementById('setCurPw').value = '';
  document.getElementById('setNewPw').value = '';
  document.getElementById('setNewUrl').value = config.mainUrl;
  
  // 모달 띄우기
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveSettingsFromModal() {
  const config = getAdminConfig();
  const curId = document.getElementById('setCurId').value.trim();
  const curPw = document.getElementById('setCurPw').value.trim();
  const newPw = document.getElementById('setNewPw').value.trim();
  const newUrl = document.getElementById('setNewUrl').value.trim();

  // 기존 아이디/비번 인증 확인
  if (curId === config.id && curPw === config.pw) {
    const finalPw = newPw !== '' ? newPw : config.pw;
    const finalUrl = newUrl !== '' ? newUrl : config.mainUrl;
    
    saveAdminConfig({ id: config.id, pw: finalPw, mainUrl: finalUrl });
    closeSettingsModal();
    showAlert('관리자 설정이 성공적으로 변경되었습니다.', '✅');
  } else {
    showAlert('현재 아이디 또는 비밀번호가 일치하지 않습니다.', '🚫');
  }
}
