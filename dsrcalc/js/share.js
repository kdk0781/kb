/* share.js — DSR 계산기 임시 링크 검증 + PWA 설치 안내
   ★ share.html 과 세트: 카드 3개 (loadingCard / mainCard / errorCard)
   ★ 모든 카드는 display:none 으로 시작 — 이 파일이 필요한 카드만 표시 */

var deferredPrompt = null;

// ─── 카드 전환 (1개만 표시) ───────────────────────────────────────────────────
function _showCard(id) {
  ['loadingCard','mainCard','errorCard'].forEach(function(cid) {
    var el = document.getElementById(cid);
    if (el) el.style.display = (cid === id) ? 'block' : 'none';
  });
}

// ─── 토큰 파싱 (URL-safe base64 + 구형 표준 base64 모두 처리) ─────────────────
function _parseToken(token) {
  // 시도 1: URL-safe base64 (js/admin.js 신형 — - _ 사용)
  try {
    var b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var p1 = JSON.parse(decodeURIComponent(atob(b64)));
    if (p1 && p1.exp) return p1;
  } catch(e1) {}

  // 시도 2: 구형 표준 base64 (이전 버전 호환)
  try {
    var p2 = JSON.parse(decodeURIComponent(atob(token)));
    if (p2 && p2.exp) return p2;
  } catch(e2) {}

  return null;
}

// ─── 토큰 검증 ───────────────────────────────────────────────────────────────
function validateToken() {
  var urlParams = new URLSearchParams(window.location.search);
  var token = urlParams.get('t');

  // 케이스 1: URL에 토큰 있음
  if (token) {
    var payload = _parseToken(token);
    if (payload && payload.exp && Date.now() <= payload.exp) {
      sessionStorage.setItem('kb_valid_share', 'true');
      window.history.replaceState(null, '', 'share.html');
      _showCard('mainCard');
    } else {
      _showCard('errorCard');
    }
    return;
  }

  // 케이스 2: 토큰 없지만 같은 세션에서 이미 검증됨
  // (PWA 설치 과정에서 페이지 재로드 케이스)
  if (sessionStorage.getItem('kb_valid_share') === 'true') {
    _showCard('mainCard');
    return;
  }

  // 케이스 3: 직접 접근 or 만료
  _showCard('errorCard');
}

