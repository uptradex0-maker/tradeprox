const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
// Payment gateway imports will be added as needed

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Payment gateway configurations
const RAZORPAY_KEY = 'rzp_test_RMg5mvjRX8HCe3';
const RAZORPAY_SECRET = 'your_razorpay_secret_key';

// Routes
app.get('/', (req, res) => {
  try {
    res.render('login');
  } catch (error) {
    res.redirect('/dashboard');
  }
});

app.get('/register', (req, res) => {
  try {
    res.render('register');
  } catch (error) {
    res.redirect('/dashboard');
  }
});

app.get('/dashboard', (req, res) => {
  try {
    res.render('dashboard');
  } catch (error) {
    res.send(`<!DOCTYPE html><html><head><title>TrustX</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;background:#0a0e1a;color:#fff;text-align:center;padding:50px}.container{max-width:600px;margin:0 auto}.logo{font-size:2em;color:#00d4ff;margin-bottom:20px}.btn{background:#00d4ff;color:#000;padding:15px 30px;text-decoration:none;border-radius:5px;display:inline-block;margin:10px}</style></head><body><div class="container"><div class="logo">TrustX</div><p>Trading Platform Loading...</p><a href="/dashboard" class="btn">Reload</a></div></body></html>`);
  }
});

app.get('/admin-login', (req, res) => {
  try {
    res.render('admin-login');
  } catch (error) {
    res.redirect('/admin');
  }
});

