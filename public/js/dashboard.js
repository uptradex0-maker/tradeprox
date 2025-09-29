// Dashboard JavaScript with Real-time Candlestick Trading

let socket;
let chart;
let candleSeries;
let currentAsset = 'EUR/USD';
let currentTimeframe = '5s';
let currentTimeframeSeconds = 5;
let candleData = new Map();
let assetTimeframeData = new Map();
let activeTrades = [];
let accountType = localStorage.getItem('account_type') || 'demo'; // demo or real
let userAccount = { demo: { balance: 50000 }, real: { balance: 0 } };

// Initialize dashboard with faster loading
document.addEventListener('DOMContentLoaded', function() {
    // Show loading indicator
    showChartLoading();
    
    // Restore account type from localStorage
    const savedAccountType = localStorage.getItem('account_type');
    if (savedAccountType) {
        accountType = savedAccountType;
        // Update UI to reflect saved account type
        document.querySelectorAll('.account-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const savedBtn = document.querySelector(`[data-account="${savedAccountType}"]`);
        if (savedBtn) {
            savedBtn.classList.add('active');
        }
    }
    
    // Initialize in optimal order
    initializeChart();
    setupEventListeners();
    initializeSocket();
    loadUserData();
});

// Socket.io connection with faster initialization
function initializeSocket() {
    // Get or create persistent user ID
    let userId = localStorage.getItem('tradepro_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tradepro_user_id', userId);
    }
    
    // Initialize with faster connection options
    socket = io({
        query: { userId: userId },
        transports: ['websocket', 'polling'],
        upgrade: true,
        timeout: 5000,
        forceNew: false
    });
    
    socket.on('priceUpdate', function(assets) {
        updateAssetPrices(assets);
        updateCurrentPrice(assets[currentAsset]);
    });
    
    socket.on('historicalData', function(historical) {
        loadHistoricalData(historical);
    });
    
    socket.on('timeframeData', function(data) {
        const key = `${data.asset}_${data.timeframe}`;
        assetTimeframeData.set(key, data.candles);
        
        if (data.asset === currentAsset && data.timeframe === currentTimeframeSeconds) {
            if (chart && chart.setData) {
                chart.setData(data.candles);
                candleData.set(currentAsset, data.candles);
            }
        }
    });
    
    socket.on('tradeResult', function(data) {
        if (data.success) {
            chart.addTradeLine(data.trade.startPrice, data.trade.direction, Date.now(), data.trade.duration);
            addTradeAnimation(data.trade.direction);
            showTradeNotification(`Trade placed: ${data.trade.direction.toUpperCase()} ${data.trade.asset} for ₹${data.trade.amount}`, 'success');
            updateUserBalance(data.balance);
            
            // Add to active trades immediately
            activeTrades.push({
                ...data.trade,
                startTime: new Date(data.trade.startTime),
                endTime: new Date(data.trade.endTime)
            });
            displayActiveTrades();
        } else {
            showTradeNotification(data.message, 'error');
        }
    });
    
    socket.on('tradeCompleted', function(data) {
        if (data.won) {
            showTradeNotification(`🎉 Trade Won! +₹${data.payout}`, 'success');
        } else {
            showTradeNotification(`😔 Trade Lost! -₹${data.amount}`, 'error');
        }
        updateUserBalance(data.balance);
        
        // Remove from active trades and add to history
        activeTrades = activeTrades.filter(trade => trade.id !== data.id);
        displayActiveTrades();
        
        // Store in trade history
        const completedTrade = {
            id: data.id,
            asset: data.asset,
            direction: data.direction,
            amount: data.amount,
            result: data.won ? 'won' : 'lost',
            payout: data.payout || data.amount,
            timestamp: new Date().toISOString()
        };
        
        let tradeHistory = JSON.parse(localStorage.getItem('trade_history') || '[]');
        tradeHistory.unshift(completedTrade);
        
        // Keep only last 100 trades
        if (tradeHistory.length > 100) {
            tradeHistory = tradeHistory.slice(0, 100);
        }
        
        localStorage.setItem('trade_history', JSON.stringify(tradeHistory));
    });
    
    socket.on('balanceUpdate', function(data) {
        updateUserBalance(data.balance);
        if (data.accountType) {
            accountType = data.accountType;
        }
        if (data.type === 'deposit') {
            showTradeNotification('💰 Deposit successful!', 'success');
        } else if (data.type === 'withdraw') {
            showTradeNotification(`💸 Withdrawal request for ₹${data.amount} submitted`, 'info');
        } else if (data.type === 'error' && data.message) {
            showTradeNotification(data.message, 'error');
        }
    });
    
    socket.on('processPayment', function(data) {
        initiateCashfreePayment(data.amount, data.userId);
    });
    
    socket.on('accountData', function(data) {
        userAccount = data.accounts;
        accountType = data.currentAccount;
        updateUserBalance(userAccount[accountType].balance);
        
        // Store user ID if provided
        if (data.userId) {
            localStorage.setItem('tradepro_user_id', data.userId);
        }
    });
    
    socket.on('transactionsData', function(transactions) {
        localStorage.setItem('user_transactions', JSON.stringify(transactions));
        displayTransactions(transactions);
    });
    
    socket.on('userTrades', function(trades) {
        activeTrades = trades.map(trade => ({
            ...trade,
            startTime: new Date(trade.startTime),
            endTime: new Date(trade.endTime)
        }));
        displayActiveTrades();
    });
    
    socket.on('connect', function() {
        console.log('Connected to server');
        loadUserData();
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
    });
    
    socket.on('serverStatusChanged', function(data) {
        if (data.status === 'maintenance') {
            showTradeNotification('⚠️ Server entering maintenance mode', 'info');
        } else if (data.status === 'online') {
            showTradeNotification('✅ Server is back online', 'success');
        }
    });
    
    socket.on('maintenanceMode', function(data) {
        showMaintenanceScreen(data.message);
    });
    
    socket.on('currentCandles', function(candles) {
        // Load current incomplete candles
        Object.keys(candles).forEach(asset => {
            if (!candleData.has(asset)) {
                candleData.set(asset, []);
            }
            const data = candleData.get(asset);
            if (data.length === 0 || data[data.length - 1].time !== candles[asset].time) {
                data.push(candles[asset]);
            }
        });
        
        if (candles[currentAsset]) {
            chart.setData(candleData.get(currentAsset) || []);
        }
    });
    
    socket.on('candleUpdate', function(data) {
        // Update current candle in real-time
        if (data.asset === currentAsset) {
            chart.updateCandle(data.candle);
        }
        
        // Store updated candle
        if (candleData.has(data.asset)) {
            const assetData = candleData.get(data.asset);
            if (assetData.length > 0) {
                assetData[assetData.length - 1] = data.candle;
            }
        }
    });
    
    socket.on('newCandle', function(data) {
        // New completed candle
        if (data.asset === currentAsset) {
            addNewCandle(data.candle);
        }
        
        // Store completed candle
        if (!candleData.has(data.asset)) {
            candleData.set(data.asset, []);
        }
        const assetData = candleData.get(data.asset);
        
        // Replace last candle if same time, otherwise add new
        if (assetData.length > 0 && assetData[assetData.length - 1].time === data.candle.time) {
            assetData[assetData.length - 1] = data.candle;
        } else {
            assetData.push(data.candle);
        }
        
        // Keep only last 200 candles
        if (assetData.length > 200) {
            assetData.shift();
        }
    });
}

