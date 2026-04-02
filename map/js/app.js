// 전역 상태 변수
let currentData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50; 

// 고정 헤더 항목
const currentHeaders = ['지역', '아파트', '공급면적', '전용면적', '하한가', '일반가', '상한가'];

// 데이터 소스
const filePaths = {
    '전체데이터': 'excel/map.csv'
};

// 아파트 색상 그룹화를 위한 변수
let aptColorMap = {};
let colorCounter = 0;

function getAptColorClass(aptName) {
    if (aptColorMap[aptName] === undefined) {
        aptColorMap[aptName] = `apt-group-${colorCounter % 5}`;
        colorCounter++;
    }
    return aptColorMap[aptName];
}

document.addEventListener("DOMContentLoaded", () => {
    loadData('전체데이터');

    // 검색 이벤트 (AND 조건 실시간 필터)
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
            statusMsg.textContent = "오류: excel 폴더에 map.csv 파일이 존재하는지 확인해주세요.";
            statusMsg.style.color = "red";
        });
}

function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const parsedData = [];

    // 파싱 시 초기화
    aptColorMap = {};
    colorCounter = 0;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue; 

        // 불필요 행 스킵
        if (currentLine.includes('전국은행연합회') || 
            currentLine.includes('조견표') || 
            currentLine.includes('절대 수정 금지') ||
            currentLine.includes('대출상담사') ||
            currentLine.includes('시도,시군구,읍면동')) {
            continue;
        }

        const col = currentLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());

        if (col.length < 11) continue;
        if (!col[0] || col[0] === '') continue;

        // 지역 병합 (시도 시군구 읍면동)
        const regionStr = `${col[0]} ${col[1]} ${col[2]}`.replace(/\s+/g, ' ').trim();
        
        // 금액 콤마 포맷팅
        const formatPrice = (val) => {
            const num = parseFloat(val);
            return isNaN(num) || num === 0 ? '-' : num.toLocaleString();
        };

        const obj = {
            '지역': regionStr,
            '아파트': col[3],
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
    renderHeader(); // 헤더 렌더링
    renderPage();   // 데이터 렌더링
}

function filterData(keyword) {
    if (!keyword) {
        filteredData = currentData;
    } else {
        const searchTerms = keyword.toLowerCase().split(/\s+/);
        filteredData = currentData.filter(row => {
            const targetStr = `${row['지역']} ${row['아파트']}`.toLowerCase();
            return searchTerms.every(term => targetStr.includes(term));
        });
    }
    currentPage = 1;
    renderPage();
    
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = keyword ? `검색 결과: ${filteredData.length.toLocaleString()}건` : `총 ${currentData.length.toLocaleString()}건의 데이터가 있습니다.`;
}

// 💡 table의 thead 역할을 하는 div 렌더링
function renderHeader() {
    const listHeader = document.getElementById('listHeader');
    listHeader.innerHTML = '';

    currentHeaders.forEach(headerText => {
        const cell = document.createElement('div');
        cell.className = 'list-cell';
        cell.textContent = headerText;
        listHeader.appendChild(cell);
    });
}

// 💡 table의 tbody 역할을 하는 div 렌더링
function renderPage() {
    const listBody = document.getElementById('listBody');
    listBody.innerHTML = '';

    if (filteredData.length === 0) {
        listBody.innerHTML = '<div style="padding:40px; text-align:center; color:#6c757d;">검색 결과가 없습니다.</div>';
        renderPagination(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // tr, td 대신 div로 행과 셀 생성
    pageData.forEach(rowObj => {
        const row = document.createElement('div');
        row.className = `list-row ${getAptColorClass(rowObj['아파트'])}`;

        currentHeaders.forEach(header => {
            const cell = document.createElement('div');
            cell.className = 'list-cell';
            cell.textContent = rowObj[header];
            cell.setAttribute('data-label', header); // 모바일에서 라벨로 사용됨
            row.appendChild(cell);
        });
        listBody.appendChild(row);
    });

    // 스크롤 상단 이동 (클래스명 변경됨)
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
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
