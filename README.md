# TradePro - Binary Options Trading Platform

Quotex aur Pocket Option jaisi professional trading app with real-time charts aur complete admin control.

## Features

### User Features
- **Real-time Trading Charts** - Live price updates with Socket.io
- **Multiple Assets** - EUR/USD, GBP/USD, USD/JPY, BTC/USD, ETH/USD
- **Multiple Timeframes** - 5s, 10s, 15s, 30s, 1m, 5m
- **User Authentication** - Username/password with availability check
- **Deposit/Withdrawal** - Cashfree integration (₹2,720 min deposit, ₹5,700 min withdrawal)
- **Live Trading** - Binary options with 85% payout
- **Responsive Design** - Mobile-friendly interface

### Admin Features
- **Asset Control** - Control base prices, volatility, and trends
- **Trading Settings** - Configure payouts and trade limits
- **User Statistics** - Real-time user and trading stats
- **Price Manipulation** - Manual price control for testing

## Installation

1. **Install Dependencies**
```bash
npm install
```

2. **Start Development Server**
```bash
npm run dev
```

3. **Start Production Server**
```bash
npm start
```

## Usage

### User Access
- **Login**: http://localhost:3000/
- **Register**: http://localhost:3000/register
- **Dashboard**: http://localhost:3000/dashboard

### Admin Access
- **Admin Panel**: http://localhost:3000/admin

## Technology Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript, Chart.js
- **Real-time**: WebSocket connections
- **Database**: MongoDB (to be integrated)
- **Payment**: Cashfree Payment Gateway

## File Structure

```
tradig/
├── server.js              # Main server file
├── package.json           # Dependencies
├── views/                 # EJS templates
│   ├── login.ejs         # Login page
│   ├── register.ejs      # Registration page
│   ├── dashboard.ejs     # Trading dashboard
│   └── admin.ejs         # Admin panel
├── public/               # Static files
│   ├── css/
│   │   └── style.css     # All styles
│   └── js/
│       ├── auth.js       # Authentication
│       ├── dashboard.js  # Trading logic
│       └── admin.js      # Admin controls
└── README.md
```

## Next Steps (Database Integration)

1. **MongoDB Setup**
   - User management
   - Trade history
   - Asset configurations
   - Payment records

2. **Cashfree Integration**
   - Real payment processing
   - Webhook handling
   - Transaction logging

3. **Security Enhancements**
   - JWT authentication
   - Rate limiting
   - Input validation
   - HTTPS setup

## Demo Credentials

**User Login**: Any username/password combination
**Admin Access**: Direct URL access to /admin

## Features Implemented

✅ Modern UI similar to Quotex
✅ Real-time price updates
✅ Interactive trading charts
✅ Multiple assets and timeframes
✅ User authentication system
✅ Trading functionality
✅ Admin control panel
✅ Deposit/withdrawal UI
✅ Responsive design

## Coming Soon

🔄 MongoDB database integration
✅ Cashfree payment gateway
🔄 JWT authentication
🔄 Trade history
🔄 User profiles
🔄 Advanced charting tools# Trade