// Quotex-Style Candlestick Chart
class QuotexChart {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.candles = [];
        this.maxCandles = 120;
        this.candleWidth = 12;
        this.candleSpacing = 2;
        this.padding = { top: 40, right: 70, bottom: 30, left: 10 };
        this.priceRange = { min: 0, max: 0 };
        this.hoveredCandle = null;
        this.crosshair = { x: 0, y: 0, visible: false };
        this.tradeLines = [];
        this.indicators = {};
        this.drawingMode = null;
        this.drawings = [];
        this.zoom = 1;
        this.panOffset = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastPinchDistance = null;
        
        this.init();
        this.createToolbar();
    }
    
    init() {
        // Clear container first
        this.container.innerHTML = '';
        
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.background = 'linear-gradient(135deg, #1a1d29 0%, #0f1419 100%)';
        this.canvas.style.display = 'block';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        
        // Mobile-specific styles
        if (window.innerWidth <= 768) {
            this.canvas.style.border = 'none';
            this.canvas.style.borderRadius = '0';
            this.canvas.style.touchAction = 'pan-x pan-y';
            this.candleWidth = 8;
            this.candleSpacing = 1;
            this.maxCandles = 60;
        } else {
            this.canvas.style.border = '1px solid #2a2d3a';
            this.canvas.style.borderRadius = '8px';
            this.canvas.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
            this.candleWidth = 16;
            this.candleSpacing = 3;
            this.maxCandles = 80;
        }
        
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        
        // Immediate resize for faster display
        this.resize();
        
        // Add event listeners with passive options for better performance
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: true });
        this.canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this), { passive: true });
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Enhanced touch events for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
        
        // Optimized resize handling
        window.addEventListener('resize', this.debounce(this.resize.bind(this), 100));
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 100);
        });
        
        // Start animation immediately
        this.animate();
        
        // Draw initial state
        this.draw();
    }
    
    createToolbar() {
        // Skip toolbar creation on mobile devices
        if (window.innerWidth <= 768) {
            return;
        }
        
        const toolbar = document.createElement('div');
        toolbar.className = 'chart-toolbar';
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <button class="tool-btn" data-tool="crosshair" title="Crosshair">✛</button>
                <button class="tool-btn" data-tool="line" title="Trend Line">📈</button>
                <button class="tool-btn" data-tool="horizontal" title="Horizontal Line">━</button>
            </div>
            <div class="toolbar-section">
                <button class="indicator-btn" data-indicator="sma" title="SMA">SMA</button>
                <button class="indicator-btn" data-indicator="ema" title="EMA">EMA</button>
                <button class="indicator-btn" data-indicator="rsi" title="RSI">RSI</button>
            </div>
            <div class="toolbar-section">
                <button class="zoom-btn" onclick="chart.zoomIn()" title="Zoom In">+</button>
                <button class="zoom-btn" onclick="chart.zoomOut()" title="Zoom Out">-</button>
                <button class="action-btn" onclick="chart.clearAll()" title="Clear">🗑️</button>
                <button class="action-btn" onclick="chart.resetView()" title="Reset">🔄</button>
            </div>
        `;
        
        toolbar.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: linear-gradient(135deg, rgba(26, 29, 41, 0.95), rgba(15, 20, 25, 0.95));
            border: 1px solid #26a69a;
            border-radius: 8px;
            padding: 10px;
            display: flex;
            gap: 12px;
            z-index: 100;
            box-shadow: 0 4px 20px rgba(38, 166, 154, 0.2);
            backdrop-filter: blur(10px);
        `;
        
        this.container.style.position = 'relative';
        this.container.appendChild(toolbar);
        
        // Toolbar event listeners
        toolbar.addEventListener('click', (e) => {
            if (e.target.classList.contains('tool-btn')) {
                this.setDrawingMode(e.target.dataset.tool);
            }
            if (e.target.classList.contains('indicator-btn')) {
                this.toggleIndicator(e.target.dataset.indicator);
            }
        });
    }
    
    resize() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Enhanced mobile dimensions
        const width = Math.max(rect.width, 320);
        const height = Math.max(rect.height, window.innerWidth <= 768 ? 350 : 200);
        
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // Enhanced mobile-specific adjustments
        if (window.innerWidth <= 768) {
            this.candleWidth = Math.max(10, Math.min(16, width / 35));
            this.candleSpacing = 2;
            this.maxCandles = Math.floor(width / (this.candleWidth + this.candleSpacing));
            this.padding = { top: 20, right: 60, bottom: 20, left: 5 };
        } else {
            this.padding = { top: 40, right: 70, bottom: 30, left: 10 };
        }
        
        this.draw();
    }
    
    setData(candles) {
        this.candles = candles.slice(-this.maxCandles);
        this.updatePriceRange();
        this.draw();
    }
    
    addCandle(candle) {
        this.candles.push(candle);
        if (this.candles.length > this.maxCandles) {
            this.candles.shift();
        }
        this.updatePriceRange();
        
        // Auto-scroll to follow price on mobile
        if (window.innerWidth <= 768) {
            this.autoFollowPrice();
        }
        
        this.draw();
    }
    
    updateCandle(candle) {
        if (this.candles.length > 0) {
            this.candles[this.candles.length - 1] = candle;
            this.updatePriceRange();
            
            // Auto-follow current price on mobile
            if (window.innerWidth <= 768) {
                this.autoFollowPrice();
            }
            
            this.draw();
        }
    }
    
    updatePriceRange() {
        if (this.candles.length === 0) return;
        
        let min = Infinity, max = -Infinity;
        this.candles.forEach(candle => {
            min = Math.min(min, candle.low);
            max = Math.max(max, candle.high);
        });
        
        // Auto-focus on current price for mobile
        if (window.innerWidth <= 768 && this.candles.length > 0) {
            const currentPrice = this.candles[this.candles.length - 1].close;
            const range = (max - min) * 0.3;
            this.priceRange = { 
                min: currentPrice - range, 
                max: currentPrice + range 
            };
        } else {
            const padding = (max - min) * 0.1;
            this.priceRange = { min: min - padding, max: max + padding };
        }
    }
    
    priceToY(price) {
        const chartHeight = this.canvas.height / window.devicePixelRatio - this.padding.top - this.padding.bottom;
        return this.padding.top + (this.priceRange.max - price) / (this.priceRange.max - this.priceRange.min) * chartHeight;
    }
    
    indexToX(index) {
        const chartWidth = this.canvas.width / window.devicePixelRatio - this.padding.left - this.padding.right;
        const totalWidth = (this.candleWidth + this.candleSpacing) * this.zoom;
        return this.padding.left + chartWidth - (this.candles.length - index) * totalWidth + this.candleWidth / 2 + this.panOffset;
    }
    
    draw() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas with gradient
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#1a1d29');
        bgGradient.addColorStop(1, '#0f1419');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, width, height);
        
        if (this.candles.length === 0) return;
        
        // Draw grid
        this.drawGrid();
        
        // Draw candles
        this.candles.forEach((candle, index) => {
            this.drawCandle(candle, index);
        });
        
        // Draw indicators
        this.drawIndicators();
        
        // Draw drawings
        this.drawDrawings();
        
        // Draw trade lines
        this.drawTradeLines();
        
        // Draw price scale
        this.drawPriceScale();
        
        // Draw crosshair
        if (this.crosshair.visible) {
            this.drawCrosshair();
        }
        
        // Draw tooltip
        if (this.hoveredCandle) {
            this.drawTooltip();
        }
    }
    
    drawGrid() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Animated grid lines
        const time = Date.now() * 0.001;
        const alpha = 0.3 + Math.sin(time) * 0.1;
        this.ctx.strokeStyle = `rgba(42, 45, 58, ${alpha})`;
        this.ctx.lineWidth = 0.5;
        
        // Horizontal grid lines
        for (let i = 0; i <= 8; i++) {
            const y = this.padding.top + (height - this.padding.top - this.padding.bottom) * i / 8;
            this.ctx.beginPath();
            this.ctx.moveTo(this.padding.left, y);
            this.ctx.lineTo(width - this.padding.right, y);
            this.ctx.stroke();
        }
        
        // Vertical grid lines
        const candleWidth = this.candleWidth + this.candleSpacing;
        for (let i = 0; i < this.candles.length; i += 20) {
            const x = this.indexToX(i);
            if (x > this.padding.left && x < width - this.padding.right) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, this.padding.top);
                this.ctx.lineTo(x, height - this.padding.bottom);
                this.ctx.stroke();
            }
        }
    }
    
    drawCandle(candle, index) {
        const x = this.indexToX(index);
        const openY = this.priceToY(candle.open);
        const closeY = this.priceToY(candle.close);
        const highY = this.priceToY(candle.high);
        const lowY = this.priceToY(candle.low);
        
        const isUp = candle.close >= candle.open;
        const upColor = '#00ff88';
        const downColor = '#ff4444';
        const color = isUp ? upColor : downColor;
        
        // Enhanced wick with better styling
        const wickWidth = window.innerWidth <= 768 ? 3 : 4;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = wickWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x, highY);
        this.ctx.lineTo(x, lowY);
        this.ctx.stroke();
        
        // Enhanced candle body
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), window.innerWidth <= 768 ? 3 : 4);
        const bodyLeft = x - this.candleWidth / 2;
        
        // Enhanced shadow for both mobile and desktop
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        this.ctx.shadowBlur = window.innerWidth <= 768 ? 4 : 8;
        this.ctx.shadowOffsetX = window.innerWidth <= 768 ? 2 : 3;
        this.ctx.shadowOffsetY = window.innerWidth <= 768 ? 2 : 3;
        
        if (isUp) {
            // Enhanced bullish candle with 3D effect
            const bullGradient = this.ctx.createLinearGradient(bodyLeft, bodyTop, bodyLeft + this.candleWidth, bodyTop + bodyHeight);
            bullGradient.addColorStop(0, '#00ff88');
            bullGradient.addColorStop(0.2, '#00ee77');
            bullGradient.addColorStop(0.5, '#00dd66');
            bullGradient.addColorStop(0.8, '#00cc55');
            bullGradient.addColorStop(1, '#00bb44');
            
            this.ctx.fillStyle = bullGradient;
            this.ctx.fillRect(bodyLeft, bodyTop, this.candleWidth, bodyHeight);
            
            // Enhanced metallic border
            this.ctx.strokeStyle = '#00ff88';
            this.ctx.lineWidth = window.innerWidth <= 768 ? 2 : 3;
            this.ctx.strokeRect(bodyLeft, bodyTop, this.candleWidth, bodyHeight);
            
            // 3D highlight effect
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            const highlightWidth = Math.max(2, this.candleWidth/3);
            this.ctx.fillRect(bodyLeft + 1, bodyTop + 1, highlightWidth, Math.max(1, bodyHeight - 2));
            
            // Inner glow
            this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(bodyLeft + 1, bodyTop + 1, this.candleWidth - 2, bodyHeight - 2);
        } else {
            // Enhanced bearish candle with 3D effect
            const bearGradient = this.ctx.createLinearGradient(bodyLeft, bodyTop, bodyLeft + this.candleWidth, bodyTop + bodyHeight);
            bearGradient.addColorStop(0, '#ff4444');
            bearGradient.addColorStop(0.2, '#ee3333');
            bearGradient.addColorStop(0.5, '#dd2222');
            bearGradient.addColorStop(0.8, '#cc1111');
            bearGradient.addColorStop(1, '#bb0000');
            
            this.ctx.fillStyle = bearGradient;
            this.ctx.fillRect(bodyLeft, bodyTop, this.candleWidth, bodyHeight);
            
            // Enhanced metallic border
            this.ctx.strokeStyle = '#ff4444';
            this.ctx.lineWidth = window.innerWidth <= 768 ? 2 : 3;
            this.ctx.strokeRect(bodyLeft, bodyTop, this.candleWidth, bodyHeight);
            
            // 3D highlight effect
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const highlightWidth = Math.max(2, this.candleWidth/3);
            this.ctx.fillRect(bodyLeft + 1, bodyTop + 1, highlightWidth, Math.max(1, bodyHeight - 2));
            
            // Inner glow
            this.ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(bodyLeft + 1, bodyTop + 1, this.candleWidth - 2, bodyHeight - 2);
        }
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        // Enhanced mobile hover
        if (this.hoveredCandle && this.hoveredCandle.index === index) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = window.innerWidth <= 768 ? 3 : 2;
            this.ctx.setLineDash([6, 3]);
            this.ctx.strokeRect(bodyLeft - 3, bodyTop - 3, this.candleWidth + 6, bodyHeight + 6);
            this.ctx.setLineDash([]);
            
            // Mobile glow
            if (window.innerWidth <= 768) {
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 12;
                this.ctx.strokeRect(bodyLeft - 2, bodyTop - 2, this.candleWidth + 4, bodyHeight + 4);
                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
            }
        }
    }
    
    drawPriceScale() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        this.ctx.fillStyle = '#8a8e9b';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'left';
        
        for (let i = 0; i <= 8; i++) {
            const y = this.padding.top + (height - this.padding.top - this.padding.bottom) * i / 8;
            const price = this.priceRange.max - (this.priceRange.max - this.priceRange.min) * i / 8;
            
            const text = price.toFixed(4);
            this.ctx.fillText(text, width - this.padding.right + 5, y + 3);
        }
    }
    
    drawCrosshair() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        this.ctx.strokeStyle = '#8a8e9b';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        
        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(this.crosshair.x, this.padding.top);
        this.ctx.lineTo(this.crosshair.x, height - this.padding.bottom);
        this.ctx.stroke();
        
        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding.left, this.crosshair.y);
        this.ctx.lineTo(width - this.padding.right, this.crosshair.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Price label on crosshair
        const price = this.yToPrice(this.crosshair.y);
        const priceText = price.toFixed(4);
        const textWidth = this.ctx.measureText(priceText).width;
        
        this.ctx.fillStyle = '#2a2d3a';
        this.ctx.fillRect(width - this.padding.right, this.crosshair.y - 8, this.padding.right, 16);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(priceText, width - this.padding.right + 5, this.crosshair.y + 3);
    }
    
    yToPrice(y) {
        const chartHeight = this.canvas.height / window.devicePixelRatio - this.padding.top - this.padding.bottom;
        const ratio = (y - this.padding.top) / chartHeight;
        return this.priceRange.max - ratio * (this.priceRange.max - this.priceRange.min);
    }
    
    drawTooltip() {
        const candle = this.candles[this.hoveredCandle.index];
        const x = this.crosshair.x + 10;
        const y = this.crosshair.y - 60;
        
        // Enhanced tooltip with gradient and glow
        const tooltipGradient = this.ctx.createLinearGradient(x, y, x + 120, y + 50);
        tooltipGradient.addColorStop(0, 'rgba(26, 29, 41, 0.95)');
        tooltipGradient.addColorStop(1, 'rgba(42, 45, 58, 0.95)');
        
        this.ctx.shadowColor = '#26a69a';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = tooltipGradient;
        this.ctx.fillRect(x, y, 120, 50);
        
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#26a69a';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, 120, 50);
        
        // OHLC text
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#ffffff';
        
        this.ctx.fillText(`O: ${candle.open.toFixed(4)}`, x + 5, y + 12);
        this.ctx.fillText(`H: ${candle.high.toFixed(4)}`, x + 65, y + 12);
        this.ctx.fillText(`L: ${candle.low.toFixed(4)}`, x + 5, y + 26);
        
        const isUp = candle.close >= candle.open;
        this.ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
        this.ctx.fillText(`C: ${candle.close.toFixed(4)}`, x + 65, y + 26);
        
        // Change percentage
        const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
        this.ctx.fillText(`${change >= 0 ? '+' : ''}${change}%`, x + 5, y + 40);
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.crosshair = { x, y, visible: true };
        
        if (this.isDragging) {
            const deltaX = e.clientX - this.lastMouseX;
            this.panOffset += deltaX;
            this.lastMouseX = e.clientX;
        }
        
        this.hoveredCandle = null;
        for (let i = 0; i < this.candles.length; i++) {
            const candleX = this.indexToX(i);
            if (Math.abs(x - candleX) < this.candleWidth + 2) {
                this.hoveredCandle = { index: i };
                break;
            }
        }
        
        this.draw();
    }
    
    onMouseLeave() {
        this.crosshair.visible = false;
        this.hoveredCandle = null;
        this.isDragging = false;
        this.draw();
    }
    
    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(0.5, Math.min(3, this.zoom * zoomFactor));
        this.draw();
    }
    
    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
    }
    
    onMouseUp(e) {
        this.isDragging = false;
    }
    
    // Touch event handlers for mobile
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastTouchX = touch.clientX;
            this.crosshair = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
                visible: true
            };
            this.isDragging = true;
        }
    }
    
    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const deltaX = touch.clientX - this.lastTouchX;
            
            this.panOffset += deltaX * 1.5; // Enhanced pan sensitivity
            this.lastTouchX = touch.clientX;
            
            this.crosshair = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
                visible: true
            };
            
            // Enhanced candle detection for mobile
            this.hoveredCandle = null;
            for (let i = 0; i < this.candles.length; i++) {
                const candleX = this.indexToX(i);
                if (Math.abs(this.crosshair.x - candleX) < this.candleWidth + 8) {
                    this.hoveredCandle = { index: i };
                    break;
                }
            }
            
            this.draw();
        } else if (e.touches.length === 2) {
            // Pinch to zoom for mobile
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            if (this.lastPinchDistance) {
                const scale = distance / this.lastPinchDistance;
                this.zoom = Math.max(0.5, Math.min(3, this.zoom * scale));
                this.draw();
            }
            this.lastPinchDistance = distance;
        }
    }
    
    onTouchEnd(e) {
        this.isDragging = false;
        this.lastPinchDistance = null;
        
        // Keep crosshair visible longer on mobile
        setTimeout(() => {
            this.crosshair.visible = false;
            this.hoveredCandle = null;
            this.draw();
        }, 3000);
    }
    
    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    onClick(e) {
        if (this.drawingMode) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.drawingMode === 'horizontal') {
                this.drawings.push({
                    type: 'horizontal',
                    price: this.yToPrice(y),
                    color: '#ffeb3b'
                });
            }
        }
    }
    
    setDrawingMode(mode) {
        this.drawingMode = mode;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tool="${mode}"]`).classList.add('active');
    }
    
    toggleIndicator(indicator) {
        this.indicators[indicator] = !this.indicators[indicator];
        const btn = document.querySelector(`[data-indicator="${indicator}"]`);
        btn.classList.toggle('active', this.indicators[indicator]);
        
        if (!this.indicators[indicator]) {
            delete this.indicators[indicator];
        }
    }
    
    clearAll() {
        this.drawings = [];
        this.tradeLines = [];
        this.indicators = {};
        document.querySelectorAll('.indicator-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    resetView() {
        this.zoom = 1;
        this.panOffset = 0;
        this.updatePriceRange();
        showTradeNotification('Chart view reset', 'info');
    }
    
    zoomIn() {
        this.zoom = Math.min(3, this.zoom * 1.2);
    }
    
    zoomOut() {
        this.zoom = Math.max(0.5, this.zoom * 0.8);
    }
    
    addTradeLine(price, direction, time, duration = 60) {
        this.tradeLines.push({
            price: price,
            direction: direction,
            time: time,
            duration: duration * 1000, // Convert to milliseconds
            startTime: Date.now(),
            alpha: 1.0
        });
    }
    
    drawTradeLines() {
        const width = this.canvas.width / window.devicePixelRatio;
        const currentTime = Date.now();
        
        this.tradeLines.forEach((line, index) => {
            const y = this.priceToY(line.price);
            const color = line.direction === 'up' ? '#26a69a' : '#ef5350';
            const elapsed = currentTime - line.startTime;
            const progress = elapsed / line.duration;
            
            // Keep line visible for full duration, then fade
            if (progress < 1) {
                line.alpha = 1.0;
            } else {
                line.alpha = Math.max(0, 1.0 - (progress - 1) * 2); // Fade over 0.5 duration
            }
            
            this.ctx.globalAlpha = line.alpha;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 4]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.padding.left, y);
            this.ctx.lineTo(width - this.padding.right, y);
            this.ctx.stroke();
            
            // Arrow with trade info
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            if (line.direction === 'up') {
                this.ctx.moveTo(this.padding.left + 15, y - 6);
                this.ctx.lineTo(this.padding.left + 8, y);
                this.ctx.lineTo(this.padding.left + 22, y);
            } else {
                this.ctx.moveTo(this.padding.left + 15, y + 6);
                this.ctx.lineTo(this.padding.left + 8, y);
                this.ctx.lineTo(this.padding.left + 22, y);
            }
            this.ctx.fill();
            
            // Time remaining text
            const timeLeft = Math.max(0, Math.ceil((line.duration - elapsed) / 1000));
            if (timeLeft > 0) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(`${timeLeft}s`, this.padding.left + 30, y + 4);
            }
            
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = 1.0;
            
            // Remove line only after fade is complete
            if (line.alpha <= 0) {
                this.tradeLines.splice(index, 1);
            }
        });
    }
    
    drawDrawings() {
        this.drawings.forEach(drawing => {
            if (drawing.type === 'horizontal') {
                const y = this.priceToY(drawing.price);
                const width = this.canvas.width / window.devicePixelRatio;
                
                this.ctx.strokeStyle = drawing.color;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(this.padding.left, y);
                this.ctx.lineTo(width - this.padding.right, y);
                this.ctx.stroke();
            }
        });
    }
    
    drawIndicators() {
        if (this.indicators.sma && this.candles.length > 20) {
            this.ctx.strokeStyle = '#2196f3';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            
            for (let i = 19; i < this.candles.length; i++) {
                const sma = this.calculateSMA(i, 20);
                const x = this.indexToX(i);
                const y = this.priceToY(sma);
                
                if (i === 19) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }
        
        if (this.indicators.ema && this.candles.length > 20) {
            this.ctx.strokeStyle = '#ff9800';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            
            let ema = this.candles[0].close;
            const multiplier = 2 / (20 + 1);
            
            for (let i = 1; i < this.candles.length; i++) {
                ema = (this.candles[i].close * multiplier) + (ema * (1 - multiplier));
                const x = this.indexToX(i);
                const y = this.priceToY(ema);
                
                if (i === 1) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }
    }
    
    calculateSMA(index, period) {
        let sum = 0;
        for (let i = index - period + 1; i <= index; i++) {
            sum += this.candles[i].close;
        }
        return sum / period;
    }
    
    animate() {
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    autoFollowPrice() {
        if (this.candles.length === 0) return;
        
        const currentPrice = this.candles[this.candles.length - 1].close;
        const chartHeight = this.canvas.height / window.devicePixelRatio - this.padding.top - this.padding.bottom;
        const currentY = this.priceToY(currentPrice);
        
        // If price is going out of visible area, adjust range
        if (currentY < this.padding.top + chartHeight * 0.1 || currentY > this.padding.top + chartHeight * 0.9) {
            const range = this.priceRange.max - this.priceRange.min;
            this.priceRange = {
                min: currentPrice - range * 0.4,
                max: currentPrice + range * 0.6
            };
        }
    }
}

// Show loading indicator
function showChartLoading() {
    const chartContainer = document.getElementById('tradingChart');
    chartContainer.innerHTML = `
        <div class="chart-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Chart...</div>
        </div>
    `;
}

// Initialize Quotex-Style Chart with faster loading
function initializeChart() {
    const chartContainer = document.getElementById('tradingChart');
    
    // Ensure container has proper dimensions immediately
    chartContainer.style.width = '100%';
    chartContainer.style.height = '100%';
    chartContainer.style.minHeight = window.innerWidth <= 768 ? '280px' : '400px';
    chartContainer.style.position = 'relative';
    chartContainer.style.overflow = 'hidden';
    chartContainer.style.background = 'linear-gradient(135deg, #0a0e1a 0%, #1a1d29 100%)';
    
    // Initialize chart immediately
    try {
        chart = new QuotexChart(chartContainer);
        
        // Hide loading indicator
        setTimeout(() => {
            const loading = chartContainer.querySelector('.chart-loading');
            if (loading) loading.remove();
        }, 500);
        
        // Immediate resize
        if (chart && chart.resize) {
            chart.resize();
        }
    } catch (error) {
        console.error('Chart initialization error:', error);
        // Fallback: show simple chart placeholder
        chartContainer.innerHTML = `
            <div class="chart-fallback">
                <div class="fallback-text">Chart Loading...</div>
                <div class="fallback-price">EUR/USD: 1.0850</div>
            </div>
        `;
    }
}

// Load historical candle data
function loadHistoricalData(historical) {
    Object.keys(historical).forEach(asset => {
        candleData.set(asset, historical[asset]);
        assetTimeframeData.set(`${asset}_5`, historical[asset]);
    });
    
    if (historical[currentAsset] && chart) {
        chart.setData(historical[currentAsset]);
    }
}

// Add new candle to chart
function addNewCandle(candle) {
    chart.addCandle(candle);
}

// Update asset prices in sidebar
function updateAssetPrices(assets) {
    Object.keys(assets).forEach(asset => {
        const priceElement = document.getElementById(`price-${asset}`);
        const changeElement = document.getElementById(`change-${asset}`);
        
        if (priceElement && changeElement) {
            const decimals = getAssetDecimals(asset);
            priceElement.textContent = assets[asset].price.toFixed(decimals);
            
            const change = assets[asset].change;
            changeElement.textContent = (change >= 0 ? '+' : '') + change.toFixed(decimals);
            changeElement.className = `asset-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    });
}

