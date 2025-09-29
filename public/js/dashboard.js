// Simple Dashboard that ALWAYS works
let currentAsset = 'EUR/USD';
let accountType = 'demo';
let userBalance = { demo: 50000, real: 0 };
let chart;

// Initialize immediately when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    initializeAccounts();
    startPriceUpdates();
});

// Simple chart that always works
function initializeChart() {
    const container = document.getElementById('tradingChart');
    if (!container) return;
    
    container.innerHTML = `
        <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #0a0e1a 0%, #1a1d29 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; border-radius: 8px;">
            <div style="font-size: 48px; margin-bottom: 20px;">📈</div>
            <div style="font-size: 24px; margin-bottom: 10px;" id="chartPrice">EUR/USD: 1.0850</div>
            <div style="font-size: 16px; margin-bottom: 20px;" id="chartChange">+0.0012 (+0.11%)</div>
            <div style="display: flex; gap: 15px;">
                <button onclick="placeTrade('up')" style="padding: 15px 30px; background: #00ff88; color: #000; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">📈 UP</button>
                <button onclick="placeTrade('down')" style="padding: 15px 30px; background: #ff4444; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">📉 DOWN</button>
            </div>
        </div>
    `;
}

// Initialize accounts
function initializeAccounts() {
    // Set demo as default
    accountType = localStorage.getItem('account_type') || 'demo';
    
    // Update balance display
    updateBalance();
    
    // Update account buttons
    updateAccountButtons();
}

// Update balance display
function updateBalance() {
    const balanceEl = document.getElementById('userBalance');
    if (balanceEl) {
        balanceEl.textContent = userBalance[accountType].toLocaleString();
    }
    
    const accountEl = document.getElementById('accountType');
    if (accountEl) {
        accountEl.textContent = accountType.toUpperCase();
    }
}

// Update account buttons
function updateAccountButtons() {
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.account === accountType) {
            btn.classList.add('active');
        }
    });
}

// Switch account function
function switchAccount(type) {
    accountType = type;
    localStorage.setItem('account_type', type);
    
    updateBalance();
    updateAccountButtons();
    
    showNotification(`Switched to ${type.toUpperCase()} account`);
}

// Place trade function
function placeTrade(direction) {
    const amount = 100; // Fixed amount for simplicity
    
    if (userBalance[accountType] < amount) {
        showNotification('Insufficient balance', 'error');
        return;
    }
    
    // Deduct amount
    userBalance[accountType] -= amount;
    updateBalance();
    
    showNotification(`${direction.toUpperCase()} trade placed for ₹${amount}`);
    
    // Simulate trade result after 5 seconds
    setTimeout(() => {
        const won = Math.random() > 0.5;
        if (won) {
            const payout = Math.floor(amount * 1.85);
            userBalance[accountType] += payout;
            showNotification(`🎉 Trade Won! +₹${payout}`, 'success');
        } else {
            showNotification(`😔 Trade Lost! -₹${amount}`, 'error');
        }
        updateBalance();
    }, 5000);
}

// Start price updates
function startPriceUpdates() {
    let price = 1.0850;
    
    setInterval(() => {
        const change = (Math.random() - 0.5) * 0.002;
        price += change;
        
        const priceEl = document.getElementById('chartPrice');
        const changeEl = document.getElementById('chartChange');
        
        if (priceEl) {
            priceEl.textContent = `${currentAsset}: ${price.toFixed(4)}`;
            priceEl.style.color = change > 0 ? '#00ff88' : '#ff4444';
        }
        
        if (changeEl) {
            const changePercent = ((change / price) * 100).toFixed(2);
            changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(4)} (${change >= 0 ? '+' : ''}${changePercent}%)`;
            changeEl.style.color = change > 0 ? '#00ff88' : '#ff4444';
        }
    }, 1000);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        ${type === 'success' ? 'background: #00ff88;' : type === 'error' ? 'background: #ff4444;' : 'background: #00d4ff;'}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Asset switching
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('asset-item')) {
        document.querySelector('.asset-item.active')?.classList.remove('active');
        e.target.classList.add('active');
        currentAsset = e.target.dataset.asset;
        document.getElementById('currentAsset').textContent = currentAsset;
    }
});