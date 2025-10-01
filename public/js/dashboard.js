// Professional Trading Dashboard - Exact Screenshot Match
let currentAsset = 'EUR/USD';
let accountType = 'demo';
let userBalance = JSON.parse(localStorage.getItem('userBalance')) || { demo: 50000, real: 2780 };
let activeTrades = [];
let socket;
let isConnected = false;

// Chart variables
let candleChart;
let candleData = [];
let currentPrice = 1.0850;
let tradeLines = [];
let currentTimeframe = 300000; // 5 minutes default
let currentCandle = null;
let candleUpdateInterval = null;

// Asset data with different base prices
const assetData = {
    'EUR/USD': { price: 1.08500, decimals: 5, volatility: 0.006 },
    'GBP/USD': { price: 1.26450, decimals: 5, volatility: 0.008 },
    'USD/JPY': { price: 149.750, decimals: 3, volatility: 0.5 },
    'AUD/USD': { price: 0.65800, decimals: 5, volatility: 0.007 },
    'BTC/USD': { price: 43250.50, decimals: 2, volatility: 500 },
    'ETH/USD': { price: 2650.75, decimals: 2, volatility: 50 },
    'LTC/USD': { price: 72.50, decimals: 2, volatility: 5 },
    'US30': { price: 37850.25, decimals: 2, volatility: 100 },
    'SPX500': { price: 4785.50, decimals: 2, volatility: 25 },
    'NAS100': { price: 15420.75, decimals: 2, volatility: 80 }
};

// Initialize immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    createFullScreenChart();
    initializeAccounts();
    loadSavedTrades();
    connectToServer();
    startPriceUpdates();
}

function loadSavedTrades() {
    try {
        const savedTrades = localStorage.getItem('activeTrades');
        if (savedTrades) {
            const trades = JSON.parse(savedTrades);
            const now = Date.now();
            
            // Filter out expired trades and restore active ones
            activeTrades = trades.filter(trade => {
                const timeLeft = trade.endTime - now;
                
                if (timeLeft > 0) {
                    // Restore trade timer
                    setTimeout(() => {
                        const won = Math.random() > 0.5;
                        console.log('Restored trade completed. Won:', won);
                        
                        // Handle win/loss
                        if (won) {
                            const payout = Math.floor(trade.amount * 1.85);
                            if (userBalance[accountType].balance !== undefined) {
                                userBalance[accountType].balance += payout;
                            } else {
                                userBalance[accountType] += payout;
                            }
                            
                            // Update balance display
                            const balanceEl = document.getElementById('userBalance');
                            if (balanceEl) {
                                const newBalance = userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType];
                                balanceEl.textContent = `₹${newBalance.toLocaleString()}`;
                            }
                        }
                        
                        // Save updated balance
                        localStorage.setItem('userBalance', JSON.stringify(userBalance));
                        
                        // Remove completed trade
                        activeTrades = activeTrades.filter(t => t.id !== trade.id);
                        localStorage.setItem('activeTrades', JSON.stringify(activeTrades));
                        displayActiveTrades();
                    }, timeLeft);
                    
                    return true; // Keep this trade
                }
                return false; // Remove expired trade
            });
            
            // Save cleaned trades
            localStorage.setItem('activeTrades', JSON.stringify(activeTrades));
            
            // Display active trades after a short delay to ensure UI is ready
            setTimeout(() => {
                displayActiveTrades();
            }, 500);
        }
    } catch (error) {
        console.log('Error loading saved trades:', error);
        activeTrades = [];
    }
}