// Update current price overlay
function updateCurrentPrice(assetData) {
    const priceElement = document.getElementById('currentPrice');
    const directionElement = document.getElementById('priceDirection');
    
    if (priceElement && directionElement) {
        const decimals = getAssetDecimals(currentAsset);
        priceElement.textContent = assetData.price.toFixed(decimals);
        
        // Update direction indicator
        if (assetData.change > 0) {
            directionElement.textContent = '📈';
            priceElement.style.color = '#00ff88';
        } else if (assetData.change < 0) {
            directionElement.textContent = '📉';
            priceElement.style.color = '#ff4444';
        } else {
            directionElement.textContent = '➡️';
            priceElement.style.color = '#00d4ff';
        }
    }
}

// Get decimal places for asset
function getAssetDecimals(asset) {
    if (asset.includes('JPY')) return 2;
    if (asset.includes('BTC') || asset.includes('ETH') || asset.includes('LTC')) return 2;
    if (asset.includes('US30') || asset.includes('SPX500')) return 0;
    return 4;
}

// Setup event listeners
function setupEventListeners() {
    // Asset selection
    document.querySelectorAll('.asset-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelector('.asset-item.active').classList.remove('active');
            this.classList.add('active');
            
            currentAsset = this.dataset.asset;
            document.getElementById('currentAsset').textContent = currentAsset;
            
            // Switch chart to new asset
            switchAsset(currentAsset);
        });
    });
    
    // Timeframe selection
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelector('.timeframe-btn.active').classList.remove('active');
            this.classList.add('active');
            
            currentTimeframe = this.dataset.time;
            currentTimeframeSeconds = parseInt(this.dataset.seconds);
            
            // Switch timeframe
            switchTimeframe(currentTimeframeSeconds);
        });
    });
}

