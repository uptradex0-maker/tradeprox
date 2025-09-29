// Dashboard with server connection
let currentAsset = 'EUR/USD';
let accountType = 'demo';
let userBalance = { demo: 50000, real: 0 };
let activeTrades = [];
let socket;
let isConnected = false;

// Initialize immediately when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    initializeAccounts();
    connectToServer();
    startPriceUpdates();
});

// Simple chart that always works
function initializeChart() {
    const container = document.getElementById('tradingChart');
    if (!container) return;
    
    container.innerHTML = `
        <div id="chartArea" style="width: 100%; height: 100%; background: linear-gradient(135deg, #0a0e1a 0%, #1a1d29 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; border-radius: 8px; position: relative;">
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

// Connect to server
function connectToServer() {
    if (typeof io === 'undefined') {
        console.log('Socket.io not available');
        isConnected = false;
        return;
    }
    
    let userId = localStorage.getItem('tradepro_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tradepro_user_id', userId);
    }
    
    socket = io({
        query: { userId: userId },
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true
    });
        
    socket.on('connect', function() {
        isConnected = true;
        showNotification('Connected to server', 'success');
        socket.emit('getUserData');
    });
    
    socket.on('connect_error', function(error) {
        console.log('Connection error:', error);
        isConnected = false;
    });
    
    socket.on('accountData', function(data) {
        userBalance = data.accounts;
        accountType = data.currentAccount;
        updateBalance();
        updateAccountButtons();
    });
    
    socket.on('balanceUpdate', function(data) {
        console.log('Balance update received:', data);
        
        // Update balance immediately
        if (userBalance[accountType]) {
            userBalance[accountType].balance = data.balance;
        } else {
            userBalance[accountType] = { balance: data.balance };
        }
        updateBalance();
        
        if (data.type === 'deposit') {
            showNotification('💰 Deposit Approved! Money Added!', 'success');
        }
    });
    
    socket.on('userTrades', function(trades) {
        activeTrades = trades.map(trade => ({
            ...trade,
            startTime: new Date(trade.startTime),
            endTime: new Date(trade.endTime)
        }));
        displayActiveTrades();
    });
    
    socket.on('tradeResult', function(data) {
        console.log('Trade result:', data);
        if (data.success) {
            // Update balance
            if (userBalance[accountType]) {
                userBalance[accountType].balance = data.balance;
            }
            updateBalance();
            
            // Add trade line to chart
            addTradeLineToChart(data.trade.direction, data.trade.duration);
            
            // Add to active trades
            const trade = {
                ...data.trade,
                startTime: new Date(data.trade.startTime),
                endTime: new Date(data.trade.endTime)
            };
            activeTrades.push(trade);
            displayActiveTrades();
            
            showNotification(`✅ ${data.trade.direction.toUpperCase()} Trade Placed!`, 'success');
        } else {
            showNotification(data.message, 'error');
        }
    });
    
    socket.on('tradeCompleted', function(data) {
        console.log('Trade completed:', data);
        
        // Update balance
        if (userBalance[accountType]) {
            userBalance[accountType].balance = data.balance;
        }
        updateBalance();
        
        // Remove from active trades
        activeTrades = activeTrades.filter(t => t.id !== data.id);
        displayActiveTrades();
        
        // Show result
        if (data.won) {
            showNotification(`🎉 TRADE WON! +₹${data.payout}`, 'success');
        } else {
            showNotification(`😔 TRADE LOST! -₹${data.amount}`, 'error');
        }
    });
    
    socket.on('disconnect', function() {
        isConnected = false;
        showNotification('Connection lost', 'error');
    });
}

// Initialize accounts
function initializeAccounts() {
    accountType = localStorage.getItem('account_type') || 'demo';
    updateBalance();
    updateAccountButtons();
}

// Update balance display
function updateBalance() {
    const balanceEl = document.getElementById('userBalance');
    if (balanceEl) {
        const balance = userBalance[accountType] ? 
            (userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType]) : 
            (accountType === 'demo' ? 50000 : 0);
        balanceEl.textContent = balance.toLocaleString();
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
    
    if (isConnected && socket) {
        socket.emit('switchAccount', { accountType: type });
    }
    
    updateBalance();
    updateAccountButtons();
    displayActiveTrades();
    
    showNotification(`Switched to ${type.toUpperCase()} account`);
}

// Place trade function
function placeTrade(direction) {
    const amountInput = document.getElementById('tradeAmount');
    const durationInput = document.getElementById('tradeDuration');
    
    const amount = amountInput ? parseInt(amountInput.value) || 100 : 100;
    const duration = durationInput ? parseInt(durationInput.value) || 60 : 60;
    
    const currentBalance = userBalance[accountType] ? 
        (userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType]) : 0;
    
    if (currentBalance < amount) {
        showNotification('Insufficient balance', 'error');
        return;
    }
    
    console.log('Placing trade:', { direction, amount, duration, accountType });
    
    if (isConnected && socket) {
        // Send to server
        socket.emit('placeTrade', {
            asset: currentAsset,
            direction: direction,
            amount: amount,
            duration: duration,
            accountType: accountType
        });
    } else {
        // Offline fallback
        showNotification('Not connected to server', 'error');
    }
}

// Add trade line to chart
function addTradeLineToChart(direction, duration) {
    const chartArea = document.getElementById('chartArea');
    if (!chartArea) return;
    
    console.log('Adding trade line:', direction, duration);
    
    // Create trade line
    const tradeLine = document.createElement('div');
    tradeLine.style.cssText = `
        position: absolute;
        top: 50%;
        left: 10px;
        right: 10px;
        height: 4px;
        background: ${direction === 'up' ? '#00ff88' : '#ff4444'};
        z-index: 100;
        box-shadow: 0 0 20px ${direction === 'up' ? '#00ff88' : '#ff4444'};
        border-radius: 2px;
        animation: pulse 1s infinite;
    `;
    
    // Add arrow
    const arrow = document.createElement('div');
    arrow.textContent = direction === 'up' ? '⬆️' : '⬇️';
    arrow.style.cssText = `
        position: absolute;
        left: 20px;
        top: -25px;
        font-size: 20px;
        animation: bounce 1s infinite;
    `;
    tradeLine.appendChild(arrow);
    
    // Add timer
    const timer = document.createElement('div');
    timer.style.cssText = `
        position: absolute;
        right: 20px;
        top: -25px;
        color: white;
        font-weight: bold;
        background: rgba(0,0,0,0.8);
        padding: 5px 10px;
        border-radius: 5px;
        border: 2px solid ${direction === 'up' ? '#00ff88' : '#ff4444'};
    `;
    tradeLine.appendChild(timer);
    
    chartArea.appendChild(tradeLine);
    
    // Countdown
    let timeLeft = duration;
    const countdown = setInterval(() => {
        timeLeft--;
        timer.textContent = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(countdown);
            tradeLine.style.transition = 'opacity 1s';
            tradeLine.style.opacity = '0';
            setTimeout(() => {
                if (chartArea.contains(tradeLine)) {
                    chartArea.removeChild(tradeLine);
                }
            }, 1000);
        }
    }, 1000);
    
    timer.textContent = `${timeLeft}s`;
}

// Display active trades
function displayActiveTrades() {
    const container = document.getElementById('activeTradesList');
    if (!container) return;
    
    if (activeTrades.length === 0) {
        container.innerHTML = '<p style="color: #ccc; text-align: center; padding: 20px;">No active trades</p>';
        return;
    }
    
    container.innerHTML = activeTrades.map(trade => {
        const timeLeft = Math.max(0, Math.floor((new Date(trade.endTime) - new Date()) / 1000));
        
        return `
            <div style="background: rgba(255,255,255,0.1); padding: 15px; margin: 10px 0; border-radius: 10px; border-left: 5px solid ${trade.direction === 'up' ? '#00ff88' : '#ff4444'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: white; font-size: 16px;">${trade.asset}</strong>
                        <span style="color: ${trade.direction === 'up' ? '#00ff88' : '#ff4444'}; margin-left: 15px; font-weight: bold; font-size: 14px;">
                            ${trade.direction === 'up' ? '⬆️' : '⬇️'} ${trade.direction.toUpperCase()}
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: white; font-weight: bold; font-size: 16px;">₹${trade.amount}</div>
                        <div style="font-size: 14px; color: #00d4ff; font-weight: bold;">${timeLeft}s left</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
        padding: 15px 25px;
        border-radius: 10px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        font-size: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ${type === 'success' ? 'background: linear-gradient(135deg, #00ff88, #00cc6a);' : 
          type === 'error' ? 'background: linear-gradient(135deg, #ff4444, #cc3333);' : 
          'background: linear-gradient(135deg, #00d4ff, #0099cc);'}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 4000);
}

// Asset switching
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('asset-item')) {
        document.querySelector('.asset-item.active')?.classList.remove('active');
        e.target.classList.add('active');
        currentAsset = e.target.dataset.asset;
        const currentAssetEl = document.getElementById('currentAsset');
        if (currentAssetEl) {
            currentAssetEl.textContent = currentAsset;
        }
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
    }
`;
document.head.appendChild(style);