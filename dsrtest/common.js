/* [DSR 정밀 진단 계산기 - 통합 관리 고도화 스크립트] */

const NOTICE_VERSION = "0781_1"; 
let lastFocusId = null;
let loanCount = 0;

window.onload = function() {
    initNotice();
    addLoan();
    initThemeObserver();
    // 모달 확인 버튼 리스너
    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) confirmBtn.onclick = handleModalConfirm;
};

// [테마 감지] 시스템 설정 변경 시 브라우저 상단바 색상 동기화
function initThemeObserver() {
    const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (isDark) => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#121212' : '#f4f7f9');
    };
    updateTheme(themeMedia.matches);
    themeMedia.addEventListener('change', (e) => updateTheme(e.matches));
}

// [공지사항 로직]
function initNotice() {
    const notice = document.getElementById('noticePopup');
    if (localStorage.getItem('hideNotice') !== NOTICE_VERSION) {
        notice.style.display = 'flex';
    }
}
function closeNotice() { document.getElementById('noticePopup').style.display = 'none'; }
function closeNoticeForever() {
    localStorage.setItem('hideNotice', NOTICE_VERSION);
    closeNotice();
}

// [기존 금융 로직 보존] - 수정 없이 원복 상태 유지
function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, "");
    obj.value = val.length > 0 ? Number(val).toLocaleString() : "";
}

// ... (기존 addLoan, calculateTotalDSR, generateSchedule 함수들 전체 포함)

// [알림 모달 제어]
function showAlert(msg, focusId = null) {
    document.getElementById('modalMsg').innerHTML = msg;
    lastFocusId = focusId;
    document.getElementById('customModal').style.display = 'flex';
}
function handleModalConfirm() {
    document.getElementById('customModal').style.display = 'none';
    if (lastFocusId) {
        const el = document.getElementById(lastFocusId);
        if (el) el.focus();
    }
}
