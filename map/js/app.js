// 전역 상태 변수
let currentData = [];       // 현재 불러온 전체 데이터
let filteredData = [];      // 검색으로 필터링된 데이터
let currentHeaders = [];    // CSV 컬럼 헤더
let currentPage = 1;
const rowsPerPage = 50;     // 한 페이지에 보여줄 줄 수

const filePaths = {
    '서울경기인천': 'map.csv',
    '그외지역': 'map.csv'
};

document.addEventListener("DOMContentLoaded", () => {
    loadRegion('서울경기인천');

    // 검색창 입력 이벤트 리스너 (실시간 검색)
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const keyword = e.target.value.toLowerCase().trim();
        filterData(keyword);
    });
});

function loadRegion(regionKey) {
    const statusMsg = document.getElementById('statusMessage');
    const searchInput = document.getElementById('searchInput');
    
    // 버튼 UI 업데이트
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event && event.target ? event.target.classList.add('active') : document.querySelector('.tab-btn').classList.add('active');

    statusMsg.textContent = "데이터를 불러오는 중입니다...";
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    searchInput.value = ''; // 탭 변경 시 검색어 초기화

    const filePath = filePaths[regionKey];

    fetch(filePath)
        .then(response => {
            if (!response.ok) throw new Error("파일 로드 실패");
            return response.arrayBuffer();
        })
        .then(buffer => {
            const decoder = new TextDecoder('euc-kr');
            const csvText = decoder.decode(buffer);
            
            parseCSV(csvText);
            statusMsg.textContent = `[${regionKey}] 총 ${currentData.length.toLocaleString()}건의 데이터가 있습니다.`;
        })
        .catch(error => {
            console.error(error);
            statusMsg.textContent = "데이터를 불러오지 못했습니다. 파일 경로를 확인해주세요.";
            statusMsg.style.color = "red";
        });
}

// CSV 데이터를 JSON 배열로 변환
function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const ESTIMATED_ROWS_ABOVE_HEADER = 5; 

    if (lines.length <= ESTIMATED_ROWS_ABOVE_HEADER) return;

    // 헤더 파싱
    currentHeaders = lines[ESTIMATED_ROWS_ABOVE_HEADER].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const parsedData = [];
    for (let i = ESTIMATED_ROWS_ABOVE_HEADER + 1; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue;

        const obj = {};
        const currentLineArr = currentLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

        let isEmptyRow = true;
        currentHeaders.forEach((header, index) => {
            let value = currentLineArr[index] || '';
            value = value.replace(/^"|"$/g, '').trim();
            obj[header] = value;
            if (value && value !== '0.0') isEmptyRow = false; // 빈 데이터 행 걸러내기
        });
        
        if (!isEmptyRow) parsedData.push(obj);
    }

    currentData = parsedData;
    filteredData = parsedData;
    currentPage = 1;
    renderPage();
}

// 검색어 필터링
function filterData(keyword) {
    if (!keyword) {
        filteredData = currentData;
    } else {
        filteredData = currentData.filter(row => {
            // 행의 모든 값 중 하나라도 검색어를 포함하면 반환
            return Object.values(row).some(value => 
                String(value).toLowerCase().includes(keyword)
            );
        });
    }
    currentPage = 1;
    renderPage();
    
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = `검색 결과: ${filteredData.length.toLocaleString()}건`;
}

// 특정 페이지의 데이터 렌더링
function renderPage() {
    const container = document.getElementById('tableContainer');
    container.innerHTML = '';

    if (filteredData.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center;">검색 결과가 없습니다.</div>';
        renderPagination(0);
        return;
    }

    // 현재 페이지에 해당하는 데이터 자르기
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    const table = document.createElement('table');
    
    // thead
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    currentHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // tbody
    const tbody = document.createElement('tbody');
    pageData.forEach(rowObj => {
        const tr = document.createElement('tr');
        currentHeaders.forEach(header => {
            const td = document.createElement('td');
            // 숫자 형식에 콤마 추가 (금액 등)
            let value = rowObj[header];
            if (!isNaN(value) && value !== '') {
                // 필요시 Number(value).toLocaleString() 처리 가능
            }
            td.textContent = value;
            td.setAttribute('data-label', header);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // 스크롤 상단으로 이동 (부드럽게)
    document.querySelector('.table-wrapper').scrollTo({ top: 0, behavior: 'smooth' });
    
    renderPagination(Math.ceil(filteredData.length / rowsPerPage));
}

// 페이지네이션 버튼 렌더링
function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    // 모바일에서는 페이징 버튼이 너무 많으면 복잡하므로 5개씩만 표시
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // 이전 버튼
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '◀';
        prevBtn.onclick = () => { currentPage--; renderPage(); };
        pagination.appendChild(prevBtn);
    }

    // 숫자 버튼
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderPage(); };
        pagination.appendChild(btn);
    }

    // 다음 버튼
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '▶';
        nextBtn.onclick = () => { currentPage++; renderPage(); };
        pagination.appendChild(nextBtn);
    }
}
