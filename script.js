const SHEET_ID = '1IzUo-d4_9C9pnJR-12R7Uy1AfHfxRkb8WauXOqCENyg'; 
const API_KEY = 'AIzaSyAxbVThyW2UZHsWZr4-UxkjanGxmgDtuRY'; 
const RANGE = 'webApp!A2:E';  

const COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"];
const CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR"];
const TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

let assets = JSON.parse(localStorage.getItem('assets')) || [];
let rates = JSON.parse(localStorage.getItem('fx_rates')) || { USD: 1, CAD: 1.36 };
let currentView = 'type';
let assetChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on detail or index
    const isDetail = window.location.pathname.includes('detail.html');

    if (isDetail) {
        if (typeof renderDetails === "function") renderDetails();
    } else {
        populateDropdowns();
        loadFilters();
        if (assets.length > 0) updateUI();
        fetchRates();

        // Robust listener for Sync Button
        const syncBtn = document.getElementById('syncTrigger');
        if (syncBtn) {
            syncBtn.addEventListener('click', (e) => {
                e.preventDefault();
                triggerFullSync();
            });
        }
    }
    if (window.lucide) lucide.createIcons();
});

async function triggerFullSync() {
    if (!confirm("Sync from Google Sheets?")) return;
    
    const btn = document.getElementById('syncTrigger');
    const icon = btn?.querySelector('.sync-icon');
    if (icon) icon.classList.add('spinning');

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const res = await fetch(url, { method: 'GET', mode: 'cors' });

        if (!res.ok) throw new Error("API Connection Failed");

        const data = await res.json();
        if (data.values) {
            assets = data.values.map((row, i) => ({
                name: row[0], country: row[1], type: row[2], currency: row[3],
                value: parseFloat(row[4]?.toString().replace(/[^0-9.-]+/g, "")) || 0, id: Date.now() + i
            }));
            localStorage.setItem('assets', JSON.stringify(assets));
            updateUI();
            alert("Sync Complete!");
        }
    } catch (e) {
        alert("Sync error. Ensure Sheet is Public and API Key is valid.");
    } finally {
        if (icon) icon.classList.remove('spinning');
    }
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

    const display = document.getElementById('totalDisplay');
    if (display) {
        const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref, maximumFractionDigits: 0 });
        display.innerText = fmt.format(net);
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
        const localLine = showLocal ? `<div style="color:var(--text-muted); font-size: 0.75rem; font-weight: 500;">${numFmt.format(localSumm[k])} ${k}</div>` : '';
        return `
            <div class="clickable-row" onclick="window.location.href='detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'">
                <div style="color:var(--prime); font-weight:700">${k}</div>
                <div style="text-align:right;">
                    <div style="color:#fff; font-weight:800;">${numFmt.format(v)} <small style="color:var(--text-muted); font-weight:400;">${ref}</small></div>
                    ${localLine}
                </div>
            </div>
        `;
    }).join('');
}

function setView(v, btn) {
    currentView = v.toLowerCase();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateUI();
}

function populateDropdowns() {
    const fill = (id, list, hasAll=true) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = (hasAll ? '<option value="All">All Items</option>' : '') + list.map(x => `<option value="${x}">${x}</option>`).join('');
    };
    fill('refCurrency', CURRENCIES, false);
    fill('typeFilter', TYPES);
    fill('countryFilter', COUNTRIES);
}

function loadFilters() {
    const s = JSON.parse(localStorage.getItem('filters')) || { exT: false, exC: false, tF: 'All', coF: 'All', ref: 'CAD' };
    const elMap = { exType: 'exT', exCountry: 'exC', typeFilter: 'tF', countryFilter: 'coF', refCurrency: 'ref' };
    Object.keys(elMap).forEach(id => {
        const el = document.getElementById(id);
        if(el) el[el.type === 'checkbox' ? 'checked' : 'value'] = s[elMap[id]];
    });
}

function saveFilters() {
    const s = {
        exT: document.getElementById('exType')?.checked || false,
        exC: document.getElementById('exCountry')?.checked || false,
        tF: document.getElementById('typeFilter')?.value || 'All',
        coF: document.getElementById('countryFilter')?.value || 'All',
        ref: document.getElementById('refCurrency')?.value || 'CAD'
    };
    localStorage.setItem('filters', JSON.stringify(s));
}

function fetchRates() {
    fetch('https://open.er-api.com/v6/latest/USD')
        .then(res => res.json())
        .then(data => {
            if (data.rates) {
                rates = data.rates;
                localStorage.setItem('fx_rates', JSON.stringify(rates));
                updateUI();
            }
        }).catch(() => updateUI());
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
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, cutout: '70%' }
    });
}