function createFullScreenChart() {
    // Find or create chart container
    let container = document.getElementById('tradingChart');
    if (!container) {
        container = document.createElement('div');
        container.id = 'tradingChart';
        container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1000;';
        document.body.appendChild(container);
    }
    
    container.innerHTML = `
        <div style="width: 100%; height: 100%; background: #0d1421; position: relative; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            
            <!-- Top Toolbar -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 45px; background: linear-gradient(135deg, #1e2329 0%, #181a20 100%); border-bottom: 1px solid #2b2f36; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 20px;">
                
                <!-- Left Side - Asset & Timeframes -->
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="color: #f0b90b; font-size: 16px; font-weight: 600;">${currentAsset}</div>
                    <div style="display: flex; gap: 2px;">
                        <button onclick="setTimeframe(5000)" class="tf-btn" data-tf="5000" style="padding: 6px 12px; background: #2b2f36; color: #848e9c; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">5s</button>
                        <button onclick="setTimeframe(60000)" class="tf-btn" data-tf="60000" style="padding: 6px 12px; background: #2b2f36; color: #848e9c; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">1m</button>
                        <button onclick="setTimeframe(300000)" class="tf-btn active" data-tf="300000" style="padding: 6px 12px; background: #f0b90b; color: #000; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">5m</button>
                        <button onclick="setTimeframe(900000)" class="tf-btn" data-tf="900000" style="padding: 6px 12px; background: #2b2f36; color: #848e9c; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">15m</button>
                        <button onclick="setTimeframe(3600000)" class="tf-btn" data-tf="3600000" style="padding: 6px 12px; background: #2b2f36; color: #848e9c; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">1h</button>
                        <button onclick="setTimeframe(14400000)" class="tf-btn" data-tf="14400000" style="padding: 6px 12px; background: #2b2f36; color: #848e9c; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s;">4h</button>
                    </div>
                </div>
                
                <!-- Right Side - Price Info -->
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="color: #ffffff; font-size: 18px; font-weight: 600;" id="topPrice">1.08500</div>
                    <div style="color: #02c076; font-size: 14px; font-weight: 500;" id="topChange">+0.00120 (+0.11%)</div>
                    <div style="color: #848e9c; font-size: 12px;">24h Vol: 1.2M</div>
                </div>
            </div>
            
            <!-- Asset Selector (Left Side) -->
            <div style="position: absolute; top: 45px; left: 0; width: 250px; height: 100%; background: linear-gradient(135deg, #1e2329 0%, #181a20 100%); border-right: 1px solid #2b2f36; z-index: 90; padding: 15px; box-sizing: border-box; overflow-y: auto;">
                <div style="color: #f0b90b; font-size: 14px; font-weight: 600; margin-bottom: 15px;">ASSETS</div>
                
                <!-- Forex Assets -->
                <div style="margin-bottom: 20px;">
                    <div style="color: #848e9c; font-size: 11px; margin-bottom: 8px; font-weight: 600;">💱 FOREX</div>
                    <div class="asset-option active" data-asset="EUR/USD" onclick="selectAsset('EUR/USD', 1.08500)" style="padding: 8px 12px; background: rgba(240, 185, 11, 0.2); border: 1px solid #f0b90b; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">EUR/USD</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-EUR/USD">1.08500</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="GBP/USD" onclick="selectAsset('GBP/USD', 1.26450)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">GBP/USD</span>
                            <span style="color: #f84960; font-size: 11px;" id="price-GBP/USD">1.26450</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="USD/JPY" onclick="selectAsset('USD/JPY', 149.750)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">USD/JPY</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-USD/JPY">149.750</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="AUD/USD" onclick="selectAsset('AUD/USD', 0.65800)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">AUD/USD</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-AUD/USD">0.65800</span>
                        </div>
                    </div>
                </div>
                
                <!-- Crypto Assets -->
                <div style="margin-bottom: 20px;">
                    <div style="color: #848e9c; font-size: 11px; margin-bottom: 8px; font-weight: 600;">₿ CRYPTO</div>
                    <div class="asset-option" data-asset="BTC/USD" onclick="selectAsset('BTC/USD', 43250.50)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">BTC/USD</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-BTC/USD">43,250</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="ETH/USD" onclick="selectAsset('ETH/USD', 2650.75)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">ETH/USD</span>
                            <span style="color: #f84960; font-size: 11px;" id="price-ETH/USD">2,650</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="LTC/USD" onclick="selectAsset('LTC/USD', 72.50)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">LTC/USD</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-LTC/USD">72.50</span>
                        </div>
                    </div>
                </div>
                
                <!-- Indices Assets -->
                <div>
                    <div style="color: #848e9c; font-size: 11px; margin-bottom: 8px; font-weight: 600;">📈 INDICES</div>
                    <div class="asset-option" data-asset="US30" onclick="selectAsset('US30', 37850.25)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">US30</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-US30">37,850</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="SPX500" onclick="selectAsset('SPX500', 4785.50)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">SPX500</span>
                            <span style="color: #f84960; font-size: 11px;" id="price-SPX500">4,785</span>
                        </div>
                    </div>
                    <div class="asset-option" data-asset="NAS100" onclick="selectAsset('NAS100', 15420.75)" style="padding: 8px 12px; background: rgba(43, 47, 54, 0.5); border: 1px solid #3c4043; border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ffffff; font-size: 12px; font-weight: 600;">NAS100</span>
                            <span style="color: #02c076; font-size: 11px;" id="price-NAS100">15,420</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Main Chart Area -->
            <div style="position: absolute; top: 45px; left: 250px; right: 280px; bottom: 0; background: #0d1421;">
                
                <!-- Chart Canvas -->
                <canvas id="mainChart" style="width: 100%; height: 100%; display: block; background: #0d1421;"></canvas>
                
                <!-- Price Scale (Right) -->
                <div id="priceScale" style="position: absolute; right: 0; top: 0; bottom: 30px; width: 70px; background: rgba(13, 20, 33, 0.95); border-left: 1px solid #2b2f36; z-index: 50; display: flex; flex-direction: column; justify-content: space-between; padding: 10px 5px;"></div>
                
                <!-- Time Scale (Bottom) -->
                <div id="timeScale" style="position: absolute; bottom: 0; left: 0; right: 70px; height: 30px; background: rgba(13, 20, 33, 0.95); border-top: 1px solid #2b2f36; z-index: 50; display: flex; align-items: center; justify-content: space-between; padding: 0 20px;"></div>
                
                <!-- Crosshair Lines -->
                <div id="crosshairV" style="position: absolute; width: 1px; height: 100%; background: #848e9c; opacity: 0; z-index: 60; pointer-events: none;"></div>
                <div id="crosshairH" style="position: absolute; height: 1px; width: 100%; background: #848e9c; opacity: 0; z-index: 60; pointer-events: none;"></div>
                
                <!-- Balance & Top-up Section (Top Right Corner) -->
                <div style="position: fixed; top: 0; right: 0; width: 280px; height: 100px; background: linear-gradient(135deg, #1e2329 0%, #181a20 100%); border-left: 1px solid #2b2f36; border-bottom: 1px solid #2b2f36; z-index: 100; padding: 12px; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <div style="color: #848e9c; font-size: 10px; margin-bottom: 2px;">BALANCE</div>
                            <div style="color: #ffffff; font-size: 16px; font-weight: 600;" id="userBalance">₹50,000</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="account-btn active" data-account="demo" onclick="switchAccount('demo')" style="padding: 4px 8px; background: #f0b90b; color: #000; border: none; border-radius: 3px; font-size: 10px; font-weight: 600; cursor: pointer;">DEMO</button>
                            <button class="account-btn" data-account="real" onclick="switchAccount('real')" style="padding: 4px 8px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 3px; font-size: 10px; font-weight: 600; cursor: pointer;">REAL</button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="showDepositModal()" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #02c076, #028a50); color: white; border: none; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;">💰 DEPOSIT</button>
                        <button onclick="showWithdrawModal()" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #f84960, #d63447); color: white; border: none; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;">💸 WITHDRAW</button>
                    </div>
                </div>
                
                <!-- Trading Panel (Bottom Right Corner - Absolute Corner) -->
                <div style="position: fixed; bottom: 0; right: 0; width: 280px; height: calc(100vh - 100px); background: linear-gradient(135deg, #1e2329 0%, #181a20 100%); border-left: 1px solid #2b2f36; border-top: 1px solid #2b2f36; z-index: 99; padding: 15px; box-sizing: border-box; overflow-y: auto;">
                    
                    <!-- Asset Info -->
                    <div style="margin-bottom: 25px;">
                        <div style="color: #f0b90b; font-size: 18px; font-weight: 600; margin-bottom: 8px;">${currentAsset}</div>
                        <div style="color: #02c076; font-size: 14px; font-weight: 500;" id="sidePrice">1.08500 (+0.11%)</div>
                    </div>
                    
                    <!-- Trade Amount -->
                    <div style="margin-bottom: 20px;">
                        <label style="color: #848e9c; font-size: 12px; display: block; margin-bottom: 8px;">TRADE AMOUNT</label>
                        <div style="position: relative;">
                            <input type="number" id="tradeAmount" value="100" min="10" style="width: 100%; padding: 12px 15px; background: #2b2f36; border: 1px solid #3c4043; border-radius: 6px; color: white; font-size: 16px; font-weight: 600; outline: none;">
                            <span style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #848e9c; font-size: 14px;">₹</span>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button onclick="setAmount(50)" style="flex: 1; padding: 8px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">₹50</button>
                            <button onclick="setAmount(100)" style="flex: 1; padding: 8px; background: #f0b90b; color: #000; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">₹100</button>
                            <button onclick="setAmount(500)" style="flex: 1; padding: 8px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">₹500</button>
                            <button onclick="setAmount(1000)" style="flex: 1; padding: 8px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">₹1K</button>
                        </div>
                    </div>
                    
                    <!-- Trade Duration -->
                    <div style="margin-bottom: 20px;">
                        <label style="color: #848e9c; font-size: 12px; display: block; margin-bottom: 8px;">TRADE DURATION</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                            <button onclick="setDuration(5)" class="duration-btn" data-duration="5" style="padding: 10px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">5s</button>
                            <button onclick="setDuration(10)" class="duration-btn" data-duration="10" style="padding: 10px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">10s</button>
                            <button onclick="setDuration(15)" class="duration-btn" data-duration="15" style="padding: 10px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">15s</button>
                            <button onclick="setDuration(30)" class="duration-btn" data-duration="30" style="padding: 10px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">30s</button>
                            <button onclick="setDuration(60)" class="duration-btn active" data-duration="60" style="padding: 10px; background: #f0b90b; color: #000; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">1m</button>
                            <button onclick="setDuration(300)" class="duration-btn" data-duration="300" style="padding: 10px; background: #2b2f36; color: #848e9c; border: 1px solid #3c4043; border-radius: 4px; font-size: 12px; cursor: pointer;">5m</button>
                        </div>
                    </div>
                    
                    <!-- Payout Info -->
                    <div style="margin-bottom: 25px; padding: 15px; background: rgba(43, 47, 54, 0.5); border-radius: 8px; border: 1px solid #3c4043;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: #848e9c; font-size: 12px;">PAYOUT</span>
                            <span style="color: #02c076; font-size: 14px; font-weight: 600;">85%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: #848e9c; font-size: 12px;">PROFIT</span>
                            <span style="color: #02c076; font-size: 14px; font-weight: 600;" id="profitAmount">₹85</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #848e9c; font-size: 12px;">TOTAL RETURN</span>
                            <span style="color: #ffffff; font-size: 14px; font-weight: 600;" id="totalReturn">₹185</span>
                        </div>
                    </div>
                    
                    <!-- Buy/Sell Buttons -->
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="placeTrade('up')" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #02c076, #028a50); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(2, 192, 118, 0.3); transition: all 0.2s;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <span>📈</span>
                                <span>BUY (UP)</span>
                            </div>
                        </button>
                        <button onclick="placeTrade('down')" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #f84960, #d63447); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(248, 73, 96, 0.3); transition: all 0.2s;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <span>📉</span>
                                <span>SELL (DOWN)</span>
                            </div>
                        </button>
                    </div>
                    
                    <!-- Active Trades -->
                    <div style="margin-top: 25px;">
                        <div style="color: #848e9c; font-size: 12px; margin-bottom: 12px; font-weight: 600;">ACTIVE TRADES</div>
                        <div id="activeTradesList" style="max-height: 200px; overflow-y: auto;">
                            <div style="color: #848e9c; font-size: 12px; text-align: center; padding: 20px;">No active trades</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Force immediate initialization
    setTimeout(() => {
        initializeProfessionalChart();
        setupMouseTracking();
        
        // Force redraw after 500ms to ensure everything loads
        setTimeout(() => {
            if (candleChart) {
                drawProfessionalChart();
            }
        }, 500);
    }, 100);
}

function initializeProfessionalChart() {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to full container
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    candleChart = { 
        canvas, 
        ctx, 
        width: rect.width, 
        height: rect.height,
        chartArea: {
            left: 20,
            right: rect.width - 90,
            top: 20,
            bottom: rect.height - 50
        }
    };
    
    generateRealisticCandles();
    drawProfessionalChart();
    
    // Update chart every 3 seconds
    setInterval(() => {
        updateRealisticCandles();
        drawProfessionalChart();
    }, 3000);
}

function generateRealisticCandles() {
    candleData = [];
    let price = currentPrice;
    const now = Date.now();
    
    // Generate 120 candles for better chart appearance
    for (let i = 120; i >= 0; i--) {
        const time = now - (i * 300000); // 5 minutes apart
        const open = price;
        
        // More realistic price movement
        const trend = Math.sin(i * 0.1) * 0.002;
        const noise = (Math.random() - 0.5) * 0.006;
        const change = trend + noise;
        
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 0.004;
        const low = Math.min(open, close) - Math.random() * 0.004;
        
        candleData.push({ 
            time, 
            open, 
            high, 
            low, 
            close, 
            volume: Math.random() * 2000 + 800 
        });
        
        price = close;
    }
    
    currentPrice = price;
}

function updateRealisticCandles() {
    const now = Date.now();
    const lastCandle = candleData[candleData.length - 1];
    
    const open = lastCandle.close;
    const trend = Math.sin(Date.now() * 0.0001) * 0.001;
    const noise = (Math.random() - 0.5) * 0.008;
    const change = trend + noise;
    
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 0.003;
    const low = Math.min(open, close) - Math.random() * 0.003;
    
    candleData.push({ 
        time: now, 
        open, 
        high, 
        low, 
        close, 
        volume: Math.random() * 2000 + 800 
    });
    
    // Keep last 120 candles
    if (candleData.length > 120) {
        candleData.shift();
    }
    
    currentPrice = close;
}

function drawProfessionalChart() {
    if (!candleChart || candleData.length === 0) return;
    
    const { ctx, width, height, chartArea } = candleChart;
    
    // Clear canvas
    ctx.fillStyle = '#0d1421';
    ctx.fillRect(0, 0, width, height);
    
    // Calculate price range
    const prices = candleData.flatMap(c => [c.high, c.low]);
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.02;
    minPrice -= padding;
    maxPrice += padding;
    
    // Store for global access
    window.minPrice = minPrice;
    window.maxPrice = maxPrice;
    
    const priceRange = maxPrice - minPrice;
    const candleWidth = (chartArea.right - chartArea.left) / candleData.length;
    
    // Draw grid
    drawProfessionalGrid(ctx, chartArea, minPrice, maxPrice);
    
    // Draw candles
    candleData.forEach((candle, index) => {
        drawRealisticCandle(ctx, candle, index, candleWidth, chartArea, minPrice, priceRange, maxPrice);
    });
    
    // Draw trade lines
    drawProfessionalTradeLines(ctx, chartArea, minPrice, maxPrice);
    
    // Update scales
    updateProfessionalScales(minPrice, maxPrice);
}

function drawProfessionalGrid(ctx, chartArea, minPrice, maxPrice) {
    const { left, right, top, bottom } = chartArea;
    
    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(43, 47, 54, 0.5)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 8; i++) {
        const y = top + (bottom - top) * i / 8;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
    
    // Vertical grid lines
    const gridCount = 12;
    for (let i = 0; i <= gridCount; i++) {
        const x = left + (right - left) * i / gridCount;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }
}

function drawRealisticCandle(ctx, candle, index, candleWidth, chartArea, minPrice, priceRange, maxPrice) {
    const { left, top, bottom } = chartArea;
    const x = left + index * candleWidth + candleWidth / 2;
    
    // Calculate Y positions
    const highY = top + (maxPrice - candle.high) / priceRange * (bottom - top);
    const lowY = top + (maxPrice - candle.low) / priceRange * (bottom - top);
    const openY = top + (maxPrice - candle.open) / priceRange * (bottom - top);
    const closeY = top + (maxPrice - candle.close) / priceRange * (bottom - top);
    
    const isUp = candle.close >= candle.open;
    const bodyColor = isUp ? '#02c076' : '#f84960';
    const wickColor = isUp ? '#02c076' : '#f84960';
    
    // Draw wick (shadow)
    ctx.strokeStyle = wickColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();
    
    // Draw candle body
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
    const bodyWidth = Math.max(candleWidth * 0.7, 2);
    
    if (isUp) {
        // Bullish candle - hollow (outline only)
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    } else {
        // Bearish candle - filled
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    }
}

function drawProfessionalTradeLines(ctx, chartArea, minPrice, maxPrice) {
    const { left, right, top, bottom } = chartArea;
    
    tradeLines.forEach(line => {
        const y = top + (maxPrice - line.price) / (maxPrice - minPrice) * (bottom - top);
        
        // Draw dashed horizontal line
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        
        // Draw entry point
        ctx.fillStyle = line.color;
        ctx.beginPath();
        ctx.arc(left + 20, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw direction arrow
        ctx.fillStyle = line.color;
        ctx.font = 'bold 16px Arial';
        ctx.fillText(line.direction === 'up' ? '↗' : '↘', left + 35, y + 6);
        
        // Draw countdown
        const timeLeft = Math.max(0, Math.ceil((line.endTime - Date.now()) / 1000));
        ctx.fillStyle = 'rgba(13, 20, 33, 0.9)';
        ctx.fillRect(right - 80, y - 12, 70, 24);
        ctx.fillStyle = line.color;
        ctx.font = 'bold 12px Arial';
        ctx.fillText(`${timeLeft}s`, right - 75, y + 4);
    });
}

function updateProfessionalScales(minPrice, maxPrice) {
    // Update price scale
    const priceScale = document.getElementById('priceScale');
    if (priceScale) {
        let html = '';
        for (let i = 0; i <= 8; i++) {
            const price = maxPrice - ((maxPrice - minPrice) * i / 8);
            html += `<div style="color: #848e9c; font-size: 11px; text-align: right; font-family: monospace;">${price.toFixed(5)}</div>`;
        }
        priceScale.innerHTML = html;
    }
    
    // Update time scale
    const timeScale = document.getElementById('timeScale');
    if (timeScale) {
        let html = '';
        for (let i = 0; i < 6; i++) {
            const time = new Date(Date.now() - (5 - i) * 3600000);
            const timeStr = time.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            html += `<div style="color: #848e9c; font-size: 11px; font-family: monospace;">${timeStr}</div>`;
        }
        timeScale.innerHTML = html;
    }
}

function setupMouseTracking() {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    
    const crosshairV = document.getElementById('crosshairV');
    const crosshairH = document.getElementById('crosshairH');
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (crosshairV && crosshairH) {
            crosshairV.style.left = x + 'px';
            crosshairV.style.opacity = '0.5';
            crosshairH.style.top = y + 'px';
            crosshairH.style.opacity = '0.5';
        }
    });
    
    canvas.addEventListener('mouseleave', () => {
        if (crosshairV && crosshairH) {
            crosshairV.style.opacity = '0';
            crosshairH.style.opacity = '0';
        }
    });
}

function setTimeframe(tf) {
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.style.background = '#2b2f36';
        btn.style.color = '#848e9c';
    });
    
    const activeBtn = document.querySelector(`[data-tf="${tf}"]`);
    if (activeBtn) {
        activeBtn.style.background = '#f0b90b';
        activeBtn.style.color = '#000';
    }
}

function addTradeLineToChart(direction, duration) {
    console.log('Adding trade line with duration:', duration, 'seconds');
    
    const line = {
        id: Date.now(),
        direction: direction,
        price: currentPrice,
        color: direction === 'up' ? '#02c076' : '#f84960',
        startTime: Date.now(),
        endTime: Date.now() + (duration * 1000)
    };
    
    tradeLines.push(line);
    
    // Remove line after exact duration
    setTimeout(() => {
        tradeLines = tradeLines.filter(l => l.id !== line.id);
        if (candleChart) {
            drawProfessionalChart();
        }
    }, duration * 1000);
}

// Server connection and other functions remain the same...
function connectToServer() {
    try {
        if (typeof io === 'undefined') {
            isConnected = false;
            return;
        }
        
        let userId = localStorage.getItem('tradepro_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('tradepro_user_id', userId);
        }
        
        socket = io(window.location.origin, {
            query: { userId: userId },
            transports: ['polling', 'websocket'],
            timeout: 10000,
            reconnection: true
        });
            
        socket.on('connect', function() {
            isConnected = true;
            socket.emit('getUserData');
        });
        
        socket.on('balanceUpdate', function(data) {
            console.log('Balance update received:', data);
            
            // Update the specific account type from the server
            const targetAccount = data.accountType || accountType;
            
            if (userBalance[targetAccount]) {
                userBalance[targetAccount].balance = data.balance;
            } else {
                userBalance[targetAccount] = { balance: data.balance };
            }
            
            localStorage.setItem('userBalance', JSON.stringify(userBalance));
            
            // Update balance display
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl && targetAccount === accountType) {
                balanceEl.textContent = `₹${data.balance.toLocaleString()}`;
            }
            
            console.log('Updated balance for', targetAccount, ':', data.balance);
        });
        
        socket.on('tradeResult', function(data) {
            if (data.success) {
                addTradeLineToChart(data.trade.direction, data.trade.duration);
            }
        });
        
    } catch (error) {
        isConnected = false;
    }
}

function initializeAccounts() {
    accountType = localStorage.getItem('account_type') || 'demo';
}

function placeTrade(direction) {
    const amountInput = document.getElementById('tradeAmount');
    const amount = amountInput ? parseInt(amountInput.value) || 100 : 100;
    
    // Get selected duration from active button
    const activeDurationBtn = document.querySelector('.duration-btn[style*="#f0b90b"]');
    let duration = 60; // default
    
    if (activeDurationBtn) {
        duration = parseInt(activeDurationBtn.dataset.duration);
    }
    
    console.log('Trade placed:', { direction, amount, duration });
    
    if (isConnected && socket) {
        socket.emit('placeTrade', {
            asset: currentAsset,
            direction: direction,
            amount: amount,
            duration: duration,
            accountType: accountType
        });
    } else {
        addTradeLineToChart(direction, duration);
        simulateLocalTrade(direction, amount, duration);
    }
}

function setAmount(amount) {
    document.getElementById('tradeAmount').value = amount;
    updatePayout();
    
    // Update amount button styles
    document.querySelectorAll('[onclick^="setAmount"]').forEach(btn => {
        btn.style.background = '#2b2f36';
        btn.style.color = '#848e9c';
        btn.style.border = '1px solid #3c4043';
    });
    
    event.target.style.background = '#f0b90b';
    event.target.style.color = '#000';
    event.target.style.border = 'none';
}

function setDuration(duration) {
    console.log('Duration selected:', duration);
    
    // Update duration button styles
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.style.background = '#2b2f36';
        btn.style.color = '#848e9c';
        btn.style.border = '1px solid #3c4043';
    });
    
    // Set active button style
    const clickedBtn = event.target;
    clickedBtn.style.background = '#f0b90b';
    clickedBtn.style.color = '#000';
    clickedBtn.style.border = 'none';
}

function updatePayout() {
    const amount = parseInt(document.getElementById('tradeAmount').value) || 100;
    const profit = Math.floor(amount * 0.85);
    const totalReturn = amount + profit;
    
    document.getElementById('profitAmount').textContent = `₹${profit}`;
    document.getElementById('totalReturn').textContent = `₹${totalReturn}`;
}

function selectAsset(asset, basePrice) {
    currentAsset = asset;
    currentPrice = basePrice;
    
    // Update active asset styling
    document.querySelectorAll('.asset-option').forEach(option => {
        option.style.background = 'rgba(43, 47, 54, 0.5)';
        option.style.border = '1px solid #3c4043';
    });
    
    const selectedOption = document.querySelector(`[data-asset="${asset}"]`);
    if (selectedOption) {
        selectedOption.style.background = 'rgba(240, 185, 11, 0.2)';
        selectedOption.style.border = '1px solid #f0b90b';
    }
    
    // Update header asset name
    const headerAsset = document.querySelector('#chartArea .logo');
    if (headerAsset) {
        headerAsset.textContent = asset;
    }
    
    // Update side panel asset name
    const sideAsset = document.querySelector('#chartArea > div:last-child > div:first-child > div:first-child');
    if (sideAsset) {
        sideAsset.textContent = asset;
    }
    
    // Generate new chart data for selected asset
    generateAssetSpecificCandles(asset);
    
    if (candleChart) {
        drawProfessionalChart();
    }
}

function generateAssetSpecificCandles(asset) {
    generateTimeframeCandles(asset, currentTimeframe);
    startRealTimeCandleUpdates();
}

function generateTimeframeCandles(asset, timeframeMs) {
    candleData = [];
    const assetInfo = assetData[asset];
    let price = assetInfo.price;
    const now = Date.now();
    
    // Generate 100 completed candles
    for (let i = 100; i >= 1; i--) {
        const candleStartTime = now - (i * timeframeMs);
        const open = price;
        
        const trend = Math.sin(i * 0.1) * (assetInfo.volatility * 0.3);
        const noise = (Math.random() - 0.5) * assetInfo.volatility;
        const change = trend + noise;
        
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * (assetInfo.volatility * 0.5);
        const low = Math.min(open, close) - Math.random() * (assetInfo.volatility * 0.5);
        
        candleData.push({ 
            time: candleStartTime, 
            open, 
            high, 
            low, 
            close, 
            volume: Math.random() * 2000 + 800,
            completed: true
        });
        
        price = close;
    }
    
    // Create current forming candle
    const currentCandleStart = now - (now % timeframeMs);
    currentCandle = {
        time: currentCandleStart,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        completed: false
    };
    
    candleData.push(currentCandle);
    currentPrice = price;
}

function startRealTimeCandleUpdates() {
    if (candleUpdateInterval) {
        clearInterval(candleUpdateInterval);
    }
    
    candleUpdateInterval = setInterval(() => {
        updateCurrentCandle();
        
        const now = Date.now();
        const candleEndTime = currentCandle.time + currentTimeframe;
        
        if (now >= candleEndTime) {
            currentCandle.completed = true;
            
            const newCandleStart = candleEndTime;
            currentCandle = {
                time: newCandleStart,
                open: currentPrice,
                high: currentPrice,
                low: currentPrice,
                close: currentPrice,
                volume: 0,
                completed: false
            };
            
            candleData.push(currentCandle);
            
            if (candleData.length > 101) {
                candleData.shift();
            }
        }
        
        if (candleChart) {
            drawProfessionalChart();
        }
    }, 1000);
}

function updateCurrentCandle() {
    if (!currentCandle || currentCandle.completed) return;
    
    const assetInfo = assetData[currentAsset];
    const change = (Math.random() - 0.5) * (assetInfo.volatility * 0.1);
    currentPrice += change;
    
    currentCandle.close = currentPrice;
    currentCandle.high = Math.max(currentCandle.high, currentPrice);
    currentCandle.low = Math.min(currentCandle.low, currentPrice);
    currentCandle.volume += Math.random() * 10;
}

function setTimeframe(timeframeMs) {
    currentTimeframe = timeframeMs;
    
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.style.background = '#2b2f36';
        btn.style.color = '#848e9c';
    });
    
    const activeBtn = document.querySelector(`[data-tf="${timeframeMs}"]`);
    if (activeBtn) {
        activeBtn.style.background = '#f0b90b';
        activeBtn.style.color = '#000';
    }
    
    if (candleUpdateInterval) {
        clearInterval(candleUpdateInterval);
    }
    
    generateTimeframeCandles(currentAsset, timeframeMs);
    startRealTimeCandleUpdates();
    
    if (candleChart) {
        drawProfessionalChart();
    }
}

function startPriceUpdates() {
    // Update payout on amount change
    const amountInput = document.getElementById('tradeAmount');
    if (amountInput) {
        amountInput.addEventListener('input', updatePayout);
        updatePayout();
    }
    
    setInterval(() => {
        const assetInfo = assetData[currentAsset];
        const change = (Math.random() - 0.5) * (assetInfo.volatility * 0.1);
        currentPrice += change;
        
        const decimals = assetInfo.decimals;
        
        // Update all price displays
        const topPrice = document.getElementById('topPrice');
        const topChange = document.getElementById('topChange');
        const sidePrice = document.getElementById('sidePrice');
        const assetPriceEl = document.getElementById(`price-${currentAsset}`);
        
        if (topPrice) {
            topPrice.textContent = currentPrice.toFixed(decimals);
            topPrice.style.color = change > 0 ? '#02c076' : '#f84960';
        }
        
        if (topChange) {
            const changePercent = ((change / currentPrice) * 100).toFixed(2);
            topChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(decimals)} (${change >= 0 ? '+' : ''}${changePercent}%)`;
            topChange.style.color = change > 0 ? '#02c076' : '#f84960';
        }
        
        if (sidePrice) {
            const changePercent = ((change / currentPrice) * 100).toFixed(2);
            sidePrice.textContent = `${currentPrice.toFixed(decimals)} (${change >= 0 ? '+' : ''}${changePercent}%)`;
            sidePrice.style.color = change > 0 ? '#02c076' : '#f84960';
        }
        
        if (assetPriceEl) {
            assetPriceEl.textContent = currentPrice.toLocaleString(undefined, { 
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals 
            });
            assetPriceEl.style.color = change > 0 ? '#02c076' : '#f84960';
        }
    }, 1000);
}

