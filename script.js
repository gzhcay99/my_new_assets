console.log("AssetHQ Pro V2.4 [DEPLOYED] - Native Totals Dashboard + Details");

const SHEET_ID = '1IzUo-d4_9C9pnJR-12R7Uy1AfHfxRkb8WauXOqCENyg'; 
const API_KEY = 'AIzaSyAxbVThyW2UZHsWZr4-UxkjanGxmgDtuRY'; 
const RANGE = 'webApp!A2:E'; 

const CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR"];
const COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"];
const TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

let assets = [];
let rates = { USD: 1, CAD: 1.36 };
let currentView = 'type';
let assetChart = null;

function loadDataFromStorage() {
    try {
        const storedAssets = localStorage.getItem('assets');
        const storedRates = localStorage.getItem('fx_rates');
        assets = storedAssets ? JSON.parse(storedAssets) : [];
        rates = storedRates ? JSON.parse(storedRates) : { USD: 1, CAD: 1.36 };
    } catch (e) { console.warn("Storage access failed:", e); }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    const isDetailPage = !!document.getElementById('detailsList');

    if (isDetailPage) {
        renderDetails();
    } else {
        populateDropdowns();
        loadFilters();
        updateUI();
        fetchRates();
        
        const syncBtn = document.getElementById('syncTrigger');
        if (syncBtn) syncBtn.onclick = triggerFullSync;

        const clearBtn = document.getElementById('clearCacheBtn');
        if (clearBtn) {
            clearBtn.onclick = () => {
                if (confirm("Clear all local data and reset filters?")) {
                    localStorage.clear();
                    window.location.reload(true); // Forced reload
                }
            };
        }
    }
    if (window.lucide) lucide.createIcons();
});

function updateUI() {
    const totalDisplay = document.getElementById('totalDisplay');
    if (!totalDisplay) return;

    const ref = document.getElementById('refCurrency')?.value || 'CAD';
    const tF = document.getElementById('typeFilter')?.value || 'All';
    const coF = document.getElementById('countryFilter')?.value || 'All';
    const exT = document.getElementById('exType')?.checked || false;
    const exC = document.getElementById('exCountry')?.checked || false;

    saveFilters();

    const filtered = assets.filter(a => {
        let matchT = (tF === 'All' || a.type === tF);
        if (exT && tF !== 'All') matchT = (a.type !== tF);
        let matchC = (coF === 'All' || a.country === coF);
        if (exC && coF !== 'All') matchC = (a.country !== coF);
        return matchT && matchC;
    });

    let net = 0; 
    const summ = {}; 
    const nativeSumm = {}; 

    filtered.forEach(a => {
        const factor = a.type === "Loan" ? -1 : 1;
        const valConverted = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        net += (valConverted * factor);
        
        const key = currentView === 'country' ? a.country : (currentView === 'currency' ? a.currency : a.type);
        summ[key] = (summ[key] || 0) + (valConverted * factor);
        
        if (currentView === 'currency') {
            nativeSumm[key] = (nativeSumm[key] || 0) + (a.value * factor);
        }
    });

    const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref, maximumFractionDigits: 0 });
    totalDisplay.innerText = fmt.format(net);
    
    renderSummaryList(summ, ref, nativeSumm);
    if (document.getElementById('assetChart')) renderChart(summ);
}

function renderSummaryList(summ, ref, nativeSumm) {
    const container = document.getElementById('summaryDisplay');
    if (!container) return;
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
    
    container.innerHTML = Object.entries(summ).sort((a,b)=>b[1]-a[1]).map(([k, v]) => {
        const subLabel = (currentView === 'currency' && nativeSumm[k] !== undefined) 
            ? `<div style="font-size: 0.85rem; color: var(--prime); font-weight: 700;">${numFmt.format(nativeSumm[k])} ${k}</div>`
            : `<div style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;">${numFmt.format(v)} ${ref}</div>`;

        return `
        <div class="clickable-row" onclick="window.location.href='./detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 15px; border-bottom: 1px solid var(--border);">
            <div>
                <div style="font-weight:700; color:#fff; font-size: 1.15rem; margin-bottom: 2px;">${k}</div>
                ${subLabel}
            </div>
            <div style="text-align: right;">
                <div style="font-weight:800; font-size: 1.15rem; color: #fff;">${numFmt.format(v)} <small style="font-size: 0.7rem; opacity:0.6;">${ref}</small></div>
            </div>
        </div>
    `}).join('');
}

async function triggerFullSync() {
    const icon = document.querySelector('.sync-icon');
    if (icon) icon.classList.add('spinning');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}&t=${Date.now()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.values) {
            assets = data.values.map(row => ({ 
                name: row[0], country: row[1], type: row[2], currency: row[3], 
                value: parseFloat(row[4]?.toString().replace(/[^0-9.-]+/g, "")) || 0 
            }));
            localStorage.setItem('assets', JSON.stringify(assets));
            localStorage.setItem('lastSyncTime', new Date().toLocaleString());
            updateUI();
            alert("Sync Successful!");
        }
    } catch (e) { alert("Sync Error: " + e.message); }
    finally { if (icon) icon.classList.remove('spinning'); }
}

