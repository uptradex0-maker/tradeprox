// Simple Dashboard for Vercel - No Firebase
let currentAsset = 'EUR/USD';
let userBalance = 50000;
let activeTrades = [];
let username = '';
let chartData = {};
let currentCandle = {};
let candleStartTime = {};

// Account state
let currentAccount = 'demo';
let demoBalanceValue = 50000;
let realBalanceValue = 0;
let timeframe = 60000;

const assets = ['EUR/USD', 'GBP/USD', 'BTC/USD'];

document.addEventListener('DOMContentLoaded', function() {
    username = localStorage.getItem('tradepro_username');
    if (!username) {
        window.location.href = '/login';
        return;
    }
    
    const storedAccount = localStorage.getItem('tradepro_current_account');
    currentAccount = storedAccount === 'real' ? 'real' : 'demo';
    
    loadUserData();
    initializeChart();
    startPriceUpdates();
    
    const assetSelector = document.getElementById('assetSelector');
    if (assetSelector) {
        assetSelector.addEventListener('change', function(e) {
            currentAsset = e.target.value;
            updateChartDisplay();
        });
    }

    const timeframeSelector = document.getElementById('timeframeSelector');
    if (timeframeSelector) {
        timeframeSelector.addEventListener('change', function(e) {
            timeframe = parseInt(e.target.value);
            assets.forEach(asset => {
                chartData[asset] = [];
                currentCandle[asset] = null;
                candleStartTime[asset] = Date.now();
            });
            updateChartDisplay();
        });
    }
});

function loadUserData() {
    try {
        const cached = localStorage.getItem('tradepro_balance_cache');
        if (cached) {
            const balance = JSON.parse(cached);
            demoBalanceValue = balance.demoBalance || 50000;
            realBalanceValue = balance.realBalance || 0;
            currentAccount = balance.currentAccount || 'demo';
        }
        userBalance = currentAccount === 'real' ? realBalanceValue : demoBalanceValue;
        updateBalance();
        applyAccountToUI();
    } catch (error) {
        console.error('Error loading user data:', error);
        userBalance = 50000;
        updateBalance();
        applyAccountToUI();
    }
}

