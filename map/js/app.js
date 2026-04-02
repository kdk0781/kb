let currentData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50; 

const columns = [
    { key: '지역', class: 'cell-region' },
    { key: '아파트', class: 'cell-apt' },
    { key: '공급면적', class: 'cell-area-sup' },
    { key: '전용면적', class: 'cell-area-ex' },
    { key: '하한가', class: 'cell-price-low' },
    { key: '일반가', class: 'cell-price-mid' },
    { key: '상한가', class: 'cell-price-high' }
];

document.addEventListener("DOMContentLoaded", () => {
    loadData();

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
            document.getElementById('statusMessage').innerHTML = `총 <b>${currentData.length.toLocaleString()}</b>건의 실거래 시세가 있습니다.`;
        })
        .catch(error => {
            console.error("오류:", error);
            document.getElementById('statusMessage').textContent = "데이터를 불러오지 못했습니다. 경로를 확인해주세요.";
        });
}

function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const parsedData = [];

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

        if (col.length < 11 || !col[0]) continue;

        const regionStr = `${col[0]} ${col[1]} ${col[2]}`.replace(/\s+/g, ' ').trim();
        
        // ⭐️ 콤마(,) 제거 후 숫자로 변환하여 정상적인 금액 노출
        const formatPrice = (val) => {
            const cleanVal = val.replace(/,/g, ''); // 원본 데이터의 콤마 제거
            const num = parseFloat(cleanVal);
            if (isNaN(num) || num === 0) return '-';
            return num.toLocaleString('ko-KR') + '만원'; // 정상적으로 만원 단위 포맷팅
        };

        const formatArea = (val) => {
            const cleanVal = val.replace(/,/g, '');
            const num = parseFloat(cleanVal);
            return isNaN(num) ? val : num.toString() + '㎡';
        };

        parsedData.push({
            '지역': regionStr,
            '아파트': col[3],
            '공급면적': formatArea(col[6]),
            '전용면적': formatArea(col[5]),
            '하한가': formatPrice(col[8]),
            '일반가': formatPrice(col[9]),
            '상한가': formatPrice(col[10])
        });
    }

    currentData = parsedData;
    filteredData = parsedData;
    currentPage = 1;
    renderHeader(); 
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
}

function renderHeader() {
    const listHeader = document.getElementById('listHeader');
    listHeader.innerHTML = '';

    columns.forEach(col => {
        const cell = document.createElement('div');
        cell.className = `list-cell ${col.class}`;
        cell.textContent = col.key;
        listHeader.appendChild(cell);
    });
}

function renderPage() {
    const listBody = document.getElementById('listBody');
    listBody.innerHTML = '';

    if (filteredData.length === 0) {
        listBody.innerHTML = '<div style="padding:50px; text-align:center; color:#94a3b8; font-weight:500;">조건에 맞는 시세 정보가 없습니다.</div>';
        renderPagination(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    pageData.forEach(rowObj => {
        const row = document.createElement('div');
        row.className = 'list-row';

        columns.forEach(col => {
            const cell = document.createElement('div');
            cell.className = `list-cell ${col.class}`;
            cell.textContent = rowObj[col.key];
            row.appendChild(cell);
        });
        listBody.appendChild(row);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderPagination(Math.ceil(filteredData.length / rowsPerPage));
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