// Switch to different asset
function switchAsset(asset) {
    currentAsset = asset;
    
    // Check if we have data for this asset with current timeframe
    const key = `${asset}_${currentTimeframeSeconds}`;
    if (assetTimeframeData.has(key)) {
        const data = assetTimeframeData.get(key);
        chart.setData(data);
        candleData.set(asset, data);
    } else {
        // Request data for this asset with current timeframe
        socket.emit('requestTimeframe', { asset, timeframe: currentTimeframeSeconds });
        showTradeNotification(`Loading ${asset} data...`, 'info');
    }
}

// Switch timeframe
function switchTimeframe(seconds) {
    currentTimeframeSeconds = seconds;
    
    // Check if we have data for current asset with new timeframe
    const key = `${currentAsset}_${seconds}`;
    if (assetTimeframeData.has(key)) {
        const data = assetTimeframeData.get(key);
        chart.setData(data);
        candleData.set(currentAsset, data);
    } else {
        // Request new timeframe data
        socket.emit('requestTimeframe', { 
            asset: currentAsset, 
            timeframe: seconds 
        });
    }
    
    const timeText = seconds < 60 ? seconds + 's' : (seconds/60) + 'm';
    showTradeNotification(`Switched to ${timeText} timeframe`, 'info');
}

// Place trade function
function placeTrade(direction) {
    const amountInput = document.getElementById('tradeAmount');
    const durationInput = document.getElementById('tradeDuration');
    
    if (!amountInput || !durationInput) {
        showTradeNotification('Trade form not found', 'error');
        return;
    }
    
    const amount = parseInt(amountInput.value) || 10;
    const duration = parseInt(durationInput.value) || 60;
    
    if (amount < 10) {
        showTradeNotification('Minimum trade amount is ₹10', 'error');
        return;
    }
    
    if (!socket || !socket.connected) {
        showTradeNotification('Not connected to server', 'error');
        return;
    }
    
    // Send trade to server with account type
    socket.emit('placeTrade', {
        asset: currentAsset,
        direction: direction,
        amount: amount,
        duration: duration,
        accountType: accountType
    });
}

