// Admin Panel JavaScript with Full Functionality

let socket;
let currentTradeMode = 'normal';
let adminStats = {
    totalUsers: 0,
    onlineUsers: 0,
    activeTrades: 0,
    totalVolume: 0,
    serverRevenue: 0
};

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Check admin authentication
    if (localStorage.getItem('admin_authenticated') !== 'true') {
        window.location.href = '/admin-login';
        return;
    }
    
    initializeSocket();
    loadAdminData();
    startStatsUpdate();
});

// Socket connection for admin
function initializeSocket() {
    socket = io({
        query: { 
            isAdmin: true,
            adminUsername: localStorage.getItem('admin_username') || 'admin'
        }
    });
    
    socket.on('connect', function() {
        console.log('Admin connected to server');
        requestAdminData();
    });
    
    socket.on('adminStats', function(stats) {
        updateAdminStats(stats);
    });
    
    socket.on('newTrade', function(trade) {
        addTradeToTable(trade);
        updateStats();
    });
    
    socket.on('tradeCompleted', function(trade) {
        updateTradeInTable(trade);
        updateStats();
    });
    
    socket.on('supportTickets', function(tickets) {
        displayTickets(tickets);
    });
    
    socket.on('withdrawalRequests', function(withdrawals) {
        displayWithdrawals(withdrawals);
    });
    
    socket.on('assetUpdated', function(data) {
        showNotification(`Asset ${data.asset} updated successfully`, 'success');
    });
    
    socket.on('tradingSettingsUpdated', function(data) {
        showNotification('Trading settings updated successfully', 'success');
    });
}

// Asset Management Functions
function updateAsset(asset) {
    const basePrice = parseFloat(document.getElementById(`base-${asset}`).value);
    const volatility = parseFloat(document.getElementById(`vol-${asset}`).value);
    const trend = document.getElementById(`trend-${asset}`).value;
    
    const assetData = {
        asset: asset,
        basePrice: basePrice,
        volatility: volatility,
        trend: trend
    };
    
    if (socket && socket.connected) {
        socket.emit('updateAsset', assetData);
        showNotification(`Updating ${asset}...`, 'info');
    } else {
        showNotification('Not connected to server', 'error');
    }
}

// Trading Settings
function updateTradingSettings() {
    const settings = {
        defaultPayout: parseInt(document.getElementById('defaultPayout').value),
        maxTradeAmount: parseInt(document.getElementById('maxTradeAmount').value),
        minTradeAmount: parseInt(document.getElementById('minTradeAmount').value)
    };
    
    if (socket && socket.connected) {
        socket.emit('updateTradingSettings', settings);
        showNotification('Updating trading settings...', 'info');
    } else {
        showNotification('Not connected to server', 'error');
    }
}

