// REMOVED: const CORRECT_PASSWORD ... (No longer needed!)

// --- 1. HISTORY & BACK GESTURE HANDLER ---
window.addEventListener('popstate', function(event) {
    // A. Check if any Modal is open
    // We look for any div with an ID ending in 'Modal' that is flex (visible) and not hidden
    const openModal = document.querySelector('div[id$="Modal"].flex:not(.hidden)');
    
    if (openModal) {
        // If a modal is open, close it (pass 'true' to say it came from Back button)
        closeModal(openModal.id, true);
        return;
    }

    // B. Check if Mobile Menu is open
    const drawer = document.getElementById('mobileMenuDrawer');
    if (drawer && drawer.classList.contains('open')) {
        toggleMobileMenu(true); // Close drawer via Back button
        return;
    }

    // C. Handle Page Navigation
    if (event.state && event.state.page) {
        // If history has a page, go there (pass 'true' to skip pushing state again)
        showPage(event.state.page, true);
    } else {
        // Fallback for initial load
        showPage('dashboard', true);
    }
});

let transactions = [], subscriptions = [], sips = [], accounts = [], loans = [], dreams = [], monthlyBudget = 0;
// NEW VARIABLES FOR PAGINATION:
let currentAnalyticsLimit = 20, cachedFilteredTx = [];
let chartInstance = null, barChartInstance = null, analyticsBarInstance = null, analyticsDoughnutInstance = null, categories = [];

const defaultCategories = ["Food", "Travel", "Bills", "Shopping", "Medical", "Rent", "EMI", "Salary", "Business", "Freelance", "Gift", "Investment", "Other"];
const quotes = [{ t: "Money is a terrible master but an excellent servant.", a: "P.T. Barnum" },{ t: "The art is not in making money, but in keeping it.", a: "Proverb" }];

function loadMoreAnalytics() {
    currentAnalyticsLimit += 20;
    renderAnalyticsView();
}

window.onload = function() { 
    // 1. THEME SETUP
    if(localStorage.getItem('rg_theme') === 'dark') document.documentElement.classList.add('dark');
    
    // 2. SIDEBAR STATE
    const sidebarState = localStorage.getItem('rg_sidebar_collapsed');
    if(sidebarState === 'true') {
        document.getElementById('mainSidebar').classList.add('collapsed');
    }

    // 3. AUTH CHECK
    // Logic: If auth is true, initApp handles data + routing. 
    // If auth is false, initAuth handles the login screen.
    if (sessionStorage.getItem('rg_auth') === 'true') { 
        document.getElementById('loginOverlay').classList.add('hidden'); 
        initApp(); 
    } else {
        initAuth(); 
    }
    
    // 4. GLOBAL CLICK LISTENERS
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-select-wrapper')) {
            document.querySelectorAll('.custom-select-wrapper').forEach(el => el.classList.remove('open'));
        }
    });

    // 5. PWA & NOTIFICATIONS SETUP
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered!', reg))
            .catch(err => console.log('SW Failed', err));
    }
    
    // Ask for permission immediately (or you can move this to a button click)
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

};

function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    localStorage.setItem('rg_theme', html.classList.contains('dark') ? 'dark' : 'light');
    updateDashboard();
    if(document.getElementById('page-analytics').classList.contains('active')) runAnalytics();
}

function toggleSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('rg_sidebar_collapsed', sidebar.classList.contains('collapsed'));
}

// --- AUTHENTICATION LOGIC ---

function initAuth() {
    document.getElementById('loginOverlay').classList.remove('hidden');
    const storedPass = localStorage.getItem('rg_password');
    
    // Hide all forms first
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('setupForm').classList.add('hidden');
    document.getElementById('recoveryForm').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');

    if (!storedPass) {
        // Mode: SETUP
        document.getElementById('setupForm').classList.remove('hidden');
    } else {
        // Mode: LOGIN
        document.getElementById('loginForm').classList.remove('hidden');
        setTimeout(() => document.getElementById('passwordInput').focus(), 100);
    }
}

function handleSetup(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pass = fd.get('newPass');
    const key = fd.get('recoveryKey');

    if(pass.length < 4) { showToast('Password too short', 'error'); return; }
    if(!key) { showToast('Recovery key needed', 'error'); return; }

    localStorage.setItem('rg_password', pass);
    localStorage.setItem('rg_recovery', key.toLowerCase().trim()); // Store lowercase for easy matching

    showToast('Vault Secured!');
    sessionStorage.setItem('rg_auth', 'true');
    playMotivation();
}

function handleLogin(e) { 
    e.preventDefault(); 
    const input = document.getElementById('passwordInput');
    const errorMsg = document.getElementById('loginError');
    const storedPass = localStorage.getItem('rg_password');

    if(input.value === storedPass) { 
        sessionStorage.setItem('rg_auth', 'true'); 
        playMotivation(); 
    } else { 
        input.classList.add('input-error');
        errorMsg.innerText = "Incorrect Password";
        errorMsg.classList.remove('hidden');
        errorMsg.classList.add('animate-shake');
        input.value = '';
        input.focus();
        setTimeout(() => {
            input.classList.remove('input-error');
            errorMsg.classList.remove('animate-shake');
        }, 500);
    } 
}

function showRecovery() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('recoveryForm').classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
}

function handleRecovery(e) {
    e.preventDefault();
    const input = document.getElementById('recoveryInput');
    const key = input.value.toLowerCase().trim();
    const storedKey = localStorage.getItem('rg_recovery');

    if(key === storedKey) {
        // Success! Clear password and go to setup
        localStorage.removeItem('rg_password');
        showToast('Verified! Set new password.');
        initAuth(); // This will trigger Setup Mode since password is gone
    } else {
        input.classList.add('input-error');
        showToast('Wrong Recovery Key', 'error');
        setTimeout(() => input.classList.remove('input-error'), 500);
    }
}

function playMotivation() {
    document.getElementById('loginOverlay').classList.add('hidden'); 
    const loader = document.getElementById('appLoader'); 
    loader.classList.remove('hidden'); 
    setTimeout(() => loader.style.opacity = '1', 50);
    
    const txt = document.getElementById('motivationalText'); 
    const auth = document.getElementById('motivationalAuthor'); 
    const progress = document.getElementById('loaderProgress'); 
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    
    setTimeout(() => { txt.innerText = `"${q.t}"`; txt.style.opacity = '1'; txt.style.transform = 'translateY(0)'; progress.style.width = '100%'; }, 600);
    setTimeout(() => { auth.innerText = `— ${q.a}`; auth.style.opacity = '1'; }, 1200);
    
    setTimeout(() => { 
        try { 
            initApp(); 
            // CHECK BACKUP STATUS HERE 
            setTimeout(checkBackupStatus, 1000); 
        } 
        catch(e) { console.error(e); } 
        finally { 
            loader.style.opacity = '0'; 
            setTimeout(() => loader.classList.add('hidden'), 700); 
        } 
    }, 2500); 
}

function logout() { sessionStorage.removeItem('rg_auth'); location.reload(); }

function initApp() { 
    transactions = JSON.parse(localStorage.getItem('rg_transactions')) || [];
    subscriptions = JSON.parse(localStorage.getItem('rg_subscriptions')) || [];
    sips = JSON.parse(localStorage.getItem('rg_sips')) || [];
    loans = JSON.parse(localStorage.getItem('rg_loans')) || [];
    dreams = JSON.parse(localStorage.getItem('rg_dreams')) || [];
    accounts = JSON.parse(localStorage.getItem('rg_accounts')) || [];
    categories = JSON.parse(localStorage.getItem('rg_categories')) || defaultCategories;
    monthlyBudget = parseFloat(localStorage.getItem('rg_budget')) || 0;
    
    // Ensure at least one wallet exists
    if(accounts.length === 0) { accounts.push({id: 1, name: 'Cash', type: 'Cash', balance: 0}); localStorage.setItem('rg_accounts', JSON.stringify(accounts)); }
    
    // Build Navigation
    const menu = [ 
        {id:'dashboard',l:'Dashboard',i:'fa-chart-pie'}, 
        {id:'analytics',l:'Analytics',i:'fa-chart-simple'}, 
        {id:'loans',l:'Loans',i:'fa-hand-holding-dollar'}, 
        {id:'dreams',l:'Dreams',i:'fa-bullseye'}, 
        {id:'autopay',l:'Auto-Pay',i:'fa-bolt'}, 
        {id:'mutualfunds',l:'Portfolio',i:'fa-chart-line'}
    ];
    document.getElementById('desktopNav').innerHTML = menu.map(i => `<button onclick="showPage('${i.id}')" id="nav-${i.id}" class="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm group mb-1"><i class="fa-solid ${i.i} w-5 flex-shrink-0 group-hover:text-mintPrimary dark:group-hover:text-teal-400 transition-colors"></i> <span class="sidebar-text">${i.l}</span></button>`).join('');
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // --- FLATPICKR CONFIGURATION ---
    flatpickr("input[type=date]", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d-m-Y", 
        defaultDate: "today",
        disableMobile: true,
        allowInput: true,
        monthSelectorType: 'dropdown',
        animate: true
    });

    // Initialize Analytics Date Pickers specifically
    // Initialize Analytics Date Pickers specifically
    // disableMobile: true -> Forces the Custom Glass Calendar instead of Native Wheel
    flatpickr("#analyticsStart", { 
        disableMobile: true, 
        defaultDate: firstDay, 
        dateFormat: "Y-m-d", 
        altInput: true, 
        altFormat: "d-m-Y", 
        allowInput: true 
    });
    
    flatpickr("#analyticsEnd", { 
        disableMobile: true, 
        defaultDate: today, 
        dateFormat: "Y-m-d", 
        altInput: true, 
        altFormat: "d-m-Y", 
        allowInput: true 
    });

    // PAGE PERSISTENCE & DEEP LINKING
    // 1. Define what counts as a "Real Page"
    const validPages = ['dashboard', 'analytics', 'loans', 'dreams', 'autopay', 'mutualfunds'];
    
    // 2. Check the URL
    let targetPage = location.hash ? location.hash.substring(1) : null;

    // 3. Safety Check: If URL is a modal (e.g., #txModal) or invalid, fallback to Dashboard/Last Page
    if (!validPages.includes(targetPage)) {
        targetPage = localStorage.getItem('rg_last_page') || 'dashboard';
        // Clean the URL so it doesn't say #txModal anymore
        history.replaceState({ page: targetPage }, '', `#${targetPage}`);
    } else {
        // It's a valid page, just ensure history state is set
        history.replaceState({ page: targetPage }, '', `#${targetPage}`);
    }

    showPage(targetPage, true);
    
    toggleTxType(); 
    updateDashboard();
    
    setTimeout(initCustomSelects, 100);
    checkNotifications();

}

