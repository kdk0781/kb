let deferredPrompt;
let targetUrl = '';

window.onload = function() {
  validateToken();
  
  // PWA 설치 프롬프트 인터셉트
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  document.getElementById('btnInstall').addEventListener('click', async () => {
    if (deferredPrompt) {
      // 자동 설치 지원 환경 (Android Chrome 등)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        alert('설치가 진행됩니다. 설치 완료 후 앱 아이콘을 통해 실행해주세요.');
        window.location.href = targetUrl; 
      }
    } else {
      // 자동 설치 미지원 환경 (iOS Safari, PC 등) 수동 안내
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert("아이폰/아이패드 환경에서는 하단의 [공유] 버튼을 누른 후 [홈 화면에 추가]를 선택하여 설치해주세요.");
        window.location.href = targetUrl;
      } else {
        alert("브라우저 설정 메뉴(우측 상단 ⁝ 또는 ≡)에서 '앱 설치' 또는 '바로가기 만들기'를 선택하여 설치해주세요.");
        window.location.href = targetUrl;
      }
    }
  });

  document.getElementById('btnOneTime').addEventListener('click', () => {
    window.location.href = targetUrl;
  });
};

function validateToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('t');
  const mainCard = document.getElementById('mainCard');
  const errorCard = document.getElementById('errorCard');

  if (!token) {
    showError(); return;
  }

  try {
    // Base64 디코딩 후 JSON 파싱
    const payload = JSON.parse(decodeURIComponent(atob(token)));
    
    // 유효시간(24시간) 체크
    if (Date.now() > payload.exp) {
      showError();
    } else {
      targetUrl = payload.url;
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