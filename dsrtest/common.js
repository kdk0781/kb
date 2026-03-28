// 초기 실행: 부채 항목 하나 추가 및 아이폰 스크롤 대응
window.addEventListener("load", function() {
    setTimeout(function() { window.scrollTo(0, 1); }, 100);
    addLoan(); 

    // 서비스 워커 등록 (PWA 기능)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('data:text/javascript;base64,c2VsZi.addEventListener("fetch", function(e) { e.respondWith(fetch(e.request)); });')
        .catch(function(err) { console.log("SW 등록 실패", err); });
    }
});

function showAlert(msg, icon = "⚠️") {
    document.getElementById('modalMsg').innerHTML = msg;
    document.getElementById('modalIcon').innerText = icon;
    document.getElementById('customModal').style.display = 'flex';
}

function closeModal() { 
    document.getElementById('customModal').style.display = 'none'; 
}

function formatComma(obj) {
    let val = obj.value.replace(/[^0-9]/g, ""); 
    if (val.length > 0) obj.value = Number(val).toLocaleString();
    else obj.value = "";
}

function getNum(val) { 
    return Number(val.toString().replace(/,/g, "")) || 0; 
}

let loanCount = 0;
function addLoan() {
    loanCount++;
    const html = `
    <div class="input-card" id="loan_${loanCount}">
        <button class="btn-remove" onclick="document.getElementById('loan_${loanCount}').remove()">×</button>
        <div class="grid-row">
            <div>
                <label>대출 종류</label>
                <select class="l-category" onchange="applyPolicy(${loanCount})">
                    <option value="mortgage_level">주택담보 (원리금균등)</option>
                    <option value="mortgage_prin">주택담보 (원금균등)</option>
                    <option value="jeonse">전세대출 (만기일시상환)</option>
                    <option value="officetel">오피스텔 (원리금균등)</option>
                    <option value="credit">신용대출 (원리금균등)</option>
                    <option value="card_loan">카드론 (원리금균등)</option>
                </select>
            </div>
            <div><label>원금/잔액 (원)</label><input type="text" class="l-p" inputmode="numeric" onkeyup="formatComma(this)" placeholder="0"></div>
            <div><label>금리 (%)</label><input type="text" class="l-r" inputmode="decimal" placeholder="4.5"></div>
            <div><label>기간 (개월)</label><input type="text" class="l-m" inputmode="numeric" value="360"></div>
        </div>
        <div class="dynamic-guide" id="guide_${loanCount}"></div>
    </div>`;
    document.getElementById('loanList').insertAdjacentHTML('beforeend', html);
}

function applyPolicy(id) {
    const card = document.getElementById(`loan_${id}`);
    const cat = card.querySelector('.l-category').value;
    const m = card.querySelector('.l-m');
    const r = card.querySelector('.l-r');
    let guide = card.querySelector('.dynamic-guide') || document.createElement('div');
    
    if(!card.querySelector('.dynamic-guide')) { 
        guide.className = 'dynamic-guide'; 
        card.appendChild(guide); 
    }

    if(cat === 'officetel') {
        guide.style.display = 'block';
        guide.innerHTML = "🏢 <b>오피스텔 체크포인트:</b><br>- 신규 구입인 경우 '주택담보대출' 항목을 선택하여 계산하는 것이 더 정확할 수 있습니다.<br>- 이미 소유 중인 오피스텔에 담보대출이 있다면 이 항목(8년 상환 가정)을 유지해주세요.";
        m.value = "96"; r.placeholder = "5.5";
    } else {
        guide.style.display = 'none';
        if(cat === 'credit') { m.value = "60"; r.placeholder = "6.0"; }
        else if(cat === 'card_loan') { m.value = "36"; r.placeholder = "14.0"; }
        else if(cat === 'jeonse') { m.value = "24"; r.placeholder = "4.2"; }
        else { m.value = "360"; r.placeholder = "4.5"; }
    }
}

function calculateTotalDSR() {
    const income = getNum(document.getElementById('income').value);
    if (income <= 0) { showAlert("연소득을 입력해주세요."); return; }

    let totalAnnualPay = 0; 
    let baseRate = 0; 
    let firstMonths = 360;
    const items = document.querySelectorAll('[id^="loan_"]');

    if(items.length === 0) { showAlert("부채 항목을 추가해주세요."); return; }

    for (let item of items) {
        const pInput = item.querySelector('.l-p'); 
        const rInput = item.querySelector('.l-r');
        if (getNum(pInput.value) <= 0) { showAlert("원금을 입력해주세요."); return; }
        if (!rInput.value.trim()) { 
            showAlert(`금리를 미입력하여 기본값(${rInput.placeholder}%)으로 계산합니다.`, "ℹ️"); 
            rInput.value = rInput.placeholder; 
        }
    }

    items.forEach((item, index) => {
        const cat = item.querySelector('.l-category').value;
        const P = getNum(item.querySelector('.l-p').value);
        const R_raw = item.querySelector('.l-r').value;
        const n = getNum(item.querySelector('.l-m').value);
        
        if (P > 0) {
            const R = Number(R_raw) / 100; const r = R / 12;
            if (index === 0) { baseRate = Number(R_raw); firstMonths = n; }
            
            if (cat === 'jeonse') totalAnnualPay += P * R;
            else if (cat === 'mortgage_prin') totalAnnualPay += (P/n + (P*r * 0.5)) * 12; 
            else totalAnnualPay += ((P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1))*12;
        }
    });

    const dsr = (totalAnnualPay / income) * 100;
    const dsrLimit = income * 0.4;
    const r_b = (baseRate / 100) / 12;
    const n_b = firstMonths;

    const maxP = (dsrLimit / 12) / (1/n_b + (r_b * 0.5)); 
    const maxL = ((dsrLimit / 12) * (Math.pow(1+r_b, n_b)-1)) / (r_b * Math.pow(1+r_b, n_b));
    const addLim = (dsrLimit - totalAnnualPay) > 0 ? (dsrLimit - totalAnnualPay) / 12 / (1/n_b + (r_b * 0.5)) : 0;

    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('dsrVal').innerText = dsr.toFixed(2) + "%";
    document.getElementById('dsrVal').style.color = dsr > 40 ? "var(--danger)" : "var(--safe)";
    document.getElementById('dsrBar').style.width = Math.min(dsr, 100) + "%";
    document.getElementById('dsrBar').style.background = dsr > 40 ? "var(--danger)" : "var(--safe)";
    
    document.getElementById('absMaxPrin').innerText = (Math.floor(maxP/10000)*10000).toLocaleString() + " 원";
    document.getElementById('absMaxLevel').innerText = (Math.floor(maxL/10000)*10000).toLocaleString() + " 원";
    document.getElementById('remainingLimit').innerText = (Math.floor(addLim/10000)*10000).toLocaleString() + " 원";

    provideRecommendation(dsr, income, addLim);
    window.scrollTo({ top: document.getElementById('resultArea').offsetTop - 20, behavior: 'smooth' });
}