function switchAccount(type) {
    accountType = type;
    localStorage.setItem('account_type', type);
    
    // Update button styles
    document.querySelectorAll('.account-btn').forEach(btn => {
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
    
    // Update balance display
    const balance = userBalance[accountType] ? 
        (userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType]) : 
        (accountType === 'demo' ? 50000 : 2780);
    
    document.getElementById('userBalance').textContent = `₹${balance.toLocaleString()}`;
    
    if (isConnected && socket) {
        socket.emit('switchAccount', { accountType: type });
    }
}

function showDepositModal() {
    window.location.href = '/deposit';
}

function showWithdrawModal() {
    window.location.href = '/withdraw';
}

function simulateLocalTrade(direction, amount, duration) {
    console.log('Simulating trade with duration:', duration, 'seconds');
    
    // Deduct balance first
    const currentBalance = userBalance[accountType] ? 
        (userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType]) : 0;
    
    if (currentBalance < amount) {
        console.log('Insufficient balance');
        return;
    }
    
    // Deduct amount from balance
    if (userBalance[accountType].balance !== undefined) {
        userBalance[accountType].balance -= amount;
    } else {
        userBalance[accountType] -= amount;
    }
    
    // Save balance to localStorage
    localStorage.setItem('userBalance', JSON.stringify(userBalance));
    
    // Update balance display
    const balanceEl = document.getElementById('userBalance');
    if (balanceEl) {
        const newBalance = userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType];
        balanceEl.textContent = `₹${newBalance.toLocaleString()}`;
    }
    
    const trade = {
        id: Date.now(),
        asset: currentAsset,
        direction: direction,
        amount: amount,
        duration: duration,
        startTime: Date.now(),
        endTime: Date.now() + (duration * 1000)
    };
    
    activeTrades.push(trade);
    
    // Save trades to localStorage
    localStorage.setItem('activeTrades', JSON.stringify(activeTrades));
    
    displayActiveTrades();
    
    // Complete trade after exact duration
    setTimeout(() => {
        const won = Math.random() > 0.5;
        console.log('Trade completed after', duration, 'seconds. Won:', won);
        
        // Handle win/loss
        if (won) {
            const payout = Math.floor(amount * 1.85);
            if (userBalance[accountType].balance !== undefined) {
                userBalance[accountType].balance += payout;
            } else {
                userBalance[accountType] += payout;
            }
            
            // Update balance display
            if (balanceEl) {
                const newBalance = userBalance[accountType].balance !== undefined ? userBalance[accountType].balance : userBalance[accountType];
                balanceEl.textContent = `₹${newBalance.toLocaleString()}`;
            }
            
            console.log('Trade won! Payout:', payout);
        } else {
            console.log('Trade lost!');
        }
        
        // Save updated balance
        localStorage.setItem('userBalance', JSON.stringify(userBalance));
        
        // Remove completed trade
        activeTrades = activeTrades.filter(t => t.id !== trade.id);
        localStorage.setItem('activeTrades', JSON.stringify(activeTrades));
        displayActiveTrades();
    }, duration * 1000);
}