// Trade Control Functions
function setTradeMode(mode) {
    currentTradeMode = mode;
    
    // Update UI
    document.querySelectorAll('.control-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode === 'loss' ? 'lossBtn' : mode === 'profit' ? 'profitBtn' : 'normalBtn').classList.add('active');
    document.getElementById('currentMode').textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    
    // Send to server
    if (socket && socket.connected) {
        socket.emit('setTradeMode', { mode: mode });
        showNotification(`Trade mode set to: ${mode}`, 'success');
    }
}

// Price Manipulation
function manipulatePrice() {
    const asset = document.getElementById('manipulateAsset').value;
    const targetPrice = parseFloat(document.getElementById('targetPrice').value);
    const duration = parseInt(document.getElementById('manipulateDuration').value);
    
    if (!targetPrice || targetPrice <= 0) {
        showNotification('Please enter a valid target price', 'error');
        return;
    }
    
    const manipulationData = {
        asset: asset,
        targetPrice: targetPrice,
        duration: duration
    };
    
    if (socket && socket.connected) {
        socket.emit('manipulatePrice', manipulationData);
        showNotification(`Manipulating ${asset} price to ${targetPrice} for ${duration}s`, 'info');
    }
}

// System Settings
function updateServerStatus() {
    const status = document.getElementById('serverStatus').value;
    
    if (socket && socket.connected) {
        socket.emit('updateServerStatus', { status: status });
        
        if (status === 'maintenance') {
            showNotification('⚠️ Server entering maintenance mode - All users will be notified', 'info');
        } else if (status === 'online') {
            showNotification('✅ Server is now online', 'success');
        } else if (status === 'offline') {
            showNotification('🔴 Server marked as offline', 'error');
        }
    } else {
        showNotification('Not connected to server', 'error');
    }
}

function updateMaxUsers() {
    const maxUsers = parseInt(document.getElementById('maxUsers').value);
    
    if (socket && socket.connected) {
        socket.emit('updateMaxUsers', { maxUsers: maxUsers });
        showNotification(`Max users limit set to: ${maxUsers}`, 'success');
    }
}

function updateTradingHours() {
    const startTime = document.getElementById('tradingStart').value;
    const endTime = document.getElementById('tradingEnd').value;
    
    if (socket && socket.connected) {
        socket.emit('updateTradingHours', { 
            startTime: startTime, 
            endTime: endTime 
        });
        showNotification(`Trading hours updated: ${startTime} - ${endTime}`, 'success');
    }
}

// Statistics Functions
function updateAdminStats(stats) {
    adminStats = stats;
    
    document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
    document.getElementById('onlineUsers').textContent = stats.onlineUsers || 0;
    document.getElementById('liveActiveTrades').textContent = stats.activeTrades || 0;
    document.getElementById('totalVolume').textContent = (stats.totalVolume || 0).toLocaleString();
    document.getElementById('profitLossRatio').textContent = `${stats.winRate || 50}/${100 - (stats.winRate || 50)}`;
    document.getElementById('serverRevenue').textContent = (stats.serverRevenue || 0).toLocaleString();
    document.getElementById('activeTradesCount').textContent = stats.activeTrades || 0;
}

function updateStats() {
    if (socket && socket.connected) {
        socket.emit('getAdminStats');
    }
}

// Trades Table Functions
function addTradeToTable(trade) {
    const tableBody = document.getElementById('tradesTableBody');
    const row = document.createElement('tr');
    row.id = `trade-${trade.id}`;
    
    row.innerHTML = `
        <td>${new Date(trade.startTime).toLocaleTimeString()}</td>
        <td>${trade.userId.substring(0, 8)}...</td>
        <td>${trade.asset}</td>
        <td class="${trade.direction}">${trade.direction.toUpperCase()}</td>
        <td>₹${trade.amount}</td>
        <td class="pending">Pending</td>
        <td>-</td>
    `;
    
    tableBody.insertBefore(row, tableBody.firstChild);
    
    // Keep only last 50 trades
    while (tableBody.children.length > 50) {
        tableBody.removeChild(tableBody.lastChild);
    }
}

function updateTradeInTable(trade) {
    const row = document.getElementById(`trade-${trade.id}`);
    if (row) {
        const resultCell = row.children[5];
        const payoutCell = row.children[6];
        
        resultCell.textContent = trade.won ? 'Won' : 'Lost';
        resultCell.className = trade.won ? 'won' : 'lost';
        payoutCell.textContent = trade.won ? `₹${trade.payout}` : `₹${trade.amount}`;
    }
}

// Support Tickets Functions
function showTicketsModal() {
    document.getElementById('ticketsModal').style.display = 'block';
    loadTickets();
}

function loadTickets() {
    if (socket && socket.connected) {
        socket.emit('getTickets');
    }
    
    // Load from localStorage as backup
    const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    displayTickets(tickets);
}

function displayTickets(tickets) {
    const container = document.getElementById('ticketsList');
    const filter = document.getElementById('ticketFilter').value;
    
    let filteredTickets = tickets;
    if (filter !== 'all') {
        filteredTickets = tickets.filter(t => t.status === filter);
    }
    
    if (filteredTickets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #ccc; padding: 20px;">No tickets found</p>';
        return;
    }
    
    container.innerHTML = filteredTickets.map(ticket => `
        <div class="ticket-item" onclick="showTicketDetails('${ticket.id}')">
            <div class="ticket-header">
                <span class="ticket-id">#${ticket.id}</span>
                <span class="ticket-status ${ticket.status}">${ticket.status.toUpperCase()}</span>
            </div>
            <div class="ticket-subject">${ticket.subject}</div>
            <div class="ticket-meta">
                ${ticket.category} • ${new Date(ticket.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');
}

function showTicketDetails(ticketId) {
    const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (!ticket) return;
    
    document.getElementById('ticketDetails').innerHTML = `
        <div class="ticket-info">
            <h3>Ticket #${ticket.id}</h3>
            <p><strong>Category:</strong> ${ticket.category}</p>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <p><strong>User:</strong> ${ticket.userId}</p>
            <p><strong>Status:</strong> <span class="ticket-status ${ticket.status}">${ticket.status.toUpperCase()}</span></p>
            <p><strong>Created:</strong> ${new Date(ticket.timestamp).toLocaleString()}</p>
            <div class="ticket-message">
                <strong>Message:</strong><br>
                ${ticket.message}
            </div>
        </div>
    `;
    
    document.getElementById('ticketDetailsModal').style.display = 'block';
    window.currentTicketId = ticketId;
}

function respondToTicket() {
    const response = document.getElementById('adminResponse').value.trim();
    if (!response) {
        showNotification('Please enter a response', 'error');
        return;
    }
    
    const ticketId = window.currentTicketId;
    
    if (socket && socket.connected) {
        socket.emit('respondToTicket', {
            ticketId: ticketId,
            response: response,
            adminUsername: localStorage.getItem('admin_username')
        });
    }
    
    // Update local storage
    const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex !== -1) {
        tickets[ticketIndex].status = 'pending';
        tickets[ticketIndex].adminResponse = response;
        tickets[ticketIndex].responseTime = new Date().toISOString();
        localStorage.setItem('support_tickets', JSON.stringify(tickets));
    }
    
    showNotification('Response sent successfully', 'success');
    document.getElementById('adminResponse').value = '';
    closeModal('ticketDetailsModal');
    loadTickets();
}

function closeTicket() {
    const ticketId = window.currentTicketId;
    
    if (socket && socket.connected) {
        socket.emit('closeTicket', { ticketId: ticketId });
    }
    
    // Update local storage
    const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex !== -1) {
        tickets[ticketIndex].status = 'closed';
        tickets[ticketIndex].closedTime = new Date().toISOString();
        localStorage.setItem('support_tickets', JSON.stringify(tickets));
    }
    
    showNotification('Ticket closed successfully', 'success');
    closeModal('ticketDetailsModal');
    loadTickets();
}

function filterTickets() {
    loadTickets();
}

// Withdrawals Functions
function showWithdrawalsModal() {
    document.getElementById('withdrawalsModal').style.display = 'block';
    loadWithdrawals();
}

function loadWithdrawals() {
    if (socket && socket.connected) {
        socket.emit('getWithdrawals');
    }
    
    // Load from localStorage as backup
    const withdrawals = JSON.parse(localStorage.getItem('withdrawal_requests') || '[]');
    displayWithdrawals(withdrawals);
}

function displayWithdrawals(withdrawals) {
    const container = document.getElementById('withdrawalsList');
    const filter = document.getElementById('withdrawalFilter').value;
    
    let filteredWithdrawals = withdrawals;
    if (filter !== 'all') {
        filteredWithdrawals = withdrawals.filter(w => w.status === filter);
    }
    
    if (filteredWithdrawals.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #ccc; padding: 20px;">No withdrawal requests found</p>';
        return;
    }
    
    container.innerHTML = filteredWithdrawals.map(withdrawal => `
        <div class="withdrawal-item">
            <div class="withdrawal-header">
                <span class="withdrawal-amount">₹${withdrawal.amount}</span>
                <span class="withdrawal-status ${withdrawal.status}">${withdrawal.status.toUpperCase()}</span>
            </div>
            <div class="withdrawal-details">
                <strong>User:</strong> ${withdrawal.userId}<br>
                <strong>Requested:</strong> ${new Date(withdrawal.timestamp).toLocaleString()}
            </div>
            <div class="bank-details">
                <strong>Bank:</strong> ${withdrawal.bankDetails.bankName}<br>
                <strong>Account:</strong> ${withdrawal.bankDetails.accountNumber}<br>
                <strong>IFSC:</strong> ${withdrawal.bankDetails.ifscCode}<br>
                <strong>Holder:</strong> ${withdrawal.bankDetails.accountHolder}
            </div>
            ${withdrawal.status === 'pending' ? `
                <div class="withdrawal-actions">
                    <button onclick="approveWithdrawal('${withdrawal.id}')" class="approve-btn">Approve</button>
                    <button onclick="rejectWithdrawal('${withdrawal.id}')" class="reject-btn">Reject</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function approveWithdrawal(withdrawalId) {
    if (socket && socket.connected) {
        socket.emit('approveWithdrawal', { withdrawalId: withdrawalId });
    }
    
    // Update local storage
    const withdrawals = JSON.parse(localStorage.getItem('withdrawal_requests') || '[]');
    const withdrawalIndex = withdrawals.findIndex(w => w.id === withdrawalId);
    if (withdrawalIndex !== -1) {
        withdrawals[withdrawalIndex].status = 'approved';
        withdrawals[withdrawalIndex].approvedTime = new Date().toISOString();
        localStorage.setItem('withdrawal_requests', JSON.stringify(withdrawals));
    }
    
    showNotification('Withdrawal approved successfully', 'success');
    loadWithdrawals();
}

function rejectWithdrawal(withdrawalId) {
    if (socket && socket.connected) {
        socket.emit('rejectWithdrawal', { withdrawalId: withdrawalId });
    }
    
    // Update local storage
    const withdrawals = JSON.parse(localStorage.getItem('withdrawal_requests') || '[]');
    const withdrawalIndex = withdrawals.findIndex(w => w.id === withdrawalId);
    if (withdrawalIndex !== -1) {
        withdrawals[withdrawalIndex].status = 'rejected';
        withdrawals[withdrawalIndex].rejectedTime = new Date().toISOString();
        localStorage.setItem('withdrawal_requests', JSON.stringify(withdrawals));
    }
    
    showNotification('Withdrawal rejected', 'info');
    loadWithdrawals();
}

function filterWithdrawals() {
    loadWithdrawals();
}

// Utility Functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1001;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        ${
            type === 'success' ? 'background: linear-gradient(135deg, #00ff88, #00cc6a);' :
            type === 'error' ? 'background: linear-gradient(135deg, #ff4444, #cc3333);' :
            'background: linear-gradient(135deg, #00d4ff, #5200ff);'
        }
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function requestAdminData() {
    if (socket && socket.connected) {
        socket.emit('getAdminStats');
        socket.emit('getRecentTrades');
    }
}

function loadAdminData() {
    // Load initial data
    updateStats();
    
    // Generate some sample trades for demo
    generateSampleTrades();
}

function generateSampleTrades() {
    const assets = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD'];
    const directions = ['up', 'down'];
    const tableBody = document.getElementById('tradesTableBody');
    
    for (let i = 0; i < 10; i++) {
        const trade = {
            id: 'demo_' + Date.now() + '_' + i,
            userId: 'user_' + Math.random().toString(36).substr(2, 8),
            asset: assets[Math.floor(Math.random() * assets.length)],
            direction: directions[Math.floor(Math.random() * directions.length)],
            amount: Math.floor(Math.random() * 1000) + 100,
            startTime: new Date(Date.now() - Math.random() * 3600000),
            won: Math.random() > 0.5,
            payout: 0
        };
        
        trade.payout = trade.won ? Math.floor(trade.amount * 1.85) : trade.amount;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${trade.startTime.toLocaleTimeString()}</td>
            <td>${trade.userId.substring(0, 8)}...</td>
            <td>${trade.asset}</td>
            <td class="${trade.direction}">${trade.direction.toUpperCase()}</td>
            <td>₹${trade.amount}</td>
            <td class="${trade.won ? 'won' : 'lost'}">${trade.won ? 'Won' : 'Lost'}</td>
            <td>₹${trade.payout}</td>
        `;
        
        tableBody.appendChild(row);
    }
}

function startStatsUpdate() {
    // Update stats every 5 seconds
    setInterval(() => {
        // Simulate live stats
        adminStats.onlineUsers = Math.floor(Math.random() * 50) + 10;
        adminStats.activeTrades = Math.floor(Math.random() * 20) + 5;
        adminStats.totalVolume += Math.floor(Math.random() * 10000);
        adminStats.serverRevenue += Math.floor(Math.random() * 1000);
        
        updateAdminStats(adminStats);
    }, 5000);
}

// Logout function
function adminLogout() {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_username');
    window.location.href = '/admin-login';
}

// Add logout button functionality
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.admin-header .admin-nav');
    if (header) {
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = '🚪 Logout';
        logoutBtn.onclick = adminLogout;
        logoutBtn.style.cssText = `
            background: #ff4444;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        `;
        header.appendChild(logoutBtn);
    }
});