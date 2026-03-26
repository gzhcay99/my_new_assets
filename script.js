// --- CONFIG (ENTER YOUR ID & KEY) ---
const SHEET_ID = '1IzUo-d4_9C9pnJR-12R7Uy1AfHfxRkb8WauXOqCENyg'; 
const API_KEY = 'AIzaSyAxbVThyW2UZHsWZr4-UxkjanGxmgDtuRY'; 
const RANGE = 'webApp!A2:E';   

const COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"];
const CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR"];
const TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

// Persistent State
let assets = JSON.parse(localStorage.getItem('assets')) || [];
let rates = JSON.parse(localStorage.getItem('fx_rates')) || { USD: 1, CAD: 1.36 };
let currentView = 'type'; 
let assetChart = null;

// --- INITIALIZATION (AUTO-RUN) ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the Detail Page or Home Page
    const isDetailPage = window.location.pathname.includes('detail.html');

    if (isDetailPage) {
        renderDetails();
    } else {
        populateDropdowns();
        loadFilters();
        
        // Render immediately from cache so the UI isn't blank
        if (assets.length > 0) updateUI();

        // Refresh FX rates in the background
        fetchRates();

        // Bind the Sync button with specific Desktop/Mobile event listener
        const syncBtn = document.getElementById('syncTrigger');
        if (syncBtn) {
            syncBtn.addEventListener('click', (e) => {
                e.preventDefault();
                triggerFullSync();
            });
        }
    }
});

// --- HOME PAGE LOGIC ---

function setView(v, btn) {
    currentView = v.toLowerCase();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');
    updateUI();
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

    let net = 0; 
    const summ = {}; 
    const localSumm = {}; 

    // Normalize check for the CCY tab (supports both 'currency' and 'ccy')
    const isCurrencyView = (currentView === 'currency' || currentView === 'ccy');

    filtered.forEach(a => {
        const val = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const factor = a.type === "Loan" ? -1 : 1;
        net += (val * factor);
        
        const key = isCurrencyView ? a.currency : (currentView === 'country' ? a.country : a.type);
        summ[key] = (summ[key] || 0) + (val * factor);
        
        if (isCurrencyView) {
            localSumm[key] = (localSumm[key] || 0) + (a.value * factor);
        }
    });

    const display = document.getElementById('totalDisplay');
    if(display) {
        const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref, maximumFractionDigits: 0 });
        display.innerText = fmt.format(net);
    }
    
    renderSummaryList(summ, ref, localSumm, isCurrencyView);
    renderChart(summ);
}

function renderSummaryList(summ, ref, localSumm, isCurrencyView) {
    const container = document.getElementById('summaryDisplay');
    if(!container) return;
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

    container.innerHTML = Object.entries(summ).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k, v]) => {
        const showLocal = (isCurrencyView && k !== ref);
        const localLine = showLocal ? `<div style="color:var(--text-muted); font-size: 0.75rem; font-weight: 500; margin-top: 2px;">${numFmt.format(localSumm[k])} ${k}</div>` : '';

        return `
            <div class="clickable-row" onclick="window.location.href='detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'">
                <div style="color:var(--prime); font-weight:700">${k}</div>
                <div style="text-align:right;">
                    <div style="color:#fff; font-weight:80