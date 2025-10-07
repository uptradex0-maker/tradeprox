const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const multer = require('multer');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
const BALANCES_DIR = path.join(DATA_DIR, 'balances');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(BALANCES_DIR, { recursive: true });
    await fs.mkdir(path.join(__dirname, 'public', 'uploads'), { recursive: true });
  } catch (error) {
    console.log('Directories already exist');
  }
}

// Helper functions
async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Balance functions
async function getBalance(userId) {
  try {
    const balanceFile = path.join(BALANCES_DIR, `${userId}.json`);
    const balance = await readJSON(balanceFile);
    return {
      realBalance: Number(balance.realBalance) || 0,
      demoBalance: Number(balance.demoBalance) || 50000,
      currentAccount: balance.currentAccount || 'demo'
    };
  } catch (error) {
    return { realBalance: 0, demoBalance: 50000, currentAccount: 'demo' };
  }
}

async function updateBalance(userId, updates) {
  try {
    const balanceFile = path.join(BALANCES_DIR, `${userId}.json`);
    const current = await getBalance(userId);
    const newBalance = { ...current, ...updates };
    await writeJSON(balanceFile, newBalance);
    return newBalance;
  } catch (error) {
    return await getBalance(userId);
  }
}

async function hasEnoughBalance(userId, amount, accountType) {
  const balance = await getBalance(userId);
  const currentBalance = accountType === 'real' ? balance.realBalance : balance.demoBalance;
  return Number(currentBalance) >= Number(amount);
}

async function deductMoney(userId, amount, accountType) {
  const current = await getBalance(userId);
  const updates = { ...current };
  
  if (accountType === 'real') {
    updates.realBalance = Math.max(0, Number(current.realBalance) - Number(amount));
  } else {
    updates.demoBalance = Math.max(0, Number(current.demoBalance) - Number(amount));
  }
  
  return await updateBalance(userId, updates);
}

async function addMoney(userId, amount, accountType) {
  const current = await getBalance(userId);
  const updates = { ...current };
  
  if (accountType === 'real') {
    updates.realBalance = Number(current.realBalance) + Number(amount);
  } else {
    updates.demoBalance = Number(current.demoBalance) + Number(amount);
  }
  
  return await updateBalance(userId, updates);
}

// Razorpay instance
const razorpay = new Razorpay({
  key_id: 'rzp_test_RPrGZg9pUIO69T',
  key_secret: 'SCLHV8xpbjBoYYK5QlgEjhpY'
});

// Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, 'qr-code-' + Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => res.render('login'));
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('login'));
app.get('/dashboard', (req, res) => res.render('dashboard'));
app.get('/deposit', (req, res) => res.render('deposit'));
app.get('/withdraw', (req, res) => res.render('withdraw'));
app.get('/admin', (req, res) => res.render('admin'));
app.get('/admin-login', (req, res) => res.render('admin-login'));

