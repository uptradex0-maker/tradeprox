// Dashboard with Firebase - Real Account Only
let currentAsset = 'EUR/USD';
let userBalance = 0;
let activeTrades = [];
let username = '';
let chartData = {};
let currentCandle = {};
let candleStartTime = {};
let chart = null;

// Account state
let currentAccount = 'demo';
let demoBalanceValue = 50000;
let realBalanceValue = 0;

let timeframe = 60000; // default 1 minute

const assets = ['EUR/USD', 'GBP/USD', 'BTC/USD'];

// Firebase - Optional for compatibility
let database = null;
try {
    // Only load Firebase if available
    if (typeof firebase !== 'undefined') {
        const firebaseConfig = {
            databaseURL: "https://tradexpro-e0e35-default-rtdb.firebaseio.com/"
        };
        const app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
    }
} catch (e) {
    console.log('Firebase not available, using local storage');
}

document.addEventListener('DOMContentLoaded', function() {
    // Use existing username if available; otherwise generate one
    const existing = localStorage.getItem('tradepro_username');
    username = existing || ('user_' + Date.now());
    if (!existing) {
        localStorage.setItem('tradepro_username', username);
        localStorage.setItem('tradepro_user_id', username);
    }

    // Load persisted account selection (default demo)
    const storedAccount = localStorage.getItem('tradepro_current_account');
    currentAccount = storedAccount === 'real' ? 'real' : 'demo';

    // Initialize balance manager first
    if (window.balanceManager) {
        window.balanceManager.userId = username;
        // Set up balance update callback
        window.balanceManager.onBalanceUpdate((balance) => {
            userBalance = balance.currentAccount === 'real' ? balance.realBalance : balance.demoBalance;
            currentAccount = balance.currentAccount;
            updateBalance();
            applyAccountToUI();
        });
    }
    
    // Make functions global for chart integration
    window.addTradeLineToChart = addTradeLineToChart;
    window.removeTradeLineFromChart = removeTradeLineFromChart;

    // Show default balances immediately to update UI
    demoBalanceValue = 50000;
    realBalanceValue = 0;
    userBalance = currentAccount === 'real' ? realBalanceValue : demoBalanceValue;

    // Build UI first so balance is visible, then load actual data
    initializeChart();
    applyAccountToUI();
    
    // Force chart initialization after DOM is ready
    setTimeout(() => {
        initializeCandlestickChart();
    }, 500);

    // Load data with proper synchronization
    Promise.all([
        loadUserData(),
        window.balanceManager ? window.balanceManager.getBalance(true) : Promise.resolve()
    ]).then(() => {
        // Ensure UI reflects loaded values
        applyAccountToUI();
    });

    startPriceUpdates();

    // Add event listeners for selectors
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
            // Reset all chart data for new timeframe
            assets.forEach(asset => {
                chartData[asset] = [];
                currentCandle[asset] = null;
                candleStartTime[asset] = Date.now();
            });
            updateChartDisplay();
        });
    }
});

function updateChartDisplay() {
    // Update asset display
    const assetDisplay = document.getElementById('currentAssetDisplay');
    if (assetDisplay) {
        assetDisplay.textContent = currentAsset;
    }
    
    // Redraw chart
    const canvas = document.getElementById('candlestickChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        drawChart(ctx, canvas.offsetWidth, canvas.offsetHeight);
    }
}

async function loadUserData() {
    try {
        // Load from server balance system first
        if (window.balanceManager) {
            const serverBalance = await window.balanceManager.getBalance(true);
            demoBalanceValue = serverBalance.demoBalance;
            realBalanceValue = serverBalance.realBalance;
            currentAccount = serverBalance.currentAccount;
            localStorage.setItem('tradepro_current_account', currentAccount);
        }
        
        // Fallback to localStorage if no balance manager
        if (!window.balanceManager) {
            const cached = localStorage.getItem('tradepro_balance_cache');
            if (cached) {
                const balance = JSON.parse(cached);
                demoBalanceValue = balance.demoBalance || 50000;
                realBalanceValue = balance.realBalance || 0;
                currentAccount = balance.currentAccount || 'demo';
            }
        }
        
        applyAccountToUI();
        loadActiveTrades();
    } catch (error) {
        console.error('Error loading user data:', error);
        // Use defaults
        demoBalanceValue = 50000;
        realBalanceValue = 0;
        currentAccount = 'demo';
        applyAccountToUI();
    }
}

