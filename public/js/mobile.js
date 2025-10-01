// Mobile Trading Interface - COMPLETELY REWRITTEN
let mobileAmount = 100;
let mobileDuration = 60;
let mobileChart = null;
let mobileCandles = [];
let mobileTimeframe = 60000; // 1 minute default
let mobileInterval = null;
let mobileTradeLines = [];

// Initialize mobile on page load
document.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 768) {
        createMobileInterface();
    }
});

// Create mobile interface
function createMobileInterface() {
    const mobileHTML = `
        <div class="mobile-container">
            <!-- Header -->
            <div class="mobile-header">
                <div class="mobile-logo">TrustX</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="display: flex; gap: 5px;">
                        <button class="mobile-account-btn active" data-account="demo" onclick="switchMobileAccount('demo')" style="padding: 4px 8px; background: #f0b90b; color: #000; border: none; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;">DEMO</button>
                        <button class="mobile-account-btn" data-account="real" onclick="switchMobileAccount('real')" style="padding: 4px 8px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;">REAL</button>
                    </div>
                    <div style="text-align: right;">
                    <div class="mobile-balance" id="mobileBalance">₹50,000</div>
                    <div style="color: #848e9c; font-size: 9px;" id="mobileUserId">ID: Loading...</div>
                </div>
                </div>
            </div>
            
            <!-- Chart -->
            <div class="mobile-chart">
                <div style="position: absolute; top: 10px; left: 10px; right: 10px; display: flex; justify-content: space-between; align-items: center; z-index: 110;">
                    <div style="color: #f0b90b; font-size: 16px; font-weight: 600;" id="mobileAsset">EUR/USD</div>
                    <div style="text-align: right;">
                        <div style="color: #ffffff; font-size: 18px; font-weight: 600;" id="mobilePrice">1.0850</div>
                        <div style="font-size: 12px; margin-top: 2px; color: #02c076;" id="mobileChange">+0.0012 (+0.11%)</div>
                    </div>
                </div>
                <div style="position: absolute; top: 50px; left: 10px; display: flex; gap: 5px; z-index: 110;">
                    <button onclick="changeMobileTimeframe(5000)" style="padding: 4px 8px; background: rgba(255,255,255,0.1); color: #848e9c; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; font-size: 10px; cursor: pointer;">5s</button>
                    <button onclick="changeMobileTimeframe(60000)" style="padding: 4px 8px; background: #f0b90b; color: #000; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">1m</button>
                    <button onclick="changeMobileTimeframe(300000)" style="padding: 4px 8px; background: rgba(255,255,255,0.1); color: #848e9c; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; font-size: 10px; cursor: pointer;">5m</button>
                </div>
                <canvas id="mobileCandleChart" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>
            
            <!-- Assets -->
            <div class="mobile-assets">
                <div class="mobile-assets-list">
                    <div class="mobile-asset active" onclick="selectMobileAsset('EUR/USD')">EUR/USD</div>
                    <div class="mobile-asset" onclick="selectMobileAsset('GBP/USD')">GBP/USD</div>
                    <div class="mobile-asset" onclick="selectMobileAsset('BTC/USD')">BTC/USD</div>
                    <div class="mobile-asset" onclick="selectMobileAsset('ETH/USD')">ETH/USD</div>
                    <div class="mobile-asset" onclick="selectMobileAsset('US30')">US30</div>
                </div>
            </div>
            
            <!-- Controls -->
            <div class="mobile-controls">
                <!-- Wallet -->
                <div class="mobile-wallet">
                    <button class="mobile-wallet-btn mobile-deposit" onclick="window.location.href='/deposit'">
                        💰 DEPOSIT
                    </button>
                    <button class="mobile-wallet-btn mobile-withdraw" onclick="window.location.href='/withdraw'">
                        💸 WITHDRAW
                    </button>
                </div>
                
                <!-- Mobile Notice -->
                <div style="background: linear-gradient(135deg, #f84960, #d63447); padding: 10px; border-radius: 6px; margin: 10px 0; border-left: 3px solid #ff6b7a;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <span style="font-size: 14px;">⚠️</span>
                        <span style="color: white; font-weight: 600; font-size: 11px;">DEPOSIT NOTICE</span>
                    </div>
                    <p style="color: white; font-size: 10px; line-height: 1.3; margin: 0;">
                        Due to high volume, deposits may take up to 24 hours. Your money is safe!
                    </p>
                </div>
                
                <!-- Amount -->
                <div class="mobile-section">
                    <div class="mobile-section-title">Amount</div>
                    <input type="number" class="mobile-amount-input" id="mobileAmountInput" value="100" min="10" onchange="updateMobileAmount()">
                    <div class="mobile-amount-buttons">
                        <button class="mobile-amount-btn" onclick="setMobileAmount(50)">₹50</button>
                        <button class="mobile-amount-btn active" onclick="setMobileAmount(100)">₹100</button>
                        <button class="mobile-amount-btn" onclick="setMobileAmount(500)">₹500</button>
                        <button class="mobile-amount-btn" onclick="setMobileAmount(1000)">₹1K</button>
                    </div>
                </div>
                
                <!-- Duration -->
                <div class="mobile-section">
                    <div class="mobile-section-title">Duration</div>
                    <div class="mobile-duration">
                        <button class="mobile-duration-btn" onclick="setMobileDuration(5)">5s</button>
                        <button class="mobile-duration-btn" onclick="setMobileDuration(30)">30s</button>
                        <button class="mobile-duration-btn active" onclick="setMobileDuration(60)">1m</button>
                    </div>
                </div>
                
                <!-- Payout -->
                <div class="mobile-payout">
                    <div class="mobile-payout-row">
                        <span class="mobile-payout-label">PAYOUT</span>
                        <span class="mobile-payout-value">85%</span>
                    </div>
                    <div class="mobile-payout-row">
                        <span class="mobile-payout-label">PROFIT</span>
                        <span class="mobile-payout-value" id="mobileProfit">₹85</span>
                    </div>
                    <div class="mobile-payout-row">
                        <span class="mobile-payout-label">TOTAL</span>
                        <span class="mobile-payout-value" id="mobileTotal">₹185</span>
                    </div>
                </div>
                
                <!-- Trade Buttons -->
                <div class="mobile-trade-buttons">
                    <button class="mobile-trade-btn mobile-up-btn" onclick="placeMobileTrade('up')">
                        📈 UP
                    </button>
                    <button class="mobile-trade-btn mobile-down-btn" onclick="placeMobileTrade('down')">
                        📉 DOWN
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', mobileHTML);
    updateMobileBalance();
    updateMobilePayout();
    updateMobileUserId();
    
    // Initialize chart
    setTimeout(() => {
        initMobileChart();
    }, 200);
}

// SIMPLE CHART SYSTEM
function initMobileChart() {
    const canvas = document.getElementById('mobileCandleChart');
    if (!canvas) return;
    
    mobileChart = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Generate initial candles
    generateCandles();
    drawChart();
    
    // Start updates
    startChartUpdates();
}

function generateCandles() {
    mobileCandles = [];
    let price = 1.0850;
    
    for (let i = 0; i < 20; i++) {
        const open = price;
        const change = (Math.random() - 0.5) * 0.01;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 0.005;
        const low = Math.min(open, close) - Math.random() * 0.005;
        
        mobileCandles.push({ open, high, low, close });
        price = close;
    }
}

function drawChart() {
    if (!mobileChart) return;
    
    const canvas = mobileChart.canvas;
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    mobileChart.clearRect(0, 0, width, height);
    
    // Get price range
    const prices = mobileCandles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    const candleWidth = width / mobileCandles.length;
    
    // Draw candles
    mobileCandles.forEach((candle, i) => {
        const x = i * candleWidth + candleWidth / 2;
        
        const highY = 80 + (maxPrice - candle.high) / priceRange * (height - 120);
        const lowY = 80 + (maxPrice - candle.low) / priceRange * (height - 120);
        const openY = 80 + (maxPrice - candle.open) / priceRange * (height - 120);
        const closeY = 80 + (maxPrice - candle.close) / priceRange * (height - 120);
        
        const isUp = candle.close >= candle.open;
        const color = isUp ? '#02c076' : '#f84960';
        
        // Wick
        mobileChart.strokeStyle = color;
        mobileChart.lineWidth = 1;
        mobileChart.beginPath();
        mobileChart.moveTo(x, highY);
        mobileChart.lineTo(x, lowY);
        mobileChart.stroke();
        
        // Body
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(closeY - openY) || 1;
        const bodyWidth = candleWidth * 0.7;
        
        if (isUp) {
            mobileChart.strokeStyle = color;
            mobileChart.strokeRect(x - bodyWidth/2, bodyTop, bodyWidth, bodyHeight);
        } else {
            mobileChart.fillStyle = color;
            mobileChart.fillRect(x - bodyWidth/2, bodyTop, bodyWidth, bodyHeight);
        }
    });
    
    // Draw trade lines
    mobileTradeLines.forEach(line => {
        const y = 80 + (maxPrice - line.price) / priceRange * (height - 120);
        
        // Dashed line
        mobileChart.setLineDash([8, 4]);
        mobileChart.strokeStyle = line.color;
        mobileChart.lineWidth = 2;
        mobileChart.globalAlpha = 0.8;
        
        mobileChart.beginPath();
        mobileChart.moveTo(0, y);
        mobileChart.lineTo(width, y);
        mobileChart.stroke();
        
        mobileChart.globalAlpha = 1;
        mobileChart.setLineDash([]);
        
        // Entry point
        mobileChart.fillStyle = line.color;
        mobileChart.beginPath();
        mobileChart.arc(20, y, 4, 0, 2 * Math.PI);
        mobileChart.fill();
        
        // Direction arrow
        mobileChart.fillStyle = line.color;
        mobileChart.font = 'bold 14px Arial';
        mobileChart.fillText(line.direction === 'up' ? '↗' : '↘', 30, y + 5);
        
        // Timer
        const timeLeft = Math.max(0, Math.ceil((line.endTime - Date.now()) / 1000));
        mobileChart.fillStyle = 'rgba(13, 20, 33, 0.9)';
        mobileChart.fillRect(width - 60, y - 10, 50, 20);
        mobileChart.fillStyle = line.color;
        mobileChart.font = 'bold 12px Arial';
        mobileChart.fillText(`${timeLeft}s`, width - 55, y + 2);
    });
}

function startChartUpdates() {
    if (mobileInterval) clearInterval(mobileInterval);
    
    mobileInterval = setInterval(() => {
        // Update last candle
        const lastCandle = mobileCandles[mobileCandles.length - 1];
        const change = (Math.random() - 0.5) * 0.005;
        lastCandle.close += change;
        lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
        lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
        
        // Sometimes add new candle
        if (Math.random() < 0.3) {
            const open = lastCandle.close;
            const newChange = (Math.random() - 0.5) * 0.008;
            const close = open + newChange;
            const high = Math.max(open, close) + Math.random() * 0.003;
            const low = Math.min(open, close) - Math.random() * 0.003;
            
            mobileCandles.push({ open, high, low, close });
            if (mobileCandles.length > 20) mobileCandles.shift();
        }
        
        drawChart();
        updatePriceDisplay();
        updateTradeLines();
    }, 2000);
}

function changeMobileTimeframe(timeframe) {
    mobileTimeframe = timeframe;
    
    // Update buttons
    document.querySelectorAll('[onclick^="changeMobileTimeframe"]').forEach(btn => {
        btn.style.background = 'rgba(255,255,255,0.1)';
        btn.style.color = '#848e9c';
        btn.style.border = '1px solid rgba(255,255,255,0.2)';
    });
    
    event.target.style.background = '#f0b90b';
    event.target.style.color = '#000';
    event.target.style.border = 'none';
    
    // Restart chart
    if (mobileInterval) clearInterval(mobileInterval);
    generateCandles();
    drawChart();
    startChartUpdates();
}

function updatePriceDisplay() {
    const lastCandle = mobileCandles[mobileCandles.length - 1];
    if (!lastCandle) return;
    
    const price = lastCandle.close;
    const change = lastCandle.close - lastCandle.open;
    const changePercent = (change / lastCandle.open * 100).toFixed(2);
    
    document.getElementById('mobilePrice').textContent = price.toFixed(4);
    document.getElementById('mobileChange').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(4)} (${change >= 0 ? '+' : ''}${changePercent}%)`;
    document.getElementById('mobileChange').style.color = change >= 0 ? '#02c076' : '#f84960';
}

