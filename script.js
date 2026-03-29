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
    const detailList = document.getElementById('detailsList');
    if (detailList) {
        renderDetails();
    } else {
        populateDropdowns();
        updateUI();
        fetchRates();
        document.getElementById('syncTrigger')?.addEventListener('click', triggerFullSync);
    }
    if (window.lucide) lucide.createIcons();
});

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
            
            assets = data.values.map(row => ({ 
                name: row[0], country: row[1], type: row[2], currency: row[3], 
                value: parseFloat(row[4]?.toString().replace(/[^0-9.-]+/g, "")) || 0 
            }));
            
            localStorage.setItem('assets', JSON.stringify(assets));
            localStorage.setItem('lastSyncTime', new Date().toLocaleString());
            updateUI();
        }
    } catch (e) { alert("Sync Error. Ensure API Key restrictions are set for your domain in Google Cloud Console."); }
    finally { icon?.classList.remove('spinning'); }
}

function updateUI() {
    const ref = document.getElementById('refCurrency')?.value || 'CAD';
    const tF = document.getElementById('typeFilter')?.value || 'All';
    const coF = document.getElementById('countryFilter')?.value || 'All';
    
    const filtered = assets.filter(a => (tF === 'All' || a.type === tF) && (coF === 'All' || a.country === coF));
    
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
    
    const lastWealth = parseFloat(localStorage.getItem('lastWealth')) || net;
    const change = net - lastWealth;
    const changeEl = document.getElementById('changeIndicator');
    if (changeEl) {
        changeEl.innerText = (change >= 0 ? "+" : "") + fmt.format(change);
        changeEl.className = `change-tag ${change >= 0 ? 'change-up' : 'change-down'}`;
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
        <div class="clickable-row" onclick="window.location.href='detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'">
            <div style="font-weight:700; font-size: 1.1rem; color:var(--prime)">${k}</div>
            <div style="font-weight:800; font-size: 1.1rem;">${numFmt.format(v)} <small style="font-weight:400; color:var(--text-muted)">${ref}</small></div>
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

function fetchRates() { fetch('https://open.er-api.com/v6/latest/USD').then(res => res.json()).then(data => { if(data.rates) { rates = data.rates; localStorage.setItem('fx_rates', JSON.stringify(rates)); updateUI(); } }); }

function renderDetails() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const val = params.get('value');
    const ref = params.get('ref');
    document.getElementById('detailTitle').innerText = val;
    const matches = assets.filter(a => (view === 'country' ? a.country === val : (view === 'currency' ? a.currency === val : a.type === val)));
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
    document.getElementById('detailsList').innerHTML = matches.map(a => {
        const conv = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        return `<div style="padding:20px; border:1px solid var(--border); border-radius:15px; margin-bottom:10px; display:flex; justify-content:space-between; background:rgba(255,255,255,0.03)">
            <div><div style="font-size:1.2rem; font-weight:700">${a.name}</div><div style="font-size:0.8rem; color:var(--text-muted)">${a.type} | ${a.country}</div></div>
            <div style="text-align:right"><div style="font-size:1.4rem; font-weight:800; color:var(--prime)">${numFmt.format(conv)} ${ref}</div><div style="font-size:0.9rem; color:var(--text-muted)">${numFmt.format(a.value)} ${a.currency}</div></div>
        </div>`;
    }).join('');
}