// Display active trades
function displayActiveTrades() {
    const container = document.getElementById('activeTradesList');
    
    if (activeTrades.length === 0) {
        container.innerHTML = '<p style="color: #ccc;">No active trades</p>';
        return;
    }
    
    container.innerHTML = activeTrades.map(trade => {
        const timeLeft = Math.max(0, Math.floor((trade.endTime - new Date()) / 1000));
        
        return `
            <div class="active-trade" data-trade-id="${trade.id}">
                <div class="trade-info">
                    <strong>${trade.asset}</strong>
                    <span class="trade-direction ${trade.direction}">${trade.direction.toUpperCase()}</span>
                </div>
                <div class="trade-details">
                    <span>₹${trade.amount}</span>
                    <span>${timeLeft}s left</span>
                </div>
                <div class="trade-price">
                    Entry: ${trade.startPrice.toFixed(4)}
                </div>
            </div>
        `;
    }).join('');
}

// Update user balance
function updateUserBalance(balance) {
    const balanceElement = document.getElementById('userBalance');
    const accountTypeElement = document.getElementById('accountType');
    
    if (balanceElement) {
        balanceElement.textContent = balance.toLocaleString();
    }
    
    if (accountTypeElement) {
        accountTypeElement.textContent = accountType.toUpperCase();
        accountTypeElement.className = `account-type ${accountType}`;
    }
    
    userAccount[accountType].balance = balance;
}