function renderDetails() {
    const container = document.getElementById('detailsList');
    if (!container) return;
    if (assets.length === 0) loadDataFromStorage();

    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const val = decodeURIComponent(params.get('value') || '');
    const ref = params.get('ref') || 'CAD';

    const matches = assets.filter(a => (view === 'country' ? a.country === val : (view === 'currency' ? a.currency === val : a.type === val)));
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

    let totalRef = 0;
    let totalNative = 0;
    matches.forEach(a => {
        const factor = a.type === "Loan" ? -1 : 1;
        totalRef += ((a.value / (rates[a.currency] || 1)) * (rates[ref] || 1)) * factor;
        totalNative += a.value * factor;
    });

    let html = `
        <div style="background: var(--prime); color: #000; padding: 22px; border-radius: 18px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 12px 24px rgba(0,0,0,0.3);">
            <div>
                <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; opacity: 0.7; margin-bottom: 4px;">Total (${ref})</div>
                <div style="font-size: 1.7rem; font-weight: 900; letter-spacing: -0.5px;">${numFmt.format(totalRef)}</div>
            </div>
            ${view === 'currency' ? `
            <div style="text-align: right; border-left: 1px solid rgba(0,0,0,0.1); padding-left: 20px;">
                <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; opacity: 0.7; margin-bottom: 4px;">Native (${val})</div>
                <div style="font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px;">${numFmt.format(totalNative)}</div>
            </div>` : ''}
        </div>
    `;

    html += matches.map(a => {
        const conv = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const factor = a.type === "Loan" ? -1 : 1;
        return `
        <div class="detail-card" style="padding:20px; border:1px solid var(--border); border-radius:14px; margin-bottom:12px; display:flex; justify-content:space-between; background:rgba(255,255,255,0.03); align-items:center;">
            <div>
                <div style="font-weight:700; color:#fff; font-size:1.1rem; margin-bottom: 4px;">${a.name}</div>
                <div style="font-size: 0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing: 0.5px;">${a.type} • ${a.country}</div>
            </div>
            <div style="text-align:right;">
                <div style="color:${factor === -1 ? '#ff4444' : 'var(--prime)'}; font-weight:800; font-size:1.15rem;">${numFmt.format(conv)} <small style="font-size: 0.7rem; font-weight: 400; opacity: 0.7;">${ref}</small></div>
                <div style="font-size:0.85rem; color:#fff; opacity:0.6; font-weight: 500;">${numFmt.format(a.value)} ${a.currency}</div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
    if (document.getElementById('detailTitle')) document.getElementById('detailTitle').innerText = val;
}

function fetchRates() { 
    fetch('https://open.er-api.com/v6/latest/USD').then(res => res.json()).then(data => { 
        if(data.rates) { rates = data.rates; localStorage.setItem('fx_rates', JSON.stringify(rates)); updateUI(); } 
    }); 
}

function setView(v, btn) { currentView = v; document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); btn.classList.add('active'); updateUI(); }

function populateDropdowns() {
    const fill = (id, list, all=true) => { const el = document.getElementById(id); if(el) el.innerHTML = (all ? '<option value="All">All</option>' : '') + list.map(x => `<option value="${x}">${x}</option>`).join(''); };
    fill('refCurrency', CURRENCIES, false); fill('typeFilter', TYPES); fill('countryFilter', COUNTRIES);
}

function saveFilters() {
    const e = id => document.getElementById(id);
    localStorage.setItem('filters', JSON.stringify({ exT: e('exType')?.checked, exC: e('exCountry')?.checked, tF: e('typeFilter')?.value, coF: e('countryFilter')?.value, ref: e('refCurrency')?.value }));
}

function loadFilters() {
    const s = JSON.parse(localStorage.getItem('filters')) || { tF: 'All', coF: 'All', ref: 'CAD' };
    const e = id => document.getElementById(id);
    if(e('exType')) e('exType').checked = s.exT; if(e('exCountry')) e('exCountry').checked = s.exC;
    if(e('typeFilter')) e('typeFilter').value = s.tF; if(e('countryFilter')) e('countryFilter').value = s.coF;
    if(e('refCurrency')) e('refCurrency').value = s.ref;
}

function renderChart(summ) {
    const canvas = document.getElementById('assetChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (assetChart) assetChart.destroy();
    assetChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(summ), datasets: [{ data: Object.values(summ).map(v => Math.max(0,v)), backgroundColor: ['#fbbf24','#d97706','#b45309','#92400e','#78350f'], borderWidth: 0 }] }, options: { plugins: { legend: { display: true, position: 'bottom', labels: { color: '#fff', font: { size: 10 } } } }, maintainAspectRatio: false, cutout: '70%' } });
}