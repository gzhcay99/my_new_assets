const PIN = "289023", 
      COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"],
      CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR", "CNY", "JPY"],
      TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

let assets = JSON.parse(localStorage.getItem('assets')) || [], 
    history = JSON.parse(localStorage.getItem('wealth_history')) || [],
    rates = {}, typeChart = null, historyChart = null, curView = 'type', editingId = null, pendingAction = null;

window.onload = () => { populateDropdowns(); fetchRates(); };

async function fetchRates() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        rates = (await res.json()).rates;
        document.getElementById('rateDate').innerText = `SYNCED • ${new Date().toLocaleDateString()}`;
        updateUI();
    } catch (e) { rates = { USD: 1, MYR: 4.7, SGD: 1.3 }; updateUI(); }
}

function updateUI() {
    const ref = document.getElementById('refCurrency').value || 'CAD', search = document.getElementById('assetSearch').value.toLowerCase();
    const tF = document.getElementById('typeFilter').value, coF = document.getElementById('countryFilter').value, cuF = document.getElementById('currencyFilter').value;
    const exT = document.getElementById('exType').checked, exC = document.getElementById('exCountry').checked;

    const filtered = assets.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search);
        const matchesCcy = (cuF === 'All' || a.currency === cuF);
        
        let matchesType = (tF === 'All' || a.type === tF);
        if (exT && tF !== 'All') matchesType = (a.type !== tF);
        
        let matchesCountry = (coF === 'All' || a.country === coF);
        if (exC && coF !== 'All') matchesCountry = (a.country !== coF);

        return matchesSearch && matchesCcy && matchesType && matchesCountry;
    });

    let net = 0; const summ = {}, groups = {};

    filtered.forEach(a => {
        const val = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const factor = a.type === "Loan" ? -1 : 1;
        net += (val * factor);
        
        const key = a[curView];
        summ[key] = (summ[key] || 0) + (val * factor);
        if (!groups[a.country]) groups[a.country] = []; groups[a.country].push(a);
    });

    document.getElementById('totalDisplay').innerText = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref }).format(net);
    renderList(groups); renderSummary(summ, net, ref);
    renderCharts(summ); lucide.createIcons();
}

