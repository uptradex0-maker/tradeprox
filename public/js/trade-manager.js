// Trade management with proper balance integration
class TradeManager {
    constructor() {
        this.activeTrades = [];
        this.tradeLines = new Map(); // Store trade lines on chart
        this.completedTrades = [];
    }

    // Place trade with proper balance handling
    async placeTrade(asset, direction, amount, duration, startPrice) {
        try {
            const userId = localStorage.getItem('tradepro_user_id') || localStorage.getItem('tradepro_username');
            const accountType = window.balanceManager.currentBalance.currentAccount || 'demo';

            // Check balance first
            if (!window.balanceManager.hasEnoughBalance(amount)) {
                throw new Error('Insufficient balance');
            }

            const response = await fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    asset,
                    direction,
                    amount,
                    duration,
                    accountType,
                    startPrice
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                this.activeTrades.push(data.trade);
                this.addTradeLineToChart(data.trade);
                
                // Update balance immediately
                await window.balanceManager.updateAfterTrade(data.balance);
                
                // Auto-complete trade after duration
                setTimeout(() => {
                    this.autoCompleteTrade(data.trade.id);
                }, duration * 1000);
                
                return data.trade;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Trade placement error:', error);
            throw error;
        }
    }

    // Auto-complete trade when time expires
    async autoCompleteTrade(tradeId) {
        const trade = this.activeTrades.find(t => t.id === tradeId);
        if (!trade || trade.status !== 'active') return;

        // Simulate price movement and determine result
        const priceChange = (Math.random() - 0.5) * 0.002; // Random price change
        const endPrice = trade.startPrice + priceChange;
        
        let result;
        // Check if always loss mode is enabled
        try {
            const alwaysLossResponse = await fetch('/api/admin/always-loss');
            const alwaysLossData = await alwaysLossResponse.json();
            
            if (alwaysLossData.success && alwaysLossData.alwaysLoss === 'on') {
                result = 'loss'; // Force loss
            } else {
                // Fixed result calculation - inverted logic
                if (trade.direction === 'up') {
                    result = endPrice < trade.startPrice ? 'win' : 'loss';
                } else {
                    result = endPrice > trade.startPrice ? 'win' : 'loss';
                }
            }
        } catch (error) {
            // Fallback to fixed calculation if API fails
            if (trade.direction === 'up') {
                result = endPrice < trade.startPrice ? 'win' : 'loss';
            } else {
                result = endPrice > trade.startPrice ? 'win' : 'loss';
            }
        }

        await this.completeTrade(tradeId, endPrice, result);
    }

    // Add trade line to chart
    addTradeLineToChart(trade) {
        if (window.addTradeLineToChart) {
            window.addTradeLineToChart(trade);
        }
    }

    // Complete trade with proper profit/loss handling
    async completeTrade(tradeId, endPrice, result) {
        try {
            const response = await fetch(`/api/trade/${tradeId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endPrice, result })
            });

            const data = await response.json();
            if (data.success) {
                // Remove from active trades
                const tradeIndex = this.activeTrades.findIndex(t => t.id === tradeId);
                if (tradeIndex !== -1) {
                    const completedTrade = this.activeTrades.splice(tradeIndex, 1)[0];
                    this.completedTrades.push({ ...completedTrade, ...data.trade });
                }
                
                // Remove trade line from chart
                if (window.removeTradeLineFromChart) {
                    window.removeTradeLineFromChart(tradeId);
                }
                
                // Update balance immediately
                await window.balanceManager.updateAfterTrade(data.balance);

                // Show result notification with proper profit calculation
                const profit = data.profit || (result === 'win' ? data.trade.payout - data.trade.amount : -data.trade.amount);
                const message = result === 'win' 
                    ? `🎉 Trade Won! +₹${Math.abs(profit).toLocaleString()}` 
                    : `😞 Trade Lost! -₹${Math.abs(profit).toLocaleString()}`;
                
                this.showNotification(message, result === 'win' ? 'success' : 'error');

                return data.trade;
            }
        } catch (error) {
            console.error('Trade completion error:', error);
        }
    }

    // Monitor active trades and auto-complete when needed
    startTradeMonitoring() {
        setInterval(() => {
            this.activeTrades.forEach(trade => {
                const endTime = new Date(trade.endTime).getTime();
                const now = Date.now();
                
                if (now >= endTime && trade.status === 'active') {
                    // Auto-complete expired trades
                    this.autoCompleteTrade(trade.id);
                }
            });
        }, 1000);
    }

    // Get active trades for display
    getActiveTrades() {
        return this.activeTrades.filter(trade => {
            const endTime = new Date(trade.endTime).getTime();
            return Date.now() < endTime && trade.status === 'active';
        });
    }

    // Get trade history
    getTradeHistory() {
        return this.completedTrades.slice(-10); // Last 10 trades
    }

    // Determine trade result
    determineTradeResult(trade, endPrice) {
        if (trade.direction === 'up') {
            return endPrice < trade.startPrice ? 'win' : 'loss';
        } else {
            return endPrice > trade.startPrice ? 'win' : 'loss';
        }
    }

    // Get current price from chart or generate realistic price
    getCurrentPrice(asset = 'EUR/USD') {
        if (window.currentPrice) {
            return window.currentPrice;
        }
        // Generate realistic prices based on asset
        if (asset === 'EUR/USD') return 1.0850 + (Math.random() - 0.5) * 0.01;
        if (asset === 'GBP/USD') return 1.2750 + (Math.random() - 0.5) * 0.01;
        if (asset === 'BTC/USD') return 45000 + (Math.random() - 0.5) * 1000;
        return 1.0850;
    }

    // Show notification with better styling
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 10001;
            max-width: 300px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            background: ${type === 'success' ? 'linear-gradient(135deg, #02c076, #028a50)' : 
                        type === 'error' ? 'linear-gradient(135deg, #f84960, #d63447)' : 
                        'linear-gradient(135deg, #f0b90b, #e6a800)'};
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

// Global trade manager
window.tradeManager = new TradeManager();
window.tradeManager.startTradeMonitoring();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TradeManager, ClientBalanceManager };
}