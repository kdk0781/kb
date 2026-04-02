let currentData = [];
let groupedData = []; // 아파트별로 묶인 데이터
let filteredGroups = []; // 검색/필터링된 아파트 그룹
let currentPage = 1;
const groupsPerPage = 15; // 한 페이지에 보여줄 아파트 탭(그룹) 개수
let isSearching = false;  // 검색 중인지 여부 상태값

document.addEventListener("DOMContentLoaded", () => {
    loadData();

    // 💡 이벤트 위임 (이벤트 하나로 모든 탭의 클릭 처리)
    document.getElementById('listBody').addEventListener('click', function(e) {
        const header = e.target.closest('.group-header');
        if (header) {
            const groupItem = header.parentElement;
            groupItem.classList.toggle('active');
        }
    });

    document.getElementById('searchInput').addEventListener('input', function(e) {
        const keyword = e.target.value.trim();
        filterData(keyword);
    });
});

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
        .catch(error => {
            console.error("오류:", error);
        });
}

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
            const cleanVal = val.replace(/,/g, '');
            const num = parseFloat(cleanVal);
            if (isNaN(num) || num === 0) return '-';
            return num.toLocaleString('ko-KR') + '만원';
        };

        const formatArea = (val) => {
            const cleanVal = val.replace(/,/g, '');
            const num = parseFloat(cleanVal);
            return isNaN(num) ? val : num.toString();
        };

        flatData.push({
            지역: regionStr,
            아파트: aptName,
            공급면적: formatArea(col[6]),
            전용면적: formatArea(col[5]),
            하한가: formatPrice(col[8]),
            일반가: formatPrice(col[9]),
            상한가: formatPrice(col[10])
        });
    }

    // 💡 데이터를 '지역 + 아파트' 기준으로 그룹화(묶음)
    const map = new Map();
    flatData.forEach(row => {
        const key = row.지역 + '|' + row.아파트;
        if (!map.has(key)) {
            map.set(key, { 지역: row.지역, 아파트: row.아파트, rows: [] });
        }
        map.get(key).rows.push(row);
    });

    groupedData = Array.from(map.values());
    filteredGroups = groupedData;
    currentPage = 1;
    isSearching = false;
    renderPage();   
}

function filterData(keyword) {
    if (!keyword) {
        isSearching = false;
        filteredGroups = groupedData;
    } else {
        isSearching = true; // 검색어 입력 시 검색 상태 활성화
        const searchTerms = keyword.toLowerCase().split(/\s+/);
        
        filteredGroups = groupedData.filter(group => {
            // 그룹 정보(아파트, 지역)와 내부의 평수/가격 정보를 모두 문자열로 합쳐 강력한 검색 지원
            const groupText = `${group.지역} ${group.아파트}`.toLowerCase();
            const rowsText = group.rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
            const combinedText = groupText + ' ' + rowsText;
            
            return searchTerms.every(term => combinedText.includes(term));
        });
    }
    currentPage = 1;
    renderPage();
}

function renderPage() {
    const listBody = document.getElementById('listBody');
    const pagination = document.getElementById('pagination');
    listBody.innerHTML = '';

    if (filteredGroups.length === 0) {
        listBody.innerHTML = '<div style="padding:60px; text-align:center; color:#94a3b8; font-weight:500;">조건에 맞는 시세 정보가 없습니다.</div>';
        pagination.style.display = 'none';
        return;
    }

    let groupsToRender = [];
    
    // 💡 핵심: 검색 상태에 따른 분기 처리
    if (isSearching) {
        // 검색 중: 전체 결과 한 번에 표출 (스크롤 방식)
        groupsToRender = filteredGroups;
        pagination.style.display = 'none'; // 페이징 숨김
    } else {
        // 기본 상태: 지정된 개수만큼 페이징 처리
        const startIndex = (currentPage - 1) * groupsPerPage;
        const endIndex = startIndex + groupsPerPage;
        groupsToRender = filteredGroups.slice(startIndex, endIndex);
        pagination.style.display = 'flex'; // 페이징 노출
        renderPagination(Math.ceil(filteredGroups.length / groupsPerPage));
    }

    // 그룹별 아코디언 HTML 렌더링
    groupsToRender.forEach(group => {
        const item = document.createElement('div');
        item.className = 'group-item';

        // 1. 헤더 영역 (클릭 가능)
        let html = `
            <div class="group-header">
                <div class="group-title-wrap">
                    <span class="group-apt">${group.아파트}</span>
                    <span class="group-region">${group.지역}</span>
                </div>
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="group-content">
        `;

        // 2. 내부 콘텐츠 영역 (해당 아파트의 평형 및 가격)
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

        html += `</div>`; // .group-content 끝
        item.innerHTML = html;
        listBody.appendChild(item);
    });

    if (!isSearching) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '◀';
        prevBtn.onclick = () => { currentPage--; renderPage(); };
        pagination.appendChild(prevBtn);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderPage(); };
        pagination.appendChild(btn);
    }

    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '▶';
        nextBtn.onclick = () => { currentPage++; renderPage(); };
        pagination.appendChild(nextBtn);
    }
}
