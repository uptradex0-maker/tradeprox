// Complete Balance Management System
const fs = require('fs').promises;
const path = require('path');

const BALANCES_DIR = path.join(__dirname, 'data', 'balances');

// Ensure balances directory exists
fs.mkdir(BALANCES_DIR, { recursive: true }).catch(() => {});

class BalanceManager {
  
  // Get user balance with defaults
  static async getBalance(userId) {
    try {
      const balanceFile = path.join(BALANCES_DIR, `${userId}.json`);
      const data = await fs.readFile(balanceFile, 'utf8');
      const balance = JSON.parse(data);
      
      return {
        realBalance: Number(balance.realBalance) || 0,
        demoBalance: Number(balance.demoBalance) || 50000,
        totalDeposits: Number(balance.totalDeposits) || 0,
        currentAccount: balance.currentAccount || 'demo'
      };
    } catch (error) {
      // Return defaults if file doesn't exist
      return {
        realBalance: 0,
        demoBalance: 50000,
        totalDeposits: 0,
        currentAccount: 'demo'
      };
    }
  }
  
  // Update balance safely
  static async updateBalance(userId, updates) {
    try {
      const balanceFile = path.join(BALANCES_DIR, `${userId}.json`);
      const current = await this.getBalance(userId);
      const newBalance = { ...current, ...updates };
      
      await fs.writeFile(balanceFile, JSON.stringify(newBalance, null, 2));
      console.log(`Balance updated for ${userId}:`, newBalance);
      return newBalance;
    } catch (error) {
      console.error('Balance update error:', error);
      return await this.getBalance(userId);
    }
  }
  
  // Add money to balance
  static async addMoney(userId, amount, accountType = 'real') {
    const current = await this.getBalance(userId);
    const updates = { ...current };
    
    if (accountType === 'real') {
      updates.realBalance = Number(current.realBalance) + Number(amount);
      updates.totalDeposits = Number(current.totalDeposits) + Number(amount);
    } else {
      updates.demoBalance = Number(current.demoBalance) + Number(amount);
    }
    
    return await this.updateBalance(userId, updates);
  }
  
  // Deduct money from balance
  static async deductMoney(userId, amount, accountType = 'demo') {
    const current = await this.getBalance(userId);
    const updates = { ...current };
    
    if (accountType === 'real') {
      updates.realBalance = Math.max(0, Number(current.realBalance) - Number(amount));
    } else {
      updates.demoBalance = Math.max(0, Number(current.demoBalance) - Number(amount));
    }
    
    return await this.updateBalance(userId, updates);
  }
  
  // Check if user has enough balance
  static async hasEnoughBalance(userId, amount, accountType = 'demo') {
    const balance = await this.getBalance(userId);
    const currentBalance = accountType === 'real' ? balance.realBalance : balance.demoBalance;
    return Number(currentBalance) >= Number(amount);
  }
  
  // Switch account type
  static async switchAccount(userId, accountType) {
    return await this.updateBalance(userId, { currentAccount: accountType });
  }
}

module.exports = BalanceManager;