// --- CUSTOM SELECT LOGIC ---
function initCustomSelects() {
    const selects = document.querySelectorAll('select:not(.flatpickr-monthDropdown-months)');
    
    selects.forEach(select => {
        if(select.parentNode.classList.contains('custom-select-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        
        // Logic to determine initial text
        const selectedOption = select.options[select.selectedIndex];
        const initialText = selectedOption ? selectedOption.text : 'Select...';
        trigger.textContent = initialText;
        
        // CRITICAL FIX: Force label up if value exists on load
        if(initialText !== 'Select...' && select.value !== "") {
            wrapper.classList.add('has-value');
        }

        wrapper.appendChild(trigger);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'custom-options';
        
        Array.from(select.options).forEach(opt => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-option' + (opt.selected ? ' selected' : '');
            optionDiv.textContent = opt.text;
            optionDiv.dataset.value = opt.value;
            
            optionDiv.addEventListener('click', function() {
                select.value = this.dataset.value;
                select.dispatchEvent(new Event('change')); // Trigger change for app logic
                
                trigger.textContent = this.textContent;
                
                wrapper.querySelector('.custom-option.selected')?.classList.remove('selected');
                this.classList.add('selected');
                
                wrapper.classList.remove('open');
                wrapper.classList.add('has-value'); // Ensure label stays up
            });
            optionsDiv.appendChild(optionDiv);
        });
        wrapper.appendChild(optionsDiv);

        trigger.addEventListener('click', () => {
            // Close others
            document.querySelectorAll('.custom-select-wrapper').forEach(el => {
                if(el !== wrapper) el.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });
    });
}

function refreshCustomSelects() {
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const select = wrapper.querySelector('select');
        wrapper.parentNode.insertBefore(select, wrapper); 
        wrapper.remove(); 
    });
    initCustomSelects(); 
}

// --- WALLET CONTROL CENTER ---
function viewWallet(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;

    document.getElementById('editWalletId').value = id;
    document.getElementById('walletModalTitle').innerHTML = `<i class="fa-solid fa-wallet text-mintPrimary mr-2"></i> ${acc.name}`;
    
    document.getElementById('editWalletName').value = acc.name;
    document.getElementById('editWalletCurrentBalance').innerText = formatINR(acc.balance);
    document.getElementById('newWalletBalance').value = ''; 

    openModal('walletDetailsModal');
}

function saveWalletName() {
    const id = parseInt(document.getElementById('editWalletId').value);
    const newName = document.getElementById('editWalletName').value.trim();
    const acc = accounts.find(a => a.id === id);

    if (!newName || newName === acc.name) return;

    const oldName = acc.name;
    acc.name = newName;

    transactions.unshift({
        id: Date.now(), type: 'transfer', amount: 0,
        desc: `Renamed: ${oldName} ➝ ${newName}`,
        category: 'System', accountId: id, date: new Date().toISOString().split('T')[0]
    });

    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));
    
    document.getElementById('walletModalTitle').innerHTML = `<i class="fa-solid fa-wallet text-mintPrimary mr-2"></i> ${newName}`;
    updateDashboard();
    populateAccountSelects();
    showToast('Wallet Renamed');
}

function saveWalletBalance() {
    const id = parseInt(document.getElementById('editWalletId').value);
    const newBal = parseFloat(document.getElementById('newWalletBalance').value);
    const acc = accounts.find(a => a.id === id);

    if (isNaN(newBal)) { showToast('Enter valid amount', 'error'); return; }

    const diff = newBal - acc.balance;
    if (diff === 0) return;

    const type = diff > 0 ? 'income' : 'expense';
    transactions.unshift({
        id: Date.now(), type: type, amount: Math.abs(diff),
        desc: `Balance Correction`, category: 'Adjustment', accountId: id, date: new Date().toISOString().split('T')[0]
    });

    acc.balance = newBal;
    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));

    document.getElementById('editWalletCurrentBalance').innerText = formatINR(newBal);
    updateDashboard();
    showToast('Balance Adjusted');
    closeModal('walletDetailsModal');
}

function softDeleteWallet() {
    const id = parseInt(document.getElementById('editWalletId').value);
    
    askConfirm('Archive this wallet? History remains safe.', () => {
        const acc = accounts.find(a => a.id === id);
        acc.isDeleted = true; 
        acc.balance = 0; 

        transactions.unshift({
            id: Date.now(), type: 'expense', amount: 0,
            desc: `Wallet Archived: ${acc.name}`, category: 'System', accountId: id, date: new Date().toISOString().split('T')[0]
        });

        localStorage.setItem('rg_accounts', JSON.stringify(accounts));
        localStorage.setItem('rg_transactions', JSON.stringify(transactions));
        
        closeModal('walletDetailsModal'); 
        updateDashboard();
        populateAccountSelects(); 
        showToast('Wallet Archived');
    });
}

// --- PORTFOLIO & SELLING LOGIC ---
function saveSip(e){
    e.preventDefault(); if(!checkFormValidity(e.target))return;
    const fd=new FormData(e.target), t=fd.get('sipType'), amt=parseFloat(fd.get('sipAmount')), aid=parseInt(fd.get('sipAccountId')), q=t==='OneTime'?parseFloat(fd.get('sipQty')):null, p=t==='OneTime'?parseFloat(fd.get('sipPrice')):null, bd=fd.get('buyDate');
    
    if(t==='OneTime'){
        const ai=accounts.findIndex(a=>a.id===aid);
        if(accounts[ai].balance<amt){showToast('Insufficient Funds','error');return}
        accounts[ai].balance-=amt;
        transactions.unshift({id:Date.now(),type:'expense',amount:amt,desc:`Asset: ${fd.get('sipName')}`,category:'Investment',accountId:aid,date:new Date().toISOString().split('T')[0]});
        localStorage.setItem('rg_accounts',JSON.stringify(accounts));
        localStorage.setItem('rg_transactions',JSON.stringify(transactions));
    }
    sips.push({id:Date.now(),name:fd.get('sipName'),amount:amt,category:fd.get('sipCategory'),type:t,accountId:aid,qty:q,price:p,buyDate:bd});
    localStorage.setItem('rg_sips',JSON.stringify(sips));
    closeModal('sipModal'); showToast('Asset Added'); updateDashboard(); renderSips();
}

function openSellModal(id) {
    const asset = sips.find(s => s.id === id);
    if (!asset) return;

    document.getElementById('sellAssetId').value = id;
    document.getElementById('sellAssetName').innerText = asset.name;
    document.getElementById('sellAssetForm').reset();
    document.getElementById('sellTotalDisplay').innerText = formatINR(0);

    const isQtyBased = asset.type === 'OneTime' && asset.qty > 0;
    document.getElementById('sellAssetType').value = isQtyBased ? 'qty' : 'amount';

    // Current Market Logic
    const currentVal = asset.currentValue || asset.amount;

    if (isQtyBased) {
        document.getElementById('sellQtyContainer').classList.remove('hidden');
        document.getElementById('sellAmountContainer').classList.add('hidden');
        document.getElementById('sellAvailableQty').innerText = `${asset.qty} Units`;
        document.getElementById('sellQtyInput').max = asset.qty;
        
        // Pre-fill PRICE input with Current Market Price
        const unitPrice = asset.currentPrice || (asset.price || (asset.amount / asset.qty));
        document.getElementById('sellPriceInput').value = unitPrice;
    } else {
        document.getElementById('sellQtyContainer').classList.add('hidden');
        document.getElementById('sellAmountContainer').classList.remove('hidden');
        document.getElementById('sellAvailableQty').innerText = 'N/A';
        document.getElementById('sellAmountInput').max = currentVal; 
    }

    document.getElementById('sellCurrentValue').innerText = formatINR(currentVal);
    openModal('sellAssetModal');
}

function calculateSellTotal() {
    const type = document.getElementById('sellAssetType').value;
    let total = 0;

    if (type === 'qty') {
        const qty = parseFloat(document.getElementById('sellQtyInput').value) || 0;
        const price = parseFloat(document.getElementById('sellPriceInput').value) || 0;
        total = qty * price;
    } else {
        total = parseFloat(document.getElementById('sellAmountInput').value) || 0;
    }
    
    document.getElementById('sellTotalDisplay').innerText = formatINR(total);
}