// Switch account type
function switchAccount(type) {
    accountType = type;
    
    // Save to localStorage for persistence
    localStorage.setItem('account_type', type);
    
    // Update UI
    document.querySelectorAll('.account-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-account="${type}"]`).classList.add('active');
    
    // Request account data from server
    socket.emit('switchAccount', { accountType: type });
    
    showTradeNotification(`Switched to ${type.toUpperCase()} account`, 'info');
}

// Load user data from server
function loadUserData() {
    if (socket && socket.connected) {
        socket.emit('getUserData');
    } else {
        setTimeout(loadUserData, 1000);
    }
}

// Modal functions
function showDepositModal() {
    document.getElementById('depositModal').style.display = 'block';
}

function showWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function processDeposit() {
    const amountInput = document.getElementById('depositAmount');
    if (!amountInput) return;
    
    const amount = parseInt(amountInput.value);
    
    if (amount < 2720) {
        showTradeNotification('Minimum deposit is ₹2,720', 'error');
        return;
    }
    
    if (accountType === 'demo') {
        showTradeNotification('Switch to Real account to deposit real money', 'error');
        return;
    }
    
    // Create Cashfree payment session
    fetch('/create-payment-session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: amount,
            userId: localStorage.getItem('tradepro_user_id')
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Initialize Cashfree checkout
            const cashfree = Cashfree({
                mode: 'production'
            });
            
            const checkoutOptions = {
                paymentSessionId: data.sessionId,
                redirectTarget: '_modal'
            };
            
            cashfree.checkout(checkoutOptions).then(() => {
                showTradeNotification('Payment completed successfully!', 'success');
                // Reload balance
                loadUserData();
            }).catch(error => {
                console.error('Payment failed:', error);
                showTradeNotification('Payment failed. Please try again.', 'error');
            });
        } else {
            showTradeNotification(data.error || 'Failed to create payment session', 'error');
        }
    })
    .catch(error => {
        console.error('Payment session error:', error);
        showTradeNotification('Payment initialization failed', 'error');
    });
    
    closeModal('depositModal');
}

