// 전역 상태 변수
let currentData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50; 

// 사용자가 요청한 고정 헤더
const currentHeaders = ['지역', '아파트', '공급면적', '전용면적', '하한가', '일반가', '상한가'];

// 파일 경로 map.csv 로 지정
const filePaths = {
    '전체데이터': 'excel/map.csv'
};

document.addEventListener("DOMContentLoaded", () => {
    loadData('전체데이터');

    // 검색 기능 고도화: 입력할 때마다 실시간 검색
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const keyword = e.target.value.trim();
        filterData(keyword);
    });
});

function loadData(fileKey) {
    const statusMsg = document.getElementById('statusMessage');
    const filePath = filePaths[fileKey];

    statusMsg.textContent = "데이터를 불러오는 중입니다...";

    fetch(filePath)
        .then(response => {
            if (!response.ok) throw new Error("파일 로드 실패");
            return response.arrayBuffer();
        })
        .then(buffer => {
            const decoder = new TextDecoder('euc-kr');
            const csvText = decoder.decode(buffer);
            
            parseCSV(csvText);
            statusMsg.textContent = `총 ${currentData.length.toLocaleString()}건의 데이터가 있습니다.`;
        })
        .catch(error => {
            console.error(error);
            statusMsg.textContent = "데이터를 불러오지 못했습니다. excel 폴더에 map.csv 파일이 있는지 확인해주세요.";
            statusMsg.style.color = "red";
        });
}

// CSV 파싱 및 불필요한 행 삭제
function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const parsedData = [];

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue; // 빈 줄 건너뛰기

        // 불필요한 문구가 포함된 줄(등록번호 등) 완전히 무시 (삭제)
        if (currentLine.includes('전국은행연합회') || 
            currentLine.includes('조견표') || 
            currentLine.includes('절대 수정 금지') ||
            currentLine.includes('대출상담사') ||
            currentLine.includes('시도,시군구,읍면동')) {
            continue;
        }

        const col = currentLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());

        // 정상적인 데이터 행인지 확인 (컬럼이 최소 11개 이상인지)
        if (col.length < 11) continue;

        // 시도, 시군구, 읍면동 텍스트가 비어있으면 데이터가 아님
        if (!col[0] || col[0] === '') continue;

        // 데이터 조합 (원하는 규격에 맞게 맵핑)
        // 지역: 시도(col 0) + 시군구(col 1) + 읍면동(col 2)
        const regionStr = `${col[0]} ${col[1]} ${col[2]}`.replace(/\s+/g, ' ').trim();
        
        // 가격 포맷팅 함수 (44000.0 -> 44,000 형태로 보기 좋게 변환)
        const formatPrice = (val) => {
            const num = parseFloat(val);
            return isNaN(num) || num === 0 ? '-' : num.toLocaleString();
        };

        const obj = {
            '지역': regionStr,
            '아파트': col[3], // 단지명
            '공급면적': col[6],
            '전용면적': col[5],
            '하한가': formatPrice(col[8]),
            '일반가': formatPrice(col[9]),
            '상한가': formatPrice(col[10])
        };

        parsedData.push(obj);
    }

    currentData = parsedData;
    filteredData = parsedData;
    currentPage = 1;
    renderPage();
}

// 검색 기능 고도화 (AND 검색 로직)
function filterData(keyword) {
    if (!keyword) {
        filteredData = currentData;
    } else {
        // 검색어를 띄어쓰기 기준으로 나누어 배열로 만듭니다. (예: "중산동 호반" -> ["중산동", "호반"])
        const searchTerms = keyword.toLowerCase().split(/\s+/);
        
        filteredData = currentData.filter(row => {
            // 지역 + 아파트 이름을 합친 하나의 문자열 생성
            const targetStr = `${row['지역']} ${row['아파트']}`.toLowerCase();
            
            // 입력한 검색어 배열(searchTerms)의 모든 단어가 targetStr에 포함되어 있는지 확인 (AND 검색)
            return searchTerms.every(term => targetStr.includes(term));
        });
    }
    currentPage = 1;
    renderPage();
    
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = keyword ? `검색 결과: ${filteredData.length.toLocaleString()}건` : `총 ${currentData.length.toLocaleString()}건의 데이터가 있습니다.`;
}

// 테이블 렌더링
function renderPage() {
    const container = document.getElementById('tableContainer');
    container.innerHTML = '';

    if (filteredData.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#6c757d;">검색 결과가 없습니다.</div>';
        renderPagination(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    const table = document.createElement('table');
    
    // thead 생성 (고정된 항목 사용)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    currentHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // tbody 생성
    const tbody = document.createElement('tbody');
    pageData.forEach(rowObj => {
        const tr = document.createElement('tr');
        currentHeaders.forEach(header => {
            const td = document.createElement('td');
            td.textContent = rowObj[header];
            td.setAttribute('data-label', header); // 모바일 UI를 위한 라벨
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // 페이지 이동 시 맨 위로 부드럽게 스크롤
    document.querySelector('.table-wrapper').scrollTo({ top: 0, behavior: 'smooth' });
    
    renderPagination(Math.ceil(filteredData.length / rowsPerPage));
}

// 페이지네이션 렌더링
function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

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
