let deferredPrompt;

window.onload = function() {
  if (checkInAppBrowser()) return;
  
  // 최초 접속 시 토큰 검증 및 세션 스토리지 저장
  validateToken();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

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

  // ★ 고도화: 1회성 접속 시 'guest=true' 꼬리표를 달아 common.js에 고객 모드임을 알림
  document.getElementById('btnOneTime').addEventListener('click', () => {
	// ★ 고도화: 1회성 접속 시 브라우저에 '고객 모드' 강력한 락(Lock)을 걸어버림
	  document.getElementById('btnOneTime').addEventListener('click', () => {
		localStorage.setItem('kb_guest_mode', 'true'); // 고객 낙인!
		window.location.href = 'index.html'; // 꼬리표 없이 깔끔하게 원주소로 이동
	  });
  });
};

function validateToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('t');
  const mainCard = document.getElementById('mainCard');
  const errorCard = document.getElementById('errorCard');

  // 1. URL에 토큰이 있는 경우 (최초 접속)
  if (token) {
    try {
      const payload = JSON.parse(decodeURIComponent(atob(token)));
      if (Date.now() <= payload.exp) {
        // 검증 성공! 브라우저 메모리에 기록하고 주소창 세탁
        sessionStorage.setItem('kb_valid_share', 'true');
        window.history.replaceState(null, '', 'share.html');
        mainCard.classList.remove('hidden'); errorCard.classList.remove('active');
        return;
      }
    } catch (e) {}
  }

  // 2. URL에 토큰은 없지만, 방금 검증을 통과한 기록이 있는 경우 (앱 설치 시 에러 방지)
  if (sessionStorage.getItem('kb_valid_share') === 'true') {
    mainCard.classList.remove('hidden'); errorCard.classList.remove('active');
    return;
  }

  // 3. 둘 다 아니면 만료 에러
  mainCard.classList.add('hidden'); errorCard.classList.add('active');
}

function showInstallSuccess() {
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:var(--bg-page); text-align:center;">
      <div style="font-size:60px; margin-bottom:20px;">✅</div>
      <h2 style="font-size:22px; font-weight:800; color:var(--text-primary); margin-bottom:12px;">앱 설치가 시작되었습니다!</h2>
      <p style="font-size:15px; color:var(--text-secondary); line-height:1.6; word-break:keep-all;">이제 현재 브라우저 창을 닫으셔도 됩니다.<br><br>기기 홈 화면(바탕화면)에 생성된<br><b>'DSR 계산기'</b> 아이콘을 통해 접속해주세요.</p>
    </div>
  `;
}

// (checkInAppBrowser 함수는 기존과 완전히 동일하게 아래에 유지해 주세요)
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