function displayActiveTrades() {
    const container = document.getElementById('activeTradesList');
    if (!container) return;
    
    if (activeTrades.length === 0) {
        container.innerHTML = '<div style="color: #848e9c; font-size: 12px; text-align: center; padding: 20px;">No active trades</div>';
        return;
    }
    
    container.innerHTML = activeTrades.map(trade => {
        const timeLeft = Math.max(0, Math.floor((new Date(trade.endTime) - new Date()) / 1000));
        
        return `
            <div style="background: rgba(43, 47, 54, 0.5); padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid ${trade.direction === 'up' ? '#02c076' : '#f84960'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="color: #ffffff; font-size: 12px; font-weight: 600;">${trade.asset}</div>
                    <div style="color: ${trade.direction === 'up' ? '#02c076' : '#f84960'}; font-size: 11px; font-weight: 600;">
                        ${trade.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: #848e9c; font-size: 11px;">₹${trade.amount}</div>
                    <div style="color: #f0b90b; font-size: 11px; font-weight: 600;">${timeLeft}s</div>
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

// Add professional styling
const style = document.createElement('style');
style.textContent = `
    .tf-btn:hover {
        background: #f0b90b !important;
        color: #000 !important;
    }
    
    .duration-btn:hover {
        background: rgba(240, 185, 11, 0.2) !important;
    }
    
    .asset-option:hover {
        background: rgba(240, 185, 11, 0.1) !important;
        border-color: #f0b90b !important;
    }
    
    button:hover {
        transform: translateY(-1px);
    }
    
    #tradeAmount:focus {
        border-color: #f0b90b !important;
        box-shadow: 0 0 0 2px rgba(240, 185, 11, 0.2) !important;
    }
    
    body, html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
`;
document.head.appendChild(style);