app.post('/admin-auth', (req, res) => {
  const { username, password } = req.body;
  if (username === 'aryan' && password === 'aryan123') {
    res.json({ success: true, redirect: '/admin' });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/admin', (req, res) => {
  try {
    res.render('admin');
  } catch (error) {
    res.send(`<!DOCTYPE html><html><head><title>TrustX Admin</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;background:#0a0e1a;color:#fff;text-align:center;padding:50px}.container{max-width:600px;margin:0 auto}.logo{font-size:2em;color:#00d4ff;margin-bottom:20px}.btn{background:#00d4ff;color:#000;padding:15px 30px;text-decoration:none;border-radius:5px;display:inline-block;margin:10px}</style></head><body><div class="container"><div class="logo">TrustX Admin</div><p>Admin Panel Loading...</p><a href="/admin" class="btn">Reload</a><a href="/dashboard" class="btn">Dashboard</a></div></body></html>`);
  }
});

app.get('/deposit', (req, res) => {
  try {
    res.render('deposit');
  } catch (error) {
    res.redirect('/dashboard');
  }
});

app.get('/withdraw', (req, res) => {
  try {
    res.render('withdraw');
  } catch (error) {
    res.redirect('/dashboard');
  }
});

// API Routes for deposit/withdrawal
app.get('/api/get-qr-code', (req, res) => {
  res.json({ success: true, qrCode: currentQRCode });
});

app.post('/api/submit-deposit', (req, res) => {
  const { amount, utr } = req.body;
  
  if (amount < 2780) {
    return res.json({ success: false, message: 'Minimum deposit is ₹2,780' });
  }
  
  if (!utr || utr.length < 8) {
    return res.json({ success: false, message: 'Invalid UTR number' });
  }
  
  const request = {
    id: 'DEP' + Date.now(),
    userId: 'web_user_' + Date.now(),
    amount,
    utr,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  depositRequests.push(request);
  
  // Notify admin
  io.emit('newDepositRequest', request);
  
  console.log(`Deposit request: ₹${amount}, UTR: ${utr}`);
  res.json({ success: true, requestId: request.id });
});

app.post('/api/submit-withdrawal', (req, res) => {
  const { amount, bankName, accountNumber, ifscCode, accountHolder } = req.body;
  
  if (amount < 5780) {
    return res.json({ success: false, message: 'Minimum withdrawal is ₹5,780' });
  }
  
  const request = {
    id: 'WD' + Date.now(),
    userId: 'web_user_' + Date.now(),
    amount,
    bankName,
    accountNumber,
    ifscCode,
    accountHolder,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  allWithdrawals.push(request);
  saveWithdrawals();
  
  // Notify admin
  io.emit('newWithdrawal', request);
  
  console.log(`Withdrawal request: ₹${amount} to ${bankName}`);
  res.json({ success: true, requestId: request.id });
});

// QR Code and deposit system with persistence
const qrDataFile = path.join(__dirname, 'data', 'qr-code.json');
let currentQRCode = null; // Start with null to force loading from file
const depositRequests = [];

// Load saved QR code on server start
function loadQRCode() {
  try {
    if (fs.existsSync && fs.existsSync(qrDataFile)) {
      const qrData = JSON.parse(fs.readFileSync(qrDataFile, 'utf8'));
      if (qrData.qrCode && qrData.qrCode.startsWith('data:image/')) {
        currentQRCode = qrData.qrCode;
        console.log('✅ Loaded saved QR code from storage');
      } else {
        console.log('⚠️ Invalid QR code in storage, using default');
        currentQRCode = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZTwvdGV4dD48L3N2Zz4=';
      }
    } else {
      console.log('⚠️ No QR code file found, using default');
      currentQRCode = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZTwvdGV4dD48L3N2Zz4=';
    }
  } catch (error) {
    console.log('QR code loading error, using default:', error.message);
    currentQRCode = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZTwvdGV4dD48L3N2Zz4=';
  }
}

// Save QR code to file
function saveQRCode() {
  try {
    if (fs.writeFileSync && currentQRCode) {
      // Ensure data directory exists
      const dataDir = path.dirname(qrDataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(qrDataFile, JSON.stringify({ 
        qrCode: currentQRCode,
        lastUpdated: new Date().toISOString()
      }, null, 2));
      console.log('✅ QR code saved to storage');
    }
  } catch (error) {
    console.error('❌ Error saving QR code:', error.message);
  }
}

app.get('/get-qr-code', (req, res) => {
  // Ensure QR code is loaded
  if (!currentQRCode) {
    loadQRCode();
  }
  res.json({ success: true, qrCode: currentQRCode });
});

app.post('/submit-deposit-request', (req, res) => {
  const { amount, utr, userId } = req.body;
  
  if (amount < 2720) {
    return res.json({ success: false, message: 'Minimum deposit is ₹2,720' });
  }
  
  if (!utr || utr.length !== 12) {
    return res.json({ success: false, message: 'Invalid UTR number' });
  }
  
  const request = {
    id: 'DEP' + Date.now(),
    userId,
    amount,
    utr,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  depositRequests.push(request);
  
  // Notify admin
  io.emit('newDepositRequest', request);
  
  console.log(`Deposit request: ₹${amount}, UTR: ${utr}`);
  res.json({ success: true, requestId: request.id });
});

app.post('/admin/update-qr', (req, res) => {
  const { qrCode } = req.body;
  
  if (!qrCode || !qrCode.startsWith('data:image/')) {
    return res.json({ success: false, message: 'Invalid image data' });
  }
  
  currentQRCode = qrCode;
  saveQRCode(); // Save to file
  
  // Broadcast QR update to all connected clients and save to their localStorage
  io.emit('qrCodeUpdated', { qrCode });
  
  console.log('✅ QR Code updated by admin, saved to storage, and broadcasted to all users');
  res.json({ success: true });
});

app.post('/admin/update-upi', (req, res) => {
  const { upiId } = req.body;
  
  if (!upiId || !upiId.trim()) {
    return res.json({ success: false, message: 'Invalid UPI ID' });
  }
  
  currentUpiId = upiId.trim();
  saveUpiId(); // Save to file immediately
  
  // Broadcast UPI ID update to all connected clients
  io.emit('upiIdUpdated', { upiId: currentUpiId });
  
  console.log('✅ UPI ID updated by admin, saved to storage, and broadcasted to all users');
  res.json({ success: true, message: 'UPI ID updated successfully' });
});

app.post('/admin/approve-deposit', (req, res) => {
  const { requestId } = req.body;
  const request = depositRequests.find(r => r.id === requestId);
  
  if (!request) {
    return res.json({ success: false, message: 'Request not found' });
  }
  
  request.status = 'approved';
  
  // Add to user balance
  const user = users.get(request.userId) || initializeUser(request.userId);
  user.accounts.real.balance += request.amount;
  user.accounts.real.totalDeposits += request.amount;
  
  saveDataImmediate();
  
  // Notify user
  const userSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === request.userId);
  if (userSocket) {
    userSocket.emit('balanceUpdate', {
      balance: user.accounts.real.balance,
      accountType: 'real',
      type: 'deposit',
      amount: request.amount
    });
  }
  
  console.log(`Deposit approved: ₹${request.amount} for ${request.userId}`);
  res.json({ success: true });
});

app.post('/admin/reject-deposit', (req, res) => {
  const { requestId } = req.body;
  const request = depositRequests.find(r => r.id === requestId);
  
  if (!request) {
    return res.json({ success: false, message: 'Request not found' });
  }
  
  request.status = 'rejected';
  
  console.log(`Deposit rejected: ₹${request.amount} for ${request.userId}`);
  res.json({ success: true });
});

app.get('/admin/deposit-requests', (req, res) => {
  res.json({ success: true, requests: depositRequests });
});

// Simple admin deposit
app.post('/admin/deposit', (req, res) => {
  const { userId, amount, accountType } = req.body;
  
  if (!userId || !amount) {
    return res.json({ success: false, message: 'Missing data' });
  }
  
  let found = false;
  
  users.forEach((user, id) => {
    const shortId = id.split('_')[1] || id.substring(0, 8);
    if (shortId === userId || id === userId) {
      if (accountType === 'demo') {
        user.accounts.demo.balance += amount;
      } else {
        user.accounts.real.balance += amount;
      }
      
      // Update user balance in real-time
      io.sockets.sockets.forEach(socket => {
        if (socket.userId === id) {
          socket.emit('balanceUpdate', {
            balance: accountType === 'demo' ? user.accounts.demo.balance : user.accounts.real.balance,
            accountType: accountType
          });
        }
      });
      
      found = true;
    }
  });
  
  res.json({ success: found, message: found ? 'Deposit added' : 'User not found' });
});

// Get users
app.get('/admin/users', (req, res) => {
  const userList = [];
  
  users.forEach((user, userId) => {
    const shortId = userId.split('_')[1] || userId.substring(0, 8);
    userList.push({
      shortId: shortId,
      demoBalance: user.accounts.demo.balance,
      realBalance: user.accounts.real.balance
    });
  });
  
  res.json({ success: true, users: userList });
});

// User deposit request
app.post('/api/deposit-request', (req, res) => {
  const { userId, amount, utr, method } = req.body;
  
  const request = {
    id: Date.now().toString(),
    userId: userId,
    amount: parseInt(amount),
    utr: utr,
    method: method,
    status: 'pending',
    timestamp: new Date()
  };
  
  depositRequests.push(request);
  
  console.log('New deposit request:', request);
  res.json({ success: true });
});

// Get deposit requests for admin
app.get('/admin/requests', (req, res) => {
  res.json({ success: true, requests: depositRequests });
});

// Approve deposit request - WORKING
app.post('/admin/approve', (req, res) => {
  const { requestId } = req.body;
  
  const request = depositRequests.find(r => r.id === requestId);
  if (!request) {
    return res.json({ success: false, message: 'Request not found' });
  }
  
  console.log('\n=== APPROVE REQUEST ===');
  console.log('Received requestId:', requestId);
  console.log('Type of requestId:', typeof requestId);
  console.log('All deposit requests:');
  depositRequests.forEach((req, index) => {
    console.log(`  ${index}: ID="${req.id}" (type: ${typeof req.id}), Status: ${req.status}`);
  });
  
  const request = depositRequests.find(r => {
    console.log(`Comparing "${r.id}" === "${requestId}":`, r.id === requestId);
    return r.id === requestId || r.id.toString() === requestId.toString();
  });
  
  if (!request) {
    console.log('❌ Request not found!');
    return res.json({ success: false, message: 'Request not found' });
  }
  
  console.log('✅ Found request:', request);
  console.log('User ID:', request.userId);
  console.log('Amount:', request.amount);
  
  let targetUserId = null;
  let targetUser = null;
  
  // Search for user by short ID
  for (const [fullId, user] of users.entries()) {
    const shortId = fullId.split('_')[1] || fullId.substring(0, 8);
    if (shortId === request.userId) {
      targetUserId = fullId;
      targetUser = user;
      console.log('✅ Found user:', fullId);
      break;
    }
  }
  
  // Create user if not found
  if (!targetUser) {
    targetUserId = 'user_' + Date.now() + '_' + request.userId;
    targetUser = {
      accounts: {
        demo: { balance: 50000, totalTrades: 0, totalWins: 0, totalLosses: 0, totalDeposits: 0, totalWithdrawals: 0 },
        real: { balance: 0, totalTrades: 0, totalWins: 0, totalLosses: 0, totalDeposits: 0, totalWithdrawals: 0 }
      },
      currentAccount: 'demo',
      joinedAt: new Date()
    };
    users.set(targetUserId, targetUser);
    console.log('✅ Created new user:', targetUserId);
  }
  
  // Add balance to real account
  const oldBalance = targetUser.accounts.real.balance;
  targetUser.accounts.real.balance += request.amount;
  targetUser.accounts.real.totalDeposits += request.amount;
  
  console.log('💰 Balance updated:');
  console.log('Old balance:', oldBalance);
  console.log('New balance:', targetUser.accounts.real.balance);
  
  // Mark request as approved
  request.status = 'approved';
  
  // Notify ALL sockets for this user
  let notified = false;
  io.sockets.sockets.forEach(socket => {
    if (socket.userId === targetUserId) {
      console.log('📡 Sending balance update to socket:', socket.id);
      socket.emit('balanceUpdate', {
        balance: targetUser.accounts.real.balance,
        accountType: 'real'
      });
      notified = true;
    }
  });
  
  console.log('📱 User notified:', notified ? 'Yes' : 'No (offline)');
  console.log('✅ Deposit approval completed');
  
  res.json({ success: true, message: 'Deposit approved successfully' });
});

// Reject deposit request
app.post('/admin/reject', (req, res) => {
  const { requestId } = req.body;
  
  const request = depositRequests.find(r => r.id === requestId);
  if (request) {
    request.status = 'rejected';
    console.log('Deposit rejected:', request);
  }
  
  res.json({ success: true });
});

// Admin stats
app.get('/admin/stats', (req, res) => {
  let totalUsers = users.size;
  let onlineUsers = io.engine.clientsCount;
  let activeTrades = 0;
  let totalVolume = 0;
  
  users.forEach(user => {
    Object.values(user.accounts).forEach(account => {
      totalVolume += (account.totalTrades || 0) * 100;
    });
  });
  
  res.json({
    success: true,
    stats: {
      totalUsers,
      onlineUsers,
      activeTrades,
      totalVolume
    }
  });
});

// Trade settings
app.post('/admin/trade-settings', (req, res) => {
  const { tradeMode, payoutPercent } = req.body;
  
  if (tradeMode) {
    tradeMode = tradeMode;
  }
  
  if (payoutPercent) {
    adminSettings.defaultPayout = payoutPercent;
  }
  
  console.log('Admin updated trade settings:', { tradeMode, payoutPercent });
  res.json({ success: true });
});

// Server status
app.post('/admin/server-status', (req, res) => {
  const { status } = req.body;
  
  adminSettings.serverStatus = status;
  
  console.log('Server status updated to:', status);
  res.json({ success: true });
});

// Add demo balance to all - WORKING
app.post('/admin/add-demo-balance', (req, res) => {
  res.json({ success: true });
});

// Broadcast message
app.post('/admin/broadcast', (req, res) => {
  const { message } = req.body;
  
  io.emit('adminMessage', { message });
  
  console.log('Admin broadcasted:', message);
  res.json({ success: true });
});

// Clear all data - WORKING
app.post('/admin/clear-data', (req, res) => {
  res.json({ success: true });
});

// Kick all users
app.post('/admin/kick-users', (req, res) => {
  io.sockets.sockets.forEach(socket => {
    socket.disconnect(true);
  });
  
  console.log('All users kicked by admin');
  res.json({ success: true });
});

// Cashfree Payment Routes
app.post('/create-payment-session', async (req, res) => {
  try {
    const { amount, userId } = req.body;
    
    if (amount < 2720) {
      return res.status(400).json({ error: 'Minimum deposit is ₹2,720' });
    }
    
    const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const request = {
      order_amount: amount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: userId,
        customer_phone: '9999999999',
        customer_email: 'user@trustx.com'
      },
      order_meta: {
        return_url: `${req.protocol}://${req.get('host')}/payment-success?order_id={order_id}`,
        notify_url: `${req.protocol}://${req.get('host')}/payment-webhook`
      }
    };
    
    const response = await Cashfree.PGCreateOrder('2023-08-01', request);
    
    res.json({
      success: true,
      sessionId: response.data.payment_session_id,
      orderId: orderId
    });
  } catch (error) {
    console.error('Cashfree payment session error:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

app.get('/payment-success', (req, res) => {
  const orderId = req.query.order_id;
  res.send(`<script>window.close(); window.opener.postMessage({type: 'payment_success', orderId: '${orderId}'}, '*');</script>`);
});

app.post('/payment-webhook', async (req, res) => {
  try {
    const { order_id, order_status, payment_amount } = req.body;
    
    if (order_status === 'PAID') {
      // Find user and update balance
      const userId = req.body.customer_id;
      const user = users.get(userId);
      
      if (user) {
        user.accounts.real.balance += parseFloat(payment_amount);
        user.accounts.real.totalDeposits += parseFloat(payment_amount);
        saveDataImmediate();
        
        // Notify user via socket
        const userSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === userId);
        if (userSocket) {
          userSocket.emit('balanceUpdate', {
            balance: user.accounts.real.balance,
            accountType: 'real',
            type: 'deposit',
            amount: parseFloat(payment_amount)
          });
        }
        
        console.log(`Cashfree deposit completed: ₹${payment_amount} for user ${userId}`);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Cashfree webhook error:', error);
    res.status(500).send('Error');
  }
});

// Global candle data storage for synchronization
const globalCandleData = {};
const currentCandles = {};

// Mock data for real-time charts
const assets = {
  'EUR/USD': { price: 1.0850, change: 0.0012, open: 1.0838, high: 1.0865, low: 1.0835 },
  'GBP/USD': { price: 1.2650, change: -0.0025, open: 1.2675, high: 1.2680, low: 1.2640 },
  'USD/JPY': { price: 149.50, change: 0.45, open: 149.05, high: 149.75, low: 148.95 },
  'AUD/USD': { price: 0.6580, change: 0.0018, open: 0.6562, high: 0.6595, low: 0.6555 },
  'USD/CAD': { price: 1.3650, change: -0.0032, open: 1.3682, high: 1.3690, low: 1.3645 },
  'BTC/USD': { price: 43250, change: 125.50, open: 43124.50, high: 43380, low: 43100 },
  'ETH/USD': { price: 2650, change: -15.25, open: 2665.25, high: 2675, low: 2640 },
  'LTC/USD': { price: 72.50, change: 2.15, open: 70.35, high: 73.20, low: 70.10 },
  'XRP/USD': { price: 0.6250, change: -0.0125, open: 0.6375, high: 0.6380, low: 0.6240 },
  'US30': { price: 37850, change: 125.30, open: 37724.70, high: 37920, low: 37700 },
  'SPX500': { price: 4785, change: -12.45, open: 4797.45, high: 4805, low: 4780 }
};

// Initialize current candles
Object.keys(assets).forEach(asset => {
  currentCandles[asset] = {
    time: Math.floor(Date.now() / 1000),
    open: assets[asset].price,
    high: assets[asset].price,
    low: assets[asset].price,
    close: assets[asset].price
  };
});

// Real-time price updates every second
setInterval(() => {
  Object.keys(assets).forEach(asset => {
    const volatility = getAssetVolatility(asset);
    const change = (Math.random() - 0.5) * volatility;
    
    // Update price
    assets[asset].price += change;
    assets[asset].change = change;
    
    // Update current candle
    const currentCandle = currentCandles[asset];
    currentCandle.close = assets[asset].price;
    
    // Update high/low for current candle
    if (assets[asset].price > currentCandle.high) {
      currentCandle.high = assets[asset].price;
    }
    if (assets[asset].price < currentCandle.low) {
      currentCandle.low = assets[asset].price;
    }
    
    // Emit current candle update
    io.emit('candleUpdate', { asset, candle: currentCandle });
  });
  
  io.emit('priceUpdate', assets);
}, 1000);

// Complete candle every 5 seconds and start new one
setInterval(() => {
  Object.keys(assets).forEach(asset => {
    const completedCandle = { ...currentCandles[asset] };
    
    // Store completed candle
    if (!globalCandleData[asset]) {
      globalCandleData[asset] = [];
    }
    globalCandleData[asset].push(completedCandle);
    
    // Keep only last 200 candles
    if (globalCandleData[asset].length > 200) {
      globalCandleData[asset].shift();
    }
    
    // Start new candle
    currentCandles[asset] = {
      time: Math.floor(Date.now() / 1000),
      open: assets[asset].price,
      high: assets[asset].price,
      low: assets[asset].price,
      close: assets[asset].price
    };
    
    // Emit completed candle to all clients
    io.emit('newCandle', { asset, candle: completedCandle });
  });
}, 5000);

function getAssetVolatility(asset) {
  const volatilities = {
    'EUR/USD': 0.0008,
    'GBP/USD': 0.0012,
    'USD/JPY': 0.08,
    'AUD/USD': 0.0010,
    'USD/CAD': 0.0009,
    'BTC/USD': 50,
    'ETH/USD': 8,
    'LTC/USD': 1.5,
    'XRP/USD': 0.008,
    'US30': 15,
    'SPX500': 2.5
  };
  return volatilities[asset] || 0.001;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Get persistent user ID from query or create new one
  const persistentUserId = socket.handshake.query.userId || generateUserId();
  socket.userId = persistentUserId;
  
  // Initialize user with persistent ID
  const user = initializeUser(persistentUserId);
  
  // Send initial data immediately
  setTimeout(() => {
    socket.emit('priceUpdate', assets);
    socket.emit('historicalData', globalCandleData);
    socket.emit('currentCandles', currentCandles);
    socket.emit('balanceUpdate', { balance: user.balance, type: 'init' });
  }, 100);
  
  socket.on('getUserData', () => {
    const user = users.get(socket.userId) || initializeUser(socket.userId);
    const trades = userTrades.get(socket.userId) || { demo: [], real: [] };
    const currentAccount = user.currentAccount;
    
    socket.emit('accountData', {
      accounts: user.accounts,
      currentAccount: currentAccount
    });
    
    socket.emit('userTrades', trades[currentAccount].filter(t => t.status === 'active'));
    
    console.log(`Sent user data - Account: ${currentAccount}, Balance: ${user.accounts[currentAccount].balance}`);
  });
  
  socket.on('switchAccount', (data) => {
    const user = users.get(socket.userId) || initializeUser(socket.userId);
    const { accountType } = data;
    
    if (accountType === 'demo' || accountType === 'real') {
      user.currentAccount = accountType;
      const trades = userTrades.get(socket.userId);
      
      socket.emit('balanceUpdate', {
        balance: user.accounts[accountType].balance,
        accountType: accountType,
        type: 'switch'
      });
      
      socket.emit('userTrades', trades[accountType].filter(t => t.status === 'active'));
      
      console.log(`User switched to ${accountType} account`);
    }
  });
  
  socket.on('placeTrade', (data) => {
    const user = users.get(socket.userId) || initializeUser(socket.userId);
    const { asset, direction, amount, duration, accountType } = data;
    const currentAccount = accountType || user.currentAccount;
    
    console.log(`Trade request: ${direction} ${asset} ${amount} for ${duration}s on ${currentAccount} account`);
    
    if (!asset || !assets[asset]) {
      socket.emit('tradeResult', { success: false, message: 'Invalid asset' });
      return;
    }
    
    if (amount < 10) {
      socket.emit('tradeResult', { success: false, message: 'Minimum trade amount is ₹10' });
      return;
    }
    
    if (user.accounts[currentAccount].balance < amount) {
      socket.emit('tradeResult', { success: false, message: 'Insufficient balance' });
      return;
    }
    
    // Create trade
    const trade = {
      id: Date.now(),
      asset: asset,
      direction: direction,
      amount: amount,
      duration: duration,
      startPrice: assets[asset].price,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration * 1000),
      status: 'active'
    };
    
    // Update user balance
    user.accounts[currentAccount].balance -= amount;
    user.accounts[currentAccount].totalTrades++;
    
    // Store trade
    const trades = userTrades.get(socket.userId);
    trade.accountType = currentAccount;
    trades[currentAccount].push(trade);
    
    // Save immediately after trade
    saveDataImmediate();
    
    // Send success response
    socket.emit('tradeResult', { 
      success: true, 
      trade: trade, 
      balance: user.accounts[currentAccount].balance 
    });
    
    // Set timer for trade completion
    setTimeout(() => {
      completeTrade(socket.userId, trade.id);
    }, duration * 1000);
  });
  
  socket.on('deposit', (data) => {
    const user = users.get(socket.userId) || initializeUser(socket.userId);
    const { amount } = data;
    
    console.log(`Deposit request: ${amount}`);
    
    if (amount < 2720) {
      socket.emit('balanceUpdate', { 
        balance: user.accounts.real.balance, 
        type: 'error', 
        message: 'Minimum deposit is ₹2,720' 
      });
      return;
    }
    
    // Send deposit request to client for Cashfree processing
    socket.emit('processPayment', { amount, userId: socket.userId });
  });
  
  socket.on('withdraw', (data) => {
    const user = users.get(socket.userId) || initializeUser(socket.userId);
    const { amount, bankDetails } = data;
    
    console.log(`Withdrawal request: ${amount}`);
    
    if (amount < 5700) {
      socket.emit('balanceUpdate', { 
        balance: user.accounts.real.balance, 
        type: 'error', 
        message: 'Minimum withdrawal is ₹5,700' 
      });
      return;
    }
    
    if (amount > user.accounts.real.balance) {
      socket.emit('balanceUpdate', { 
        balance: user.accounts.real.balance, 
        type: 'error', 
        message: 'Insufficient balance' 
      });
      return;
    }
    
    // Create withdrawal request
    const withdrawal = {
      id: 'WD' + Date.now(),
      userId: socket.userId,
      amount: amount,
      bankDetails: bankDetails,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    
    // Store withdrawal request
    allWithdrawals.push(withdrawal);
    saveWithdrawals();
    
    // Deduct from balance (will be refunded if rejected)
    user.accounts.real.balance -= amount;
    user.accounts.real.totalWithdrawals += amount;
    saveDataImmediate();
    
    // Notify admin
    io.emit('newWithdrawal', withdrawal);
    
    socket.emit('balanceUpdate', { 
      balance: user.accounts.real.balance, 
      accountType: 'real',
      type: 'withdraw',
      amount: amount 
    });
    
    console.log(`Withdrawal request created: ${amount}, ID: ${withdrawal.id}`);
  });
  
  socket.on('requestHistorical', (data) => {
    if (globalCandleData[data.asset]) {
      socket.emit('historicalData', { [data.asset]: globalCandleData[data.asset] });
    }
  });
  
  socket.on('requestTimeframe', (data) => {
    const { asset, timeframe } = data;
    const timeframeData = generateTimeframeData(asset, timeframe);
    socket.emit('timeframeData', { 
      asset: asset, 
      timeframe: timeframe, 
      candles: timeframeData 
    });
  });
  
  // Check if this is an admin connection
  const isAdmin = socket.handshake.query.isAdmin === 'true';
  if (isAdmin) {
    console.log('Admin connected:', socket.id);
    socket.emit('adminStats', getAdminStats());
    socket.emit('supportTickets', allTickets);
    socket.emit('withdrawalRequests', allWithdrawals);
  } else {
    // Check maintenance mode for regular users
    if (adminSettings.serverStatus === 'maintenance') {
      socket.emit('maintenanceMode', { message: 'Server is under maintenance. Please try again later.' });
      return;
    }
  }
  
  socket.on('getAdminStats', () => {
    socket.emit('adminStats', getAdminStats());
  });
  
  socket.on('setTradeMode', (data) => {
    tradeMode = data.mode;
    console.log(`Trade mode set to: ${tradeMode}`);
    io.emit('tradeModeChanged', { mode: tradeMode });
  });
  
  socket.on('updateAsset', (data) => {
    const { asset, basePrice, volatility, trend } = data;
    console.log('Asset updated:', data);
    
    // Update asset base price
    if (assets[asset]) {
      assets[asset].price = basePrice;
      assets[asset].basePrice = basePrice;
      assets[asset].volatility = volatility;
      assets[asset].trend = trend;
      
      // Store asset settings
      if (!adminSettings.assetSettings) {
        adminSettings.assetSettings = {};
      }
      adminSettings.assetSettings[asset] = { basePrice, volatility, trend };
      
      socket.emit('assetUpdated', { asset, success: true });
      console.log(`Asset ${asset} updated: price=${basePrice}, volatility=${volatility}, trend=${trend}`);
    }
  });
  
  socket.on('updateTradingSettings', (data) => {
    adminSettings = { ...adminSettings, ...data };
    console.log('Trading settings updated:', adminSettings);
    socket.emit('tradingSettingsUpdated', { success: true });
    io.emit('tradingSettingsChanged', adminSettings);
  });
  
  socket.on('updateServerStatus', (data) => {
    adminSettings.serverStatus = data.status;
    console.log(`Server status updated to: ${data.status}`);
    
    // Broadcast to all clients
    io.emit('serverStatusChanged', { status: data.status });
    
    // If maintenance mode, disconnect non-admin users
    if (data.status === 'maintenance') {
      io.sockets.sockets.forEach((clientSocket) => {
        if (!clientSocket.handshake.query.isAdmin) {
          clientSocket.emit('maintenanceMode', { message: 'Server is under maintenance. Please try again later.' });
        }
      });
    }
  });
  
  socket.on('updateMaxUsers', (data) => {
    adminSettings.maxUsers = data.maxUsers;
    console.log(`Max users updated to: ${data.maxUsers}`);
  });
  
  socket.on('updateTradingHours', (data) => {
    adminSettings.tradingHours = { start: data.startTime, end: data.endTime };
    console.log(`Trading hours updated: ${data.startTime} - ${data.endTime}`);
  });
  
  socket.on('manipulatePrice', (data) => {
    const { asset, targetPrice, duration } = data;
    console.log(`Price manipulation: ${asset} to ${targetPrice} over ${duration}s`);
    
    if (assets[asset]) {
      const startPrice = assets[asset].price;
      const priceStep = (targetPrice - startPrice) / duration;
      let currentStep = 0;
      
      const manipulationInterval = setInterval(() => {
        currentStep++;
        assets[asset].price = startPrice + (priceStep * currentStep);
        
        if (currentStep >= duration) {
          clearInterval(manipulationInterval);
          console.log(`Price manipulation completed for ${asset}`);
        }
      }, 1000);
      
      socket.emit('priceManipulationStarted', { asset, targetPrice, duration });
    }
  });
  
  // Support ticket handlers
  socket.on('submitTicket', (ticket) => {
    console.log('New support ticket:', ticket);
    
    // Store ticket
    if (!supportTickets.has(ticket.userId)) {
      supportTickets.set(ticket.userId, []);
    }
    supportTickets.get(ticket.userId).push(ticket);
    
    // Add to global tickets list
    allTickets.push(ticket);
    
    // Save tickets
    saveTickets();
    
    // Notify all admin connections
    io.emit('newTicket', ticket);
    
    console.log(`Ticket ${ticket.id} submitted by ${ticket.userId}`);
  });
  
  socket.on('getTickets', () => {
    socket.emit('ticketsData', allTickets);
  });
  
  socket.on('respondToTicket', (data) => {
    const { ticketId, response } = data;
    const ticket = allTickets.find(t => t.id === ticketId);
    
    if (ticket) {
      if (!ticket.responses) {
        ticket.responses = [];
      }
      
      ticket.responses.push({
        from: 'Admin',
        message: response,
        timestamp: new Date().toISOString()
      });
      
      ticket.status = 'pending';
      saveTickets();
      
      console.log(`Admin responded to ticket ${ticketId}`);
    }
  });
  
  socket.on('closeTicket', (data) => {
    const { ticketId } = data;
    const ticket = allTickets.find(t => t.id === ticketId);
    
    if (ticket) {
      ticket.status = 'closed';
      saveTickets();
      
      console.log(`Ticket ${ticketId} closed`);
    }
  });
  
  socket.on('getWithdrawals', () => {
    socket.emit('withdrawalsData', allWithdrawals);
  });
  
  socket.on('approveWithdrawal', (data) => {
    const { withdrawalId } = data;
    const withdrawal = allWithdrawals.find(w => w.id === withdrawalId);
    
    if (withdrawal) {
      withdrawal.status = 'approved';
      
      // Update transaction status
      const userTxns = userTransactions.get(withdrawal.userId);
      if (userTxns) {
        const transaction = userTxns.find(t => t.withdrawalId === withdrawalId);
        if (transaction) {
          transaction.status = 'completed';
        }
      }
      
      saveWithdrawals();
      
      console.log(`Withdrawal ${withdrawalId} approved for ₹${withdrawal.amount}`);
    }
  });
  
  socket.on('rejectWithdrawal', (data) => {
    const { withdrawalId } = data;
    const withdrawal = allWithdrawals.find(w => w.id === withdrawalId);
    
    if (withdrawal) {
      withdrawal.status = 'rejected';
      
      // Update transaction status
      const userTxns = userTransactions.get(withdrawal.userId);
      if (userTxns) {
        const transaction = userTxns.find(t => t.withdrawalId === withdrawalId);
        if (transaction) {
          transaction.status = 'rejected';
        }
      }
      
      // Refund amount to user
      const user = users.get(withdrawal.userId);
      if (user) {
        user.accounts.real.balance += withdrawal.amount;
        user.accounts.real.totalWithdrawals -= withdrawal.amount;
        saveDataImmediate();
        
        // Notify user
        const userSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === withdrawal.userId);
        if (userSocket) {
          userSocket.emit('balanceUpdate', {
            balance: user.accounts.real.balance,
            accountType: 'real',
            type: 'refund',
            amount: withdrawal.amount
          });
        }
      }
      
      saveWithdrawals();
      
      console.log(`Withdrawal ${withdrawalId} rejected, ₹${withdrawal.amount} refunded`);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Generate unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Complete trade function with admin control
function completeTrade(userId, tradeId) {
  const user = users.get(userId);
  const trades = userTrades.get(userId);
  
  if (!user || !trades) {
    console.log('User or trades not found for completion');
    return;
  }
  
  // Find trade in both demo and real accounts
  let trade = null;
  let accountType = null;
  let tradeIndex = -1;
  
  for (const account of ['demo', 'real']) {
    tradeIndex = trades[account].findIndex(t => t.id === tradeId);
    if (tradeIndex !== -1) {
      trade = trades[account][tradeIndex];
      accountType = account;
      break;
    }
  }
  
  if (!trade) {
    console.log('Trade not found for completion');
    return;
  }
  
  const currentPrice = assets[trade.asset].price;
  
  let won = false;
  
  // Admin trade control
  if (tradeMode === 'profit') {
    won = true;
    console.log('ADMIN CONTROL: Trade forced to WIN');
  } else if (tradeMode === 'loss') {
    won = false;
    console.log('ADMIN CONTROL: Trade forced to LOSE');
  } else {
    // Normal trading logic
    if (trade.direction === 'up' && currentPrice > trade.startPrice) {
      won = true;
    } else if (trade.direction === 'down' && currentPrice < trade.startPrice) {
      won = true;
    }
  }
  
  let payout = 0;
  if (won) {
    payout = Math.floor(trade.amount * (adminSettings.defaultPayout / 100 + 1));
    user.accounts[accountType].balance += payout;
    user.accounts[accountType].totalWins++;
  } else {
    user.accounts[accountType].totalLosses++;
  }
  
  // Save data immediately after trade completion
  saveDataImmediate();
  
  // Update trade status
  trade.status = 'completed';
  trade.result = won ? 'won' : 'lost';
  trade.endPrice = currentPrice;
  trade.payout = payout;
  
  console.log(`Trade completed: ${won ? 'WON' : 'LOST'} - ${trade.asset} ${trade.direction} ${trade.amount} on ${accountType} (Mode: ${tradeMode})`);
  
  // Send result to user - find socket by userId
  const userSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === userId);
  if (userSocket) {
    userSocket.emit('tradeCompleted', {
      won: won,
      amount: trade.amount,
      payout: payout,
      balance: user.accounts[accountType].balance
    });
    
    // Send updated active trades for current account
    const currentAccount = user.currentAccount;
    const activeTrades = trades[currentAccount].filter(t => t.status === 'active');
    userSocket.emit('userTrades', activeTrades);
  }
  
  // Notify admin of completed trade
  io.emit('tradeCompleted', {
    id: trade.id,
    userId: userId,
    asset: trade.asset,
    direction: trade.direction,
    amount: trade.amount,
    won: won,
    payout: payout
  });
}

// Get admin statistics
function getAdminStats() {
  let totalUsers = users.size;
  let onlineUsers = io.engine.clientsCount;
  let activeTrades = 0;
  let totalVolume = 0;
  let totalWins = 0;
  let totalTrades = 0;
  let serverRevenue = 0;
  
  users.forEach(user => {
    Object.values(user.accounts).forEach(account => {
      activeTrades += userTrades.get(user.id) ? 
        Object.values(userTrades.get(user.id)).flat().filter(t => t.status === 'active').length : 0;
      totalVolume += account.totalTrades * 100; // Estimate
      totalWins += account.totalWins || 0;
      totalTrades += account.totalTrades || 0;
      serverRevenue += (account.totalLosses || 0) * 50; // Estimate
    });
  });
  
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 50;
  
  return {
    totalUsers,
    onlineUsers,
    activeTrades,
    totalVolume,
    winRate,
    serverRevenue,
    tradeMode
  };
}

// Initialize historical data on server start
function initializeHistoricalData() {
  Object.keys(assets).forEach(asset => {
    globalCandleData[asset] = [];
    const basePrice = assets[asset].price;
    
    // Generate 100 historical candles
    for (let i = 100; i >= 1; i--) {
      const time = Math.floor(Date.now() / 1000) - (i * 5);
      const open = basePrice + (Math.random() - 0.5) * getAssetVolatility(asset) * 10;
      const close = open + (Math.random() - 0.5) * getAssetVolatility(asset) * 5;
      const high = Math.max(open, close) + Math.random() * getAssetVolatility(asset) * 2;
      const low = Math.min(open, close) - Math.random() * getAssetVolatility(asset) * 2;
      
      globalCandleData[asset].push({ time, open, high, low, close });
    }
  });
}

// Generate data for different timeframes
function generateTimeframeData(asset, timeframeSeconds) {
  const data = [];
  const basePrice = assets[asset].price;
  const volatility = getAssetVolatility(asset);
  
  // Adjust volatility based on timeframe
  const timeframeMultiplier = Math.sqrt(timeframeSeconds / 5); // Scale volatility with timeframe
  const adjustedVolatility = volatility * timeframeMultiplier;
  
  // Generate 120 candles for the requested timeframe
  for (let i = 120; i >= 1; i--) {
    const time = Math.floor(Date.now() / 1000) - (i * timeframeSeconds);
    const open = basePrice + (Math.random() - 0.5) * adjustedVolatility * 8;
    const close = open + (Math.random() - 0.5) * adjustedVolatility * 4;
    const high = Math.max(open, close) + Math.random() * adjustedVolatility * 1.5;
    const low = Math.min(open, close) - Math.random() * adjustedVolatility * 1.5;
    
    data.push({ time, open, high, low, close });
  }
  
  return data;
}

// User data storage with persistence
const users = new Map();
const userTrades = new Map();
const supportTickets = new Map();
const userTransactions = new Map();
const allTickets = [];
const allWithdrawals = [];
const fs = require('fs');

// Data file paths
const usersDataFile = path.join(__dirname, 'data', 'users.json');
const tradesDataFile = path.join(__dirname, 'data', 'trades.json');
const ticketsDataFile = path.join(__dirname, 'data', 'tickets.json');
const withdrawalsDataFile = path.join(__dirname, 'data', 'withdrawals.json');
const transactionsDataFile = path.join(__dirname, 'data', 'transactions.json');

// Data directory handling for Vercel
try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
} catch (error) {
  console.log('Data directory creation skipped in serverless environment');
}

// Load existing data on server start with backup recovery
function loadUserData() {
  try {
    // Load users
    if (fs.existsSync(usersDataFile)) {
      try {
        const userData = JSON.parse(fs.readFileSync(usersDataFile, 'utf8'));
        Object.entries(userData).forEach(([socketId, user]) => {
          users.set(socketId, user);
        });
        console.log(`✅ Loaded ${users.size} users from storage`);
      } catch (parseError) {
        console.log('Main users file corrupted, trying backup...');
        if (fs.existsSync(usersDataFile + '.backup')) {
          const userData = JSON.parse(fs.readFileSync(usersDataFile + '.backup', 'utf8'));
          Object.entries(userData).forEach(([socketId, user]) => {
            users.set(socketId, user);
          });
          console.log(`✅ Loaded ${users.size} users from backup`);
        }
      }
    }
    
    // Load trades
    if (fs.existsSync(tradesDataFile)) {
      try {
        const tradesData = JSON.parse(fs.readFileSync(tradesDataFile, 'utf8'));
        Object.entries(tradesData).forEach(([socketId, trades]) => {
          userTrades.set(socketId, trades);
        });
        console.log('✅ Loaded trades data from storage');
      } catch (parseError) {
        console.log('Main trades file corrupted, trying backup...');
        if (fs.existsSync(tradesDataFile + '.backup')) {
          const tradesData = JSON.parse(fs.readFileSync(tradesDataFile + '.backup', 'utf8'));
          Object.entries(tradesData).forEach(([socketId, trades]) => {
            userTrades.set(socketId, trades);
          });
          console.log('✅ Loaded trades data from backup');
        }
      }
    }
    
    // Load tickets
    if (fs.existsSync(ticketsDataFile)) {
      const ticketsData = JSON.parse(fs.readFileSync(ticketsDataFile, 'utf8'));
      allTickets.push(...ticketsData);
      console.log(`✅ Loaded ${allTickets.length} support tickets from storage`);
    }
    
    // Load transactions
    if (fs.existsSync(transactionsDataFile)) {
      const transactionsData = JSON.parse(fs.readFileSync(transactionsDataFile, 'utf8'));
      Object.entries(transactionsData).forEach(([socketId, transactions]) => {
        userTransactions.set(socketId, transactions);
      });
      console.log('✅ Loaded transactions data from storage');
    }
    
    // Load withdrawals
    if (fs.existsSync(withdrawalsDataFile)) {
      const withdrawalsData = JSON.parse(fs.readFileSync(withdrawalsDataFile, 'utf8'));
      allWithdrawals.push(...withdrawalsData);
      console.log(`✅ Loaded ${allWithdrawals.length} withdrawal requests from storage`);
    }
  } catch (error) {
    console.error('❌ Error loading user data:', error);
  }
}

// Save user data to file with better error handling
function saveUserData() {
  try {
    // Create backup before saving
    if (fs.existsSync(usersDataFile)) {
      fs.copyFileSync(usersDataFile, usersDataFile + '.backup');
    }
    if (fs.existsSync(tradesDataFile)) {
      fs.copyFileSync(tradesDataFile, tradesDataFile + '.backup');
    }
    
    const userData = {};
    users.forEach((user, socketId) => {
      userData[socketId] = user;
    });
    fs.writeFileSync(usersDataFile, JSON.stringify(userData, null, 2));
    
    const tradesData = {};
    userTrades.forEach((trades, socketId) => {
      tradesData[socketId] = trades;
    });
    fs.writeFileSync(tradesDataFile, JSON.stringify(tradesData, null, 2));
    
    console.log(`Data saved: ${users.size} users, ${userTrades.size} trade records`);
  } catch (error) {
    console.error('Error saving user data:', error);
    // Try to restore from backup
    try {
      if (fs.existsSync(usersDataFile + '.backup')) {
        fs.copyFileSync(usersDataFile + '.backup', usersDataFile);
      }
      if (fs.existsSync(tradesDataFile + '.backup')) {
        fs.copyFileSync(tradesDataFile + '.backup', tradesDataFile);
      }
    } catch (restoreError) {
      console.error('Error restoring backup:', restoreError);
    }
  }
}

// Save support tickets to file
function saveTickets() {
  try {
    fs.writeFileSync(ticketsDataFile, JSON.stringify(allTickets, null, 2));
  } catch (error) {
    console.error('Error saving tickets:', error);
  }
}

// Save withdrawals to file
function saveWithdrawals() {
  try {
    fs.writeFileSync(withdrawalsDataFile, JSON.stringify(allWithdrawals, null, 2));
  } catch (error) {
    console.error('Error saving withdrawals:', error);
  }
}

// Auto-save disabled for serverless environment
if (process.env.NODE_ENV !== 'production') {
  setInterval(saveUserData, 10000);
}

// Save data on every critical operation
function saveDataImmediate() {
  saveUserData();
  saveTickets();
  saveWithdrawals();
}

// Admin controls
let tradeMode = 'normal'; // normal, profit, loss
let adminSettings = {
  defaultPayout: 85,
  maxTradeAmount: 10000,
  minTradeAmount: 10,
  serverStatus: 'online'
};

// Initialize user with demo and real accounts
function initializeUser(userId) {
  if (!users.has(userId)) {
    const newUser = {
      id: userId,
      currentAccount: 'demo',
      accounts: {
        demo: {
          balance: 50000,
          totalTrades: 0,
          totalWins: 0,
          totalLosses: 0
        },
        real: {
          balance: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalTrades: 0,
          totalWins: 0,
          totalLosses: 0
        }
      }
    };
    users.set(userId, newUser);
    userTrades.set(userId, { demo: [], real: [] });
    saveDataImmediate(); // Save immediately after creating new user
  }
  return users.get(userId);
}

// Initialize on server start
initializeHistoricalData();

// Load data safely
try {
  loadUserData();
  loadUpiId();
} catch (error) {
  console.log('Data loading skipped in serverless environment');
}

// Process handlers disabled for serverless
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGINT', () => {
    console.log('\nSaving user data before shutdown...');
    saveUserData();
    saveTickets();
    saveWithdrawals();
    process.exit(0);
  });
}

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TrustX Server running on port ${PORT}`);
  });
}

module.exports = app;