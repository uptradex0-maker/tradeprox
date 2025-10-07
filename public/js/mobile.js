// Mobile Trading Interface - Firebase Integration
let mobileAmount = 100;
let mobileDuration = 60;
let mobileChart = null;
let mobileCandles = [];
let userBalance = 2780;
let username = '';
let activeTrades = [];

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, get, set, update } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
    databaseURL: "https://tradexpro-e0e35-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialize mobile on page load
document.addEventListener('DOMContentLoaded', function() {
    username = localStorage.getItem('tradepro_username');
    if (!username) {
        window.location.href = '/';
        return;
    }
    
    if (window.innerWidth <= 768) {
        loadUserData();
        createMobileInterface();
    }
});

async function loadUserData() {
    try {
        const userRef = ref(database, 'users/' + username);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            userBalance = userData.balance || 2780;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function saveUserData() {
    try {
        const userRef = ref(database, 'users/' + username);
        await update(userRef, {
            balance: userBalance,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

// Create mobile interface
function createMobileInterface() {
    const mobileHTML = `
        <div class="mobile-container">
            <!-- Header -->
            <div class="mobile-header">
                <div class="mobile-logo">TrustX</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="text-align: right;">
                        <div class="mobile-balance" id="mobileBalance">₹${userBalance.toLocaleString()}</div>
                        <div style="color: #848e9c; font-size: 9px;" id="mobileUsername">${username}</div>
                    </div>
                    <button onclick="logout()" style="padding: 4px 8px; background: #f84960; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">Logout</button>
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
                
                <!-- Active Trades -->
                <div class="mobile-section">
                    <div class="mobile-section-title">Active Trades</div>
                    <div id="mobileActiveTradesList">
                        <p style="color: #848e9c; text-align: center; font-size: 12px;">No active trades</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', mobileHTML);
    updateMobilePayout();
    
    setTimeout(() => {
        initMobileChart();
    }, 200);
}

function initMobileChart() {
    const canvas = document.getElementById('mobileCandleChart');
    if (!canvas) return;
    
    mobileChart = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    generateCandles();
    drawChart();
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
    
    mobileChart.clearRect(0, 0, width, height);
    
    const prices = mobileCandles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    const candleWidth = width / mobileCandles.length;
    
    mobileCandles.forEach((candle, i) => {
        const x = i * candleWidth + candleWidth / 2;
        
        const highY = 80 + (maxPrice - candle.high) / priceRange * (height - 120);
        const lowY = 80 + (maxPrice - candle.low) / priceRange * (height - 120);
        const openY = 80 + (maxPrice - candle.open) / priceRange * (height - 120);
        const closeY = 80 + (maxPrice - candle.close) / priceRange * (height - 120);
        
        const isUp = candle.close >= candle.open;
        const color = isUp ? '#02c076' : '#f84960';
        
        mobileChart.strokeStyle = color;
        mobileChart.lineWidth = 1;
        mobileChart.beginPath();
        mobileChart.moveTo(x, highY);
        mobileChart.lineTo(x, lowY);
        mobileChart.stroke();
        
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
}

function startChartUpdates() {
    setInterval(() => {
        const lastCandle = mobileCandles[mobileCandles.length - 1];
        const change = (Math.random() - 0.5) * 0.005;
        lastCandle.close += change;
        lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
        lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
        
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
    }, 2000);
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

function selectMobileAsset(asset) {
    document.querySelectorAll('.mobile-asset').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('mobileAsset').textContent = asset;
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

function updateMobilePayout() {
    const profit = Math.floor(mobileAmount * 0.85);
    const total = mobileAmount + profit;
    
    document.getElementById('mobileProfit').textContent = `₹${profit}`;
    document.getElementById('mobileTotal').textContent = `₹${total}`;
}

async function placeMobileTrade(direction) {
    if (userBalance < mobileAmount) {
        alert('Insufficient balance');
        return;
    }
    
    if (mobileAmount < 10) {
        alert('Minimum trade amount is ₹10');
        return;
    }
    
    // Deduct balance
    userBalance -= mobileAmount;
    updateMobileBalance();
    await saveUserData();
    
    // Create trade
    const trade = {
        id: Date.now().toString(),
        asset: document.getElementById('mobileAsset').textContent,
        direction: direction,
        amount: mobileAmount,
        duration: mobileDuration,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + mobileDuration * 1000).toISOString(),
        status: 'active',
        startPrice: mobileCandles[mobileCandles.length - 1]?.close || 1.0850
    };
    
    // Save trade to Firebase
    try {
        const tradeRef = ref(database, 'trades/' + username + '/' + trade.id);
        await set(tradeRef, trade);
        
        activeTrades.push(trade);
        displayMobileActiveTrades();
        
        // Set timer for trade completion
        setTimeout(() => completeMobileTrade(trade.id), mobileDuration * 1000);
        
    } catch (error) {
        console.error('Error saving trade:', error);
        // Refund on error
        userBalance += mobileAmount;
        updateMobileBalance();
        await saveUserData();
    }
}

async function completeMobileTrade(tradeId) {
    const tradeIndex = activeTrades.findIndex(t => t.id === tradeId);
    if (tradeIndex === -1) return;
    
    const trade = activeTrades[tradeIndex];
    const won = Math.random() > 0.5; // 50% win rate
    
    let payout = 0;
    if (won) {
        payout = Math.floor(trade.amount * 1.85); // 85% profit
        userBalance += payout;
    }
    
    // Update trade status in Firebase
    try {
        const tradeRef = ref(database, 'trades/' + username + '/' + tradeId);
        await update(tradeRef, {
            status: 'completed',
            result: won ? 'won' : 'lost',
            payout: payout,
            completedAt: new Date().toISOString()
        });
        
        // Update user stats
        const userRef = ref(database, 'users/' + username);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        
        await update(userRef, {
            balance: userBalance,
            totalWins: userData.totalWins + (won ? 1 : 0),
            totalLosses: userData.totalLosses + (won ? 0 : 1),
            totalTrades: userData.totalTrades + 1
        });
    } catch (error) {
        console.error('Error updating trade:', error);
    }
    
    // Remove from active trades
    activeTrades.splice(tradeIndex, 1);
    displayMobileActiveTrades();
    updateMobileBalance();
    
    // Show notification
    const message = won ? `🎉 Won! +₹${payout - trade.amount}` : `😞 Lost! -₹${trade.amount}`;
    showMobileNotification(message, won ? '#02c076' : '#f84960');
}

function displayMobileActiveTrades() {
    const container = document.getElementById('mobileActiveTradesList');
    if (!container) return;
    
    if (activeTrades.length === 0) {
        container.innerHTML = '<p style="color: #848e9c; text-align: center; font-size: 12px;">No active trades</p>';
        return;
    }
    
    container.innerHTML = activeTrades.map(trade => {
        const timeLeft = Math.max(0, Math.floor((new Date(trade.endTime) - new Date()) / 1000));
        
        return `
            <div style="background: rgba(43, 47, 54, 0.5); padding: 8px; margin-bottom: 5px; border-radius: 4px; border-left: 2px solid ${trade.direction === 'up' ? '#02c076' : '#f84960'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="color: white; font-size: 11px; font-weight: 600;">${trade.asset}</div>
                        <div style="color: ${trade.direction === 'up' ? '#02c076' : '#f84960'}; font-size: 9px;">${trade.direction.toUpperCase()} ₹${trade.amount}</div>
                    </div>
                    <div style="color: #f0b90b; font-size: 12px; font-weight: 600;">${timeLeft}s</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update countdown
    setTimeout(() => {
        if (activeTrades.length > 0) {
            displayMobileActiveTrades();
        }
    }, 1000);
}

function updateMobileBalance() {
    const mobileBalanceEl = document.getElementById('mobileBalance');
    if (mobileBalanceEl) {
        mobileBalanceEl.textContent = `₹${userBalance.toLocaleString()}`;
    }
}

function showMobileNotification(message, color) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
        background: ${color}; color: white; padding: 12px 20px;
        border-radius: 8px; font-weight: 600; z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

function logout() {
    localStorage.removeItem('tradepro_username');
    localStorage.removeItem('tradepro_user_data');
    window.location.href = '/';
}

// Make functions global
window.selectMobileAsset = selectMobileAsset;
window.setMobileAmount = setMobileAmount;
window.setMobileDuration = setMobileDuration;
window.updateMobileAmount = updateMobileAmount;
window.placeMobileTrade = placeMobileTrade;
window.logout = logout;

// Auto-initialize on resize
window.addEventListener('resize', function() {
    if (window.innerWidth <= 768 && !document.querySelector('.mobile-container')) {
        const user = localStorage.getItem('tradepro_username');
        if (user) {
            loadUserData();
            createMobileInterface();
        }
    }
});