// ─── 인앱 브라우저 감지 + 리다이렉트 ────────────────────────────────────────
function checkInAppBrowser() {
  var ua = navigator.userAgent.toLowerCase();
  var isKakao = ua.indexOf('kakaotalk') > -1;
  var isInApp  = isKakao ||
    ua.indexOf('line') > -1 ||
    ua.indexOf('inapp') > -1 ||
    ua.indexOf('instagram') > -1 ||
    ua.indexOf('facebook') > -1;

  if (!isInApp) return false;

  var currentUrl = location.href;

  // Android 카카오 → Chrome Intent 리다이렉트
  if (ua.indexOf('android') > -1 && isKakao) {
    location.href = 'intent://' +
      currentUrl.replace(/https?:\/\//i, '') +
      '#Intent;scheme=https;package=com.android.chrome;end';
    return true;
  }

  // 그 외 인앱 브라우저 → 안내 화면
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;padding:20px;background:#F4F6FB;text-align:center;">' +
    '<div style="font-size:50px;margin-bottom:20px;">\uD83E\uDDED</div>' +
    '<h2 style="font-size:20px;font-weight:800;color:#12203A;margin-bottom:12px;">' +
    '\uae30\ubcf8 \ube0c\ub77c\uc6b0\uc800\ub85c \uc5f4\uc5b4\uc8fc\uc138\uc694</h2>' +
    '<p style="font-size:14px;color:#485070;line-height:1.6;word-break:keep-all;margin-bottom:24px;">' +
    '\uc571 \ub0b4 \ube0c\ub77c\uc6b0\uc800\uc5d0\uc11c\ub294 \uc571 \uc124\uce58\uac00 \uc9c0\uc6d0\ub418\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.<br><br>' +
    '\uc6b0\uce21 \ud558\ub2e8\uc758 [\ub098\uce68\ubc18] \ub610\ub294 [\u22ee]\uc744 \ub208\ub7ec<br>' +
    '<b style="color:#3B82F6;">\'\ub2e4\ub978 \ube0c\ub77c\uc6b0\uc800\ub85c \uc5f4\uae30\'</b>\ub97c \uc120\ud0dd\ud574\uc8fc\uc138\uc694.</p>' +
    '<button onclick="(function(){var t=document.createElement(\'textarea\');' +
    'document.body.appendChild(t);t.value=\'' + currentUrl + '\';' +
    't.select();document.execCommand(\'copy\');document.body.removeChild(t);' +
    'alert(\'\ub9c1\ud06c\uac00 \ubcf5\uc0ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4.\');})()"' +
    ' style="padding:14px 24px;background:#1A2B5A;color:#fff;border-radius:12px;' +
    'font-weight:700;border:none;">' +
    '\uD83D\uDD17 \ud604\uc7ac \ub9c1\ud06c \ubcf5\uc0ac\ud558\uae30</button></div>';
  return true;
}

// ─── 설치 성공 화면 ───────────────────────────────────────────────────────────
function showInstallSuccess() {
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;padding:20px;background:var(--bg-page);text-align:center;">' +
    '<div style="font-size:60px;margin-bottom:20px;">\u2705</div>' +
    '<h2 style="font-size:22px;font-weight:800;color:var(--text-primary);margin-bottom:12px;">' +
    '\uc571 \uc124\uce58\uac00 \uc2dc\uc791\ub418\uc5c8\uc2b5\ub2c8\ub2e4!</h2>' +
    '<p style="font-size:15px;color:var(--text-secondary);line-height:1.6;word-break:keep-all;">' +
    '\uae30\uae30 \ud648 \ud654\uba74\uc5d0 \uc0dd\uc131\ub41c <b>\'DSR \uacc4\uc0b0\uae30\'</b> \uc544\uc774\ucf58\uc73c\ub85c \uc811\uc18d\ud574\uc8fc\uc138\uc694.</p>' +
    '</div>';
}

// ─── 메인 초기화 ─────────────────────────────────────────────────────────────
window.onload = function() {
  // 1. 인앱 브라우저 감지 (리다이렉트 시 return)
  if (checkInAppBrowser()) return;

  // 2. 로딩 카드 즉시 표시
  _showCard('loadingCard');

  // 3. 토큰 검증 (동기, 수ms 이내 완료)
  validateToken();

  // 4. PWA 설치 프롬프트 캐치
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  // 5. 설치 버튼
  var btnInstall = document.getElementById('btnInstall');
  if (btnInstall) {
    btnInstall.addEventListener('click', function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(result) {
          if (result.outcome === 'accepted') {
            deferredPrompt = null;
            showInstallSuccess();
          }
        });
      } else {
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          alert('\uc544\uc774\ud3f0 \ud558\ub2e8\uc758 [\uacf5\uc720] \ubc84\ud2bc\uc744 \ub204\ub978 \ud6c4\n[\ud648 \ud654\uba74\uc5d0 \ucd94\uac00]\ub97c \uc120\ud0dd\ud558\uc5ec \uc124\uce58\ud574\uc8fc\uc138\uc694.');
        } else {
          alert('\ube0c\ub77c\uc6b0\uc800 \uc124\uc815 \uba54\ub274(\uc6b0\uce21 \uc0c1\ub2e8 \u22ee)\uc5d0\uc11c\n\'\uc571 \uc124\uce58\' \ub610\ub294 \'\ud648 \ud654\uba74\uc5d0 \ucd94\uac00\'\ub97c \uc120\ud0dd\ud574\uc8fc\uc138\uc694.');
        }
      }
    });
  }

  // 6. 1회성 접속 버튼
  var btnOneTime = document.getElementById('btnOneTime');
  if (btnOneTime) {
    btnOneTime.addEventListener('click', function() {
      localStorage.setItem('kb_guest_mode', 'true');
      window.location.href = 'index.html';
    });
  }
};
