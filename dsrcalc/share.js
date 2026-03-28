let deferredPrompt;
let targetUrl = 'index.html'; // 기본값

window.onload = function() {
  // 1. 인앱 브라우저(카카오톡 등) 감지 및 외부 브라우저(사파리/크롬) 유도
  if (checkInAppBrowser()) return; // 인앱 브라우저면 아래 로직 중단

  // 2. 토큰 유효성 검증 및 주소창 URL 마스킹
  validateToken();
  
  // 3. PWA 설치 프롬프트 인터셉트
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // 4. 설치 버튼 이벤트
  document.getElementById('btnInstall').addEventListener('click', async () => {
    if (deferredPrompt) {
      // 자동 설치 지원 환경 (안드로이드)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        alert('설치가 진행됩니다. 홈 화면에서 앱을 실행해주세요.');
        window.location.href = targetUrl; 
      }
    } else {
      // 자동 설치 미지원 환경 (iOS 아이폰 등)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert("아이폰 하단의 [공유(네모에 화살표)] 버튼을 누른 후\n[홈 화면에 추가]를 선택하여 설치해주세요.");
        // 주의: 이 시점에는 이미 주소창이 index.html로 마스킹되어 있으므로, 
        // 공유버튼을 누르면 정상적으로 index.html이 캡처됩니다.
      } else {
        alert("브라우저 설정 메뉴(우측 상단 ⁝)에서\n'앱 설치' 또는 '홈 화면에 추가'를 선택해주세요.");
      }
    }
  });

  // 5. 1회성 접속 버튼 이벤트
  document.getElementById('btnOneTime').addEventListener('click', () => {
    window.location.href = targetUrl;
  });
};

// ─── 인앱 브라우저 탈출 로직 ───
function checkInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  const isKakao = ua.indexOf('kakaotalk') > -1;
  const isLine = ua.indexOf('line') > -1;
  const isInApp = isKakao || isLine || ua.indexOf('inapp') > -1 || ua.indexOf('instagram') > -1 || ua.indexOf('facebook') > -1;

  if (isInApp) {
    const currentUrl = location.href;
    
    // 안드로이드 카카오톡/라인의 경우 크롬 브라우저로 강제 이동 (Intent 스킴)
    if (ua.indexOf('android') > -1 && isKakao) {
      location.href = 'intent://' + currentUrl.replace(/https?:\/\//i, '') + '#Intent;scheme=https;package=com.android.chrome;end';
      return true;
    }
    
    // iOS(아이폰) 또는 강제 이동 실패 시 보여줄 '외부 브라우저 유도 화면'
    document.body.innerHTML = `
      <div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:#F4F6FB; text-align:center;">
        <div style="font-size:50px; margin-bottom:20px;">🧭</div>
        <h2 style="font-size:20px; font-weight:800; color:#12203A; margin-bottom:12px;">기본 브라우저로 열어주세요</h2>
        <p style="font-size:14px; color:#485070; line-height:1.6; word-break:keep-all; margin-bottom:24px;">
          카카오톡 등 앱 내 브라우저에서는<br><b>앱 설치(홈 화면 추가)</b>가 지원되지 않습니다.<br><br>
          화면 우측 하단의 <b>[나침반(사파리) 아이콘]</b> 또는 <b>[⁝]</b>을 눌러<br>
          <b style="color:#3B82F6;">'다른 브라우저로 열기'</b>를 선택해주세요.
        </p>
        <button onclick="copyAndAlert('${currentUrl}')" style="padding:14px 24px; background:#1A2B5A; color:#fff; border-radius:12px; font-weight:700; border:none; box-shadow:0 4px 12px rgba(26,43,90,0.2);">🔗 현재 링크 복사하기</button>
      </div>
    `;
    
    // 링크 복사 함수 전역 등록 (안내 화면용)
    window.copyAndAlert = function(url) {
      const t = document.createElement("textarea");
      document.body.appendChild(t);
      t.value = url;
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
      alert("링크가 복사되었습니다.\n사파리(Safari)나 크롬(Chrome) 주소창에 붙여넣기 해주세요.");
    };
    
    return true;
  }
  return false;
}

// ─── 토큰 검증 및 URL 마스킹 로직 ───
function validateToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('t');
  const mainCard = document.getElementById('mainCard');
  const errorCard = document.getElementById('errorCard');

  if (!token) {
    showError(); return;
  }

  try {
    const payload = JSON.parse(decodeURIComponent(atob(token)));
    
    if (Date.now() > payload.exp) {
      showError();
    } else {
      targetUrl = payload.url;
      
      // ★ 핵심: 주소창의 긴 URL을 'index.html'로 강제 변경 
      // 사용자 화면은 그대로지만 브라우저는 현재 위치를 index.html로 인식함
      const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
      window.history.replaceState(null, '', baseUrl + 'index.html');

      mainCard.classList.remove('hidden');
      errorCard.classList.remove('active');
    }
  } catch (e) {
    showError();
  }

  function showError() {
    mainCard.classList.add('hidden');
    errorCard.classList.add('active');
  }
}