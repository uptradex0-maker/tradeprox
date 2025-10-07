const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const BalanceManager = require('./balance-system');

const app = express();

app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const DATA_DIR = path.join(__dirname, 'data');

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

// Routes
app.get('/', (req, res) => res.render('dashboard'));
app.get('/dashboard', (req, res) => res.render('dashboard'));

// Trade endpoint
app.post('/api/trade', async (req, res) => {
  console.log('Trade request:', req.body);
  try {
    const { userId, asset, direction, amount, duration, accountType, startPrice } = req.body;
    
    const tradeAmount = parseFloat(amount);
    const account = accountType || 'demo';
    
    const hasBalance = await BalanceManager.hasEnoughBalance(userId, tradeAmount, account);
    if (!hasBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
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
    
    const trades = await readJSON(path.join(DATA_DIR, 'trades.json'));
    trades.push(trade);
    await writeJSON(path.join(DATA_DIR, 'trades.json'), trades);
    
    res.json({ success: true, trade, balance: newBalance });
  } catch (error) {
    console.error('Trade error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Balance endpoint
app.get('/api/balance/:userId', async (req, res) => {
  try {
    const balance = await BalanceManager.getBalance(req.params.userId);
    res.json({ success: true, ...balance });
  } catch (error) {
    res.json({ success: true, realBalance: 0, demoBalance: 50000, currentAccount: 'demo' });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));