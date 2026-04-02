let groupedData = []; 
let filteredGroups = []; 

let loadedCount = 0;      
const loadStep = 20;      
let searchDebounceTimer;  
let scrollObserver = null;

document.addEventListener("DOMContentLoaded", () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
    }

    document.getElementById('hardRefreshBtn').addEventListener('click', async () => {
        const btnSpan = document.querySelector('#hardRefreshBtn span');
        btnSpan.textContent = '업데이트 중...';
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let reg of registrations) await reg.unregister();
            }
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            localStorage.clear(); sessionStorage.clear();
            window.location.reload(true);
        } catch (e) {
            window.location.reload(true);
        }
    });

    loadData();
    setupScrollObserver();

    document.getElementById('listBody').addEventListener('click', function(e) {
        const btn = e.target.closest('.accordion-btn');
        if (btn) {
            const groupItem = btn.parentElement;
            const isActive = groupItem.classList.contains('active');

            document.querySelectorAll('.group-item.active').forEach(item => {
                if(item !== groupItem) item.classList.remove('active');
            });

            groupItem.classList.toggle('active', !isActive);
            
            if (!isActive) {
                setTimeout(() => {
                    const rect = groupItem.getBoundingClientRect();
                    if (rect.top < 120 || rect.bottom > window.innerHeight) {
                        const topPos = groupItem.getBoundingClientRect().top + window.scrollY - 120;
                        window.scrollTo({ top: topPos, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
    });

    document.getElementById('searchInput').addEventListener('input', function(e) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            filterData(e.target.value.trim());
        }, 300); 
    });
});

function loadData() {
    fetch('excel/map.csv?t=' + new Date().getTime())
        .then(response => {
            if (!response.ok) throw new Error("파일 로드 실패");
            return response.arrayBuffer();
        })
        .then(buffer => {
            const decoder = new TextDecoder('euc-kr');
            parseCSV(decoder.decode(buffer));
            
            setTimeout(() => {
                const splash = document.getElementById('splashOverlay');
                if (splash) splash.classList.add('hide');
            }, 300);
        })
        .catch(error => {
            console.error("오류:", error);
            const splash = document.getElementById('splashOverlay');
            if (splash) {
                splash.innerHTML = '<div class="splash-text" style="color:red;">데이터를 불러올 수 없습니다.</div>';
                setTimeout(() => splash.classList.add('hide'), 2000);
            }
        });
}

function parseCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const flatData = [];
    
    // 💡 날짜 추출 로직: 처음 10줄 이내에서 날짜 패턴(YYYY.MM.DD)을 자동으로 찾아냅니다.
    let baseDate = "";
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        // 정규식을 통해 날짜 형태 추출 (예: 2024-10-25, 2024.10.25, 2024년 10월 25일)
        const match = lines[i].match(/(20\d{2})[-.년\s]+([0-1]?\d)[-.월\s]+([0-3]?\d)[일]?/);
        if (match) {
            const year = match[1];
            const month = match[2].padStart(2, '0');
            const day = match[3].padStart(2, '0');
            baseDate = `${year}.${month}.${day}`;
            break;
        }
    }
    
    // 날짜를 찾았다면 화면에 표시
    const dateLabel = document.getElementById('baseDateLabel');
    if (baseDate) {
        dateLabel.textContent = `* ${baseDate} 기준 시세`;
    } else {
        dateLabel.style.display = 'none'; // 못 찾으면 영역을 숨김
    }

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue; 
        
        if (
            currentLine.includes('전국은행연합회') || 
            currentLine.includes('조견표') || 
            currentLine.includes('절대 수정 금지') || 
            currentLine.includes('대출상담사') || 
            currentLine.includes('시도,시군구') || 
            currentLine.includes('시/도') ||       
            currentLine.includes('공급면적') ||     
            currentLine.includes('하한가')          
        ) {
            continue;
        }

        const col = currentLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
        if (col.length < 11 || !col[0]) continue;

        if (col[3] === '아파트' || col[3] === '단지명') continue;

        const regionStr = `${col[0]} ${col[1]} ${col[2]}`.replace(/\s+/g, ' ').trim();
        const aptName = col[3];
        
        const formatPrice = (val) => {
            const num = parseFloat(val.replace(/,/g, ''));
            return (isNaN(num) || num === 0) ? '-' : num.toLocaleString('ko-KR');
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
    renderInitial();   
}

function filterData(keyword) {
    if (!keyword) {
        filteredGroups = groupedData;
    } else {
        const searchTerms = keyword.toLowerCase().split(/\s+/);
        filteredGroups = groupedData.filter(group => {
            const groupText = `${group.지역} ${group.아파트}`.toLowerCase();
            const rowsText = group.rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
            return searchTerms.every(term => (groupText + ' ' + rowsText).includes(term));
        });
    }
    renderInitial();
}

function createGroupHTML(group) {
    let html = `
        <div class="group-item">
            <div class="accordion-btn">
                <div class="group-title-wrap">
                    <span class="group-apt">${group.아파트}</span>
                    <span class="group-region">${group.지역}</span>
                </div>
                <div class="accordion-right">
                    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>
            <div class="accordion-content">
                <div class="content-header">
                    <span class="header-area">면적 (공급/전용)</span>
                    <span class="header-unit">(단위: 만원)</span>
                </div>
    `;
    group.rows.forEach(row => {
        html += `
            <div class="inner-row">
                <div class="inner-area">
                    <span class="area-val">${row.공급면적}㎡</span>
                    <span class="area-divider">/</span>
                    <span class="area-val exclusive">${row.전용면적}㎡</span>
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

function renderInitial() {
    const listBody = document.getElementById('listBody');
    const sentinel = document.getElementById('scrollSentinel');
    
    listBody.innerHTML = '';
    loadedCount = 0; 

    if (filteredGroups.length === 0) {
        listBody.innerHTML = '<div style="padding:60px; text-align:center; color:#94a3b8; font-weight:500;">조건에 맞는 시세 정보가 없습니다.</div>';
        sentinel.style.display = 'none';
        return;
    }

    loadMore(); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadMore() {
    const listBody = document.getElementById('listBody');
    const sentinel = document.getElementById('scrollSentinel');
    
    const nextCount = Math.min(loadedCount + loadStep, filteredGroups.length);
    const groupsToRender = filteredGroups.slice(loadedCount, nextCount);
    
    if (groupsToRender.length > 0) {
        const html = groupsToRender.map(createGroupHTML).join('');
        listBody.insertAdjacentHTML('beforeend', html);
    }
    
    loadedCount = nextCount;
    
    if (loadedCount >= filteredGroups.length) {
        sentinel.style.display = 'none';
    } else {
        sentinel.style.display = 'block';
    }
}

function setupScrollObserver() {
    const sentinel = document.getElementById('scrollSentinel');
    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadMore();
        }
    }, { rootMargin: "200px" }); 

    if (sentinel) scrollObserver.observe(sentinel);
}
