const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const crypto = require('crypto');
const database = require('./lib/database');
const Razorpay = require('razorpay');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const BalanceManager = require('./balance-system');

const app = express();
const server = http.createServer(app);

// Basic middleware
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
// Data file paths (keeping for maintenance mode and QR code)
const DATA_DIR = path.join(__dirname, 'data');
const BALANCES_DIR = path.join(DATA_DIR, 'balances');

// Ensure uploads and balances directories exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});
fs.mkdir(BALANCES_DIR, { recursive: true }).catch(() => {});
fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Razorpay instance
const razorpay = new Razorpay({
  key_id: 'rzp_test_RPrGZg9pUIO69T',
  key_secret: 'SCLHV8xpbjBoYYK5QlgEjhpY'
});

const MAINTENANCE_FILE = path.join(DATA_DIR, 'maintenance.json');
const QR_CODE_FILE = path.join(DATA_DIR, 'qr-code.json');
const DEPOSIT_REQUESTS_FILE = path.join(DATA_DIR, 'deposit-requests.json');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, 'qr-code-' + Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Helper functions to read/write data (only for maintenance and QR)
async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Complete balance system
async function getUserBalance(userId) {
  try {
    const balanceFile = path.join(BALANCES_DIR, `${userId}.json`);
    const balance = await readJSON(balanceFile);
    return {
      realBalance: Number(balance.realBalance) || 0,
      demoBalance: Number(balance.demoBalance) || 50000,
      totalDeposits: Number(balance.totalDeposits) || 0,
      currentAccount: balance.currentAccount || 'demo'
    };
  } catch (error) {
    return { realBalance: 0, demoBalance: 50000, totalDeposits: 0, currentAccount: 'demo' };
  }
}

async function updateUserBalance(userId, updates) {
  try {
    const balanceFile = path.join(BALANCES_DIR, `${userId}.json`);
    const currentBalance = await getUserBalance(userId);
    const newBalance = { ...currentBalance, ...updates };
    await writeJSON(balanceFile, newBalance);
    console.log(`Balance updated for ${userId}:`, newBalance);
    return newBalance;
  } catch (error) {
    console.error('Balance update error:', error);
    return await getUserBalance(userId);
  }
}

async function addToBalance(userId, amount, type = 'real') {
  try {
    const current = await getUserBalance(userId);
    const updates = { ...current };
    
    if (type === 'real') {
      updates.realBalance = Number(current.realBalance || 0) + Number(amount);
      updates.totalDeposits = Number(current.totalDeposits || 0) + Number(amount);
    } else {
      updates.demoBalance = Number(current.demoBalance || 50000) + Number(amount);
    }
    
    return await updateUserBalance(userId, updates);
  } catch (error) {
    console.error('Add balance error:', error);
    return await getUserBalance(userId);
  }
}

async function deductBalance(userId, amount, type = 'demo') {
  try {
    const current = await getUserBalance(userId);
    const updates = { ...current };
    
    if (type === 'real') {
      updates.realBalance = Math.max(0, Number(current.realBalance || 0) - Number(amount));
    } else {
      updates.demoBalance = Math.max(0, Number(current.demoBalance || 50000) - Number(amount));
    }
    
    return await updateUserBalance(userId, updates);
  } catch (error) {
    console.error('Deduct balance error:', error);
    return await getUserBalance(userId);
  }
}