function processWithdraw() {
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const bankName = document.getElementById('bankName').value.trim();
    const accountNumber = document.getElementById('accountNumber').value.trim();
    const ifscCode = document.getElementById('ifscCode').value.trim();
    const accountHolder = document.getElementById('accountHolder').value.trim();
    
    if (amount < 5700) {
        showTradeNotification('Minimum withdrawal is ₹5,700', 'error');
        return;
    }
    
    if (!bankName || !accountNumber || !ifscCode || !accountHolder) {
        showTradeNotification('Please fill all bank details', 'error');
        return;
    }
    
    if (socket && socket.connected) {
        socket.emit('withdraw', { 
            amount, 
            bankDetails: {
                bankName,
                accountNumber,
                ifscCode,
                accountHolder
            }
        });
        showTradeNotification('Withdrawal request submitted!', 'success');
    }
    
    // Clear form
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('bankName').value = '';
    document.getElementById('accountNumber').value = '';
    document.getElementById('ifscCode').value = '';
    document.getElementById('accountHolder').value = '';
    
    closeModal('withdrawModal');
}

// Add trade animation
function addTradeAnimation(direction) {
    const chartContainer = document.getElementById('tradingChart');
    const animation = document.createElement('div');
    animation.className = `trade-animation ${direction}`;
    animation.innerHTML = direction === 'up' ? '⬆️' : '⬇️';
    
    animation.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 3rem;
        z-index: 1000;
        animation: tradeFlash 1s ease-out;
        pointer-events: none;
        color: ${direction === 'up' ? '#00ff88' : '#ff4444'};
    `;
    
    chartContainer.appendChild(animation);
    
    setTimeout(() => {
        if (chartContainer.contains(animation)) {
            chartContainer.removeChild(animation);
        }
    }, 1000);
}

// Show trade notification
function showTradeNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `trade-notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1001;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        ${
            type === 'success' ? 'background: linear-gradient(135deg, #00ff88, #00cc6a);' :
            type === 'error' ? 'background: linear-gradient(135deg, #ff4444, #cc3333);' :
            'background: linear-gradient(135deg, #00d4ff, #5200ff);'
        }
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations
const animationCSS = `
    @keyframes tradeFlash {
        0% { 
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }
        50% { 
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
        }
        100% { 
            opacity: 0;
            transform: translate(-50%, -50%) scale(1);
        }
    }
    
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = animationCSS;
document.head.appendChild(styleSheet);

// Profile menu functions
function toggleProfileMenu() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.toggle('show');
}

// Close profile menu when clicking outside
document.addEventListener('click', function(event) {
    const profileMenu = document.querySelector('.profile-menu');
    if (!profileMenu.contains(event.target)) {
        document.getElementById('profileDropdown').classList.remove('show');
    }
});

// Support modal functions
function showSupportModal() {
    document.getElementById('supportModal').style.display = 'block';
    document.getElementById('profileDropdown').classList.remove('show');
}

function showProfileModal() {
    document.getElementById('profileModal').style.display = 'block';
    document.getElementById('profileDropdown').classList.remove('show');
    
    // Update profile info
    const userId = localStorage.getItem('tradepro_user_id') || 'User123';
    document.getElementById('profileUsername').textContent = userId.substring(0, 10);
    document.getElementById('profileAccountType').textContent = accountType.toUpperCase();
}

// Transactions modal functions
function showTransactionsModal() {
    document.getElementById('transactionsModal').style.display = 'block';
    document.getElementById('profileDropdown').classList.remove('show');
    loadTransactions();
}

function loadTransactions() {
    if (socket && socket.connected) {
        socket.emit('getTransactions');
    }
    
    // Load from localStorage as backup
    const localTransactions = JSON.parse(localStorage.getItem('user_transactions') || '[]');
    displayTransactions(localTransactions);
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    const filter = document.getElementById('transactionFilter').value;
    
    let filteredTransactions = transactions;
    if (filter !== 'all') {
        filteredTransactions = transactions.filter(t => t.type === filter);
    }
    
    if (filteredTransactions.length === 0) {
        container.innerHTML = '<p style="color: #ccc; text-align: center; padding: 20px;">No transactions found</p>';
        return;
    }
    
    container.innerHTML = filteredTransactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <span class="transaction-type ${transaction.type}">
                    ${transaction.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}
                </span>
                <span class="transaction-date">${new Date(transaction.timestamp).toLocaleString()}</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="transaction-amount ${transaction.type === 'deposit' ? 'positive' : 'negative'}">
                    ${transaction.type === 'deposit' ? '+' : '-'}₹${transaction.amount}
                </span>
                <span class="transaction-status ${transaction.status}">${transaction.status.toUpperCase()}</span>
            </div>
        </div>
    `).join('');
}

function filterTransactions() {
    loadTransactions();
}