function saveUserData() {
    try {
        const data = {
            lastUpdated: new Date().toISOString(),
            currentAccount: currentAccount,
            demoBalance: demoBalanceValue,
            realBalance: realBalanceValue
        };
        localStorage.setItem('tradepro_balance_cache', JSON.stringify(data));
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

function initializeChart() {
    const container = document.getElementById('tradingChart');
    if (!container) return;

    container.innerHTML = `
        <div style="width: 100%; height: 100vh; background: #0d1421; position: relative; overflow: hidden;">
            <!-- Mobile Header -->
            <div style="position: fixed; top: 0; left: 0; right: 0; background: #1e2329; padding: 10px 15px; z-index: 100; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                <div>
                    <h3 style="color: #f0b90b; margin: 0; font-size: 18px;">TradePro</h3>
                    <div style="color: #848e9c; font-size: 10px;" id="currentAssetDisplay">${currentAsset}</div>
                </div>
                <div style="text-align: right;">
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                        <span id="accountTypePill" style="padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: #02c076; color: #000;">DEMO</span>
                        <span style="color: #848e9c; font-size: 10px;">Balance</span>
                    </div>
                    <div style="color: #f0b90b; font-size: 16px; font-weight: 600;" id="userBalance">₹${userBalance.toLocaleString()}</div>
                </div>
                <div>
                    <button id="accountSwitchBtn" onclick="toggleAccount()" class="fast-transition" style="padding: 6px 12px; background: #39424e; color: white; border: none; border-radius: 4px; font-size: 12px; margin-right: 5px;">Switch to Real</button>
                    <button onclick="logout()" class="fast-transition" style="padding: 6px 12px; background: #f84960; color: white; border: none; border-radius: 4px; font-size: 12px;">Exit</button>
                </div>
            </div>
            
            <!-- Chart Area -->
            <div style="margin-top: 60px; height: calc(100vh - 200px); padding: 10px;">
                <canvas id="candlestickChart" style="width: 100%; height: 100%; background: #0d1421;"></canvas>
            </div>
            
            <!-- Mobile Trading Panel -->
            <div style="position: fixed; bottom: 0; left: 0; right: 0; background: #1e2329; padding: 15px; z-index: 100; box-shadow: 0 -2px 10px rgba(0,0,0,0.3);">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label style="color: #848e9c; font-size: 10px; display: block; margin-bottom: 5px;">AMOUNT</label>
                        <input type="number" id="tradeAmount" value="100" min="10" class="fast-transition" style="width: 100%; padding: 12px; background: #2b2f36; border: 1px solid #3c4043; border-radius: 6px; color: white; font-size: 14px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="color: #848e9c; font-size: 10px; display: block; margin-bottom: 5px;">TIME</label>
                        <select id="tradeDuration" class="fast-transition" style="width: 100%; padding: 12px; background: #2b2f36; border: 1px solid #3c4043; border-radius: 6px; color: white; font-size: 14px;">
                            <option value="30">30s</option>
                            <option value="60" selected>1m</option>
                            <option value="300">5m</option>
                        </select>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="placeTrade('up')" class="fast-transition" style="flex: 1; padding: 15px; background: linear-gradient(135deg, #02c076, #028a50); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        📈 UP
                    </button>
                    <button onclick="placeTrade('down')" class="fast-transition" style="flex: 1; padding: 15px; background: linear-gradient(135deg, #f84960, #d63447); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        📉 DOWN
                    </button>
                </div>
            </div>
        </div>
    `;
    
    assets.forEach(asset => {
        chartData[asset] = [];
        currentCandle[asset] = null;
        candleStartTime[asset] = Date.now();
    });
    
    initializeCandlestickChart();
}

function updateBalance() {
    const balanceEl = document.getElementById('userBalance');
    if (balanceEl) {
        balanceEl.textContent = `₹${userBalance.toLocaleString()}`;
    }
}

function applyAccountToUI() {
    const pill = document.getElementById('accountTypePill');
    if (pill) {
        pill.textContent = currentAccount.toUpperCase();
        if (currentAccount === 'real') {
            pill.style.background = '#f84960';
            pill.style.color = '#fff';
        } else {
            pill.style.background = '#02c076';
            pill.style.color = '#000';
        }
    }
    const switchBtn = document.getElementById('accountSwitchBtn');
    if (switchBtn) {
        switchBtn.textContent = currentAccount === 'real' ? 'Switch to Demo' : 'Switch to Real';
    }
    
    userBalance = currentAccount === 'real' ? realBalanceValue : demoBalanceValue;
    updateBalance();
}

function toggleAccount() {
    currentAccount = currentAccount === 'real' ? 'demo' : 'real';
    localStorage.setItem('tradepro_current_account', currentAccount);
    applyAccountToUI();
    saveUserData();
}

async function placeTrade(direction) {
    const amountInput = document.getElementById('tradeAmount');
    const durationInput = document.getElementById('tradeDuration');
    
    const amount = parseInt(amountInput.value) || 100;
    const duration = parseInt(durationInput.value) || 60;
    
    if (amount < 10) {
        alert('Minimum trade amount is ₹10');
        return;
    }
    
    if (amount > userBalance) {
        alert('Insufficient balance');
        return;
    }
    
    try {
        // Make API call to place trade
        const response = await fetch('/api/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: username,
                amount: amount,
                direction: direction,
                accountType: currentAccount
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update balance
            if (currentAccount === 'demo') {
                demoBalanceValue -= amount;
            } else {
                realBalanceValue -= amount;
            }
            userBalance = currentAccount === 'real' ? realBalanceValue : demoBalanceValue;
            updateBalance();
            saveUserData();
            
            showNotification(`Trade placed: ${direction.toUpperCase()} ₹${amount}`, '#f0b90b');
        } else {
            alert(result.message || 'Failed to place trade');
        }
        
    } catch (error) {
        console.error('Trade placement error:', error);
        alert('Failed to place trade');
    }
}

function showNotification(message, color) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: ${color}; color: white; padding: 15px 20px;
        border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

function logout() {
    localStorage.clear();
    window.location.href = '/login';
}

function initializeCandlestickChart() {
    const canvas = document.getElementById('candlestickChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    
    generateCandleData();
    
    assets.forEach(asset => {
        const lastClose = chartData[asset].length > 0 ? chartData[asset][chartData[asset].length - 1].close : getInitialPrice(asset);
        currentCandle[asset] = {
            open: lastClose,
            high: lastClose,
            low: lastClose,
            close: lastClose,
            time: Date.now()
        };
        candleStartTime[asset] = Date.now();
    });
    
    drawChart(ctx, canvas.offsetWidth, canvas.offsetHeight);
}

function getInitialPrice(asset) {
    if (asset === 'EUR/USD') return 1.0850;
    if (asset === 'GBP/USD') return 1.2750;
    if (asset === 'BTC/USD') return 45000;
    return 1.0850;
}

function generateCandleData() {
    assets.forEach(asset => {
        chartData[asset] = [];
        let price = getInitialPrice(asset);
        
        for (let i = 0; i < 50; i++) {
            const open = price;
            const change = (Math.random() - 0.5) * 0.002;
            const close = open + change;
            const high = Math.max(open, close) + Math.random() * 0.001;
            const low = Math.min(open, close) - Math.random() * 0.001;
            
            chartData[asset].push({ open, high, low, close, time: Date.now() - (49 - i) * timeframe });
            price = close;
        }
    });
}

function drawChart(ctx, width, height) {
    ctx.fillStyle = '#0d1421';
    ctx.fillRect(0, 0, width, height);
    
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const maxCandles = Math.floor(chartWidth / 10);
    
    let allCandles = [...chartData[currentAsset]];
    if (currentCandle[currentAsset]) {
        allCandles.push(currentCandle[currentAsset]);
    }
    
    const visibleCandles = allCandles.slice(-maxCandles);
    
    if (visibleCandles.length === 0) return;
    
    const minPrice = Math.min(...visibleCandles.map(d => d.low));
    const maxPrice = Math.max(...visibleCandles.map(d => d.high));
    const priceRange = maxPrice - minPrice;
    
    const candleWidth = chartWidth / maxCandles * 0.8;
    
    visibleCandles.forEach((candle, i) => {
        const x = padding + (i * chartWidth / maxCandles) + (chartWidth / maxCandles / 2);
        const openY = padding + (maxPrice - candle.open) / priceRange * chartHeight;
        const closeY = padding + (maxPrice - candle.close) / priceRange * chartHeight;
        const highY = padding + (maxPrice - candle.high) / priceRange * chartHeight;
        const lowY = padding + (maxPrice - candle.low) / priceRange * chartHeight;
        
        const isGreen = candle.close > candle.open;
        
        // Draw wick
        ctx.strokeStyle = isGreen ? '#02c076' : '#f84960';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();
        
        // Draw body
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(closeY - openY) || 1;
        ctx.fillStyle = isGreen ? '#02c076' : '#f84960';
        ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, bodyHeight);
    });
    
    // Draw current price line
    const currentPrice = visibleCandles[visibleCandles.length - 1].close;
    const currentY = padding + (maxPrice - currentPrice) / priceRange * chartHeight;
    
    ctx.strokeStyle = '#f0b90b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, currentY);
    ctx.lineTo(width - padding, currentY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw price label
    ctx.fillStyle = 'rgba(240, 185, 11, 0.8)';
    ctx.fillRect(width - 70, currentY - 10, 50, 16);
    ctx.fillStyle = '#0d1421';
    ctx.font = '12px Arial';
    ctx.fillText(currentPrice.toFixed(currentAsset === 'BTC/USD' ? 0 : 4), width - 60, currentY + 2);
}

function updateChart() {
    assets.forEach(asset => {
        if (!currentCandle[asset]) {
            const lastClose = chartData[asset].length > 0 ? chartData[asset][chartData[asset].length - 1].close : getInitialPrice(asset);
            currentCandle[asset] = {
                open: lastClose,
                high: lastClose,
                low: lastClose,
                close: lastClose,
                time: Date.now()
            };
            candleStartTime[asset] = Date.now();
        }
        
        const volatility = asset === 'BTC/USD' ? 0.002 : 0.0002;
        const change = (Math.random() - 0.5) * volatility;
        currentCandle[asset].close += change;
        currentCandle[asset].high = Math.max(currentCandle[asset].high, currentCandle[asset].close);
        currentCandle[asset].low = Math.min(currentCandle[asset].low, currentCandle[asset].close);
        
        if (Date.now() - candleStartTime[asset] >= timeframe) {
            chartData[asset].push(currentCandle[asset]);
            if (chartData[asset].length > 50) {
                chartData[asset].shift();
            }
            currentCandle[asset] = null;
        }
    });
    
    const canvas = document.getElementById('candlestickChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        drawChart(ctx, canvas.offsetWidth, canvas.offsetHeight);
    }
}

function updateChartDisplay() {
    const assetDisplay = document.getElementById('currentAssetDisplay');
    if (assetDisplay) {
        assetDisplay.textContent = currentAsset;
    }
    
    const canvas = document.getElementById('candlestickChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        drawChart(ctx, canvas.offsetWidth, canvas.offsetHeight);
    }
}

function startPriceUpdates() {
    setInterval(updateChart, 1000);
}

// Make functions global
window.placeTrade = placeTrade;
window.logout = logout;
window.toggleAccount = toggleAccount;