// 4. UPDATED SELL PROCESS
function processSell(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = parseInt(fd.get('assetId'));
    const type = fd.get('assetType');
    const assetIdx = sips.findIndex(s => s.id === id);
    const asset = sips[assetIdx];
    
    let sellAmount = 0, sellQty = 0;

    if (type === 'qty') {
        sellQty = parseFloat(fd.get('sellQty'));
        const sellPrice = parseFloat(fd.get('sellPrice')); // Get User's Entered Price
        sellAmount = sellQty * sellPrice;
        
        if (sellQty > asset.qty) { showToast('Exceeds Wallet Qty', 'error'); return; }
        
        // Logic: Reduce Principal proportionally
        const avgBuyPrice = asset.amount / asset.qty;
        const principalReduction = avgBuyPrice * sellQty;
        asset.amount -= principalReduction; 
        asset.qty -= sellQty;
        
        // Update Current Value (Qty reduced * New Price)
        if(asset.currentValue) asset.currentValue = asset.qty * sellPrice; 
        
        if (asset.qty <= 0) sips.splice(assetIdx, 1);

    } else {
        sellAmount = parseFloat(fd.get('sellAmount'));
        const currentVal = asset.currentValue || asset.amount;
        
        if (sellAmount > currentVal) { showToast('Exceeds Balance', 'error'); return; }
        
        // Logic: Reduce Principal proportionally based on % sold
        const ratio = sellAmount / currentVal;
        asset.amount -= (asset.amount * ratio);
        
        if(asset.currentValue) asset.currentValue -= sellAmount;
        else asset.amount -= sellAmount; // Fallback if no current value set

        if ((asset.currentValue || asset.amount) <= 10) sips.splice(assetIdx, 1); // Close if negligible
    }

    if (sellAmount <= 0) return;

    // Credit to Wallet
    accounts[0].balance += sellAmount; 
    
    transactions.unshift({
        id: Date.now(), type: 'income', amount: sellAmount,
        desc: `Sold: ${asset.name}`, category: 'Investment', accountId: accounts[0].id, date: new Date().toISOString().split('T')[0]
    });

    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));
    localStorage.setItem('rg_sips', JSON.stringify(sips));
    
    closeModal('sellAssetModal'); showToast(`Sold for ${formatINR(sellAmount)}`); renderSips(); updateDashboard();
}

function deleteSip(id) {
    askConfirm('Remove this asset from portfolio?', () => {
        sips = sips.filter(s => s.id !== id);
        localStorage.setItem('rg_sips', JSON.stringify(sips));
        renderSips();
        updateDashboard();
        showToast('Asset Removed');
    });
}

function renderSips() {
    const g = document.getElementById('sipGrid');
    if (!sips.length) { g.innerHTML = `<div class="col-span-3">${getEmptyState("Portfolio empty")}</div>`; return; }

    g.innerHTML = sips.map((s, i) => {
        const invested = s.amount;
        const current = s.currentValue || s.amount;
        const diff = current - invested;
        const pnlPercent = invested > 0 ? ((diff / invested) * 100).toFixed(1) : 0;
        const isProfit = diff >= 0;
        
        const pnlColor = isProfit ? 'text-emerald-500' : 'text-rose-500';
        const icon = isProfit ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';

        let details = '';
        if (s.type === 'OneTime' && s.qty) {
            const unitPrice = s.currentPrice || (s.amount / s.qty);
            details = `<div class="mt-1 flex justify-between items-center text-xs font-bold text-slate-400"><span>${s.qty} units</span><span>@ ${formatINR(unitPrice)}</span></div>`;
        }

        return `
        <div class="mint-card interactive p-5 relative overflow-hidden stagger-item" style="animation-delay:${i * 100}ms">
            <div class="flex justify-between items-start mb-2">
                <div class="w-12 h-12 rounded-2xl bg-growth dark:bg-green-600 text-white flex items-center justify-center text-xl shadow-lg">
                    <i class="fa-solid fa-chart-line"></i>
                </div>
                
                <div class="text-right">
                    <p class="text-2xl font-bold text-slate-800 dark:text-white">${formatINR(current)}</p>
                    <div class="flex items-center justify-end gap-1 ${pnlColor} text-xs font-bold">
                        <span>${isProfit ? '+' : ''}${formatINR(diff)} (${pnlPercent}%)</span>
                        <i class="fa-solid ${icon}"></i>
                    </div>
                </div>
            </div>
            
            <h4 class="font-bold text-slate-800 dark:text-white text-lg mb-0.5 truncate">${s.name}</h4>
            <div class="flex justify-between items-center mb-3">
                <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">Invested: ${formatINR(invested)}</p>
            </div>
            
            ${details}
            
            <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                <button onclick="openUpdateAssetModal(${s.id})" class="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors text-xs uppercase tracking-wider">
                    Update
                </button>
                
                <button onclick="openSellModal(${s.id})" class="flex-1 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800 transition-colors text-xs uppercase tracking-wider">
                    <i class="fa-solid fa-money-bill-wave mr-1"></i> Sell
                </button>
                
                <button onclick="deleteSip(${s.id})" class="px-3 text-rose-400 hover:text-rose-500 transition-colors">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`
    }).join('');
}

// --- STANDARD FUNCTIONS ---
function checkFormValidity(f){const i=f.querySelectorAll('input[required],select[required]');let v=true;i.forEach(e=>{if(!e.value.trim()){e.classList.add('input-error');setTimeout(()=>e.classList.remove('input-error'),500);v=false}});if(!v)showToast('Fill all fields','error');return v}
function formatINR(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n)}
function showToast(m,t='success'){const c=document.getElementById('toast-container');const x=document.createElement('div');x.className=`${t==='success'?'bg-slate-900 dark:bg-teal-600':'bg-rose-500'} text-white px-6 py-3 rounded-2xl shadow-2xl flex gap-3 transform -translate-y-10 opacity-0 transition-all duration-500 font-bold text-sm`;x.innerHTML=m;c.appendChild(x);requestAnimationFrame(()=>x.classList.remove('-translate-y-10','opacity-0'));setTimeout(()=>{x.classList.add('-translate-y-10','opacity-0');setTimeout(()=>x.remove(),500)},3000)}

function openCategoryModal(){const l=document.getElementById('categoryList');l.innerHTML=categories.map(c=>`<div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl"><span class="font-bold text-slate-700 dark:text-slate-200">${c}</span><button onclick="deleteCategory('${c}')" class="text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash"></i></button></div>`).join('');openModal('manageCategoriesModal')}
function addCategory(e){e.preventDefault();const v=e.target.newCatName.value.trim();if(v&&!categories.includes(v)){categories.push(v);localStorage.setItem('rg_categories',JSON.stringify(categories));e.target.reset();openCategoryModal();toggleTxType();showToast('Category Added')}else{showToast('Exists/Empty','error')}}
function deleteCategory(c) {
    askConfirm(`Delete category "${c}"?`, () => {
        categories = categories.filter(x => x !== c);
        localStorage.setItem('rg_categories', JSON.stringify(categories));
        openCategoryModal(); 
        toggleTxType(); 
        showToast('Category Deleted');
    });
}
function toggleSipFields(){const t=document.getElementById('sipTypeSelect').value;const f=document.getElementById('stockFields');const tot=document.getElementById('sipTotalAmount');if(t==='OneTime'){f.classList.remove('hidden');tot.setAttribute('readonly',true);tot.classList.add('bg-slate-50','dark:bg-slate-900')}else{f.classList.add('hidden');tot.removeAttribute('readonly');tot.classList.remove('bg-slate-50','dark:bg-slate-900')}}
function calcSipTotal(){document.getElementById('sipTotalAmount').value=(parseFloat(document.getElementById('sipQty').value)||0)*(parseFloat(document.getElementById('sipPrice').value)||0)}
function calcLoanPreview(){const P=parseFloat(document.getElementById('loanPrincipal').value)||0,R=(parseFloat(document.getElementById('loanRate').value)||0)/1200,N=parseFloat(document.getElementById('loanTenure').value)||0;if(P&&R&&N){const e=(P*R*Math.pow(1+R,N))/(Math.pow(1+R,N)-1);document.getElementById('previewEMI').innerText=formatINR(Math.round(e));document.getElementById('previewTotal').innerText=`Total: ${formatINR(Math.round(e*N))}`}}

