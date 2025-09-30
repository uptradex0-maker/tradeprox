# TradePro - Binary Options Trading Platform

## Quick Deploy to Vercel

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel --prod
```

## Features
- Real-time trading with Socket.io
- Mobile responsive design
- Admin panel for deposit approval
- User deposit system with UTR verification
- Live candlestick charts
- Demo and Real accounts

## Admin Panel
Access: `/admin`
- View deposit requests
- Approve/reject deposits
- Real-time balance updates

## Deposit Flow
1. User deposits money
2. Submits UTR/Transaction ID
3. Admin approves request
4. Balance updated in real account

## Tech Stack
- Node.js + Express
- Socket.io for real-time
- EJS templates
- Vanilla JavaScript