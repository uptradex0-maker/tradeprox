const prisma = require('./prisma');

class Database {
  // User operations
  async createUser(userData) {
    return await prisma.user.create({
      data: userData
    });
  }

  async getUserByUsername(username) {
    return await prisma.user.findUnique({
      where: { username }
    });
  }

  async updateUser(userId, data) {
    return await prisma.user.update({
      where: { id: userId },
      data
    });
  }

  // Trade operations
  async createTrade(tradeData) {
    return await prisma.trade.create({
      data: tradeData
    });
  }

  async getUserTrades(userId, accountType) {
    return await prisma.trade.findMany({
      where: { 
        userId,
        accountType,
        status: 'active'
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async completeTrade(tradeId, result, endPrice, payout) {
    return await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: 'completed',
        result,
        endPrice,
        payout
      }
    });
  }

  // Deposit operations
  async createDeposit(depositData) {
    return await prisma.deposit.create({
      data: depositData
    });
  }

  async getPendingDeposits() {
    return await prisma.deposit.findMany({
      where: { status: 'pending' },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveDeposit(depositId) {
    return await prisma.deposit.update({
      where: { id: depositId },
      data: { 
        status: 'approved',
        approvedAt: new Date()
      }
    });
  }

  // Withdrawal operations
  async createWithdrawal(withdrawalData) {
    return await prisma.withdrawal.create({
      data: withdrawalData
    });
  }

  async getPendingWithdrawals() {
    return await prisma.withdrawal.findMany({
      where: { status: 'pending' },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async processWithdrawal(withdrawalId, status) {
    return await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { 
        status,
        processedAt: new Date()
      }
    });
  }

  // Admin settings
  async getAdminSettings() {
    let settings = await prisma.adminSettings.findFirst();
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {}
      });
    }
    return settings;
  }

  async updateAdminSettings(data) {
    const settings = await this.getAdminSettings();
    return await prisma.adminSettings.update({
      where: { id: settings.id },
      data
    });
  }
}

module.exports = new Database();