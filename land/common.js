    // ==========================================
    // [데이터 수정 영역] 아래 항목만 수정해서 사용하세요!
    // ==========================================
    const lastUpdated = "기준일: 2026.11.24 14:30 업데이트";

    const listData = [
        {
            title: "임시 시세표 메인 서버",
            url: "https://example.com/price-main",
            period: "2026.11.24 ~ 2026.12.31",
            downloadable: true
        },
        {
            title: "시세표 및 다운가능 링크",
            url: "https://kdk0781.github.io/Apt/?k=EEYOJxFSTm4KAQMEaxh2EF1QWG1NUh0xUVxHUjpnIVUYRlErEwURcxBRXlowVhBUCkZRKxMFEXMQVFdGKlU5AVECCjMSFVh9VlVBQi1OOWwFLQUsFREYMxAKVFczUiVe",
            period: "2026.11.26 ~ 2027.05.26",
            downloadable: true
        },
        //{
        //    title: "실시간 조회 전용 링크",
        //    url: "https://example.com/view-only",
        //    period: "2026.11.20 ~ 2026.11.30",
        //    downloadable: false
        //},
        {
            title: "11월 4주차 데이터 보관소",
            url: "https://example.com/archive-w4",
            period: "상시 운영 (7일마다 갱신)",
            downloadable: true
        }
    ];
    // ==========================================

    // 밤낮(다크/라이트) 모드 제어
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');

    function applyTheme(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
        // 현재 밤(다크) 모드면 낮으로 바꿀 수 있게 해(☀️) 아이콘 표시, 낮 모드면 달(🌙) 아이콘 표시
        themeIcon.textContent = isDark ? '☀️' : '🌙';
        themeToggleBtn.setAttribute('title', isDark ? '낮 모드로 전환' : '밤 모드로 전환');
    }

    function getInitialTheme() {
        const savedTheme = localStorage.getItem('preferredTheme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;

        // 저장된 설정이 없으면 시스템 다크모드 또는 시간대(18시~06시) 기준 적용
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return true;
        }
        const hour = new Date().getHours();
        return hour >= 18 || hour < 6;
    }

    let isDarkMode = getInitialTheme();
    applyTheme(isDarkMode);

    themeToggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        applyTheme(isDarkMode);
        localStorage.setItem('preferredTheme', isDarkMode ? 'dark' : 'light');
    });

    // 테이블 렌더링
    document.getElementById('updateTime').textContent = lastUpdated;

    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const tabBtns = document.querySelectorAll('.tab-btn');

    let currentFilter = 'ALL';
    let searchQuery = '';

    function renderList() {
        tableBody.innerHTML = '';

        const filtered = listData.filter(item => {
            const matchFilter =
                currentFilter === 'ALL' ||
                (currentFilter === 'YES' && item.downloadable) ||
                (currentFilter === 'NO' && !item.downloadable);

            const matchSearch =
                item.title.toLowerCase().includes(searchQuery) ||
                item.period.toLowerCase().includes(searchQuery) ||
                item.url.toLowerCase().includes(searchQuery);

            return matchFilter && matchSearch;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 32px; color: var(--text-sub);">조건에 맞는 항목이 없습니다.</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const tr = document.createElement('tr');
            const badgeHtml = item.downloadable
                ? `<span class="badge badge-yes">가능 (O)</span>`
                : `<span class="badge badge-no">불가 (X)</span>`;

            tr.innerHTML = `
                <td data-label="항목명">
                    <span class="site-title">${item.title}</span>
                </td>
                <td data-label="링크 주소">
                    <div class="link-group">
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="link-btn">바로가기 ↗</a>
                        <span class="url-text">${item.url}</span>
                    </div>
                </td>
                <td data-label="기간">
                    <span class="period-text">${item.period}</span>
                </td>
                <td data-label="다운로드 유무" style="text-align: center;">
                    ${badgeHtml}
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderList();
    });

    renderList();