// Simple trade endpoint - moved before other middleware
app.post('/api/trade', async (req, res) => {
  console.log('Trade API called:', req.body);
  try {
    const { userId, asset, direction, amount, duration, accountType, startPrice } = req.body;
    
    if (!userId || !asset || !direction || !amount || !duration) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const tradeAmount = parseFloat(amount);
    const account = accountType || 'demo';
    
    // Check balance first
    const hasBalance = await BalanceManager.hasEnoughBalance(userId, tradeAmount, account);
    if (!hasBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
    // Deduct balance immediately
    const newBalance = await BalanceManager.deductMoney(userId, tradeAmount, account);
    
    const trade = {
      id: uuidv4(),
      userId,
      asset,
      direction,
      amount: tradeAmount,
      duration: parseInt(duration),
      startPrice: parseFloat(startPrice),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + parseInt(duration) * 1000).toISOString(),
      status: 'active',
      accountType: account
    };
    
    // Save trade
    const trades = await readJSON(path.join(DATA_DIR, 'trades.json'));
    const tradesArray = Array.isArray(trades) ? trades : [];
    tradesArray.push(trade);
    await writeJSON(path.join(DATA_DIR, 'trades.json'), tradesArray);
    
    console.log(`Trade placed: ${userId} - ${direction} ${asset} ₹${tradeAmount} (${account})`);
    
    res.json({ success: true, trade, balance: newBalance });
  } catch (error) {
    console.error('Trade placement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Middleware to enforce maintenance mode
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
    // Allow all API routes and admin routes
    return next();
  }
  try {
    const maintenanceData = await readJSON(MAINTENANCE_FILE);
    if (maintenanceData.maintenanceMode === 'on') {
      return res.status(503).send('Site is under maintenance. Please try again later.');
    }
  } catch (error) {
    // Ignore errors and proceed
  }
  next();
});

// API to get maintenance mode status
app.get('/api/admin/maintenance', async (req, res) => {
  try {
    const maintenanceData = await readJSON(MAINTENANCE_FILE);
    res.json({ success: true, maintenanceMode: maintenanceData.maintenanceMode || 'off' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API to set maintenance mode status
app.post('/api/admin/maintenance', async (req, res) => {
  try {
    const { maintenanceMode } = req.body;
    if (!['on', 'off'].includes(maintenanceMode)) {
      return res.status(400).json({ success: false, message: 'Invalid maintenance mode value' });
    }
    await writeJSON(MAINTENANCE_FILE, { maintenanceMode });
    res.json({ success: true, message: `Maintenance mode set to ${maintenanceMode}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.render('dashboard');
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

app.get('/deposit', (req, res) => {
  res.render('deposit');
});

app.get('/withdraw', (req, res) => {
  res.render('withdraw');
});

app.get('/admin-login', (req, res) => {
  res.render('admin-login');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.get('/test-qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-qr.html'));
});

// Admin API Routes
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  // Simple admin authentication (in production, use proper authentication)
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// User API Routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await database.getUserByUsername(username);

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ 
      success: true, 
      userId: user.id, 
      username: user.username,
      realBalance: user.realBalance || 0,
      demoBalance: user.demoBalance || 50000,
      message: 'Login successful' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user balance (bulletproof)
app.get('/api/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const balance = await BalanceManager.getBalance(userId);
    res.json({ success: true, ...balance });
  } catch (error) {
    res.json({ success: true, realBalance: 0, demoBalance: 50000, totalDeposits: 0, currentAccount: 'demo' });
  }
});

// Update balance (for trades and account switching)
app.post('/api/balance/:userId/update', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, type, action, currentAccount } = req.body;
    
    let result;
    if (action === 'add') {
      result = await addToBalance(userId, amount, type);
    } else if (action === 'deduct') {
      result = await deductBalance(userId, amount, type);
    } else if (currentAccount) {
      // Handle account switching
      result = await BalanceManager.switchAccount(userId, currentAccount);
    } else {
      result = await updateUserBalance(userId, req.body);
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Balance update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Switch account endpoint
app.post('/api/balance/:userId/switch', async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountType } = req.body;
    
    if (!['real', 'demo'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'Invalid account type' });
    }
    
    const result = await BalanceManager.switchAccount(userId, accountType);
    console.log(`Account switched: ${userId} -> ${accountType}`);
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Account switch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Legacy endpoint
app.get('/api/user/balance/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const balance = await getUserBalance(username);
    res.json({ success: true, ...balance });
  } catch (error) {
    res.json({ success: true, realBalance: 0, demoBalance: 50000, totalDeposits: 0 });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if username already exists
    const existingUser = await database.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Create new user with proper defaults
    const userData = {
      username,
      password, // In production, hash the password
      demoBalance: 50000,
      realBalance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      currentAccount: 'demo'
    };

    const newUser = await database.createUser(userData);
    res.json({ 
      success: true, 
      message: 'Registration successful', 
      userId: newUser.id,
      realBalance: 0,
      demoBalance: 50000
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Razorpay order creation
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, userId } = req.body;

    // Validate amount
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 2780) {
      return res.status(400).json({ success: false, message: 'Invalid amount. Minimum is ₹2,780' });
    }

    // Treat userId from client as username (stored via Firebase-based auth)
    const username = String(userId);
    let user = await database.getUserByUsername(username);
    if (!user) {
      // Auto-provision user if not present in Prisma DB
      user = await database.createUser({ username });
    }

    const options = {
      amount: Math.round(depositAmount * 100), // Razorpay expects amount in paisa
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: user.id,
        username: user.username
      }
    };

    const order = await razorpay.orders.create(options);
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: 'rzp_test_RPrGZg9pUIO69T' // Public key for frontend
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Razorpay payment verification
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;

    // Verify payment signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', 'SCLHV8xpbjBoYYK5QlgEjhpY')
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Ensure user exists (auto-provision if needed)
      const username = String(userId);
      let user = await database.getUserByUsername(username);
      if (!user) {
        user = await database.createUser({ username });
      }

      // Get order details to know the amount actually paid
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const amount = order.amount / 100; // Convert back from paisa

      // Update user balance and totals
      await database.updateUser(user.id, {
        realBalance: (user.realBalance || 0) + amount,
        totalDeposits: (user.totalDeposits || 0) + amount
      });

      // Create deposit record
      await database.createDeposit({
        userId: user.id,
        amount: amount,
        status: 'approved',
        method: 'razorpay',
        utr: razorpay_payment_id
      });

      res.json({ success: true, message: 'Payment verified and balance updated' });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await database.getAllUsers();
    // For now, we'll simulate online users or remove this feature
    // TODO: Add online tracking to database
    const onlineUsers = {};
    res.json({ success: true, users, onlineUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/users/:userId/activate', async (req, res) => {
  try {
    res.json({ success: true, message: 'User activated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/users/:userId/deactivate', async (req, res) => {
  try {
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit', async (req, res) => {
  try {
    const { userId, amount, accountType = 'real' } = req.body;
    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    await BalanceManager.addMoney(userId, depositAmount, accountType);
    res.json({ success: true, message: `Deposited ₹${depositAmount} to ${accountType} account of user ${userId}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    res.json({ success: true, withdrawals: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/withdrawals/:id/approve', async (req, res) => {
  try {
    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/withdrawals/:id/reject', async (req, res) => {
  try {
    res.json({ success: true, message: 'Withdrawal rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = {
      totalUsers: 0,
      onlineUsers: 0,
      activeTrades: 0,
      totalVolume: 0,
      serverRevenue: 0,
      winRate: 50
    };
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// QR Code APIs
app.get('/api/qr-code', async (req, res) => {
  try {
    console.log('QR Code API called');
    const qrData = await readJSON(QR_CODE_FILE);
    console.log('QR Data:', qrData);
    res.json({ success: true, qrCode: qrData.qrCode || '/qr-code.jpeg' });
  } catch (error) {
    console.error('QR Code API error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/qr-code', async (req, res) => {
  try {
    const qrData = await readJSON(QR_CODE_FILE);
    res.json({ success: true, qrCode: qrData.qrCode || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/upload-qr', upload.single('qrCode'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const qrCodeUrl = `/uploads/${req.file.filename}`;
    await writeJSON(QR_CODE_FILE, { qrCode: qrCodeUrl });
    
    res.json({ success: true, message: 'QR code uploaded successfully', qrCode: qrCodeUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Deposit Request APIs
app.post('/api/deposit-request', async (req, res) => {
  try {
    const { userId, amount, utr } = req.body;
    
    if (!userId || !amount || !utr) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Ensure user exists with proper defaults
    const username = String(userId);
    let user = await database.getUserByUsername(username);
    if (!user) {
      user = await database.createUser({ 
        username,
        realBalance: 0,
        demoBalance: 50000,
        totalDeposits: 0
      });
    }

    const depositRequest = {
      id: uuidv4(),
      userId: username,
      amount: depositAmount,
      utr: utr.trim(),
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    const requests = await readJSON(DEPOSIT_REQUESTS_FILE);
    const requestsArray = Array.isArray(requests) ? requests : [];
    requestsArray.push(depositRequest);
    
    await writeJSON(DEPOSIT_REQUESTS_FILE, requestsArray);
    
    console.log(`New deposit request: ${username} - ₹${depositAmount} - UTR: ${utr}`);
    
    res.json({ 
      success: true, 
      message: `Deposit request for ₹${depositAmount} submitted successfully. UTR: ${utr}` 
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/deposit-requests', async (req, res) => {
  try {
    const requests = await readJSON(DEPOSIT_REQUESTS_FILE);
    const requestsArray = Array.isArray(requests) ? requests : [];
    
    // Sort by timestamp, newest first
    requestsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ success: true, requests: requestsArray });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const requests = await readJSON(DEPOSIT_REQUESTS_FILE);
    const requestsArray = Array.isArray(requests) ? requests : [];
    
    const requestIndex = requestsArray.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    const request = requestsArray[requestIndex];
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }
    
    // Update balance using BalanceManager
    const newBalance = await BalanceManager.addMoney(request.userId, request.amount, 'real');
    
    // Update request status
    request.status = 'approved';
    request.approvedAt = new Date().toISOString();
    
    await writeJSON(DEPOSIT_REQUESTS_FILE, requestsArray);
    
    console.log(`Deposit approved: User ${request.userId}, Amount: ${request.amount}, New Balance: ${newBalance.realBalance}`);
    
    res.json({ 
      success: true, 
      message: `Deposit approved! ₹${request.amount} added to ${request.userId}'s account. New balance: ₹${newBalance.realBalance}` 
    });
  } catch (error) {
    console.error('Deposit approval error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const requests = await readJSON(DEPOSIT_REQUESTS_FILE);
    const requestsArray = Array.isArray(requests) ? requests : [];
    
    const requestIndex = requestsArray.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    const request = requestsArray[requestIndex];
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }
    
    // Update request status
    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();
    
    await writeJSON(DEPOSIT_REQUESTS_FILE, requestsArray);
    
    res.json({ success: true, message: 'Deposit request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Install new dependencies
try {
  require('multer');
  require('uuid');
} catch (error) {
  console.log('Installing required dependencies...');
  // Dependencies will be installed via package.json
}

// Trade completion endpoint
app.post('/api/trade/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { endPrice, result } = req.body;
    
    const trades = await readJSON(path.join(DATA_DIR, 'trades.json'));
    const tradesArray = Array.isArray(trades) ? trades : [];
    
    const tradeIndex = tradesArray.findIndex(t => t.id === id);
    if (tradeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }
    
    const trade = tradesArray[tradeIndex];
    if (trade.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Trade already completed' });
    }
    
    trade.endPrice = parseFloat(endPrice);
    trade.result = result;
    trade.status = 'completed';
    trade.completedAt = new Date().toISOString();
    
    let payout = 0;
    let profit = -trade.amount;
    
    if (result === 'win') {
      payout = Math.floor(trade.amount * 1.85);
      profit = payout - trade.amount;
      await BalanceManager.addMoney(trade.userId, payout, trade.accountType);
    }
    
    trade.payout = payout;
    trade.profit = profit;
    
    await writeJSON(path.join(DATA_DIR, 'trades.json'), tradesArray);
    
    const balance = await BalanceManager.getBalance(trade.userId);
    
    console.log(`Trade completed: ${trade.userId} - ${result} - Profit: ₹${profit} (${trade.accountType})`);
    
    res.json({ success: true, trade, balance, profit });
  } catch (error) {
    console.error('Trade completion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



app.get('/api/trades/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit } = req.query;
    
    const trades = await readJSON(path.join(DATA_DIR, 'trades.json'));
    const tradesArray = Array.isArray(trades) ? trades : [];
    
    let userTrades = tradesArray.filter(t => t.userId === userId);
    
    // Filter by status if provided
    if (status) {
      userTrades = userTrades.filter(t => t.status === status);
    }
    
    // Sort by start time, newest first
    userTrades.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // Limit results if specified
    if (limit) {
      userTrades = userTrades.slice(0, parseInt(limit));
    }
    
    res.json({ success: true, trades: userTrades });
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get active trades for a user
app.get('/api/trades/:userId/active', async (req, res) => {
  try {
    const { userId } = req.params;
    const trades = await readJSON(path.join(DATA_DIR, 'trades.json'));
    const tradesArray = Array.isArray(trades) ? trades : [];
    
    const activeTrades = tradesArray.filter(t => 
      t.userId === userId && 
      t.status === 'active' && 
      new Date(t.endTime) > new Date()
    );
    
    res.json({ success: true, trades: activeTrades });
  } catch (error) {
    console.error('Get active trades error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 TrustX Server running on http://localhost:${PORT}`);
  console.log(`📊 Balance system: Active`);
  console.log(`💰 Trade system: Active`);
  console.log(`🔄 Auto-completion: Enabled`);
});

// Cleanup function for graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;