function saveLoan(e){e.preventDefault();if(!checkFormValidity(e.target))return;const fd=new FormData(e.target),P=parseFloat(fd.get('loanPrincipal')),R=parseFloat(fd.get('loanRate'))/1200,N=parseFloat(fd.get('loanTenure')),emi=(P*R*Math.pow(1+R,N))/(Math.pow(1+R,N)-1);loans.push({id:Date.now(),name:fd.get('loanName'),principal:P,totalPayable:emi*N,emi:emi,paid:0,tenure:N,startDate:new Date().toISOString().split('T')[0]});localStorage.setItem('rg_loans',JSON.stringify(loans));closeModal('loanModal');showToast('Loan Added');renderLoans()}
function openRepayModal(id) {
    const l = loans.find(x => x.id === id);
    if (!l) return;
    
    document.getElementById('repayLoanId').value = id;
    document.getElementById('repayTitle').innerText = `Repaying: ${l.name}`;
    
    const remaining = l.totalPayable - l.paid;
    const suggestAmt = Math.min(l.emi, remaining);
    
    const input = document.getElementById('repayAmount');
    input.value = Math.round(suggestAmt);
    input.max = remaining; 
    
    populateAccountSelects(); 
    openModal('repayModal');
}
function confirmRepayment(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lid = parseInt(fd.get('loanId'));
    const amt = parseFloat(fd.get('amount'));
    const aid = parseInt(fd.get('repayAccountId')); 
    
    const l = loans.find(x => x.id === lid);
    const accIdx = accounts.findIndex(a => a.id === aid);
    
    if (!l || isNaN(amt) || amt <= 0) { showToast('Invalid Amount', 'error'); return; }
    
    const remaining = l.totalPayable - l.paid;
    if (amt > remaining + 1) { 
        showToast(`Max payable is ${formatINR(remaining)}`, 'error'); 
        return; 
    }
    
    if (accounts[accIdx].balance < amt) { 
        showToast('Low Wallet Balance', 'error'); 
        return; 
    }
    
    accounts[accIdx].balance -= amt;
    l.paid += amt;
    
    transactions.unshift({
        id: Date.now(), type: 'expense', amount: amt,
        desc: `Repayment: ${l.name}`, category: 'EMI', accountId: aid, date: new Date().toISOString().split('T')[0]
    });
    
    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));
    localStorage.setItem('rg_loans', JSON.stringify(loans));
    
    closeModal('repayModal');
    showToast('Paid');
    renderLoans();
    updateDashboard();
}
function deleteLoan(id) {
    askConfirm('Delete this loan record?', () => {
        loans = loans.filter(l => l.id !== id);
        localStorage.setItem('rg_loans', JSON.stringify(loans));
        renderLoans();
        updateDashboard();
        showToast('Loan Deleted');
    });
}
function renderLoans(){const g=document.getElementById('loanGrid');if(!loans.length){g.innerHTML=`<div class="col-span-3">${getEmptyState("No active loans")}</div>`;return}g.innerHTML=loans.map((l,i)=>{const p=Math.min((l.paid/l.totalPayable)*100,100);const actionBtn = l.paid >= l.totalPayable ? `<button class="flex-1 py-2 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-bold rounded-lg pointer-events-none">CLEARED 🎉</button>` : `<button onclick="openRepayModal(${l.id})" class="flex-1 py-2 bg-debt dark:bg-indigo-600 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all">Repay</button>`; return `<div class="mint-card interactive p-5 relative overflow-hidden stagger-item" style="animation-delay:${i*100}ms"><div class="flex justify-between items-start mb-4"><div class="w-12 h-12 rounded-2xl bg-debt dark:bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="text-right"><p class="text-2xl font-bold text-slate-800 dark:text-white">${formatINR(Math.round(l.totalPayable-l.paid))}</p><p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Remaining</p></div></div><h4 class="font-bold text-slate-800 dark:text-white text-lg mb-1">${l.name}</h4><p class="text-xs text-debt dark:text-indigo-400 font-bold mb-4">EMI: ${formatINR(Math.round(l.emi))}/mo</p><div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-4"><div class="h-full bg-debt dark:bg-indigo-500 rounded-full transition-all duration-1000" style="width:${p}%"></div></div><div class="flex gap-2">${actionBtn}<button onclick="deleteLoan(${l.id})" class="px-3 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"><i class="fa-solid fa-trash"></i></button></div></div>`}).join('')}

function openDreamModal(){openModal('dreamModal')}
function saveDream(e){e.preventDefault();if(!checkFormValidity(e.target))return;const fd=new FormData(e.target);dreams.push({id:Date.now(),name:fd.get('dreamName'),target:parseFloat(fd.get('dreamTarget')),saved:0});localStorage.setItem('rg_dreams',JSON.stringify(dreams));closeModal('dreamModal');showToast('Dream Created');renderDreams()}
function openContributeModal(id, mode) {
    const d = dreams.find(x => x.id === id);
    if (!d) return;
    
    document.getElementById('contributeId').value = id;
    document.getElementById('contributeTitle').innerText = d.name;
    document.getElementById('dreamAvailable').innerText = formatINR(d.saved);
    document.getElementById('dreamTypeInput').value = mode; 
    document.getElementById('contributeForm').reset();
    populateAccountSelects();

    // UI Customization based on Mode
    const header = document.getElementById('contributeHeader');
    const label = document.getElementById('contributeModalLabel');
    const btn = document.getElementById('contributeSubmitBtn');
    const accLabel = document.getElementById('contributeAccountLabel');

    if (mode === 'save') {
        header.className = "bg-emerald-50 dark:bg-emerald-900/30 px-6 py-4 flex justify-between items-center transition-colors";
        label.className = "font-bold text-emerald-600 dark:text-emerald-400";
        label.innerText = "Add to Savings";
        
        accLabel.innerText = "Take from Wallet";
        btn.className = "w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-emerald-700";
        btn.innerText = "Confirm Deposit";
    } else {
        header.className = "bg-rose-50 dark:bg-rose-900/30 px-6 py-4 flex justify-between items-center transition-colors";
        label.className = "font-bold text-rose-500 dark:text-rose-400";
        label.innerText = "Withdraw Savings";
        
        accLabel.innerText = "Deposit to Wallet";
        btn.className = "w-full bg-rose-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-rose-600";
        btn.innerText = "Confirm Withdrawal";
    }

    openModal('contributeModal');
}

