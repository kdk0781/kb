const r = {
    base: { mor5: 3.87, mor2: 3.40, ncofix: 2.82, scofix: 2.47, primeOn: 1.10, primeOff: 0.90 },
    add: {
        mort: { m5: 2.17, n6: 2.74, n12: 2.69, s6: 3.08, s12: 3.20 },
        hf:   { m2: 2.20, n6: 2.43, n12: 2.54, s6: 2.68, s12: 3.07 },
        hug:  { m2: 2.26, n6: 2.46, n12: 2.44, s6: 2.71, s12: 2.97 },
        target: { m2: 2.56, n6: 2.55, n12: 2.67, s6: 3.00, s12: 3.13 } // SGI 데이터 매핑
    }
};

const calc = (b, a, p) => parseFloat((b + a - p).toFixed(2));

function renderSummary() {
    const items = [
        {l:'금융채5Y',v:r.base.mor5},
        {l:'금융채2Y',v:r.base.mor2},
        {l:'신규COFIX',v:r.base.ncofix},
        {l:'신잔액',v:r.base.scofix}
    ];
    document.getElementById('top-summary').innerHTML = items.map(i => `
        <div class="summary-item">${i.l}<span>${i.v}%</span></div>
    `).join('');
}

function renderContent() {
    const groups = [
        { title: "주택담보대출", desc: "부동산 담보 대출 금리 리포트", id: 'mort' },
        { title: "전세 (HF 주택금융공사)", desc: "공사 보증 전세자금대출", id: 'hf' },
        { title: "전세 (HUG 주택도시보증)", desc: "안심전세 보증금 반환보증", id: 'hug' },
        { title: "전세 (SGI 서울보증보험)", desc: "고액 전세자금 SGI 보증", id: 'target' }
    ];

    let finalHtml = "";
    groups.forEach(g => {
        const ga = r.add[g.id];
        
        // 5년 변동 항목 강제 고정 포함
        const items = [
            { n: (g.id === 'mort' ? "금융채 5년 (혼합)" : "금융채 2년 (고정)"), c: (g.id === 'mort' ? "5년 고정" : "2년 고정"), b: (g.id === 'mort' ? r.base.mor5 : r.base.mor2), a: ga.m2 || ga.m5 },
            ...(g.id === 'mort' ? [{ n: "금융채 5년 (변동)", c: "5년 변동", b: r.base.mor5, a: ga.m5 }] : []),
            { n: "신규 코픽스 6개월", c: "6개월 변동", b: r.base.ncofix, a: ga.n6 },
            { n: "신규 코픽스 12개월", c: "12개월 변동", b: r.base.ncofix, a: ga.n12 },
            { n: "신잔액 코픽스 6개월", c: "6개월 변동", b: r.base.scofix, a: ga.s6 },
            { n: "신잔액 코픽스 12개월", c: "12개월 변동", b: r.base.scofix, a: ga.s12 }
        ];

        const minVal = Math.min(...items.map(i => calc(i.b, i.a, r.base.primeOn)));
        
        let groupHtml = `<section class="group-wrapper"><div class="section-header"><h3>${g.title}</h3><p>${g.desc}</p></div><div class="card-list">`;
        items.forEach(i => {
            const onVal = calc(i.b, i.a, r.base.primeOn);
            const isBest = onVal === minVal;
            groupHtml += `
                <article class="rate-card ${isBest ? 'best-rate' : ''}">
                    <div class="best-label">BEST</div>
                    <div class="card-top">
                        <span class="product-name">${i.n}</span>
                        <span class="cycle-tag">${i.c}</span>
                    </div>
                    <div class="price-grid">
                        <div class="price-box ${isBest ? 'target' : ''}">
                            <span class="label">전자계약 O</span>
                            <span class="value">${onVal.toFixed(2)}%</span>
                            <span class="formula">${i.b}+${i.a}-1.1</span>
                        </div>
                        <div class="price-box">
                            <span class="label">전자계약 X</span>
                            <span class="value">${calc(i.b, i.a, r.base.primeOff).toFixed(2)}%</span>
                            <span class="formula">${i.b}+${i.a}-0.9</span>
                        </div>
                    </div>
                </article>`;
        });
        groupHtml += `</div></section>`;
        finalHtml += groupHtml;
    });
    document.getElementById('main-content').innerHTML = finalHtml;
}

function startClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return; 

    const tick = () => {
        const n = new Date();
        const yyyy = n.getFullYear();
        const mm = String(n.getMonth() + 1).padStart(2, '0');
        const dd = String(n.getDate()).padStart(2, '0');
        const h = String(n.getHours()).padStart(2, '0');
        const m = String(n.getMinutes()).padStart(2, '0');
        const s = String(n.getSeconds()).padStart(2, '0');
        clockEl.innerText = `${yyyy}/${mm}/${dd} ${h}:${m}:${s}`;
    };

    tick();
    setInterval(tick, 1000);
}

window.onload = () => {
    renderSummary();
    renderContent();
    startClock();
};