// Client-side balance management - Fixed persistence and sync
class ClientBalanceManager {
    constructor() {
        this.userId = localStorage.getItem('tradepro_user_id') || localStorage.getItem('tradepro_username');
        this.currentBalance = { realBalance: 0, demoBalance: 50000, currentAccount: 'demo' };
        this.balanceUpdateCallbacks = [];
        this.isInitialized = false;
        this.init();
    }

    async init() {
        await this.loadBalance();
        this.startMonitoring();
        this.isInitialized = true;
    }

    // Load balance from server and cache locally
    async loadBalance() {
        try {
            const response = await fetch(`/api/balance/${this.userId}`);
            const data = await response.json();
            if (data.success) {
                this.currentBalance = {
                    realBalance: Number(data.realBalance) || 0,
                    demoBalance: Number(data.demoBalance) || 50000,
                    currentAccount: data.currentAccount || 'demo',
                    totalDeposits: Number(data.totalDeposits) || 0
                };
                // Cache in localStorage to prevent reset on refresh
                localStorage.setItem('tradepro_balance_cache', JSON.stringify(this.currentBalance));
                this.notifyBalanceUpdate();
                return this.currentBalance;
            }
        } catch (error) {
            console.error('Balance fetch error:', error);
            // Load from cache if server fails
            const cached = localStorage.getItem('tradepro_balance_cache');
            if (cached) {
                this.currentBalance = JSON.parse(cached);
            }
        }
        return this.currentBalance;
    }

    // Get current balance (force refresh if needed)
    async getBalance(forceRefresh = false) {
        if (forceRefresh || !this.isInitialized) {
            return await this.loadBalance();
        }
        return this.currentBalance;
    }

    // Get current account balance
    getCurrentAccountBalance() {
        return this.currentBalance.currentAccount === 'real' 
            ? this.currentBalance.realBalance 
            : this.currentBalance.demoBalance;
    }

    // Check if user has enough balance
    hasEnoughBalance(amount) {
        return this.getCurrentAccountBalance() >= amount;
    }

    // Switch account
    async switchAccount(accountType) {
        try {
            const response = await fetch(`/api/balance/${this.userId}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentAccount: accountType })
            });
            const data = await response.json();
            if (data.success) {
                this.currentBalance.currentAccount = accountType;
                localStorage.setItem('tradepro_balance_cache', JSON.stringify(this.currentBalance));
                this.notifyBalanceUpdate();
            }
        } catch (error) {
            console.error('Account switch error:', error);
        }
    }

    // Update balance after trade
    async updateAfterTrade(newBalance) {
        if (newBalance) {
            this.currentBalance = {
                realBalance: Number(newBalance.realBalance) || 0,
                demoBalance: Number(newBalance.demoBalance) || 50000,
                currentAccount: newBalance.currentAccount || this.currentBalance.currentAccount,
                totalDeposits: Number(newBalance.totalDeposits) || 0
            };
            localStorage.setItem('tradepro_balance_cache', JSON.stringify(this.currentBalance));
            this.notifyBalanceUpdate();
        }
    }

    // Start monitoring balance changes
    startMonitoring() {
        // Check for balance updates every 3 seconds
        setInterval(async () => {
            await this.loadBalance();
        }, 3000);
    }

    // Add callback for balance updates
    onBalanceUpdate(callback) {
        this.balanceUpdateCallbacks.push(callback);
    }

    // Notify all callbacks
    notifyBalanceUpdate() {
        this.balanceUpdateCallbacks.forEach(callback => {
            try {
                callback(this.currentBalance);
            } catch (error) {
                console.error('Balance callback error:', error);
            }
        });
    }

    // Update balance display elements
    updateBalanceDisplay() {
        const realBalanceEl = document.getElementById('realBalance');
        const demoBalanceEl = document.getElementById('demoBalance');
        const currentBalanceEl = document.getElementById('currentBalance');
        const userBalanceEl = document.getElementById('userBalance');
        
        if (realBalanceEl) realBalanceEl.textContent = this.currentBalance.realBalance.toLocaleString();
        if (demoBalanceEl) demoBalanceEl.textContent = this.currentBalance.demoBalance.toLocaleString();
        if (currentBalanceEl) currentBalanceEl.textContent = this.getCurrentAccountBalance().toLocaleString();
        if (userBalanceEl) userBalanceEl.textContent = `₹${this.getCurrentAccountBalance().toLocaleString()}`;
    }
}

// Global balance manager instance
window.balanceManager = new ClientBalanceManager();