function saveContribution(e) {
    e.preventDefault();
    if (!checkFormValidity(e.target)) return;

    const fd = new FormData(e.target);
    const amt = parseFloat(fd.get('amount'));
    const aid = parseInt(fd.get('accountId'));
    const did = parseInt(fd.get('dreamId'));
    const type = fd.get('dreamType'); 

    const aIdx = accounts.findIndex(a => a.id === aid);
    const dIdx = dreams.findIndex(d => d.id === did);
    
    if (aIdx === -1 || dIdx === -1) return;

    if (type === 'save') {
        if (accounts[aIdx].balance < amt) { showToast('Insufficient Funds', 'error'); return; }
        
        accounts[aIdx].balance -= amt;
        dreams[dIdx].saved += amt;
        
        transactions.unshift({
            id: Date.now(), type: 'expense', amount: amt,
            desc: `Saved: ${dreams[dIdx].name}`, category: 'Savings', accountId: aid, date: new Date().toISOString().split('T')[0]
        });

    } else {
        if (dreams[dIdx].saved < amt) { showToast('Not enough saved', 'error'); return; }

        accounts[aIdx].balance += amt; 
        dreams[dIdx].saved -= amt;
        
        transactions.unshift({
            id: Date.now(), type: 'income', amount: amt,
            desc: `Withdrew: ${dreams[dIdx].name}`, category: 'Savings', accountId: aid, date: new Date().toISOString().split('T')[0]
        });
    }

    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    localStorage.setItem('rg_dreams', JSON.stringify(dreams));
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));
    
    closeModal('contributeModal');
    showToast(type === 'save' ? 'Saved!' : 'Withdrawn!');
    renderDreams();
    updateDashboard();
}
function deleteDream(id) {
    askConfirm('Give up on this dream?', () => {
        dreams = dreams.filter(d => d.id !== id);
        localStorage.setItem('rg_dreams', JSON.stringify(dreams));
        renderDreams();
        showToast('Dream Deleted');
    });
}
function renderDreams() {
    const g = document.getElementById('dreamGrid');
    if (!dreams.length) {
        g.innerHTML = `<div class="col-span-3">${getEmptyState("No dreams yet")}</div>`;
        return;
    }
    g.innerHTML = dreams.map((d, i) => {
        const p = Math.min((d.saved / d.target) * 100, 100);
        
        // STANDARD CARD LAYOUT (Matches Loans/SIPs)
        return `
        <div class="mint-card interactive p-5 relative overflow-hidden stagger-item" style="animation-delay:${i * 100}ms">
            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 rounded-2xl ${d.saved >= d.target ? 'bg-emerald-500' : 'bg-dream dark:bg-amber-600'} text-white flex items-center justify-center text-xl shadow-lg">
                    <i class="fa-solid ${d.saved >= d.target ? 'fa-trophy' : 'fa-bullseye'}"></i>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-bold text-slate-800 dark:text-white">${formatINR(d.target)}</p>
                    <p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target</p>
                </div>
            </div>
            <h4 class="font-bold text-slate-800 dark:text-white text-lg mb-1">${d.name}</h4>
            <p class="text-xs ${d.saved >= d.target ? 'text-emerald-500' : 'text-dream dark:text-amber-400'} font-bold mb-4">Saved: ${formatINR(d.saved)} (${Math.round(p)}%)</p>
            
            <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-4">
                <div class="h-full ${d.saved >= d.target ? 'bg-emerald-500' : 'bg-dream dark:bg-amber-500'} rounded-full transition-all duration-1000" style="width:${p}%"></div>
            </div>
            
            <div class="flex gap-2">
                <button onclick="openContributeModal(${d.id}, 'save')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all">
                    <i class="fa-solid fa-plus mr-1"></i> Add
                </button>
                <button onclick="openContributeModal(${d.id}, 'withdraw')" class="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all">
                    <i class="fa-solid fa-minus"></i>
                </button>
                <button onclick="deleteDream(${d.id})" class="px-3 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function updateDashboard(){
    setTimeout(()=>{
        const tc=accounts.reduce((s,a)=>s+a.balance,0),ta = sips.reduce((s, x) => s + (x.currentValue || x.amount), 0),td=loans.reduce((s,l)=>s+(l.totalPayable-l.paid),0);
        
        // Added 'tracking-tight' for premium typography
        document.getElementById('dashBalance').className = "text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight";
        document.getElementById('dashBalance').innerHTML=formatINR((tc+ta)-td);
        
        const exp=transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
        document.getElementById('budgetTarget').innerText=formatINR(monthlyBudget);
        if(monthlyBudget>0){const p=Math.min((exp/monthlyBudget)*100,100);const b=document.getElementById('budgetBar');b.style.width=p+"%";if(p<85)b.className="h-full bg-gradient-to-r from-teal-400 to-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]";else b.className="h-full bg-gradient-to-r from-orange-400 to-rose-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(244,63,94,0.5)]";document.getElementById('budgetText').innerHTML=`${Math.round(p)}% used`}
        
        // WALLETS
        const ar=document.getElementById('accountScroll');
        ar.innerHTML=accounts.filter(a=>!a.isDeleted).map(a=>`
            <div class="account-card interactive flex-shrink-0 stagger-item cursor-pointer group" onclick="viewWallet(${a.id})">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wider opacity-70 group-hover:text-mintPrimary transition-colors">${a.type}</p>
                        <h4 class="text-xl font-bold text-slate-800 dark:text-white group-hover:text-mintPrimary transition-colors">${a.name}</h4>
                    </div>
                    <div class="w-10 h-10 rounded-full bg-white/40 dark:bg-black/20 backdrop-blur-md flex items-center justify-center shadow-sm">
                        <i class="fa-solid ${a.type==='Bank'?'fa-building-columns':a.type==='Cash'?'fa-money-bill':a.type==='Credit Card'?'fa-credit-card':'fa-wallet'} text-slate-600 dark:text-slate-300"></i>
                    </div>
                </div>
                <p class="text-2xl font-bold mt-2 text-slate-800 dark:text-white tracking-tight">${formatINR(a.balance)}</p>
            </div>`).join('');

        // RECENT TX
        const dr=document.getElementById('dashboardRecentTx');
        const s=transactions.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
        dr.innerHTML=s.length?s.map(t=>`<div class="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full ${t.type==='expense'?'bg-rose-50 dark:bg-rose-900/20 text-rose-500':'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'} flex items-center justify-center text-sm"><i class="fa-solid ${getCategoryIcon(t.category)}"></i></div><div><p class="font-bold text-slate-700 dark:text-slate-200 text-sm">${t.desc}</p><p class="text-[10px] text-slate-400 uppercase font-bold">${t.date}</p></div></div><span class="font-bold text-sm ${t.type==='expense'?'text-rose-500':'text-emerald-500'}">${t.type==='expense'?'-':'+'}${formatINR(t.amount)}</span></div>`).join(''):getEmptyState('No tx');
        
        // CHART
        if(document.getElementById('page-dashboard').classList.contains('active')){
            const c=document.getElementById('mainChart');const ph=document.getElementById('chartPlaceholder');
            if(c){
                const ctx=c.getContext('2d');const m={};const now=new Date();
                
                const currentMonthTx=transactions.filter(t=>{
                    const tDate=new Date(t.date);
                    return tDate.getMonth()===now.getMonth() && 
                           tDate.getFullYear()===now.getFullYear() && 
                           t.type==='expense' && 
                           t.category !== 'Adjustment' && 
                           t.category !== 'System';
                });
                
                currentMonthTx.forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount});
                const d=Object.values(m);const isDark=document.documentElement.classList.contains('dark');const textColor=isDark?'#cbd5e1':'#334155';
                
                if(chartInstance)chartInstance.destroy();
                if(!d.length){ph.classList.remove('hidden');chartInstance=new Chart(ctx,{type:'pie',data:{labels:[],datasets:[{data:[1],backgroundColor:['#e2e8f0'],borderWidth:0}]},options:{plugins:{legend:{display:false},tooltip:{enabled:false}}}})}
                else{
                    ph.classList.add('hidden');
                    chartInstance=new Chart(ctx,{
                        type:'pie',
                        data:{
                            labels:Object.keys(m),
                            datasets:[{
                                data:d,
                                backgroundColor:['#0d9488','#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#6366f1','#ec4899'],
                                borderWidth:2,
                                borderColor:isDark?'#1e293b':'#ffffff',
                                hoverOffset: 4  /* FIXED: Subtle popup */
                            }]
                        },
                        options:{
                            responsive:true,
                            maintainAspectRatio:false,
                            animation: { duration: 800, easing: 'easeOutQuart' }, /* Smooth chart entry */
                            plugins:{legend:{position:'right',labels:{color:textColor,font:{family:'Inter'},boxWidth:12,padding:15}}}
                        }
                    })
                }
            }
        }
    },300)
}

// ==========================================
// 📊 PRO ANALYTICS: FADE + REPLAY ANIMATION
// ==========================================

function switchAnalyticsTab(tab) {
    const barContainer = document.getElementById('chart-bar-container');
    const doughnutContainer = document.getElementById('chart-doughnut-container');
    
    // Animation Elements
    const pill = document.getElementById('analytics-tab-pill');
    const btnBar = document.getElementById('tab-btn-bar');
    const btnPie = document.getElementById('tab-btn-doughnut');

    const activeText = "text-slate-800 dark:text-white";
    const inactiveText = "text-slate-400";

    if (tab === 'bar') {
        // 1. Move Pill & Text
        pill.style.transform = "translateX(0%)";
        btnBar.className = `tab-btn py-2 ${activeText}`;
        btnPie.className = `tab-btn py-2 ${inactiveText}`;

        // 2. Animate Switch (Pass the Canvas ID too!)
        animateChartSwitch(doughnutContainer, barContainer, 'analyticsBarChart');
        
    } else {
        // 1. Move Pill & Text
        pill.style.transform = "translateX(100%)";
        btnBar.className = `tab-btn py-2 ${inactiveText}`;
        btnPie.className = `tab-btn py-2 ${activeText}`;

        // 2. Animate Switch (Pass the Canvas ID too!)
        animateChartSwitch(barContainer, doughnutContainer, 'analyticsDoughnutChart');
    }
}

// Helper: Fades Container + Replays Chart Data Animation
function animateChartSwitch(elementToHide, elementToShow, canvasIdToReplay) {
    // A. Setup CSS Transitions
    elementToHide.classList.add('chart-anim-wrapper');
    elementToShow.classList.add('chart-anim-wrapper');

    // B. Fade OUT old container
    elementToHide.classList.add('chart-exit');

    setTimeout(() => {
        // C. Hide Old / Show New
        elementToHide.classList.add('hidden');
        elementToHide.classList.remove('flex'); 
        
        elementToShow.classList.remove('hidden');
        if(elementToShow.id === 'chart-doughnut-container') {
             elementToShow.classList.add('flex', 'justify-center');
        } else {
             elementToShow.classList.add('block');
        }

        // D. Prepare New Container (Start Invisible)
        elementToShow.classList.add('chart-exit');

        // E. THE MAGIC TRICK: Replay the Chart Animation 🪄
        // We find the chart instance by ID and force it to reset to 0 and redraw
        const chartInstance = Chart.getChart(canvasIdToReplay);
        if (chartInstance) {
            chartInstance.reset(); // Sets bars to 0 height, pie to 0 rotation
            chartInstance.update(); // Triggers the "Growth" animation
        }

        // F. Fade IN the Container
        requestAnimationFrame(() => {
            elementToShow.classList.remove('chart-exit');
        });
        
    }, 200); 
}
function runAnalytics() {
    const startEl = document.getElementById('analyticsStart'), endEl = document.getElementById('analyticsEnd');
    if(!startEl || !endEl) return; 
    const startStr = startEl.value, endStr = endEl.value;
    if(!startStr || !endStr) { showToast('Select date range', 'error'); return; }
    const startDate = new Date(startStr), endDate = new Date(endStr); endDate.setHours(23, 59, 59); 

    // 1. Filter and Cache
    cachedFilteredTx = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= startDate && tDate <= endDate;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    // 2. Reset Limit
    currentAnalyticsLimit = 20;

    // 3. Render Charts (Keep existing chart logic)
    renderAnalyticsCharts(cachedFilteredTx);

    // 4. Render Table/List with Pagination
    renderAnalyticsView();
}

function renderAnalyticsView() {
    const isMobile = window.innerWidth < 768;
    const tableBody = document.getElementById('analyticsTableBody');
    const mobileList = document.getElementById('analyticsMobileList');
    const loadBtn = document.getElementById('historyLoadMoreContainer');

    // Slice data based on limit
    const visibleTx = cachedFilteredTx.slice(0, currentAnalyticsLimit);
    
    // Toggle Button Visibility
    if(loadBtn) {
        if(cachedFilteredTx.length > currentAnalyticsLimit) loadBtn.classList.remove('hidden');
        else loadBtn.classList.add('hidden');
    }

    // --- POPULATE TABLE (DESKTOP) ---
    if(tableBody) {
        if(visibleTx.length === 0) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-xs font-bold">No transactions found</td></tr>`;
        else {
            tableBody.innerHTML = visibleTx.map(t => {
                const meta = t.payee ? `<span class="block text-[10px] text-slate-400 font-normal">To: ${t.payee}</span>` : '';
                return `<tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td class="px-6 py-4 text-xs text-slate-500 font-bold whitespace-nowrap">${t.date}</td><td class="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 text-sm">${t.desc}${meta}</td><td class="px-6 py-4 text-xs"><span class="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-400 font-bold">${t.category}</span></td><td class="px-6 py-4 text-right font-bold text-sm ${t.type==='expense'?'text-rose-500':'text-emerald-500'}">${t.type==='expense'?'-':'+'}${formatINR(t.amount)}</td><td class="px-6 py-4 text-center"><button onclick="deleteTransaction(${t.id})" class="text-slate-300 hover:text-rose-500 transition-colors"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            }).join('');
        }
    }

    // --- POPULATE LIST (MOBILE) ---
    if(mobileList) {
        if(visibleTx.length === 0) mobileList.innerHTML = getEmptyState('No transactions');
        else {
            mobileList.innerHTML = visibleTx.map(t => {
                 return `
                 <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full flex-shrink-0 ${t.type==='expense'?'bg-rose-50 dark:bg-rose-900/20 text-rose-500':'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'} flex items-center justify-center text-sm">
                            <i class="fa-solid ${getCategoryIcon(t.category)}"></i>
                        </div>
                        <div class="min-w-0"> <p class="font-bold text-slate-800 dark:text-white text-sm truncate">${t.desc}</p>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">${t.category}</span>
                                <span class="text-[10px] text-slate-400 font-bold">${t.date}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-2">
                        <p class="font-extrabold text-sm ${t.type==='expense'?'text-rose-500':'text-emerald-500'}">${t.type==='expense'?'-':'+'}${formatINR(t.amount)}</p>
                        <button onclick="deleteTransaction(${t.id})" class="text-[10px] text-slate-300 hover:text-rose-500 mt-1 p-1"><i class="fa-solid fa-trash"></i></button>
                    </div>
                 </div>`;
            }).join('');
        }
    }
}

// Helper to keep charts isolated from pagination logic
function renderAnalyticsCharts(data) {
    const isMobile = window.innerWidth < 768; 
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const barCanvas = document.getElementById('analyticsBarChart');
    if(barCanvas) {
        const income = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const savings = income - expense;
        
        if(analyticsBarInstance) analyticsBarInstance.destroy();
        
        analyticsBarInstance = new Chart(barCanvas.getContext('2d'), {
            type: 'bar', 
            data: { 
                labels: ['Income', 'Expense', 'Net Flow'], 
                datasets: [{ 
                    label: 'Total', 
                    data: [income, expense, savings], 
                    backgroundColor: ['#10b981', '#f43f5e', '#3b82f6'], 
                    borderRadius: 8, 
                    barThickness: isMobile ? 20 : 40 
                }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: isMobile ? 10 : 12 } } }, x: { grid: { display: false }, ticks: { color: textColor, font: { size: isMobile ? 10 : 12 } } } } 
            }
        });
    }

    const donutCanvas = document.getElementById('analyticsDoughnutChart');
    if(donutCanvas) {
        const cats = {}; 
        data.filter(t => t.type === 'expense' && t.category !== 'Adjustment' && t.category !== 'System').forEach(t => { 
            cats[t.category] = (cats[t.category] || 0) + t.amount; 
        });
        const catLabels = Object.keys(cats), catData = Object.values(cats);
        
        if(analyticsDoughnutInstance) analyticsDoughnutInstance.destroy();
        
        const displayData = catData.length ? catData : [1];
        const displayColors = catData.length ? ['#0d9488', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#6366f1', '#ec4899'] : ['#e2e8f0'];
        const displayLabels = catData.length ? catLabels : ['No Expenses'];
        
        analyticsDoughnutInstance = new Chart(donutCanvas.getContext('2d'), {
            type: 'pie', 
            data: { labels: displayLabels, datasets: [{ data: displayData, backgroundColor: displayColors, borderWidth: 2, borderColor: isDark ? '#1e293b' : '#ffffff', hoverOffset: isMobile ? 5 : 15 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: {family: 'Inter', size: isMobile ? 10 : 12}, boxWidth: 12, padding: 15 } } } }
        });
    }
}

// --- NEW EXPORT FUNCTIONS ---
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("RG Wealth - Transaction Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    // Data Preparation
    const tableData = transactions.map(t => [
        t.date,
        t.desc,
        t.category,
        t.type.toUpperCase(),
        formatINR(t.amount)
    ]);
    
    // AutoTable
    doc.autoTable({
        startY: 35,
        head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] } // Mint color
    });
    
    doc.save('RG_Wealth_Report.pdf');
    showToast('PDF Downloaded');
}

function exportToExcel() {
    // Flatten data for Excel
    const data = transactions.map(t => ({
        Date: t.date,
        Description: t.desc,
        Category: t.category,
        Type: t.type,
        Amount: t.amount,
        Wallet: (accounts.find(a => a.id === t.accountId) || {}).name || 'Unknown',
        Payee: t.payee || '',
        Notes: t.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, "RG_Wealth_Data.xlsx");
    showToast('Excel Downloaded');
}

function renderSubscriptions() {
    const g = document.getElementById('subGrid');
    if (!subscriptions.length) {
        g.innerHTML = `<div class="col-span-3">${getEmptyState("No subs")}</div>`;
        return;
    }
    g.innerHTML = subscriptions.map((s, i) => {
        const acc = accounts.find(a => a.id === s.accountId);
        const walletName = acc ? acc.name : 'Unknown Wallet';
        return `
        <div class="mint-card interactive p-5 relative overflow-hidden stagger-item" style="animation-delay:${i * 100}ms">
            <div class="flex justify-between items-start mb-4">
                <div class="w-12 h-12 rounded-2xl bg-mintPrimary dark:bg-teal-600 text-white flex items-center justify-center text-xl shadow-lg">
                    <i class="fa-solid fa-bolt"></i>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-bold text-slate-800 dark:text-white">${formatINR(s.amount)}</p>
                    <p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">${s.frequency}</p>
                </div>
            </div>
            <h4 class="font-bold text-slate-800 dark:text-white text-lg mb-0.5">${s.name}</h4>
            <p class="text-xs text-mintPrimary dark:text-teal-400 font-bold mb-3">Next Due: ${s.nextDue || 'Not Set'}</p>
            <div class="flex items-center gap-2 mb-4 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600">
                <i class="fa-solid fa-wallet text-slate-400 text-xs"></i>
                <span class="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">Source: ${walletName}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="openPaySubModal(${s.id})" class="flex-1 py-2 bg-mintPrimary dark:bg-teal-600 hover:bg-mintDark dark:hover:bg-teal-700 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all">Pay Now</button>
                <button onclick="deleteSubscription(${s.id})" class="px-3 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-lg hover:bg-rose-100"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function openAccountModal(){document.getElementById('accountForm').reset();openModal('accountModal')}
function saveAccount(e){e.preventDefault();const fd=new FormData(e.target);accounts.push({id:Date.now(),name:fd.get('accName'),type:fd.get('accType'),balance:parseFloat(fd.get('accBalance'))});localStorage.setItem('rg_accounts',JSON.stringify(accounts));closeModal('accountModal');updateDashboard();populateAccountSelects();}
function saveBudget(e){e.preventDefault();monthlyBudget=parseFloat(new FormData(e.target).get('budgetAmount'))||0;localStorage.setItem('rg_budget',monthlyBudget);updateDashboard();closeModal('budgetModal');showToast("Budget Updated")}

function saveTransaction(e){
    e.preventDefault();
    if(!checkFormValidity(e.target)) return;
    
    const fd = new FormData(e.target);
    const amt = parseFloat(fd.get('amount'));
    const type = fd.get('type');
    const aid = parseInt(fd.get('accountId'));
    const aIdx = accounts.findIndex(a => a.id === aid);
    
    if(type !== 'income' && accounts[aIdx].balance < amt) {
        showToast('Insufficient Funds','error'); return;
    }
    
    if(type === 'expense') accounts[aIdx].balance -= amt;
    else if(type === 'income') accounts[aIdx].balance += amt;
    else {
        const tid = parseInt(fd.get('toAccountId'));
        accounts[aIdx].balance -= amt;
        accounts[accounts.findIndex(a => a.id === tid)].balance += amt;
    }
    
    transactions.unshift({
        id: Date.now(),
        type,
        amount: amt,
        desc: fd.get('desc'),
        category: type === 'transfer' ? 'Transfer' : fd.get('category'),
        accountId: aid,
        date: fd.get('date'),
        payee: fd.get('txPayee') || '',
        ref: fd.get('txRef') || '',
        tags: fd.get('txTags') || '',
        notes: fd.get('txNotes') || ''
    });
    
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));
    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    
    checkBudgetBreach();

    closeModal('txModal');
    updateDashboard();
    
    if(document.getElementById('page-analytics').classList.contains('active')) runAnalytics();
}

function saveSubscription(e){e.preventDefault();const fd=new FormData(e.target);subscriptions.push({id:Date.now(),name:fd.get('subName'),amount:parseFloat(fd.get('subAmount')),frequency:fd.get('subFreq'),accountId:parseInt(fd.get('subAccountId')),nextDue:fd.get('subDate')});localStorage.setItem('rg_subscriptions',JSON.stringify(subscriptions));closeModal('subModal');renderSubscriptions()}
function openPaySubModal(id) {
    const s = subscriptions.find(sub => sub.id === id);
    if (!s) return;
    document.getElementById('paySubId').value = id;
    document.getElementById('paySubName').innerText = s.name;
    document.getElementById('paySubDue').innerText = s.nextDue;
    document.getElementById('paySubAmount').value = s.amount;
    populateAccountSelects();
    document.getElementById('paySubAccountSelect').value = s.accountId;
    refreshCustomSelects();
    openModal('paySubModal');
}

function confirmSubPayment(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const subId = parseInt(fd.get('subId'));
    const amount = parseFloat(fd.get('amount'));
    const accId = parseInt(fd.get('accountId'));
    
    const subIdx = subscriptions.findIndex(s => s.id === subId);
    const accIdx = accounts.findIndex(a => a.id === accId);
    
    if (subIdx === -1 || accIdx === -1) return;
    
    if (accounts[accIdx].balance < amount) {
        showToast('Insufficient Funds', 'error');
        return;
    }

    accounts[accIdx].balance -= amount;
    
    transactions.unshift({
        id: Date.now(), type: 'expense', amount: amount,
        desc: `Bill: ${subscriptions[subIdx].name}`, category: 'Bills', accountId: accId, date: new Date().toISOString().split('T')[0]
    });

    const n = new Date(subscriptions[subIdx].nextDue);
    n.setMonth(n.getMonth() + 1);
    subscriptions[subIdx].nextDue = n.toISOString().split('T')[0];

    localStorage.setItem('rg_accounts', JSON.stringify(accounts));
    localStorage.setItem('rg_subscriptions', JSON.stringify(subscriptions));
    localStorage.setItem('rg_transactions', JSON.stringify(transactions));

    closeModal('paySubModal');
    showToast(`Paid ${formatINR(amount)}`);
    updateDashboard();
    renderSubscriptions();
}
function deleteTransaction(id) {
    askConfirm('Delete this transaction permanently?', () => {
        transactions = transactions.filter(t => t.id !== id);
        localStorage.setItem('rg_transactions', JSON.stringify(transactions));
        updateDashboard();
        if (document.getElementById('page-analytics').classList.contains('active')) runAnalytics();
        showToast('Transaction Deleted');
    });
}

function deleteSubscription(id) {
    askConfirm('Stop tracking this subscription?', () => {
        subscriptions = subscriptions.filter(s => s.id !== id);
        localStorage.setItem('rg_subscriptions', JSON.stringify(subscriptions));
        renderSubscriptions();
        showToast('Subscription Removed');
    });
}

function showPage(p, isBackEvent = false) { 
    // 1. HISTORY LOGIC
    // If this didn't come from the Back button, push a new state
    if (!isBackEvent) {
        history.pushState({ page: p }, '', `#${p}`);
    }

    // 2. MOBILE MENU CLEANUP (Manually close to avoid history conflict)
    const drawer = document.getElementById('mobileMenuDrawer');
    const menuBtn = document.getElementById('mob-nav-menu');
    
    if (drawer && !drawer.classList.contains('hidden')) {
        drawer.classList.remove('open');
        setTimeout(() => drawer.classList.add('hidden'), 500);
        if(menuBtn) menuBtn.classList.remove('nav-active');
    }

    // 3. CORE PAGE SWITCHING
    document.querySelector('.page-section.visible')?.classList.remove('visible','active');
    const t = document.getElementById(`page-${p}`);
    t.classList.add('active');
    
    localStorage.setItem('rg_last_page', p);

    requestAnimationFrame(()=>{
        t.classList.add('visible');
        if(p==='autopay')renderSubscriptions();
        if(p==='mutualfunds')renderSips();
        if(p==='loans')renderLoans();
        if(p==='dreams')renderDreams();
        if(p==='analytics')runAnalytics()
    });
    
    // Reset desktop navs
    document.querySelectorAll('.nav-active').forEach(b=>b.classList.remove('nav-active'));
    
    // Highlight Desktop Sidebar Button
    const b=document.getElementById(`nav-${p}`);
    if(b) b.classList.add('nav-active');
    
    // Highlight Mobile Bottom Bar Button
    const mb=document.getElementById(`mob-nav-${p}`);
    if(mb) mb.classList.add('nav-active');
    
    window.scrollTo(0,0);
    updateDashboard();
}

function openModal(id) {
    // Push a state so the Back button has something to "undo"
    history.pushState({ modal: id }, '', `#${id}`);

    const m = document.getElementById(id), c = m.querySelector('div');
    m.classList.remove('hidden', 'flex');
    m.classList.add('flex');
    void m.offsetWidth;
    m.classList.remove('opacity-0');
    c.classList.remove('translate-y-full', 'opacity-0', 'scale-95');
}

function closeModal(id, isBackEvent = false) {
    // If the user clicked "X" (not a back swipe), we must manually go back 
    // to keep history clean. This will trigger 'popstate', which runs this function again with isBackEvent = true.
    if (!isBackEvent) {
        history.back(); 
        return; // Stop here, let the popstate listener handle the UI closing
    }

    // Actual UI Closing Logic
    const m = document.getElementById(id), c = m.querySelector('div');
    m.classList.add('opacity-0');
    c.classList.add('translate-y-full', 'opacity-0', 'scale-95');
    setTimeout(() => {
        m.classList.add('hidden');
        m.classList.remove('flex');
    }, 300);
}
function openSubModal(){populateAccountSelects();openModal('subModal')} function openSipModal(){populateAccountSelects();openModal('sipModal')} function openLoanModal(){populateAccountSelects();openModal('loanModal')} function openAddModal(){document.getElementById('txForm').reset();document.querySelector('input[name="type"][value="expense"]').click();populateAccountSelects();openModal('txModal')} function setBudget(){document.getElementById('budgetInput').value=monthlyBudget>0?monthlyBudget:'';openModal('budgetModal')}
function populateAccountSelects() {
    const activeAccounts = accounts.filter(a => !a.isDeleted);
    const o = activeAccounts.map(a => `<option value="${a.id}">${a.name} (${formatINR(a.balance)})</option>`).join('');
    
    const ids = [
        'fromAccountSelect', 'toAccountSelect', 'subAccountSelect', 
        'sipAccountSelect', 'contributeAccountSelect', 'repayAccountSelect',
        'paySubAccountSelect'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = o;
    });
    
    refreshCustomSelects();
}
function toggleTxType(){const t=document.querySelector('input[name="type"]:checked').value;document.getElementById('categoryDiv').classList.toggle('hidden',t==='transfer');document.getElementById('toAccountDiv').classList.toggle('hidden',t!=='transfer');document.getElementById('fromAccountLabel').innerText=t==='income'?"Deposit To":"Pay From";const l=t==='expense'?categories:["Salary","Business","Freelance","Gift","Dividends"];document.getElementById('catSelect').innerHTML=l.map(c=>`<option value="${c}">${c}</option>`).join(''); refreshCustomSelects()}
function getEmptyState(m){return`<div class="flex flex-col items-center justify-center py-8 opacity-40"><i class="fa-solid fa-wind text-4xl mb-2 text-slate-300 dark:text-slate-500"></i><p class="text-xs font-bold text-slate-400 dark:text-slate-500">${m}</p></div>`}
function getCategoryIcon(c) {
    const icons = {
        'Food': 'fa-utensils',
        'Travel': 'fa-plane-departure',
        'Bills': 'fa-file-invoice',
        'Shopping': 'fa-bag-shopping',
        'Medical': 'fa-stethoscope',
        'Rent': 'fa-house-chimney',
        'EMI': 'fa-calendar-check',
        'Salary': 'fa-money-bill-wave',
        'Business': 'fa-briefcase',
        'Freelance': 'fa-laptop-code',
        'Gift': 'fa-gift',
        'Investment': 'fa-chart-line',
        'Gold': 'fa-ring',
        'Savings': 'fa-piggy-bank',
        'Other': 'fa-circle-question'
    };
    return icons[c] || 'fa-tag';
}
// ==========================================
// CUSTOM CONFIRM MODAL LOGIC
// ==========================================

let confirmCallback = null;

function askConfirm(message, callback) {
    document.getElementById('confirmMessage').innerText = message;
    confirmCallback = callback; 
    
    const m = document.getElementById('confirmModal');
    const c = m.querySelector('div');
    
    // 1. Unhide the wrapper
    m.classList.remove('hidden');
    m.classList.add('flex');
    
    // 2. CRITICAL FIX: Reset the modal box position
    // We must remove 'translate-y-full' because closeModal() adds it!
    c.classList.remove('translate-y-full', 'opacity-0', 'scale-95');
    
    // 3. Set initial state for the entry animation
    m.classList.add('opacity-0'); // Background transparent
    c.classList.add('scale-95');  // Box slightly small
    
    // 4. Trigger the animation
    setTimeout(() => {
        m.classList.remove('opacity-0');
        c.classList.remove('scale-95');
        c.classList.add('scale-100');
    }, 10);
}
const confirmBtn = document.getElementById('confirmBtn');
if(confirmBtn) {
    confirmBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeModal('confirmModal');
    });
}

// ==========================================
// 💾 BACKUP & RESTORE SYSTEM
// ==========================================

function exportData() {
    // 1. Mark the time of backup
    localStorage.setItem('rg_last_backup', Date.now());

    // 2. Gather data
    const data = {
        transactions: JSON.parse(localStorage.getItem('rg_transactions') || '[]'),
        accounts: JSON.parse(localStorage.getItem('rg_accounts') || '[]'),
        subscriptions: JSON.parse(localStorage.getItem('rg_subscriptions') || '[]'),
        sips: JSON.parse(localStorage.getItem('rg_sips') || '[]'),
        loans: JSON.parse(localStorage.getItem('rg_loans') || '[]'),
        dreams: JSON.parse(localStorage.getItem('rg_dreams') || '[]'),
        categories: JSON.parse(localStorage.getItem('rg_categories') || '[]'),
        budget: localStorage.getItem('rg_budget') || '0',
        timestamp: new Date().toLocaleString()
    };

    // 3. Download logic
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "RG_Wealth_Backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showToast('Backup Downloaded');
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Simple validation check
            if (!data.transactions || !data.accounts) {
                showToast("Invalid Backup File", "error");
                return;
            }

            // Confirm before overwriting
            askConfirm(`Restore data from ${data.timestamp || 'Unknown Date'}? This overwrites current data.`, () => {
                localStorage.setItem('rg_transactions', JSON.stringify(data.transactions));
                localStorage.setItem('rg_accounts', JSON.stringify(data.accounts));
                localStorage.setItem('rg_subscriptions', JSON.stringify(data.subscriptions));
                localStorage.setItem('rg_sips', JSON.stringify(data.sips));
                localStorage.setItem('rg_loans', JSON.stringify(data.loans));
                localStorage.setItem('rg_dreams', JSON.stringify(data.dreams));
                localStorage.setItem('rg_categories', JSON.stringify(data.categories));
                localStorage.setItem('rg_budget', data.budget);
                
                showToast("Restore Successful! Reloading...");
                setTimeout(() => location.reload(), 1500);
            });

        } catch (err) {
            console.error(err);
            showToast("Error reading file", "error");
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input so you can select the same file again if needed
}

// --- NEW FUNCTIONS FOR PORTFOLIO UPDATE ---

function openUpdateAssetModal(id) {
    const asset = sips.find(s => s.id === id);
    if (!asset) return;

    document.getElementById('updateAssetId').value = id;
    document.getElementById('updateInvestedDisplay').innerText = formatINR(asset.amount);
    document.getElementById('updateAssetForm').reset();
    document.getElementById('updateAssetType').value = asset.type;

    // Decide which input to show
    const isQtyBased = asset.type === 'OneTime' && asset.qty > 0;
    
    if (isQtyBased) {
        document.getElementById('updatePriceField').classList.remove('hidden');
        document.getElementById('updateValueField').classList.add('hidden');
        // Pre-fill current price if it exists, else calculate from invested
        const currentPrice = asset.currentPrice || (asset.price || (asset.amount / asset.qty));
        document.querySelector('input[name="newPrice"]').value = currentPrice;
    } else {
        document.getElementById('updatePriceField').classList.add('hidden');
        document.getElementById('updateValueField').classList.remove('hidden');
        // Pre-fill current value if exists, else invested amount
        document.querySelector('input[name="newValue"]').value = asset.currentValue || asset.amount;
    }

    openModal('updateAssetModal');
}

function saveAssetUpdate(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = parseInt(fd.get('assetId'));
    const asset = sips.find(s => s.id === id);
    
    if (!asset) return;

    const isQtyBased = asset.type === 'OneTime' && asset.qty > 0;
    
    if (isQtyBased) {
        const newPrice = parseFloat(fd.get('newPrice'));
        if (isNaN(newPrice)) return;
        asset.currentPrice = newPrice;
        asset.currentValue = newPrice * asset.qty; // Recalculate total value
    } else {
        const newValue = parseFloat(fd.get('newValue'));
        if (isNaN(newValue)) return;
        asset.currentValue = newValue;
    }

    localStorage.setItem('rg_sips', JSON.stringify(sips));
    closeModal('updateAssetModal');
    showToast('Portfolio Updated');
    renderSips();
    updateDashboard();
}

// --- BACKUP REMINDER SYSTEM ---

function performBackupFromModal() {
    exportData();
    closeModal('backupModal');
}

function checkBackupStatus() {
    const lastBackup = parseInt(localStorage.getItem('rg_last_backup') || 0);
    const now = Date.now();
    
    // If never backed up, treat as old
    if (!lastBackup) {
        // Give new users a grace period of 1 day before nagging
        // If transactions exist but no backup, prompt immediately
        if (transactions.length > 5) openModal('backupModal'); 
        return;
    }

    const diffTime = Math.abs(now - lastBackup);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays >= 7) {
        // BAD COP: Checkpoint Modal
        openModal('backupModal');
    } else if (diffDays >= 3) {
        // GOOD COP: Friendly Toast
        const btnHtml = `<button onclick="exportData()" class="ml-2 underline text-teal-200 hover:text-white">Save Now</button>`;
        showToast(`⚠️ Backup recommended (${diffDays} days ago) ${btnHtml}`, 'warning');
    }
}

