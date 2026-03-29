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
    const detailContainer = document.getElementById('detailsList');

    if (detailContainer) {
        // We are on the detail page
        renderDetails();
    } else {
        // We are on the main dashboard
        populateDropdowns();
        loadFilters();
        updateUI();
        fetchRates();
        document.getElementById('syncTrigger')?.addEventListener('click', triggerFullSync);
    }
    if (window.lucide) lucide.createIcons();
});

// --- CORE DETAIL RENDERING ---
function renderDetails() {
    const container = document.getElementById('detailsList');
    if (!container) return;

    // Re-verify assets from storage in case the variable cleared
    if (!assets || assets.length === 0) {
        assets = JSON.parse(localStorage.getItem('assets')) || [];
    }

    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const val = decodeURIComponent(params.get('value') || '');
    const ref = params.get('ref') || 'CAD';

    const titleEl = document.getElementById('detailTitle');
    if (titleEl) titleEl.innerText = val || "Details";

    if (assets.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">No data found. Please go back and Sync.</div>`;
        return;
    }

    const matches = assets.filter(a => {
        if (view === 'country') return a.country === val;
        if (view === 'currency' || view === 'ccy') return a.currency === val;
        return a.type === val;
    });

    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

    container.innerHTML = matches.map(a => {
        const conv = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        return `
            <div style="padding:24px; border:1px solid var(--border); border-radius:16px; margin-bottom:12px; display:flex; justify-content:space-between; background:rgba(255,255,255,0.03); align-items:center;">
                <div>
                    <div style="font-size:1.3rem; font-weight:700; color:#fff">${a.name}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${a.type} | ${a.country}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:1.5rem; font-weight:800; color:var(--prime)">${numFmt.format(conv)} <small style="font-size:0.8rem; opacity:0.7">${ref}</small></div>
                    <div style="font-size:1rem; color:var(--text-muted); font-weight:500;">${numFmt.format(a.value)} ${a.currency}</div>
                </div>
            </div>`;
    }).join('');
}

// --- DASHBOARD LOGIC ---
async function triggerFullSync() {
    const icon = document.querySelector('.sync-icon');
    icon?.classList.add('spinning');
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.values) {
            const currentDisplay = document.getElementById('totalDisplay');
            const currentNet = currentDisplay ? parseFloat(currentDisplay.innerText.replace(/[^0-9.-]+/g, "")) : 0;
            localStorage.setItem('lastWealth', currentNet);
            assets = data.values.map(row => ({ name: row[0], country: row[1], type: row[2], currency: row[3], value: parseFloat(row[4]?.toString().replace(/[^0-9.-]+/g, "")) || 0 }));
            localStorage.setItem('assets', JSON.stringify(assets));
            localStorage.setItem('lastSyncTime', new Date().toLocaleString());
            updateUI();
        }
    } catch (e) { alert("Sync Error. Check API Restrictions."); }
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
        let matchT = (tF === 'All' || a.type === tF);
        if (exT && tF !== 'All') matchT = (a.type !== tF);
        let matchC = (coF === 'All' || a.country === coF);
        if (exC && coF !== 'All') matchC = (a.country !== coF);
        return matchT && matchC;
    });

    let net = 0; const summ = {};
    filtered.forEach(a => {
        const val = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const factor = a.type === "Loan" ? -1 : 1;
        net += (val * factor);
        const key = currentView === 'country' ? a.country : (currentView === 'currency' ? a.currency : a.type);
        summ[key] = (summ[key] || 0) + (val * factor);
    });

    const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref, maximumFractionDigits: 0 });
    const totalDisplay = document.getElementById('totalDisplay');
    if (totalDisplay) totalDisplay.innerText = fmt.format(net);
    
    const changeEl = document.getElementById('changeIndicator');
    const lastWealth = parseFloat(localStorage.getItem('lastWealth')) || net;
    if (changeEl) {
        const diff = net - lastWealth;
        changeEl.innerText = (diff >= 0 ? "+" : "") + fmt.format(diff);
        changeEl.className = `change-tag ${diff >= 0 ? 'change-up' : 'change-down'}`;
    }

    const lastSyncEl = document.getElementById('lastUpdated');
    if (lastSyncEl) lastSyncEl.innerText = `Last Sync: ${localStorage.getItem('lastSyncTime') || 'Never'}`;

    renderSummaryList(summ, ref);
    renderChart(summ);
}

function renderSummaryList(summ, ref) {
    const container = document.getElementById('summaryDisplay');
    if (!container) return;
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
    container.innerHTML = Object.entries(summ).sort((a,b)=>b[1]-a[1]).map(([k, v]) => `
        <div class="clickable-row" onclick="window.location.href='./detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'">
            <div style="font-weight:700; font-size: 1.1rem; color:var(--prime)">${k}</div>
            <div style="font-weight:800; font-size: 1.1rem;">${numFmt.format(v)} <small>${ref}</small></div>
        </div>
    `).join('');
}

function renderChart(summ) {
    const canvas = document.getElementById('assetChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (assetChart) assetChart.destroy();
    assetChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(summ), datasets: [{ data: Object.values(summ).map(v => Math.max(0,v)), backgroundColor: ['#fbbf24','#d97706','#b45309','#92400e','#78350f'], borderWidth: 0 }] },
        options: { plugins: { legend: { display: true, position: 'bottom', labels: { color: '#fff', font: { size: 10 } } } }, maintainAspectRatio: false, cutout: '70%' }
    });
}

function setView(v, btn) { currentView = v; document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); btn.classList.add('active'); updateUI(); }

function populateDropdowns() {
    const fill = (id, list, all=true) => { const el = document.getElementById(id); if(el) el.innerHTML = (all ? '<option value="All">All</option>' : '') + list.map(x => `<option value="${x}">${x}</option>`).join(''); };
    fill('refCurrency', CURRENCIES, false); fill('typeFilter', TYPES); fill('countryFilter', COUNTRIES);
}

function saveFilters() {
    const s = { exT: document.getElementById('exType')?.checked, exC: document.getElementById('exCountry')?.checked, tF: document.getElementById('typeFilter')?.value, coF: document.getElementById('countryFilter')?.value, ref: document.getElementById('refCurrency')?.value };
    localStorage.setItem('filters', JSON.stringify(s));
}

function loadFilters() {
    const s = JSON.parse(localStorage.getItem('filters')) || { exT: false, exC: false, tF: 'All', coF: 'All', ref: 'CAD' };
    if(document.getElementById('exType')) document.getElementById('exType').checked = s.exT;
    if(document.getElementById('exCountry')) document.getElementById('exCountry').checked = s.exC;
    if(document.getElementById('typeFilter')) document.getElementById('typeFilter').value = s.tF;
    if(document.getElementById('countryFilter')) document.getElementById('countryFilter').value = s.coF;
    if(document.getElementById('refCurrency')) document.getElementById('refCurrency').value = s.ref;
}

function fetchRates() { fetch('https://open.er-api.com/v6/latest/USD').then(res => res.json()).then(data => { if(data.rates) { rates = data.rates; localStorage.setItem('fx_rates', JSON.stringify(rates)); updateUI(); } }); }