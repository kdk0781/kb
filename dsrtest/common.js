/**
 * [DSR Calculator System] 
 * Version: 260323_F (Full Integration)
 * Description: 다크모드 텍스트 컬러 완벽 보정 및 동적 요소 스타일 자동화
 */

const DSR_App = {
    // [1] 다크모드 전용 컬러 강제 주입 로직
    applyDarkStyles: function() {
        const isDark = document.body.classList.contains('dark');
        if (!isDark) return;

        // 보정이 필요한 모든 타겟 추출 (입력창, 팝업 텍스트, 표 데이터)
        const targets = document.querySelectorAll(`
            input, select, textarea, 
            .main-text, .sub-text, 
            .notice-header, td, .total-amount
        `);

        targets.forEach(el => {
            // 브라우저의 Autofill 및 기본 스타일을 무시하고 흰색 강제
            el.style.setProperty('color', '#ffffff', 'important');
            el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
            
            // 인풋 요소일 경우 자동완성 배경색 전이 방지
            if (el.tagName === 'INPUT') {
                el.style.setProperty('transition', 'background-color 5000s ease-in-out 0s', 'important');
            }
        });
        console.log("260323_F: 다크모드 시각적 보정 완료");
    },

    // [2] 동적 요소 감시자 (MutationObserver)
    // '부채 항목 추가' 버튼 클릭으로 새로운 카드가 생길 때마다 자동으로 스타일 적용
    initDynamicObserver: function() {
        const targetNode = document.querySelector('.loan-list-container') || document.body;
        
        const config = { childList: true, subtree: true };
        
        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // 새로운 노드가 추가되면 50ms 후 스타일 재보정 (렌더링 시간 고려)
                    setTimeout(() => this.applyDarkStyles(), 50);
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
    },

    // [3] 앱 초기화 및 이벤트 바인딩
    startup: function() {
        // DOM 로드 즉시 실행
        this.applyDarkStyles();
        this.initDynamicObserver();

        // 테마 토글 버튼이 있을 경우 연동
        const themeBtn = document.querySelector('.theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                // 클래스 변경 시간을 고려하여 지연 실행
                setTimeout(() => this.applyDarkStyles(), 100);
            });
        }

        // 팝업(noticePopup) 노출 여부 상시 체크
        const popup = document.getElementById('noticePopup');
        if (popup) {
            const popupObserver = new MutationObserver(() => this.applyDarkStyles());
            popupObserver.observe(popup, { attributes: true, attributeFilter: ['style', 'class'] });
        }
    }
};

// [실행 영역]
document.addEventListener('DOMContentLoaded', () => {
    DSR_App.startup();
});

// 페이지의 모든 리소스(이미지 등)가 로드된 후 최종 1회 더 실행
window.onload = () => {
    DSR_App.applyDarkStyles();
};