// Login API
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Simple validation - accept any username/password for demo
    res.json({ 
      success: true, 
      userId: username, 
      username: username,
      realBalance: 0,
      demoBalance: 50000,
      message: 'Login successful' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Register API
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    res.json({ 
      success: true, 
      message: 'Registration successful',
      userId: username
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// API Routes
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API working' });
});

app.get('/api/balance/:userId', async (req, res) => {
  const balance = await getBalance(req.params.userId);
  res.json({ success: true, ...balance });
});

app.post('/api/trade', async (req, res) => {
  console.log('Trade request received:', req.body);
  
  try {
    const { userId, asset, direction, amount, duration, accountType, startPrice } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const tradeAmount = parseFloat(amount);
    const account = accountType || 'demo';
    
    // Check balance
    const hasBalance = await hasEnoughBalance(userId, tradeAmount, account);
    if (!hasBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
    // Deduct balance
    const newBalance = await deductMoney(userId, tradeAmount, account);
    
    // Create trade
    const trade = {
      id: uuidv4(),
      userId,
      asset: asset || 'EUR/USD',
      direction: direction || 'up',
      amount: tradeAmount,
      duration: parseInt(duration) || 60,
      startPrice: parseFloat(startPrice) || 1.0850,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + (parseInt(duration) || 60) * 1000).toISOString(),
      status: 'active',
      accountType: account
    };
    
    // Save trade
    const tradesFile = path.join(DATA_DIR, 'trades.json');
    const trades = await readJSON(tradesFile);
    trades.push(trade);
    await writeJSON(tradesFile, trades);
    
    console.log('Trade created successfully:', trade.id);
    
    res.json({ success: true, trade, balance: newBalance });
  } catch (error) {
    console.error('Trade error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/trade/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    let { endPrice, result } = req.body;
    
    // Check always loss mode
    const alwaysLossFile = path.join(DATA_DIR, 'always-loss.json');
    const alwaysLossData = await readJSON(alwaysLossFile);
    if (alwaysLossData.alwaysLoss === 'on') {
      result = 'loss'; // Force loss when always loss mode is on
    }
    
    const tradesFile = path.join(DATA_DIR, 'trades.json');
    const trades = await readJSON(tradesFile);
    const tradeIndex = trades.findIndex(t => t.id === id);
    
    if (tradeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }
    
    const trade = trades[tradeIndex];
    trade.endPrice = parseFloat(endPrice);
    trade.result = result;
    trade.status = 'completed';
    
    let payout = 0;
    if (result === 'win') {
      payout = Math.floor(trade.amount * 1.85);
      await addMoney(trade.userId, payout, trade.accountType);
    }
    
    trade.payout = payout;
    await writeJSON(tradesFile, trades);
    
    const balance = await getBalance(trade.userId);
    res.json({ success: true, trade, balance, profit: payout - trade.amount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Razorpay order creation
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, userId } = req.body;
    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount < 2990) {
      return res.status(400).json({ success: false, message: 'Invalid amount. Minimum is ₹2,990' });
    }

    const options = {
      amount: Math.round(depositAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: 'rzp_test_RPrGZg9pUIO69T'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Razorpay payment verification
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', 'SCLHV8xpbjBoYYK5QlgEjhpY')
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const amount = order.amount / 100;
      
      await addMoney(userId, amount, 'real');
      res.json({ success: true, message: 'Payment verified and balance updated' });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Admin deposit
app.post('/api/admin/deposit', async (req, res) => {
  try {
    const { userId, amount, accountType = 'real' } = req.body;
    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    await addMoney(userId, depositAmount, accountType);
    res.json({ success: true, message: `Deposited ₹${depositAmount} to ${accountType} account` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Balance update
app.post('/api/balance/:userId/update', async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentAccount } = req.body;
    
    if (currentAccount) {
      const result = await updateBalance(userId, { currentAccount });
      res.json({ success: true, ...result });
    } else {
      res.json({ success: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get trades
app.get('/api/trades/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tradesFile = path.join(DATA_DIR, 'trades.json');
    const trades = await readJSON(tradesFile);
    const userTrades = trades.filter(t => t.userId === userId);
    res.json({ success: true, trades: userTrades });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin stats
app.get('/api/admin/stats', async (req, res) => {
  res.json({
    success: true,
    stats: {
      totalUsers: 0,
      onlineUsers: 0,
      activeTrades: 0,
      totalVolume: 0,
      serverRevenue: 0,
      winRate: 50
    }
  });
});

// Admin users
app.get('/api/admin/users', async (req, res) => {
  res.json({ success: true, users: [], onlineUsers: {} });
});

// QR Code APIs
app.get('/api/qr-code', async (req, res) => {
  try {
    const qrFile = path.join(DATA_DIR, 'qr-code.json');
    const qrData = await readJSON(qrFile);
    res.json({ success: true, qrCode: qrData.qrCode || null });
  } catch (error) {
    res.json({ success: true, qrCode: null });
  }
});

app.get('/api/admin/qr-code', async (req, res) => {
  try {
    const qrFile = path.join(DATA_DIR, 'qr-code.json');
    const qrData = await readJSON(qrFile);
    res.json({ success: true, qrCode: qrData.qrCode || null });
  } catch (error) {
    res.json({ success: true, qrCode: null });
  }
});

app.post('/api/admin/upload-qr', upload.single('qrCode'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const qrCodeUrl = `/uploads/${req.file.filename}`;
    const qrFile = path.join(DATA_DIR, 'qr-code.json');
    await writeJSON(qrFile, { qrCode: qrCodeUrl });
    
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

    const depositRequest = {
      id: uuidv4(),
      userId: String(userId),
      amount: depositAmount,
      utr: utr.trim(),
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    const requestsFile = path.join(DATA_DIR, 'deposit-requests.json');
    const requests = await readJSON(requestsFile);
    requests.push(depositRequest);
    await writeJSON(requestsFile, requests);
    
    res.json({ 
      success: true, 
      message: `Deposit request for ₹${depositAmount} submitted successfully. UTR: ${utr}` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/deposit-requests', async (req, res) => {
  try {
    const requestsFile = path.join(DATA_DIR, 'deposit-requests.json');
    const requests = await readJSON(requestsFile);
    requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const requestsFile = path.join(DATA_DIR, 'deposit-requests.json');
    const requests = await readJSON(requestsFile);
    
    const requestIndex = requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    const request = requests[requestIndex];
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }
    
    await addMoney(request.userId, request.amount, 'real');
    
    request.status = 'approved';
    request.approvedAt = new Date().toISOString();
    await writeJSON(requestsFile, requests);
    
    res.json({ 
      success: true, 
      message: `Deposit approved! ₹${request.amount} added to ${request.userId}'s account` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const requestsFile = path.join(DATA_DIR, 'deposit-requests.json');
    const requests = await readJSON(requestsFile);
    
    const requestIndex = requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    const request = requests[requestIndex];
    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();
    await writeJSON(requestsFile, requests);
    
    res.json({ success: true, message: 'Deposit request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Maintenance mode APIs
app.get('/api/admin/maintenance', async (req, res) => {
  try {
    const maintenanceFile = path.join(DATA_DIR, 'maintenance.json');
    const maintenanceData = await readJSON(maintenanceFile);
    res.json({ success: true, maintenanceMode: maintenanceData.maintenanceMode || 'off' });
  } catch (error) {
    res.json({ success: true, maintenanceMode: 'off' });
  }
});

app.post('/api/admin/maintenance', async (req, res) => {
  try {
    const { maintenanceMode } = req.body;
    if (!['on', 'off'].includes(maintenanceMode)) {
      return res.status(400).json({ success: false, message: 'Invalid maintenance mode value' });
    }
    
    const maintenanceFile = path.join(DATA_DIR, 'maintenance.json');
    await writeJSON(maintenanceFile, { maintenanceMode });
    res.json({ success: true, message: `Maintenance mode set to ${maintenanceMode}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Always Loss Mode APIs
app.get('/api/admin/always-loss', async (req, res) => {
  try {
    const alwaysLossFile = path.join(DATA_DIR, 'always-loss.json');
    const alwaysLossData = await readJSON(alwaysLossFile);
    res.json({ success: true, alwaysLoss: alwaysLossData.alwaysLoss || 'off' });
  } catch (error) {
    res.json({ success: true, alwaysLoss: 'off' });
  }
});

app.post('/api/admin/always-loss', async (req, res) => {
  try {
    const { alwaysLoss } = req.body;
    if (!['on', 'off'].includes(alwaysLoss)) {
      return res.status(400).json({ success: false, message: 'Invalid always loss mode value' });
    }
    
    const alwaysLossFile = path.join(DATA_DIR, 'always-loss.json');
    await writeJSON(alwaysLossFile, { alwaysLoss });
    res.json({ success: true, message: `Always loss mode set to ${alwaysLoss}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Initialize and start server
ensureDirectories().then(() => {
  app.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
    console.log('📊 Trade API: /api/trade');
    console.log('🧪 Test API: /api/test');
  });
});

module.exports = app;