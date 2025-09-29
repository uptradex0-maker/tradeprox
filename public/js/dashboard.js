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
            userBalance[accountType].balance = data.balance;
            updateBalance();
        });
        
        socket.on('userTrades', function(trades) {
            activeTrades = trades;
            displayActiveTrades();
        });
        
        socket.on('tradeResult', function(data) {
            if (data.success) {
                userBalance[accountType].balance = data.balance;
                updateBalance();
                addTradeLineToChart(data.trade.direction, data.trade.duration);
                showNotification(`Trade placed: ${data.trade.direction.toUpperCase()}`, 'success');
                activeTrades.push(data.trade);
                displayActiveTrades();
            } else {
                showNotification(data.message, 'error');
            }
        });
        
        socket.on('tradeCompleted', function(data) {
            userBalance[accountType].balance = data.balance;
            updateBalance();
            activeTrades = activeTrades.filter(t => t.id !== data.id);
            displayActiveTrades();
            
            if (data.won) {
                showNotification(`🎉 Trade Won! +₹${data.payout}`, 'success');
            } else {
                showNotification(`😔 Trade Lost!`, 'error');
            }
        });
        
        socket.on('disconnect', function() {
            isConnected = false;
            showNotification('Connection lost', 'error');
        });
        
    // Check connection after 3 seconds
    setTimeout(() => {
        if (!isConnected) {
            console.log('Failed to connect to server');
        }
    }, 3000);
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
        const balance = userBalance[accountType] ? userBalance[accountType].balance || userBalance[accountType] : (accountType === 'demo' ? 50000 : 0);
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
    } else {
        // Offline mode
        if (!userBalance[type]) {
            userBalance[type] = type === 'demo' ? 50000 : 0;
        }
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
    
    const currentBalance = userBalance[accountType] ? (userBalance[accountType].balance || userBalance[accountType]) : 0;
    
    if (currentBalance < amount) {
        showNotification('Insufficient balance', 'error');
        return;
    }
    
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
        // Offline mode
        if (userBalance[accountType].balance) {
            userBalance[accountType].balance -= amount;
        } else {
            userBalance[accountType] -= amount;
        }
        
        updateBalance();
        addTradeLineToChart(direction, duration);
        
        const trade = {
            id: Date.now(),
            asset: currentAsset,
            direction: direction,
            amount: amount,
            duration: duration,
            startTime: new Date(),
            endTime: new Date(Date.now() + duration * 1000)
        };
        
        activeTrades.push(trade);
        displayActiveTrades();
        
        showNotification(`${direction.toUpperCase()} trade placed for ₹${amount}`);
        
        // Simulate result
        setTimeout(() => {
            const won = Math.random() > 0.5;
            if (won) {
                const payout = Math.floor(amount * 1.85);
                if (userBalance[accountType].balance !== undefined) {
                    userBalance[accountType].balance += payout;
                } else {
                    userBalance[accountType] += payout;
                }
                showNotification(`🎉 Trade Won! +₹${payout}`, 'success');
            } else {
                showNotification(`😔 Trade Lost! -₹${amount}`, 'error');
            }
            
            activeTrades = activeTrades.filter(t => t.id !== trade.id);
            displayActiveTrades();
            updateBalance();
        }, duration * 1000);
    }
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

// Add trade line to chart
function addTradeLineToChart(direction, duration) {
    const chartContainer = document.getElementById('tradingChart');
    
    // Create trade line overlay
    const tradeLine = document.createElement('div');
    tradeLine.style.cssText = `
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 2px;
        background: ${direction === 'up' ? '#00ff88' : '#ff4444'};
        z-index: 10;
        box-shadow: 0 0 10px ${direction === 'up' ? '#00ff88' : '#ff4444'};
    `;
    
    // Add direction arrow
    const arrow = document.createElement('div');
    arrow.textContent = direction === 'up' ? '↗' : '↘';
    arrow.style.cssText = `
        position: absolute;
        left: 20px;
        top: -15px;
        color: ${direction === 'up' ? '#00ff88' : '#ff4444'};
        font-size: 20px;
        font-weight: bold;
    `;
    tradeLine.appendChild(arrow);
    
    // Add countdown timer
    const timer = document.createElement('div');
    timer.style.cssText = `
        position: absolute;
        right: 20px;
        top: -15px;
        color: white;
        font-size: 12px;
        font-weight: bold;
        background: rgba(0,0,0,0.7);
        padding: 2px 8px;
        border-radius: 4px;
    `;
    tradeLine.appendChild(timer);
    
    chartContainer.style.position = 'relative';
    chartContainer.appendChild(tradeLine);
    
    // Countdown timer
    let timeLeft = duration;
    const countdown = setInterval(() => {
        timeLeft--;
        timer.textContent = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(countdown);
            // Fade out trade line
            tradeLine.style.transition = 'opacity 1s';
            tradeLine.style.opacity = '0';
            setTimeout(() => {
                if (chartContainer.contains(tradeLine)) {
                    chartContainer.removeChild(tradeLine);
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
            <div class="active-trade" style="background: rgba(255,255,255,0.1); padding: 10px; margin: 5px 0; border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${trade.asset}</strong>
                        <span style="color: ${trade.direction === 'up' ? '#00ff88' : '#ff4444'}; margin-left: 10px;">
                            ${trade.direction === 'up' ? '↑' : '↓'} ${trade.direction.toUpperCase()}
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <div>₹${trade.amount}</div>
                        <div style="font-size: 12px; color: #ccc;">${timeLeft}s left</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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