function submitTicket(event) {
    event.preventDefault();
    
    const category = document.getElementById('ticketCategory').value;
    const subject = document.getElementById('ticketSubject').value;
    const message = document.getElementById('ticketMessage').value;
    
    if (!category || !subject || !message) {
        showTradeNotification('Please fill all fields', 'error');
        return;
    }
    
    const ticket = {
        id: 'TKT' + Date.now(),
        category,
        subject,
        message,
        status: 'open',
        userId: localStorage.getItem('tradepro_user_id') || 'User123',
        timestamp: new Date().toISOString()
    };
    
    // Send to server
    if (socket && socket.connected) {
        socket.emit('submitTicket', ticket);
    }
    
    // Store locally
    const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    tickets.push(ticket);
    localStorage.setItem('support_tickets', JSON.stringify(tickets));
    
    showTradeNotification('Support ticket submitted successfully!', 'success');
    closeModal('supportModal');
    
    // Reset form
    document.getElementById('ticketCategory').value = '';
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
}

function logout() {
    localStorage.removeItem('tradepro_user_id');
    window.location.href = '/';
}

// Asset Selector Functions
function toggleAssetSelector() {
    const dropdown = document.getElementById('assetSelectorDropdown');
    const btn = document.querySelector('.asset-selector-btn');
    
    dropdown.classList.toggle('show');
    btn.classList.toggle('active');
}

function filterAssets() {
    const searchTerm = document.getElementById('assetSearch').value.toLowerCase();
    const assetOptions = document.querySelectorAll('.asset-option');
    
    assetOptions.forEach(option => {
        const assetName = option.textContent.toLowerCase();
        if (assetName.includes(searchTerm)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    });
}

// Enhanced Chart Functions
function toggleFullscreen() {
    const chartContainer = document.querySelector('.chart-area');
    if (!document.fullscreenElement) {
        chartContainer.requestFullscreen();
        showTradeNotification('Fullscreen mode activated', 'info');
    } else {
        document.exitFullscreen();
        showTradeNotification('Fullscreen mode deactivated', 'info');
    }
}

function resetChart() {
    if (chart) {
        chart.resetView();
        showTradeNotification('Chart reset to default view', 'info');
    }
}

let chartType = 'candle';
function toggleChartType() {
    chartType = chartType === 'candle' ? 'line' : 'candle';
    showTradeNotification(`Switched to ${chartType} chart`, 'info');
    // Chart type switching logic would go here
}

// Enhanced Price Updates
function updateCurrentPrice(assetData) {
    const priceElement = document.getElementById('currentPrice');
    const changeElement = document.getElementById('priceChange');
    const directionElement = document.getElementById('priceDirection');
    
    if (priceElement && changeElement && directionElement) {
        const decimals = getAssetDecimals(currentAsset);
        priceElement.textContent = assetData.price.toFixed(decimals);
        
        const change = assetData.change;
        const changePercent = ((change / (assetData.price - change)) * 100).toFixed(2);
        
        changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(decimals)} (${change >= 0 ? '+' : ''}${changePercent}%)`;
        changeElement.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
        
        // Update direction indicator
        if (change > 0) {
            directionElement.textContent = '📈';
        } else if (change < 0) {
            directionElement.textContent = '📉';
        } else {
            directionElement.textContent = '➡️';
        }
    }
}

// Asset Selector Event Listeners
document.addEventListener('click', function(event) {
    const assetSelector = document.querySelector('.chart-title');
    const profileMenu = document.querySelector('.profile-menu');
    
    // Close asset selector when clicking outside
    if (!assetSelector.contains(event.target)) {
        document.getElementById('assetSelectorDropdown').classList.remove('show');
        document.querySelector('.asset-selector-btn').classList.remove('active');
    }
    
    // Close profile menu when clicking outside
    if (!profileMenu.contains(event.target)) {
        document.getElementById('profileDropdown').classList.remove('show');
    }
    
    // Handle asset option clicks
    if (event.target.classList.contains('asset-option')) {
        const selectedAsset = event.target.dataset.asset;
        document.getElementById('currentAsset').textContent = selectedAsset;
        
        // Update active asset in sidebar
        document.querySelector('.asset-item.active').classList.remove('active');
        document.querySelector(`[data-asset="${selectedAsset}"]`).classList.add('active');
        
        // Switch to selected asset
        currentAsset = selectedAsset;
        switchAsset(selectedAsset);
        
        // Close dropdown
        document.getElementById('assetSelectorDropdown').classList.remove('show');
        document.querySelector('.asset-selector-btn').classList.remove('active');
        
        showTradeNotification(`Switched to ${selectedAsset}`, 'info');
    }
});

// Trade History Functions
function showTradeHistoryModal() {
    document.getElementById('tradeHistoryModal').style.display = 'block';
    document.getElementById('profileDropdown').classList.remove('show');
    loadTradeHistory();
}

function loadTradeHistory() {
    const tradeHistory = JSON.parse(localStorage.getItem('trade_history') || '[]');
    displayTradeHistory(tradeHistory);
}

function displayTradeHistory(trades) {
    const container = document.getElementById('tradeHistoryList');
    const filter = document.getElementById('tradeHistoryFilter').value;
    
    let filteredTrades = trades;
    if (filter !== 'all') {
        filteredTrades = trades.filter(t => t.result === filter);
    }
    
    if (filteredTrades.length === 0) {
        container.innerHTML = '<p style="color: #ccc; text-align: center; padding: 20px;">No trades found</p>';
        return;
    }
    
    container.innerHTML = filteredTrades.map(trade => `
        <div class="trade-history-item">
            <div class="trade-header">
                <span class="trade-asset">${trade.asset}</span>
                <span class="trade-result ${trade.result}">${trade.result.toUpperCase()}</span>
            </div>
            <div class="trade-details">
                <span class="trade-direction ${trade.direction}">${trade.direction.toUpperCase()}</span>
                <span class="trade-amount">₹${trade.amount}</span>
                <span class="trade-payout ${trade.result === 'won' ? 'positive' : 'negative'}">
                    ${trade.result === 'won' ? '+' : '-'}₹${trade.payout}
                </span>
            </div>
            <div class="trade-time">${new Date(trade.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

function filterTradeHistory() {
    loadTradeHistory();
}

// Maintenance screen function
function showMaintenanceScreen(message) {
    const maintenanceScreen = document.createElement('div');
    maintenanceScreen.id = 'maintenanceScreen';
    maintenanceScreen.innerHTML = `
        <div class="maintenance-content">
            <div class="maintenance-icon">⚙️</div>
            <h2>Server Maintenance</h2>
            <p>${message}</p>
            <div class="maintenance-spinner"></div>
            <button onclick="location.reload()" class="retry-btn">Retry Connection</button>
        </div>
    `;
    
    maintenanceScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(maintenanceScreen);
}

// Update active trades timer
setInterval(() => {
    displayActiveTrades();
}, 1000);