function provideRecommendation(dsr, income, addLim) {
    const recTitle = document.getElementById('recTitle');
    const recDesc = document.getElementById('recDesc');
    const prinCard = document.getElementById('prinCard');
    const levelCard = document.getElementById('levelCard');
    let target = ""; let strategy = "";

    if (dsr > 40) { 
        target = "원금균등 (한도 극대화 필수)"; 
        recTitle.style.color = "var(--danger)"; 
        strategy = `<b>🚨 DSR 한도 초과: 현재 부채가 소득 임계치를 넘었습니다.</b><br>반드시 <strong>'원금균등 상환'</strong> 방식을 고려해야 합니다. 원금균등은 원리금균등 방식보다 <b>실제 한도가 약 10% 더 높게 산정</b>되는 실무적 이점이 있어 한도 초과 상황을 타개할 유일한 전략입니다.`; 
    } 
    else if (dsr > 30) { 
        target = "원금균등 (추천)"; 
        recTitle.style.color = "#2c3e50"; 
        strategy = `<b>⚠️ 한도 임계점 도달: 추가 한도 확보가 최우선입니다.</b><br>현재 DSR이 높은 편이므로 <strong>'원금균등 상환'</strong>이 압도적으로 유리합니다. 초기 부담은 크지만 원리금 방식보다 더 높은 대출 승인액을 확보할 수 있으며 이자까지 절감하는 실속형 선택입니다.`; 
    } 
    else if (income > 70000000) { 
        target = "원금균등 (이자 절감형)"; 
        recTitle.style.color = "#2c3e50"; 
        strategy = `<b>✨ 자산 최적화: 고소득자에게 유리한 방식입니다.</b><br>상환 능력이 충분하시므로 <strong>'원금균등 상환'</strong>을 통해 총 지불 이자를 최소화하세요. 시간이 갈수록 부담이 급감하여 자산 증식 속도를 높여주는 가장 스마트한 방식입니다.`; 
    } 
    else { 
        target = "원리금균등 (지출 안정형)"; 
        recTitle.style.color = "#2c3e50"; 
        strategy = `<b>✅ 정상: 안정적인 현금 흐름 관리를 권장합니다.</b><br>매월 상환액이 일정하여 지출 예측이 용이한 <strong>'원리금균등 상환'</strong>이 적합합니다. 가계 예산 운영을 안정적으로 유지하고 싶은 분들께 권장하는 표준 방식입니다.`; 
    }

    recTitle.innerHTML = `🎯 ${target} 방식을 추천합니다`;
    recDesc.innerHTML = strategy;

    [prinCard, levelCard].forEach(c => { 
        c.classList.remove('recommended'); 
        const oldBadge = c.querySelector('.rec-badge'); 
        if(oldBadge) oldBadge.remove(); 
    });

    if (target.includes("원리금균등")) { 
        levelCard.classList.add('recommended'); 
        levelCard.insertAdjacentHTML('afterbegin', '<div class="rec-badge">지출 안정성 추천</div>'); 
    } else { 
        prinCard.classList.add('recommended'); 
        prinCard.insertAdjacentHTML('afterbegin', '<div class="rec-badge">한도/이자 우위 추천</div>'); 
    }
}

function copyResultText() {
    const text = `[DSR 진단 리포트]\n연소득: ${document.getElementById('income').value}원\nDSR 지수: ${document.getElementById('dsrVal').innerText}\n최대 한도(원금): ${document.getElementById('absMaxPrin').innerText}\n추가여력: ${document.getElementById('remainingLimit').innerText}\n\n[추천전략]\n${document.getElementById('recTitle').innerText}\n${document.getElementById('recDesc').innerText.replace(/<[^>]*>?/gm, '')}\n\n* 본 결과는 참고용으로만 활용하시기 바랍니다.`;
    const temp = document.createElement("textarea"); 
    document.body.appendChild(temp);
    temp.value = text; temp.select(); 
    document.execCommand("copy"); 
    document.body.removeChild(temp);
    showAlert("분석 결과가 복사되었습니다!", "✅");
}