// ==========================================
// 📱 MOBILE MENU LOGIC (New Addition)
// ==========================================

function toggleMobileMenu(isBackEvent = false) {
    const drawer = document.getElementById('mobileMenuDrawer');
    const menuBtn = document.getElementById('mob-nav-menu');
    const lastPage = localStorage.getItem('rg_last_page');
    
    if (drawer.classList.contains('hidden')) {
        // --- OPENING MENU ---
        // Push state so Back button can close it
        history.pushState({ menu: 'open' }, '', '#menu');

        drawer.classList.remove('hidden'); 
        requestAnimationFrame(() => drawer.classList.add('open'));
        menuBtn.classList.add('nav-active');
        
        document.querySelectorAll('.mobile-nav-island .nav-item').forEach(btn => {
            if(btn.id !== 'mob-nav-menu') btn.classList.remove('nav-active');
        });

    } else {
        // --- CLOSING MENU ---
        // If clicked button (not back swipe), go back in history to trigger listener
        if (!isBackEvent) {
            history.back();
            return;
        }

        drawer.classList.remove('open'); 
        setTimeout(() => drawer.classList.add('hidden'), 500);

        menuBtn.classList.remove('nav-active');
        
        if(lastPage) {
            const activeBtn = document.getElementById(`mob-nav-${lastPage}`);
            if(activeBtn) activeBtn.classList.add('nav-active');
        }
    }
}