async function saveUserData() {
    try {
        // Save to localStorage as fallback
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

async function loadActiveTrades() {
    try {
        // Load from localStorage as fallback
        const cached = localStorage.getItem('tradepro_active_trades');
        if (cached) {
            const trades = JSON.parse(cached);
            activeTrades = trades.filter(trade => 
                trade.status === 'active' && new Date(trade.endTime) > new Date() && (!trade.accountType || trade.accountType === currentAccount)
            );
            displayActiveTrades();
            
            // Set timers for active trades
            activeTrades.forEach(trade => {
                const timeLeft = new Date(trade.endTime) - new Date();
                if (timeLeft > 0) {
                    setTimeout(() => completeTrade(trade.id), timeLeft);
                }
            });
        }
    } catch (error) {
        console.error('Error loading trades:', error);
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
                    <h3 style="color: #f0b90b; margin: 0; font-size: 18px;">TrustX</h3>
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
                    <button onclick="window.location.href='/deposit'" class="fast-transition" style="padding: 6px 12px; background: #02c076; color: white; border: none; border-radius: 4px; font-size: 12px; margin-right: 5px;">Deposit</button>
                    <button onclick="window.location.href='/withdraw'" class="fast-transition" style="padding: 6px 12px; background: #f84960; color: white; border: none; border-radius: 4px; font-size: 12px; margin-right: 5px;">Withdraw</button>
                    <button onclick="logout()" class="fast-transition" style="padding: 6px 12px; background: #f84960; color: white; border: none; border-radius: 4px; font-size: 12px;">Exit</button>
                </div>
            </div>
            
            <!-- Chart Area -->
            <div style="margin-top: 60px; height: calc(100vh - 200px); padding: 10px; background: #1a1a1a;">
                <canvas id="candlestickChart" width="800" height="400" style="width: 100%; height: 100%; background: #1a1a1a; border: 1px solid #333;"></canvas>
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
                            <option value="5">5s</option>
                            <option value="10">10s</option>
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
            
            <!-- Active Trades Overlay -->
            <div id="activeTradesOverlay" style="position: fixed; top: 70px; right: 10px; width: 200px; max-height: 300px; overflow-y: auto; z-index: 50; display: none;">
                <div style="background: rgba(30, 35, 41, 0.95); padding: 10px; border-radius: 8px; backdrop-filter: blur(10px);">
                    <h4 style="color: #f0b90b; margin: 0 0 10px 0; font-size: 14px;">Active Trades</h4>
                    <div id="activeTradesList">
                        <p style="color: #848e9c; text-align: center; font-size: 12px;">No active trades</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize chart data for all assets
    assets.forEach(asset => {
        chartData[asset] = [];
        currentCandle[asset] = null;
        candleStartTime[asset] = Date.now();
    });
    
    // Force chart initialization
    setTimeout(() => {
        forceInitChart();
    }, 100);
}

function forceInitChart() {
    const canvas = document.getElementById('candlestickChart');
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 400;
    
    const ctx = canvas.getContext('2d');
    
    // Generate sample data
    generateCandleData();
    
    // Draw immediately
    drawChart(ctx, 800, 400);
    
    console.log('Chart forced to initialize');
}

function updateBalance() {
    const balanceEl = document.getElementById('userBalance');
    if (balanceEl) {
        const balance = window.balanceManager ? window.balanceManager.getCurrentAccountBalance() : userBalance;
        balanceEl.textContent = `₹${balance.toLocaleString()}`;
    }
}

function applyAccountToUI() {
    const pill = document.getElementById('accountTypePill');
    if (pill) {
        const account = window.balanceManager.currentBalance.currentAccount || currentAccount;
        pill.textContent = account.toUpperCase();
        if (account === 'real') {
            pill.style.background = '#f84960';
            pill.style.color = '#fff';
        } else {
            pill.style.background = '#02c076';
            pill.style.color = '#000';
        }
    }
    const switchBtn = document.getElementById('accountSwitchBtn');
    if (switchBtn) {
        const account = window.balanceManager.currentBalance.currentAccount || currentAccount;
        switchBtn.textContent = account === 'real' ? 'Switch to Demo' : 'Switch to Real';
    }
    
    // Update balance from balance manager
    userBalance = window.balanceManager.getCurrentAccountBalance();
    updateBalance();
}

async function setCurrentAccount(account) {
    currentAccount = account === 'real' ? 'real' : 'demo';
    localStorage.setItem('tradepro_current_account', currentAccount);
    
    // Update via balance manager
    await window.balanceManager.switchAccount(currentAccount);
    
    // Also update Firebase for compatibility
    try {
        const userRef = ref(database, 'users/' + username);
        await update(userRef, { currentAccount });
    } catch (e) {
        console.warn('Could not persist currentAccount to Firebase', e);
    }
    
    applyAccountToUI();
}

function switchAccount(account) {
    setCurrentAccount(account);
}

function toggleAccount() {
    const target = currentAccount === 'real' ? 'demo' : 'real';
    setCurrentAccount(target);
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
    
    // Check balance using balance manager
    if (!window.balanceManager.hasEnoughBalance(amount)) {
        alert('Insufficient balance');
        return;
    }
    
    try {
        // Get current price from chart
        const startPrice = getCurrentPrice(currentAsset);
        
        // Place trade using trade manager
        const trade = await window.tradeManager.placeTrade(
            currentAsset,
            direction,
            amount,
            duration,
            startPrice
        );
        
        if (trade) {
            // Add trade line to chart
            addTradeLineToChart(trade);
            
            // Update local active trades for display
            activeTrades.push(trade);
            displayActiveTrades();
            
            // Show success notification
            showNotification(`Trade placed: ${direction.toUpperCase()} ₹${amount}`, '#f0b90b');
        }
        
    } catch (error) {
        console.error('Trade placement error:', error);
        alert(error.message || 'Failed to place trade');
    }
}

// Get current price for the asset
function getCurrentPrice(asset) {
    if (currentCandle[asset]) {
        return currentCandle[asset].close;
    }
    return getInitialPrice(asset);
}

// Trade completion is now handled by TradeManager
// This function is kept for compatibility but delegates to TradeManager
async function completeTrade(tradeId) {
    // Find trade in local array
    const tradeIndex = activeTrades.findIndex(t => t.id === tradeId);
    if (tradeIndex === -1) return;
    
    const trade = activeTrades[tradeIndex];
    
    // Get current price and determine result - FIXED LOGIC
    const endPrice = getCurrentPrice(trade.asset);
    let result;
    if (trade.direction === 'up') {
        result = endPrice < trade.startPrice ? 'win' : 'loss';
    } else {
        result = endPrice > trade.startPrice ? 'win' : 'loss';
    }
    
    // Use TradeManager to complete the trade
    await window.tradeManager.completeTrade(tradeId, endPrice, result);
    
    // Remove trade line from chart
    removeTradeLineFromChart(tradeId);
    
    // Remove from local active trades
    activeTrades.splice(tradeIndex, 1);
    displayActiveTrades();
}

function displayActiveTrades() {
    const container = document.getElementById('activeTradesList');
    if (!container) return;
    
    if (activeTrades.length === 0) {
        container.innerHTML = '<p style="color: #848e9c; text-align: center;">No active trades</p>';
        return;
    }
    
    container.innerHTML = activeTrades.map(trade => {
        const timeLeft = Math.max(0, Math.floor((new Date(trade.endTime) - new Date()) / 1000));
        
        return `
            <div style="background: rgba(43, 47, 54, 0.5); padding: 10px; margin-bottom: 8px; border-radius: 5px; border-left: 3px solid ${trade.direction === 'up' ? '#02c076' : '#f84960'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="color: white; font-size: 12px; font-weight: 600;">${trade.asset}</div>
                        <div style="color: ${trade.direction === 'up' ? '#02c076' : '#f84960'}; font-size: 10px;">${trade.direction.toUpperCase()} ₹${trade.amount}</div>
                    </div>
                    <div style="color: #f0b90b; font-size: 14px; font-weight: 600;">${timeLeft}s</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update countdown every second
    setTimeout(() => {
        if (activeTrades.length > 0) {
            displayActiveTrades();
        }
    }, 1000);
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
    localStorage.removeItem('tradepro_username');
    localStorage.removeItem('tradepro_user_data');
    location.reload();
}

function initializeCandlestickChart() {
    forceInitChart();
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

// Store trade lines globally
window.tradeLines = window.tradeLines || [];

function drawChart(ctx, width, height) {
    ctx.fillStyle = '#0d1421';
    ctx.fillRect(0, 0, width, height);
    
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Scroll offset for panning
    if (typeof drawChart.scrollOffset === 'undefined') {
        drawChart.scrollOffset = 0;
    }
    
    // Max candles to show based on width and candle width
    const maxCandles = Math.floor(chartWidth / 10); // 10px per candle approx
    
    let allCandles = [...chartData[currentAsset]];
    if (currentCandle[currentAsset]) {
        allCandles.push(currentCandle[currentAsset]);
    }
    
    // Apply scroll offset to slice candles for display
    const startIndex = Math.max(0, allCandles.length - maxCandles - drawChart.scrollOffset);
    const visibleCandles = allCandles.slice(startIndex, startIndex + maxCandles);
    
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
        
        // Draw body with gradient
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(closeY - openY) || 1;
        const gradient = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyHeight);
        if (isGreen) {
            gradient.addColorStop(0, '#02c076');
            gradient.addColorStop(1, '#028a50');
        } else {
            gradient.addColorStop(0, '#f84960');
            gradient.addColorStop(1, '#d63447');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, bodyHeight);
        
        // Add glow effect
        ctx.shadowColor = isGreen ? '#02c076' : '#f84960';
        ctx.shadowBlur = 5;
        ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, bodyHeight);
        ctx.shadowBlur = 0;
    });
    
    // Draw trade lines
    window.tradeLines.forEach(tradeLine => {
        if (tradeLine.asset === currentAsset) {
            const tradeY = padding + (maxPrice - tradeLine.price) / priceRange * chartHeight;
            
            // Draw horizontal line
            ctx.strokeStyle = tradeLine.direction === 'up' ? '#02c076' : '#f84960';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(padding, tradeY);
            ctx.lineTo(width - padding, tradeY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw trade marker
            ctx.fillStyle = tradeLine.direction === 'up' ? '#02c076' : '#f84960';
            ctx.beginPath();
            ctx.arc(padding + 10, tradeY, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw trade info
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(padding + 20, tradeY - 10, 80, 20);
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText(`${tradeLine.direction.toUpperCase()} ₹${tradeLine.amount}`, padding + 25, tradeY + 3);
        }
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
    
    // Draw price label with background
    ctx.fillStyle = 'rgba(240, 185, 11, 0.8)';
    ctx.fillRect(width - 70, currentY - 10, 50, 16);
    ctx.fillStyle = '#0d1421';
    ctx.font = '12px Arial';
    ctx.fillText(currentPrice.toFixed(currentAsset === 'BTC/USD' ? 0 : 4), width - 60, currentY + 2);
}

// Add trade line to chart
function addTradeLineToChart(trade) {
    window.tradeLines.push({
        id: trade.id,
        asset: trade.asset,
        price: trade.startPrice,
        direction: trade.direction,
        amount: trade.amount,
        timestamp: Date.now()
    });
    
    // Remove old trade lines (keep last 5)
    if (window.tradeLines.length > 5) {
        window.tradeLines = window.tradeLines.slice(-5);
    }
}

// Remove trade line when trade completes
function removeTradeLineFromChart(tradeId) {
    window.tradeLines = window.tradeLines.filter(line => line.id !== tradeId);
}

const canvas = document.getElementById('candlestickChart');
if (canvas) {
    canvas.addEventListener('wheel', function(event) {
        event.preventDefault();
        if (event.ctrlKey) {
            // Zoom in/out with ctrl + wheel
            if (event.deltaY > 0) {
                drawChart.zoomLevel = Math.max(5, (drawChart.zoomLevel || 10) - 1);
            } else {
                drawChart.zoomLevel = Math.min(50, (drawChart.zoomLevel || 10) + 1);
            }
        } else {
            // Scroll chart horizontally
            if (event.deltaY > 0) {
                drawChart.scrollOffset = Math.min(drawChart.scrollOffset + 1, chartData[currentAsset].length);
            } else {
                drawChart.scrollOffset = Math.max(drawChart.scrollOffset - 1, 0);
            }
        }
        const ctx = canvas.getContext('2d');
        drawChart(ctx, canvas.width, canvas.height);
    });
}

function updateChart() {
    assets.forEach(asset => {
        if (!currentCandle[asset]) {
            // Start new candle
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
        
        // Update current candle with small price tick
        const volatility = asset === 'BTC/USD' ? 0.002 : 0.0002; // Higher volatility for BTC
        const change = (Math.random() - 0.5) * volatility;
        currentCandle[asset].close += change;
        currentCandle[asset].high = Math.max(currentCandle[asset].high, currentCandle[asset].close);
        currentCandle[asset].low = Math.min(currentCandle[asset].low, currentCandle[asset].close);
        
        // Check if candle period ended
        if (Date.now() - candleStartTime[asset] >= timeframe) {
            chartData[asset].push(currentCandle[asset]);
            if (chartData[asset].length > 50) {
                chartData[asset].shift();
            }
            currentCandle[asset] = null;
        }
    });
    
    // Redraw chart for current asset
    const canvas = document.getElementById('candlestickChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        drawChart(ctx, canvas.width, canvas.height);
    }
}

function startPriceUpdates() {
    setInterval(updateChart, 1000); // Update every 1 second for smoother candle formation
}

function toggleActiveTrades() {
    const overlay = document.getElementById('activeTradesOverlay');
    if (overlay) {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
    }
}

if (typeof window.displayActiveTrades === 'undefined') {
    window.displayActiveTrades = function() {
        const container = document.getElementById('activeTradesList');
        if (!container) return;

        if (activeTrades.length === 0) {
            container.innerHTML = '<p style="color: #848e9c; text-align: center; font-size: 12px;">No active trades</p>';
            document.getElementById('activeTradesOverlay').style.display = 'none';
            return;
        }

        document.getElementById('activeTradesOverlay').style.display = 'block';

        container.innerHTML = activeTrades.map(trade => {
            const timeLeft = Math.max(0, Math.floor((new Date(trade.endTime) - new Date()) / 1000));

            return `
                <div style="background: rgba(43, 47, 54, 0.8); padding: 8px; margin-bottom: 6px; border-radius: 4px; border-left: 2px solid ${trade.direction === 'up' ? '#02c076' : '#f84960'};">
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

        setTimeout(() => {
            if (activeTrades.length > 0) {
                window.displayActiveTrades();
            }
        }, 1000);
    }
}

// Add mobile viewport meta tag
if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
    document.head.appendChild(viewport);
}

// Make functions global
window.placeTrade = placeTrade;
window.logout = logout;
window.toggleActiveTrades = toggleActiveTrades;
window.switchAccount = switchAccount;
window.toggleAccount = toggleAccount;