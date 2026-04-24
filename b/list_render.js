document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 데이터 모델 (나중에 메뉴가 추가되면 이 배열만 수정하면 됩니다)
    const kbLinks = [
        { title: "고객확인제도(CDD/EDD)", url: "../cddedd.html" },
        { title: "대출 상담시 체크사항", url: "../check_list.html" },
        { title: "주택임대차보호법 시행령 개정안", url: "../20210511.html" },
        { title: "담보회수율", url: "../area/index.html" },
        { title: "홈택스 소득공제 카드 출력방법", url: "../card.html" },
        { title: "스타뱅킹 장기미사용 해지", url: "../longterm.html" },
        { title: "특약문구", url: "../contract.html" },
        { title: "다운로드", url: "../down.html" },
        { title: "임대차 정보제공 다운로드", url: "../officetels.html" },
        { title: "251013가계부채FAQ", url: "../FAQ/index.html" },
        { title: "이자계산기", url: "../calc.html" },
        { title: "DSR계산기", url: "../dsr/index.html" },
        { title: "DTI계산기", url: "../dti.html" },
        { title: "국민은행 부수거래1", url: "../check.html" },
        { title: "국민은행 부수거래2", url: "../kb_check.html" },
        { title: "담보,전세 금리", url: "../interest/index.html" },
        { title: "시세표", url: "../map/index.html" }
    ];

    // 2. 리스트를 렌더링하는 함수
    function renderList(data, targetId) {
        const listContainer = document.getElementById(targetId);
        
        // 타겟 요소가 없거나 데이터가 없으면 함수 종료 (에러 방지)
        if (!listContainer || !data.length) return;

        // 성능 최적화를 위한 가상 DOM (DocumentFragment) 생성
        const fragment = document.createDocumentFragment();

        // 데이터 배열을 순회하며 HTML 요소 생성
        data.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            
            a.href = item.url;
            a.textContent = item.title;
            
            // 링크 클릭 시 화면이 부드럽게 넘어가도록 하려면 target="_self" 등 속성 추가 가능
            
            li.appendChild(a);
            fragment.appendChild(li);
        });

        // 완성된 가상 DOM을 실제 화면(ul)에 한 번에 삽입
        listContainer.appendChild(fragment);
    }

    // 3. 함수 실행
    renderList(kbLinks, 'kbLinkList');
});