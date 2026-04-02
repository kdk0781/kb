// 페이지가 열리면 기본적으로 첫 번째 탭의 데이터를 자동으로 불러옵니다.
document.addEventListener("DOMContentLoaded", () => {
    loadExcelData('서울경기인천');
});

// 파일 경로 매핑 (excel 폴더 안의 파일명과 정확히 일치해야 함)
const filePaths = {
    '서울경기인천': 'excel/시세표(서울,경기,인천).csv',
    '그외지역': 'excel/시세표(그외지역).csv'
};

function loadExcelData(regionKey) {
    const statusMsg = document.getElementById('statusMessage');
    const container = document.getElementById('tableContainer');
    
    // 버튼 활성화 상태 변경
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event && event.target ? event.target.classList.add('active') : document.querySelector('.tab-btn').classList.add('active');

    statusMsg.textContent = "데이터를 불러오는 중입니다...";
    container.innerHTML = '';

    const filePath = filePaths[regionKey];

    // Fetch API를 사용하여 excel 폴더의 파일을 자동으로 읽어옵니다.
    fetch(filePath)
        .then(response => {
            if (!response.ok) {
                throw new Error("파일을 찾을 수 없거나 서버 오류입니다.");
            }
            // 엑셀에서 저장한 CSV의 한글(EUC-KR) 깨짐을 방지하기 위해 arrayBuffer로 받습니다.
            return response.arrayBuffer();
        })
        .then(buffer => {
            // EUC-KR 인코딩으로 텍스트 디코딩
            const decoder = new TextDecoder('euc-kr');
            const csvText = decoder.decode(buffer);
            
            processData(csvText);
            statusMsg.textContent = `${regionKey} 데이터를 성공적으로 불러왔습니다.`;
        })
        .catch(error => {
            console.error("데이터 로드 실패:", error);
            statusMsg.textContent = `오류 발생: 파일을 불러오지 못했습니다. (경로: ${filePath})`;
            statusMsg.style.color = "red";
        });
}

function processData(csv) {
    const lines = csv.split(/\r\n|\n/);
    const ESTIMATED_ROWS_ABOVE_HEADER = 5; // 상단 안내문구 5줄 무시

    if (lines.length <= ESTIMATED_ROWS_ABOVE_HEADER) {
        document.getElementById('tableContainer').innerHTML = '<p>데이터가 부족합니다.</p>';
        return;
    }

    // 헤더 행 파싱 (6번째 줄)
    const headers = lines[ESTIMATED_ROWS_ABOVE_HEADER].split(',').map(h => h.trim().replace(/"/g, ''));
    const jsonData = [];

    // 데이터 행 파싱 (7번째 줄부터 끝까지)
    for (let i = ESTIMATED_ROWS_ABOVE_HEADER + 1; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue;

        const obj = {};
        // 쉼표 분리 (따옴표 안의 쉼표는 무시하는 정규식)
        const currentLineArr = currentLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

        headers.forEach((header, index) => {
            let value = currentLineArr[index] || '';
            obj[header] = value.replace(/^"|"$/g, '').trim();
        });
        jsonData.push(obj);
    }

    renderTable(headers, jsonData);
}

function renderTable(headers, data) {
    const container = document.getElementById('tableContainer');
    const table = document.createElement('table');
    
    // thead 생성
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // tbody 생성
    const tbody = document.createElement('tbody');
    data.forEach(rowObj => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = rowObj[header];
            td.setAttribute('data-label', header); // 모바일 카드형 라벨용
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}
