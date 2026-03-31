/* ══════════════════════════════════════
   KB FAQ — app.js
   렌더링 / 검색 / 모달 / 이벤트 처리
   ══════════════════════════════════════ */

/* ─── 상태 변수 ─── */
let activeCategory = 'all';
let searchQuery    = '';
let faqData        = [...FAQ_DATA];   // data.js 에서 로드

/* ══════════════════════════════════════
   유틸
   ══════════════════════════════════════ */

/**
 * 검색어를 <span class="hl">로 하이라이팅
 * @param {string} text  - 원본 텍스트
 * @param {string} query - 검색어
 */
function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="hl">$1</span>');
}

/**
 * 현재 상태(카테고리 + 검색어)에 맞는 항목 반환
 */
function getFilteredItems() {
  return faqData.filter(item => {
    const catMatch = activeCategory === 'all' || item.cat === activeCategory;
    if (!catMatch) return false;
    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();
    return (
      item.q.toLowerCase().includes(q) ||
      item.a.toLowerCase().includes(q)  ||
      item.cat.toLowerCase().includes(q)
    );
  });
}

/* ══════════════════════════════════════
   렌더링
   ══════════════════════════════════════ */

/** 카테고리 필터 Pills 렌더링 */
function renderCatBar() {
  const bar = document.getElementById('catBar');

  // 카테고리별 항목 수 집계
  const counts = { all: faqData.length };
  faqData.forEach(f => { counts[f.cat] = (counts[f.cat] || 0) + 1; });

  bar.innerHTML = CATEGORIES.map(c => {
    const cnt = counts[c.id] || 0;
    if (c.id !== 'all' && cnt === 0) return '';

    const isActive = activeCategory === c.id;
    const label    = c.id === 'all' ? faqData.length : cnt;
    return `
      <button class="cat-pill${isActive ? ' active' : ''}" data-cat="${c.id}">
        ${c.icon} ${c.label}
        <span class="count">${label}</span>
      </button>`;
  }).join('');

  // 클릭 이벤트
  bar.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderAll();
    });
  });
}

/** FAQ 목록 렌더링 */
function renderMain() {
  const main     = document.getElementById('mainContent');
  const filtered = getFilteredItems();

  // 결과 없음
  if (filtered.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">검색 결과가 없습니다.</div>
      </div>`;
    return;
  }

  // 카테고리별 그룹핑
  const grouped  = {};
  const catOrder = CATEGORIES.filter(c => c.id !== 'all').map(c => c.id);
  filtered.forEach(item => {
    if (!grouped[item.cat]) grouped[item.cat] = [];
    grouped[item.cat].push(item);
  });

  // 카테고리 메타 맵
  const catInfo = {};
  CATEGORIES.forEach(c => { catInfo[c.id] = c; });

  // 결과 카운트 헤더
  let html = `
    <div class="stats-bar">
      <div class="result-count"><span>${filtered.length}</span>개 항목</div>
    </div>`;

  // 각 카테고리 그룹 렌더링
  catOrder.forEach(catId => {
    if (!grouped[catId]) return;

    const items      = grouped[catId];
    const info       = catInfo[catId];
    const colors     = CAT_COLORS[catId] || { dark: '#555', light: '#f0f0f0' };

    html += `
      <div class="faq-group" data-cat="${catId}">
        <div class="group-header">
          <div class="group-icon"
               style="background:${colors.light}; color:${colors.dark}">
            ${info.icon}
          </div>
          <div class="group-title">${info.label}</div>
          <div class="group-count">${items.length}건</div>
        </div>`;

    items.forEach(item => {
      const qText      = highlight(item.q, searchQuery);
      const newBadge   = item.tags.includes('NEW')  ? '<span class="badge-new">NEW</span>'    : '';
      const commonBadge= item.tags.includes('공통') ? '<span class="badge-common">공통</span>' : '';
      const badges     = (newBadge || commonBadge)
        ? `<div class="q-badges">${newBadge}${commonBadge}</div>`
        : '';

      html += `
        <div class="faq-item" data-id="${item.id}">
          <div class="faq-question">
            <span class="q-num">${item.num}</span>
            <span class="q-text">${qText}</span>
            ${badges}
            <span class="chevron">▾</span>
          </div>
          <div class="faq-answer">
            <div class="answer-inner">${item.a}</div>
          </div>
        </div>`;
    });

    html += `</div>`;  // .faq-group
  });

  main.innerHTML = html;

  // 아코디언 토글
  main.querySelectorAll('.faq-question').forEach(qEl => {
    qEl.addEventListener('click', () => {
      const item   = qEl.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // 모두 닫기
      main.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));

      // 이전에 닫혀있던 경우만 열기
      if (!isOpen) item.classList.add('open');
    });
  });
}

/** 전체 UI 다시 그리기 */
function renderAll() {
  renderCatBar();
  renderMain();
}

/* ══════════════════════════════════════
   검색
   ══════════════════════════════════════ */
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  searchClear.classList.toggle('show', searchQuery.length > 0);
  activeCategory = 'all';
  renderAll();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery       = '';
  searchClear.classList.remove('show');
  renderAll();
});

/* ══════════════════════════════════════
   모달 (FAQ 항목 추가)
   ══════════════════════════════════════ */
const fab       = document.getElementById('fabBtn');
const overlay   = document.getElementById('modalOverlay');
const closeBtn  = document.getElementById('modalClose');
const cancelBtn = document.getElementById('btnCancel');
const submitBtn = document.getElementById('btnSubmit');

function openModal()  { overlay.classList.add('show'); }
function closeModal() { overlay.classList.remove('show'); }

fab.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

submitBtn.addEventListener('click', () => {
  const cat      = document.getElementById('formCat').value.trim();
  const q        = document.getElementById('formQ').value.trim();
  const a        = document.getElementById('formA').value.trim();
  const isNew    = document.getElementById('tagNew').checked;
  const isCommon = document.getElementById('tagCommon').checked;

  // 유효성 검사
  if (!q || !a) {
    alert('질문과 답변을 모두 입력해주세요.');
    return;
  }

  // 해당 카테고리의 다음 번호 계산
  const catItems = faqData.filter(f => f.cat === cat);
  const nextNum  = catItems.length + 1;

  const newItem = {
    id  : `U${Date.now()}`,
    cat,
    num : `Q${nextNum}`,
    q,
    a   : `<p class="ans-main">${a.replace(/\n/g, '<br>')}</p>`,
    tags: [
      ...(isNew    ? ['NEW']  : []),
      ...(isCommon ? ['공통'] : []),
    ],
  };

  faqData.push(newItem);

  // 폼 초기화
  document.getElementById('formQ').value     = '';
  document.getElementById('formA').value     = '';
  document.getElementById('tagNew').checked  = false;
  document.getElementById('tagCommon').checked = false;

  // 추가한 카테고리로 이동 후 닫기
  activeCategory = cat;
  closeModal();
  renderAll();
});

/* ══════════════════════════════════════
   초기화
   ══════════════════════════════════════ */
renderAll();
