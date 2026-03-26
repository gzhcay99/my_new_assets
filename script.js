const SHEET_ID = '1IzUo-d4_9C9pnJR-12R7Uy1AfHfxRkb8WauXOqCENyg'; 
const API_KEY = 'AIzaSyAxbVThyW2UZHsWZr4-UxkjanGxmgDtuRY'; 
const RANGE = 'webApp!A2:E';  

const COUNTRIES = ["Malaysia", "Singapore", "Hong Kong", "USA", "Canada", "Switzerland", "UK", "IBKR", "yy private", "kirsty", "philip", "markus"];
const CURRENCIES = ["MYR", "SGD", "HKD", "USD", "CAD", "CHF", "GBP", "EUR"];
const TYPES = ["Cash", "Fixed Term Deposit", "Bonds", "Stocks and Funds", "Real Estate", "Crypto", "Other", "Loan"];

let assets = JSON.parse(localStorage.getItem('assets')) || [];
let rates = JSON.parse(localStorage.getItem('fx_rates')) || { USD: 1, CAD: 1.36 };
let currentView = 'type', assetChart = null;

window.onload = () => {
    populateDropdowns();
    loadFilters();
    fetchRates();
};

function loadFilters() {
    const s = JSON.parse(localStorage.getItem('filters')) || { exT: false, exC: false, tF: 'All', coF: 'All', ref: 'CAD' };
    document.getElementById('exType').checked = s.exT;
    document.getElementById('exCountry').checked = s.exC;
    document.getElementById('typeFilter').value = s.tF;
    document.getElementById('countryFilter').value = s.coF;
    document.getElementById('refCurrency').value = s.ref;
}

function saveFilters() {
    const s = {
        exT: document.getElementById('exType').checked,
        exC: document.getElementById('exCountry').checked,
        tF: document.getElementById('typeFilter').value,
        coF: document.getElementById('countryFilter').value,
        ref: document.getElementById('refCurrency').value
    };
    localStorage.setItem('filters', JSON.stringify(s));
}

async function fetchRates() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data.rates) {
            rates = data.rates;
            localStorage.setItem('fx_rates', JSON.stringify(rates));
            updateUI();
        }
    } catch (e) { updateUI(); }
}

function setView(v, btn) {
    currentView = v;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    updateUI();
}

function updateUI() {
    saveFilters();
    const ref = document.getElementById('refCurrency').value;
    const tF = document.getElementById('typeFilter').value;
    const coF = document.getElementById('countryFilter').value;
    const exT = document.getElementById('exType').checked;
    const exC = document.getElementById('exCountry').checked;

    const filtered = assets.filter(a => {
        let mT = (tF === 'All' || a.type === tF);
        if (exT && tF !== 'All') mT = (a.type !== tF);
        let mC = (coF === 'All' || a.country === coF);
        if (exC && coF !== 'All') mC = (a.country !== coF);
        return mT && mC;
    });

    let net = 0; const summ = {};
    const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: ref, maximumFractionDigits: 0 });

    filtered.forEach(a => {
        const val = (a.value / (rates[a.currency] || 1)) * (rates[ref] || 1);
        const factor = a.type === "Loan" ? -1 : 1;
        net += (val * factor);
        
        const key = currentView === 'currency' ? a.currency : (currentView === 'country' ? a.country : a.type);
        summ[key] = (summ[key] || 0) + (val * factor);
    });

    document.getElementById('totalDisplay').innerText = fmt.format(net);
    renderSummaryList(summ, ref);
    renderChart(summ);
}

function renderSummaryList(summ, ref) {
    const container = document.getElementById('summaryDisplay');
    if(!container) return;
    const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

    container.innerHTML = Object.entries(summ).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k, v]) => `
        <div class="clickable-row" onclick="window.location.href='detail.html?view=${currentView}&value=${encodeURIComponent(k)}&ref=${ref}'">
            <div style="color:var(--prime); font-weight:700">${k}</div>
            <div style="color:#fff;">
                <b>${numFmt.format(v)}</b> <small style="color:var(--text-muted)">${ref}</small>
                <i data-lucide="chevron-right" style="width:12px; vertical-align:middle; margin-left:10px;"></i>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
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
                borderWidth: 2,
                borderColor: '#0f172a'
            }]
        },
        options: { 
            plugins: { 
                legend: { 
                    display: true, 
                    position: 'bottom',
                    labels: { 
                        color: '#f8fafc',
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            return data.labels.map((label, i) => ({
                                text: `${label}: ${numFmt.format(data.datasets[0].data[i])}`,
                                fillStyle: data.datasets[0].backgroundColor[i],
                                strokeStyle: data.datasets[0].backgroundColor[i],
                                fontColor: '#f8fafc',
                                lineWidth: 0,
                                index: i
                            }));
                        }
                    } 
                }
            },
            maintainAspectRatio: false,
            cutout: '65%'
        }
    });
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

async function triggerFullSync() {
    if (!confirm("Sync from Google Sheets?")) return;
    
    const icon = document.querySelector('.sync-icon');
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
    } catch (e) {
        console.error("Sync error", e);
    } finally {
        if(icon) icon.classList.remove('spinning');
    }
}