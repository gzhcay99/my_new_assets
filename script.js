const SHEET_ID = '1IzUo-d4_9C9pnJR-12R7Uy1AfHfxRkb8WauXOqCENyg'; 
const API_KEY = 'AIzaSyAxbVThyW2UZHsWZr4-UxkjanGxmgDtuRY'; 
const RANGE = 'webApp!A2:E'; 

const CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR"];
const COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"];
const TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

let assets = JSON.parse(localStorage.getItem('assets')) || [];
let rates = JSON.parse(localStorage.getItem('fx_rates')) || { USD: 1, CAD: 1.36 };
let currentView = 'type';
let assetChart = null;

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('detail.html')) {
        if (typeof renderDetails === "function") renderDetails();
    } else {
        populateDropdowns();
        loadFilters();
        updateUI();
        fetchRates();
        document.getElementById('syncTrigger')?.addEventListener('click', triggerFullSync);
    }
    if (window.lucide) lucide.createIcons();
});

async function triggerFullSync() {
    const btn = document.getElementById('syncTrigger');
    const icon = btn?.querySelector('.sync-icon');
    icon?.classList.add('spinning');

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.values) {
            // Store current net as 'lastWealth' before updating
            const currentNet = parseFloat(document.getElementById('totalDisplay').innerText.replace(/[^0-9.-]+/g, "")) || 0;
            localStorage.setItem('lastWealth', currentNet);

            assets = data.values.map((row, i) => ({
                name: row[0], country: row[1], type: row[2], currency: row[3],
                value: parseFloat(row[4]?.toString().replace(/[^0-9.-]+/g, "")) || 0, id: Date.now() + i
            }));
            
            localStorage.setItem('assets', JSON.stringify(assets));
            localStorage.setItem('lastSyncTime', new Date().toLocaleString());
            
            updateUI();
        }
    } catch (e) { alert("Sync failed."); }
    finally { icon?.classList.remove('spinning'); }
}

function updateUI() {
    saveFilters();
    const ref = document.getElementById('refCurrency')?.value || 'CAD';
    const tF = document.getElementById('typeFilter')?.value || 'All';
    const coF = document.getElementById('countryFilter')?.value || 'All';
    const exT = document.getElementById('exType')?.checked || false;
    const exC = document.getElementById('exCountry')?.checked || false;

    const filtered = assets.filter(a => {
        let mT = (tF === 'All' || a.type === tF);
        if (exT && tF !== 'All') mT = (a.type !== tF);
        let mC = (coF === 'All' || a.country === coF);
        if (exC && coF !== 'All') mC = (a.country !== coF);
        return mT && mC;
    });

    let net = 0; const summ = {}; const localSumm = {};
    const isCurrencyView = (currentView === 'currency' || currentView === 'ccy');

    filtered.forEach(a => {
        const val = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const factor = a.type === "Loan" ? -1 : 1;
        net += (val * factor);
        const key = isCurrencyView ? a.currency : (currentView === 'country' ? a.country : a.type);
        summ[key] = (summ[key] || 0) + (val * factor);
        if (isCurrencyView) localSumm[key] = (localSumm[key] || 0) + (a.value * factor);
    });

    // Display Wealth
    const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref, maximumFractionDigits: 0 });
    document.getElementById('totalDisplay').innerText = fmt.format(net);

    // Update Timestamp
    document.getElementById('lastUpdated').innerText = `Last Sync: ${localStorage.getItem('lastSyncTime') || 'Never'}`;

    // Update Change Indicator
    const lastWealth = parseFloat(localStorage.getItem('lastWealth')) || net;
    const change = net - lastWealth;
    const changeEl = document.getElementById('changeIndicator');
    if (change === 0) {
        changeEl.innerText = "UNCH";
        changeEl.className = "change-tag";
    } else {
        const prefix = change > 0 ? "+" : "";
        changeEl.innerText = `${prefix}${fmt.format(change)}`;
        changeEl.className = `change-tag ${change > 0 ? 'change-up' : 'change-down'}`;
    }

    renderSummaryList(summ, ref, localSumm, isCurrencyView);
    renderChart(summ);
}

function renderSummaryList(summ, ref, localSumm, isCurrencyView) {
    const container = document.getElementById('summaryDisplay');
    if (!container) return;
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
    container.innerHTML = Object.entries(summ).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k, v]) => {
        const showLocal = (isCurrencyView && k !== ref);
        const localLine = showLocal ? `<div style="color:var(--text-muted); font-size: 0.75rem;">${numFmt.format(localSumm[k])} ${k}</div>` : '';
        return `<div class="clickable-row" onclick="window.location.href='detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'">
            <div style="color:var(--prime); font-weight:700">${k}</div>
            <div style="text-align:right;"><div style="color:#fff; font-weight:800;">${numFmt.format(v)} <small style="color:var(--text-muted)">${ref}</small></div>${localLine}</div>
        </div>`;
    }).join('');
}

function renderChart(summ) {
    const canvas = document.getElementById('assetChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (assetChart) assetChart.destroy();
    assetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(summ),
            datasets: [{
                data: Object.values(summ).map(v => Math.max(0, v)),
                backgroundColor: ['#fbbf24','#d97706','#b45309','#92400e','#78350f','#5c2b06','#334155'],
                borderWidth: 2, borderColor: '#0f172a'
            }]
        },
        options: { plugins: { legend: { display: true, position: 'bottom', labels: { color: '#f8fafc', font: { size: 10 } } } }, maintainAspectRatio: false, cutout: '70%' }
    });
}

function setView(v, btn) { currentView = v.toLowerCase(); document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); btn.classList.add('active'); updateUI(); }
function populateDropdowns() {
    const fill = (id, list, hasAll=true) => {
        const el = document.getElementById(id); if(!el) return;
        el.innerHTML = (hasAll ? '<option value="All">All Items</option>' : '') + list.map(x => `<option value="${x}">${x}</option>`).join('');
    };
    fill('refCurrency', CURRENCIES, false); fill('typeFilter', TYPES); fill('countryFilter', COUNTRIES);
}
function loadFilters() {
    const s = JSON.parse(localStorage.getItem('filters')) || { exT: false, exC: false, tF: 'All', coF: 'All', ref: 'CAD' };
    const elMap = { exType: 'exT', exCountry: 'exC', typeFilter: 'tF', countryFilter: 'coF', refCurrency: 'ref' };
    Object.keys(elMap).forEach(id => { if(document.getElementById(id)) document.getElementById(id)[document.getElementById(id).type === 'checkbox' ? 'checked' : 'value'] = s[elMap[id]]; });
}
function saveFilters() {
    const s = { exT: document.getElementById('exType')?.checked, exC: document.getElementById('exCountry')?.checked, tF: document.getElementById('typeFilter')?.value, coF: document.getElementById('countryFilter')?.value, ref: document.getElementById('refCurrency')?.value };
    localStorage.setItem('filters', JSON.stringify(s));
}
function fetchRates() {
    fetch('https://open.er-api.com/v6/latest/USD').then(res => res.json()).then(data => { if (data.rates) { rates = data.rates; localStorage.setItem('fx_rates', JSON.stringify(rates)); updateUI(); } });
}