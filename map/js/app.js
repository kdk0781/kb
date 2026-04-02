let currentData = [];
let groupedData = []; 
let filteredGroups = []; 

// 💡 페이징 및 무한 스크롤용 상태 변수
let currentPage = 1;
const groupsPerPage = 15; // 기본 상태에서 1페이지당 아파트 수
let isSearching = false;  
let searchPage = 1;       // 검색 시 무한 스크롤 페이지
const searchPerPage = 20; // 검색 시 한 번에 불러올 렌더링 개수
let scrollObserver = null;
let searchDebounceTimer;  // 모바일 타이핑 버벅거림 방지 타이머

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    setupScrollObserver();

    // 💡 1. 하나만 열리고 닫히는 아코디언 로직 적용
    document.getElementById('listBody').addEventListener('click', function(e) {
        const header = e.target.closest('.group-header');
        if (header) {
            const groupItem = header.parentElement;
            const isActive = groupItem.classList.contains('active');

            // 클릭된 것을 제외한 열려있는 모든 아코디언을 먼저 닫음
            document.querySelectorAll('.group-item.active').forEach(item => {
                if(item !== groupItem) item.classList.remove('active');
            });

            // 클릭한 항목 토글 (닫혀있었으면 열고, 열려있었으면 닫음)
            groupItem.classList.toggle('active', !isActive);
            
            // 아코디언 열릴 때 살짝 위로 스크롤 보정
            if (!isActive) {
                setTimeout(() => {
                    const rect = groupItem.getBoundingClientRect();
                    if (rect.top < 100 || rect.bottom > window.innerHeight) {
                        const topPos = groupItem.getBoundingClientRect().top + window.scrollY - 100;
                        window.scrollTo({ top: topPos, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
    });

    // 💡 2. 모바일 타이핑 버벅거림 방지 (디바운스 기법 적용)
    document.getElementById('searchInput').addEventListener('input', function(e) {
        clearTimeout(searchDebounceTimer);
        // 타이핑이 멈추고 300ms 후에만 검색 실행 (렌더링 과부하 방지)
        searchDebounceTimer = setTimeout(() => {
            const keyword = e.target.value.trim();
            filterData(keyword);
        }, 300); 
    });
});

// CSV 데이터 로드
function loadData() {
    fetch('excel/map.csv')
        .then(response => {
            if (!response.ok) throw new Error("파일 로드 실패");
            return response.arrayBuffer();
        })
        .then(buffer => {
            const decoder = new TextDecoder('euc-kr');
            const csvText = decoder.decode(buffer);
            parseCSV(csvText);
        })
        .catch(error => console.error("오류:", error));
}

// 데이터 파싱
function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const flatData = [];

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue; 
        if (currentLine.includes('전국은행연합회') || currentLine.includes('조견표') || currentLine.includes('절대 수정 금지') || currentLine.includes('대출상담사') || currentLine.includes('시도,시군구,읍면동')) continue;

        const col = currentLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
        if (col.length < 11 || !col[0]) continue;

        const regionStr = `${col[0]} ${col[1]} ${col[2]}`.replace(/\s+/g, ' ').trim();
        const aptName = col[3];
        
        const formatPrice = (val) => {
            const num = parseFloat(val.replace(/,/g, ''));
            return (isNaN(num) || num === 0) ? '-' : num.toLocaleString('ko-KR') + '만원';
        };

        const formatArea = (val) => {
            const num = parseFloat(val.replace(/,/g, ''));
            return isNaN(num) ? val : num.toString();
        };

        flatData.push({ 지역: regionStr, 아파트: aptName, 공급면적: formatArea(col[6]), 전용면적: formatArea(col[5]), 하한가: formatPrice(col[8]), 일반가: formatPrice(col[9]), 상한가: formatPrice(col[10]) });
    }

    const map = new Map();
    flatData.forEach(row => {
        const key = row.지역 + '|' + row.아파트;
        if (!map.has(key)) map.set(key, { 지역: row.지역, 아파트: row.아파트, rows: [] });
        map.get(key).rows.push(row);
    });

    groupedData = Array.from(map.values());
    filteredGroups = groupedData;
    isSearching = false;
    currentPage = 1;
    renderPage();   
}

// 검색 필터
function filterData(keyword) {
    if (!keyword) {
        isSearching = false;
        filteredGroups = groupedData;
    } else {
        isSearching = true; 
        const searchTerms = keyword.toLowerCase().split(/\s+/);
        filteredGroups = groupedData.filter(group => {
            const groupText = `${group.지역} ${group.아파트}`.toLowerCase();
            const rowsText = group.rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
            return searchTerms.every(term => (groupText + ' ' + rowsText).includes(term));
        });
    }
    
    // 검색 시 초기화
    currentPage = 1; 
    searchPage = 1;
    renderPage();
}

// HTML 생성 도우미 함수
function createGroupHTML(group) {
    let html = `
        <div class="group-item">
            <div class="group-header">
                <div class="group-title-wrap">
                    <span class="group-apt">${group.아파트}</span>
                    <span class="group-region">${group.지역}</span>
                </div>
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="group-content">
    `;
    group.rows.forEach(row => {
        html += `
            <div class="inner-row">
                <div class="inner-area">
                    <span><span class="area-label">공급</span>${row.공급면적}㎡</span>
                    <span><span class="area-label">전용</span>${row.전용면적}㎡</span>
                </div>
                <div class="inner-prices">
                    <div class="price-box low"><span class="price-label">하한가</span><span class="price-val">${row.하한가}</span></div>
                    <div class="price-box mid"><span class="price-label">일반가</span><span class="price-val">${row.일반가}</span></div>
                    <div class="price-box high"><span class="price-label">상한가</span><span class="price-val">${row.상한가}</span></div>
                </div>
            </div>
        `;
    });
    return html + `</div></div>`;
}

// 리스트 렌더링
function renderPage() {
    const listBody = document.getElementById('listBody');
    const pagination = document.getElementById('pagination');
    const sentinel = document.getElementById('scrollSentinel');
    
    listBody.innerHTML = '';

    if (filteredGroups.length === 0) {
        listBody.innerHTML = '<div style="padding:60px; text-align:center; color:#94a3b8; font-weight:500;">조건에 맞는 시세 정보가 없습니다.</div>';
        pagination.style.display = 'none';
        sentinel.style.display = 'none';
        return;
    }

    let groupsToRender = [];
    
    if (isSearching) {
        // 💡 3. 검색 시: 한 번에 수백개를 그려 뻗는 현상 방지 (무한 스크롤 적용)
        groupsToRender = filteredGroups.slice(0, searchPerPage);
        pagination.style.display = 'none';
        sentinel.style.display = 'block'; // 스크롤 센서 켬
    } else {
        // 기본 상태: 기존처럼 페이징 처리
        const startIndex = (currentPage - 1) * groupsPerPage;
        groupsToRender = filteredGroups.slice(startIndex, startIndex + groupsPerPage);
        pagination.style.display = 'flex';
        sentinel.style.display = 'none'; // 스크롤 센서 끔
        renderPagination(Math.ceil(filteredGroups.length / groupsPerPage));
    }

    listBody.innerHTML = groupsToRender.map(createGroupHTML).join('');
    if (!isSearching) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 무한 스크롤 추가 렌더링 함수
function appendSearchPage() {
    const startIndex = (searchPage - 1) * searchPerPage;
    const groupsToRender = filteredGroups.slice(startIndex, startIndex + searchPerPage);
    
    if (groupsToRender.length > 0) {
        const html = groupsToRender.map(createGroupHTML).join('');
        document.getElementById('listBody').insertAdjacentHTML('beforeend', html);
    }
}

// 무한 스크롤 옵저버 세팅 (화면 맨 밑으로 가면 다음 데이터 불러오기)
function setupScrollObserver() {
    const sentinel = document.getElementById('scrollSentinel');
    scrollObserver = new IntersectionObserver((entries) => {
        // 검색 중이고, 센서가 화면에 보이면
        if (entries[0].isIntersecting && isSearching) {
            if (searchPage * searchPerPage < filteredGroups.length) {
                searchPage++;
                appendSearchPage(); // 화면 버벅임 없이 다음 20개만 하단에 쏙 추가함
            }
        }
    }, { rootMargin: "200px" }); // 밑바닥에 닿기 200px 전부터 미리 로딩

    if (sentinel) scrollObserver.observe(sentinel);
}

// 페이징 (기본 상태 전용)
function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    if (totalPages <= 1) return;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    if (currentPage > 1) {
        const btn = document.createElement('button'); btn.className = 'page-btn'; btn.textContent = '◀';
        btn.onclick = () => { currentPage--; renderPage(); };
        pagination.appendChild(btn);
    }
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button'); btn.className = `page-btn ${i === currentPage ? 'active' : ''}`; btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderPage(); };
        pagination.appendChild(btn);
    }
    if (currentPage < totalPages) {
        const btn = document.createElement('button'); btn.className = 'page-btn'; btn.textContent = '▶';
        btn.onclick = () => { currentPage++; renderPage(); };
        pagination.appendChild(btn);
    }
}