function renderCharts(summ) {
    if (typeChart) typeChart.destroy();
    const keys = Object.keys(summ), vals = Object.values(summ).map(Math.abs);
    typeChart = new Chart(document.getElementById('typeChart'), {
        type: 'pie',
        data: {
            labels: keys,
            datasets: [{ data: vals, backgroundColor: ['#d4af37','#b8860b','#daa520','#ffd700','#f5deb3','#8b4513'], borderWidth: 0 }]
        },
        options: {
            plugins: { legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 10 } } },
            maintainAspectRatio: false
        }
    });

    if (historyChart) historyChart.destroy();
    if (history.length > 1) {
        historyChart = new Chart(document.getElementById('historyChart'), {
            type: 'line',
            data: { labels: history.map(h=>h.date), datasets: [{ data: history.map(h=>h.value), borderColor: '#d4af37', fill: true, backgroundColor: 'rgba(212,175,55,0.05)', tension: 0.4, pointRadius: 0 }] },
            options: { scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
    }
}

function renderSummary(summ, net, ref) {
    const list = document.getElementById('typeSummaryList'); list.innerHTML = "";
    Object.entries(summ).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).forEach(([k,v]) => {
        const p = net ? (Math.abs(v)/Math.abs(net)*100).toFixed(0) : 0;
        list.innerHTML += `<div style="margin-bottom:12px"><div style="display:flex; justify-content:space-between; font-size:11px"><span style="color:#94a3b8">${k}</span><strong>${p}%</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:2px"><strong>${v.toLocaleString(undefined,{maximumFractionDigits:0})}</strong><small style="color:#d4af37">${ref}</small></div></div>`;
    });
}

function renderList(groups) {
    const feed = document.getElementById('assetList'); feed.innerHTML = "";
    Object.keys(groups).sort().forEach(c => {
        let html = `<div class="asset-group"><div class="input-tag" style="margin: 20px 0 10px; border-bottom:1px solid var(--border); padding-bottom:5px">${c}</div>`;
        groups[c].forEach(a => {
            if (editingId === a.id) {
                html += `<div class="asset-item editing">
                    <input id="en" value="${a.name}">
                    <div style="display:flex; gap:10px"><select id="et">${TYPES.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`)}</select>
                    <input type="number" id="ev" value="${a.value}"></div>
                    <button onclick="saveEdit(${a.id})" class="prime-btn">SAVE CHANGES</button></div>`;
            } else {
                const isLoan = a.type === "Loan";
                html += `<div class="asset-item"><div><strong>${a.name}</strong><br><small style="color:#94a3b8">${a.type}</small></div>
                    <div style="text-align:right"><strong style="color:${isLoan?'#f87171':'#fff'}">${isLoan?'-':''}${a.value.toLocaleString()} ${a.currency}</strong><br>
                    <button onclick="triggerAuth('edit', ${a.id})" class="btn-small btn-edit">EDIT</button>
                    <button onclick="triggerAuth('del', ${a.id})" class="btn-small btn-del">DEL</button></div></div>`;
            }
        });
        feed.innerHTML += html + `</div>`;
    });
}

function triggerAuth(action, id) { pendingAction = { action, id }; document.getElementById('authOverlay').style.display = 'flex'; }
function closeAuth() { document.getElementById('authOverlay').style.display = 'none'; document.getElementById('loginPin').value = ""; }

function confirmAuth() {
    if (document.getElementById('loginPin').value === PIN) {
        const { action, id } = pendingAction;
        if (action === 'del') assets = assets.filter(a => a.id !== id);
        if (action === 'edit') editingId = id;
        if (action === 'wipe') { assets = []; history = []; localStorage.clear(); location.reload(); }
        if (action !== 'edit') { localStorage.setItem('assets', JSON.stringify(assets)); saveSnapshot(); }
        closeAuth(); updateUI();
    } else alert("Invalid PIN");
}

function saveEdit(id) {
    const a = assets.find(x => x.id === id);
    a.name = document.getElementById('en').value; a.type = document.getElementById('et').value; a.value = parseFloat(document.getElementById('ev').value);
    editingId = null; localStorage.setItem('assets', JSON.stringify(assets)); saveSnapshot(); updateUI();
}

function saveSnapshot() {
    const ref = document.getElementById('refCurrency').value || 'CAD';
    let total = assets.reduce((sum, a) => sum + ((a.value / (rates[a.currency]||1)) * (rates[ref]||1) * (a.type==="Loan"?-1:1)), 0);
    const date = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short'});
    if (!history.length || history[history.length-1].value !== total) {
        history.push({ date, value: total }); if (history.length > 15) history.shift();
        localStorage.setItem('wealth_history', JSON.stringify(history));
    }
}

function populateDropdowns() {
    const fill = (id, l, filter=true) => {
        const el = document.getElementById(id); el.innerHTML = filter ? '<option value="All">All</option>' : '';
        el.innerHTML += l.map(x => `<option value="${x}">${x}</option>`).join('');
    };
    fill('assetCountry', COUNTRIES, false); fill('countryFilter', COUNTRIES);
    fill('assetCurrency', CURRENCIES, false); fill('currencyFilter', CURRENCIES); fill('refCurrency', CURRENCIES, false);
    fill('assetType', TYPES, false); fill('typeFilter', TYPES);
    document.getElementById('refCurrency').value = 'CAD';
}

document.getElementById('assetForm').onsubmit = (e) => {
    e.preventDefault();
    assets.push({ name:document.getElementById('assetName').value, country:document.getElementById('assetCountry').value, type:document.getElementById('assetType').value, currency:document.getElementById('assetCurrency').value, value:parseFloat(document.getElementById('assetValue').value), id:Date.now() });
    localStorage.setItem('assets', JSON.stringify(assets)); e.target.reset(); updateUI(); saveSnapshot();
};

function exportCSV() { let csv = "Name,Entity,Type,Currency,Value\n" + assets.map(a => `"${a.name}","${a.country}","${a.type}","${a.currency}",${a.value}`).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download="Assets.csv"; a.click(); }
function setSummaryView(v, b) { curView = v; document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); b.classList.add('active'); updateUI(); }