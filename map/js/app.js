// 전역 상태 변수
let currentData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50; 

// 사용자가 요청한 고정 헤더
const currentHeaders = ['지역', '아파트', '공급면적', '전용면적', '하한가', '일반가', '상한가'];

const filePaths = {
    '전체데이터': 'excel/map.csv'
};

// 아파트별 고유 색상 지정을 위한 맵퍼
let aptColorMap = {};
let colorCounter = 0;

function getAptColorClass(aptName) {
    if (aptColorMap[aptName] === undefined) {
        // 5가지 색상(0~4)을 순환하며 배정
        aptColorMap[aptName] = `apt-group-${colorCounter % 5}`;
        colorCounter++;
    }
    return aptColorMap[aptName];
}

document.addEventListener("DOMContentLoaded", () => {
    loadData('전체데이터');

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

function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const parsedData = [];

    // 파싱 시작 전 색상 초기화
    aptColorMap = {};
    colorCounter = 0;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue; 

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

        const regionStr = `${col[0]} ${col[1]} ${col[2]}`.replace(/\s+/g, ' ').trim();
        
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
    renderPage();
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
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    currentHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    pageData.forEach(rowObj => {
        const tr = document.createElement('tr');
        
        // 💡 핵심: 아파트명에 따라 색상 클래스(apt-group-0 ~ 4) 부여
        tr.className = getAptColorClass(rowObj['아파트']);

        currentHeaders.forEach(header => {
            const td = document.createElement('td');
            td.textContent = rowObj[header];
            td.setAttribute('data-label', header);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    document.querySelector('.table-wrapper').scrollTo({ top: 0, behavior: 'smooth' });
    
    renderPagination(Math.ceil(filteredData.length / rowsPerPage));
}

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