// ==========================================
// 🔔 NOTIFICATION ENGINE
// ==========================================

function checkNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Helper to send
    const send = (title, body) => {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: body,
                icon: 'assets/icon-1024.png',
                vibrate: [200, 100, 200]
            });
        });
    };

    // 1. 💾 BACKUP REMINDER (3 Days)
    const lastBackup = parseInt(localStorage.getItem('rg_last_backup') || 0);
    if (lastBackup) {
        const diffDays = Math.ceil(Math.abs(Date.now() - lastBackup) / (1000 * 60 * 60 * 24));
        if (diffDays >= 3 && localStorage.getItem('rg_notif_backup') !== todayStr) {
            send('⚠️ Backup Warning', `You haven't backed up in ${diffDays} days. Data is at risk!`);
            localStorage.setItem('rg_notif_backup', todayStr); // Prevent spamming same day
        }
    }

    // 2. ⚡ SUBSCRIPTION DUE (Tomorrow)
    subscriptions.forEach(sub => {
        if (!sub.nextDue) return;
        const due = new Date(sub.nextDue);
        const diffTime = due - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays === 1 && localStorage.getItem(`rg_notif_sub_${sub.id}`) !== todayStr) {
            send('💸 Bill Due Tomorrow', `${sub.name} is due for ${formatINR(sub.amount)}. Check your wallet!`);
            localStorage.setItem(`rg_notif_sub_${sub.id}`, todayStr);
        }
    });

    // 3. 🏦 LOAN EMI (3 Days Before) - approximated by start date day-of-month
    loans.forEach(loan => {
        // Simple logic: If today is 3 days before the "Start Date Day", warn them.
        const startDay = new Date(loan.startDate).getDate();
        const targetDate = new Date();
        targetDate.setDate(startDay);
        
        // Handle month wrap-around logic roughly or just check raw day diff
        const dayDiff = startDay - now.getDate();
        
        if (dayDiff === 3 && localStorage.getItem(`rg_notif_loan_${loan.id}`) !== todayStr) {
            send('🏠 EMI Upcoming', `Heads up! ${loan.name} EMI of ${formatINR(loan.emi)} is due soon.`);
            localStorage.setItem(`rg_notif_loan_${loan.id}`, todayStr);
        }
    });

    // 4. 🌱 SIP REMINDER (1st of Month)
    if (now.getDate() === 1 && localStorage.getItem('rg_notif_sip') !== todayStr) {
        send('🌱 Wealth Growth Day', 'It\'s the 1st of the month! Have you made your investments?');
        localStorage.setItem('rg_notif_sip', todayStr);
    }
    
    // 5. 🏆 DREAMS (50% Milestone)
    dreams.forEach(d => {
        const p = (d.saved / d.target);
        if (p >= 0.5 && p < 1.0 && localStorage.getItem(`rg_notif_dream_50_${d.id}`) !== 'sent') {
            send('🎉 Halfway There!', `You've reached 50% of your goal: ${d.name}. Keep going!`);
            localStorage.setItem(`rg_notif_dream_50_${d.id}`, 'sent');
        }
    });
}

// Helper for Budget Notification (Call this manually)
function checkBudgetBreach() {
    if (monthlyBudget <= 0 || !('Notification' in window) || Notification.permission !== 'granted') return;
    
    const exp = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const ratio = exp / monthlyBudget;

    if (ratio >= 0.9 && ratio < 1.0 && sessionStorage.getItem('rg_warn_90') !== 'true') {
        new Notification('🚨 Budget Alert', { body: `You've used 90% of your budget (${formatINR(exp)}). Slow down!`, icon: 'assets/icon-1024.png' });
        sessionStorage.setItem('rg_warn_90', 'true');
    }
    else if (ratio >= 1.0 && sessionStorage.getItem('rg_warn_100') !== 'true') {
        new Notification('🛑 Budget Exceeded', { body: `You've crossed your limit of ${formatINR(monthlyBudget)}.`, icon: 'assets/icon-1024.png' });
        sessionStorage.setItem('rg_warn_100', 'true');
    }
}