// Mobile account switching
function switchMobileAccount(type) {
    accountType = type;
    localStorage.setItem('account_type', type);
    
    document.querySelectorAll('.mobile-account-btn').forEach(btn => {
        btn.style.background = '#2b2f36';
        btn.style.color = '#848e9c';
        btn.style.border = '1px solid #3c4043';
    });
    
    const activeBtn = document.querySelector(`[data-account="${type}"]`);
    if (activeBtn) {
        activeBtn.style.background = '#f0b90b';
        activeBtn.style.color = '#000';
        activeBtn.style.border = 'none';
    }
    
    updateMobileBalance();
}

function selectMobileAsset(asset) {
    currentAsset = asset;
    
    document.querySelectorAll('.mobile-asset').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('mobileAsset').textContent = asset;
    
    // Reset chart for new asset
    generateCandles();
    drawChart();
}

function setMobileAmount(amount) {
    mobileAmount = amount;
    document.getElementById('mobileAmountInput').value = amount;
    
    document.querySelectorAll('.mobile-amount-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    updateMobilePayout();
}

function setMobileDuration(duration) {
    mobileDuration = duration;
    
    document.querySelectorAll('.mobile-duration-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function updateMobileAmount() {
    mobileAmount = parseInt(document.getElementById('mobileAmountInput').value) || 100;
    updateMobilePayout();
}

function updateMobileBalance() {
    const balance = userBalance[accountType] ? 
        (userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType]) : 
        (accountType === 'demo' ? 50000 : 2780);
    
    const mobileBalanceEl = document.getElementById('mobileBalance');
    if (mobileBalanceEl) {
        mobileBalanceEl.textContent = `₹${balance.toLocaleString()}`;
    }
}

function updateMobileUserId() {
    const userId = localStorage.getItem('tradepro_user_id') || 'user_' + Date.now();
    const shortId = userId.split('_')[1] || userId.substring(0, 8);
    
    const mobileUserIdEl = document.getElementById('mobileUserId');
    if (mobileUserIdEl) {
        mobileUserIdEl.textContent = `ID: ${shortId}`;
    }
}

function updateMobilePayout() {
    const profit = Math.floor(mobileAmount * 0.85);
    const total = mobileAmount + profit;
    
    document.getElementById('mobileProfit').textContent = `₹${profit}`;
    document.getElementById('mobileTotal').textContent = `₹${total}`;
}

function placeMobileTrade(direction) {
    const currentBalance = userBalance[accountType] ? 
        (userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType]) : 0;
    
    if (currentBalance < mobileAmount) {
        alert('Insufficient balance');
        return;
    }
    
    // Add trade line to chart
    const currentPrice = mobileCandles[mobileCandles.length - 1]?.close || 1.0850;
    const tradeLine = {
        id: Date.now(),
        direction: direction,
        price: currentPrice,
        color: direction === 'up' ? '#02c076' : '#f84960',
        startTime: Date.now(),
        endTime: Date.now() + (mobileDuration * 1000)
    };
    
    mobileTradeLines.push(tradeLine);
    
    // Deduct balance
    if (userBalance[accountType]) {
        if (userBalance[accountType].balance !== undefined) {
            userBalance[accountType].balance -= mobileAmount;
        } else {
            userBalance[accountType] -= mobileAmount;
        }
        localStorage.setItem('userBalance', JSON.stringify(userBalance));
        updateMobileBalance();
    }
    
    // Simulate trade
    setTimeout(() => {
        const endPrice = mobileCandles[mobileCandles.length - 1]?.close || currentPrice;
        let won = false;
        
        if (direction === 'up' && endPrice > currentPrice) {
            won = true;
        } else if (direction === 'down' && endPrice < currentPrice) {
            won = true;
        }
        
        const message = won ? `🎉 Won! +₹${Math.floor(mobileAmount * 0.85)}` : `😞 Lost! -₹${mobileAmount}`;
        
        // Remove trade line
        mobileTradeLines = mobileTradeLines.filter(line => line.id !== tradeLine.id);
        
        // Show notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
            background: ${won ? '#02c076' : '#f84960'}; color: white;
            padding: 12px 20px; border-radius: 8px; font-weight: 600;
            z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
        
        // Update balance if won
        if (won) {
            const payout = Math.floor(mobileAmount * 1.85);
            if (userBalance[accountType].balance !== undefined) {
                userBalance[accountType].balance += payout;
            } else {
                userBalance[accountType] += payout;
            }
            localStorage.setItem('userBalance', JSON.stringify(userBalance));
            updateMobileBalance();
        }
    }, mobileDuration * 1000);
}

function updateTradeLines() {
    // Remove expired trade lines
    const now = Date.now();
    mobileTradeLines = mobileTradeLines.filter(line => line.endTime > now);
}

// Auto-initialize on resize
window.addEventListener('resize', function() {
    if (window.innerWidth <= 768 && !document.querySelector('.mobile-container')) {
        createMobileInterface();
    }
});