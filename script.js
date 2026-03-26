// --- CONFIG (ENTER YOUR ID & KEY) ---
const SHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; 
const API_KEY = 'YOUR_GOOGLE_CLOUD_API_KEY_HERE'; 
const RANGE = 'Sheet1!A2:E'; 

const COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"];
const CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR"];
const TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

// Persistent State
let assets = JSON.parse(localStorage.getItem('assets')) || [];
let rates = JSON.parse(localStorage.getItem('fx_rates')) || { USD: 1, CAD: 1.36 };
let currentView = 'type'; 
let assetChart = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    const isDetailPage = window.location.pathname.includes('detail.html');

    if (isDetailPage) {
        renderDetails();
    } else {
        populateDropdowns();
        loadFilters();
        if (assets.length > 0) updateUI();
        fetchRates();

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
                    <div style="color:#fff; font-weight:800; display:flex; align-items:center; justify-content:flex-end;">
                        ${numFmt.format(v)} <span style="color:var(--text-muted); font-size: 0.7rem; font-weight:400; margin-left:4px;">${ref}</span>
                        <i data-lucide="chevron-right" style="width:12px; height:12px; margin-left:8px;"></i>
                    </div>
                    ${localLine}
                </div>
            </div>
        `;
    }).join('');
    if(window.lucide) lucide.createIcons();
}

// --- DETAIL PAGE LOGIC ---

function renderDetails() {
    const params = new URLSearchParams(window.location.search);
    const view = (params.get('view') || 'type').toLowerCase();
    const filterValue = params.get('value');
    const ref = params.get('ref') || 'CAD';

    const container = document.getElementById('detailsList');
    const titleEl = document.getElementById('detailTitle');
    if (!container || !titleEl) return;

    titleEl.innerText = filterValue;

    const matches = assets.filter(a => {
        if (view === 'currency' || view === 'ccy') return a.currency === filterValue;
        if (view === 'country') return a.country === filterValue;
        return a.type === filterValue;
    });

    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

    container.innerHTML = matches.map(a => {
        const convertedVal = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const isDifferentCcy = a.currency !== ref;
        
        // Show original local amount on the detail page
        const localLine = isDifferentCcy 
            ? `<div style="color:var(--text-muted); font-size: 0.8rem; font-weight: 500; margin-top: 4px;">
                ${numFmt.format(a.value)} ${a.currency} <span style="font-size: 0.7rem;">(Original)</span>
               </div>` 
            : '';

        return `
            <div class="asset-item">
                <div>
                    <div class="asset-name">${a.name}</div>
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">
                        ${a.type} • ${a.country}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="asset-value">
                        ${numFmt.format(convertedVal)} <small style="font-weight: 400; font-size: 0.7rem; color: var(--text-muted)">${ref}</small>
                    </div>
                    ${localLine}
                </div>
            </div>
        `;
    }).join('');
}

// --- SHARED UTILITIES ---

async function triggerFullSync() {
    if (!confirm("Sync from Google Sheets?")) return;
    const btn = document.getElementById('syncTrigger');
    const icon = btn?.querySelector('.sync-icon');
    if(icon) icon.classList.add('spinning');
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.values) {
            assets = data.values.map((row, i) => ({
                name: row[0], country: row[1], type: row[2], currency: row[3],
                value: parseFloat(row[4]?.toString().replace(/[^0-9.-]+/g, "")) || 0, id: Date.now() + i
            }));
            localStorage.setItem('assets', JSON.stringify(assets));
            updateUI();
        }
    } catch (e) { alert("Sync error."); } 
    finally { if(icon) icon.classList.remove('spinning'); }
}

function renderChart(summ) {
    const canvas = document.getElementById('assetChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (assetChart) assetChart.destroy();
    
    const labels = Object.keys(summ);
    const data = Object.values(summ).map(v => Math.max(0, v));
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

    assetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#fbbf24','#d97706','#b45309','#92400e','#78350f','#5c2b06','#334155'],
                borderWidth: 2, borderColor: '#0f172a'
            }]
        },
        options: { 
            plugins: { 
                legend: { 
                    display: true, position: 'bottom',
                    labels: { 
                        color: '#f8fafc', padding: 15, usePointStyle: true,
                        font: { size: 11, weight: '600' },
                        generateLabels: (chart) => {
                            const d = chart.data;
                            return d.labels.map((label, i) => ({
                                text: `${label}: ${numFmt.format(d.datasets[0].data[i])}`,
                                fillStyle: d.datasets[0].backgroundColor[i],
                                strokeStyle: d.datasets[0].backgroundColor[i],
                                fontColor: '#f8fafc', index: i
                            }));
                        }
                    } 
                }
            },
            maintainAspectRatio: false, cutout: '65%'
        }
    });
}

function fetchRates() {
    fetch('https://open.er-api.com/v6/latest/USD')
        .then(res => res.json())
        .then(data => {
            if (data.rates) {
                rates = data.rates;
                localStorage.setItem('fx_rates', JSON.stringify(rates));
                if (assets.length > 0) updateUI();
            }
        }).catch(e => console.warn("Rate fetch failed. Using cache."));
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