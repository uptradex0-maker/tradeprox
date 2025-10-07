// Admin Panel JavaScript - Complete Implementation

// Check authentication on load
document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('admin_authenticated') !== 'true') {
        window.location.href = '/admin-login';
        return;
    }
    
    // Initialize admin panel
    initializeAdminPanel();
});

function initializeAdminPanel() {
    console.log('Admin Panel Initialized');
    loadStats();
    
    // Auto-refresh stats every 10 seconds
    setInterval(loadStats, 10000);
}

// Tab switching function
function switchTab(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // Load data based on tab
    switch(tabName) {
        case 'users':
            loadUsers();
            break;
        case 'withdrawals':
            loadWithdrawals();
            break;
        case 'dashboard':
            loadStats();
            break;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
            document.getElementById('onlineUsers').textContent = stats.onlineUsers || 0;
            document.getElementById('activeTrades').textContent = stats.activeTrades || 0;
            document.getElementById('totalVolume').textContent = (stats.totalVolume || 0).toLocaleString();
            document.getElementById('serverRevenue').textContent = (stats.serverRevenue || 0).toLocaleString();
            document.getElementById('winRate').textContent = stats.winRate || 50;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
        showNotification('Failed to load statistics', 'error');
    }
}

// Load users
async function loadUsers() {
    const container = document.getElementById('usersTable');
    container.innerHTML = '<div class="loading">Loading users...</div>';

    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();

        if (data.success) {
            const users = Object.values(data.users);

            if (users.length === 0) {
                container.innerHTML = '<div class="empty-state">No users found</div>';
                return;
            }

            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>Demo Balance</th>
                            <th>Real Balance</th>
                            <th>Total Trades</th>
                            <th>Win/Loss</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Display online users
            const onlineUsersHtml = Object.values(data.onlineUsers || {}).map(onlineUser => {
                return `<tr>
                    <td>${onlineUser.username}</td>
                    <td><span class="status online">Online</span></td>
                    <td>${new Date(onlineUser.lastSeen).toLocaleString()}</td>
                    <td>-</td>
                </tr>`;
            }).join('');
            document.getElementById('onlineUsersTable').innerHTML = onlineUsersHtml;

            // Populate deposit dropdown with all users showing IDs clearly
            const depositSelect = document.getElementById('depositUserId');
            let selectHtml = '<option value="">Select User (ID - Username - Status)</option>';

            users.forEach(user => {
                const status = user.status || 'active';
                const username = user.username || 'N/A';
                selectHtml += `<option value="${user.id}">${user.id} - ${username} - ${status.toUpperCase()}</option>`;
            });
            depositSelect.innerHTML = selectHtml;

            users.forEach(user => {
                const status = user.status || 'active';
                const demoTrades = user.accounts.demo.totalTrades || 0;
                const realTrades = user.accounts.real.totalTrades || 0;
                const totalTrades = demoTrades + realTrades;
                const wins = (user.accounts.demo.totalWins || 0) + (user.accounts.real.totalWins || 0);
                const losses = (user.accounts.demo.totalLosses || 0) + (user.accounts.real.totalLosses || 0);

                html += `
                    <tr>
                        <td title="${user.id}">${user.id.substring(0, 20)}...</td>
                        <td>₹${user.accounts.demo.balance.toLocaleString()}</td>
                        <td>₹${user.accounts.real.balance.toLocaleString()}</td>
                        <td>${totalTrades}</td>
                        <td>${wins}/${losses}</td>
                        <td><span class="status-badge status-${status}">${status.toUpperCase()}</span></td>
                        <td>
                            ${status === 'active' ?
                                `<button class="btn btn-danger" onclick="toggleUserStatus('${user.id}', 'deactivate')">Deactivate</button>` :
                                `<button class="btn btn-success" onclick="toggleUserStatus('${user.id}', 'activate')">Activate</button>`
                            }
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        container.innerHTML = '<div class="empty-state">Failed to load users</div>';
        showNotification('Failed to load users', 'error');
    }
}

// Toggle user status
async function toggleUserStatus(userId, action) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/${action}`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            loadUsers();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to update user status:', error);
        showNotification('Failed to update user status', 'error');
    }
}

// Submit admin deposit
async function submitAdminDeposit() {
    const userId = document.getElementById('depositUserId').value.trim();
    const amount = document.getElementById('depositAmount').value;
    const accountType = document.getElementById('depositAccountType').value;

    if (!userId || !amount) {
        showNotification('Please fill all fields', 'error');
        return;
    }

    if (parseFloat(amount) <= 0) {
        showNotification('Amount must be greater than 0', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount: parseFloat(amount), accountType })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(data.message, 'success');
            document.getElementById('depositUserId').value = '';
            document.getElementById('depositAmount').value = '';
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to process deposit:', error);
        showNotification('Failed to process deposit', 'error');
    }
}

// Load withdrawals
async function loadWithdrawals() {
    const container = document.getElementById('withdrawalsList');
    container.innerHTML = '<div class="loading">Loading withdrawals...</div>';
    
    try {
        const response = await fetch('/api/admin/withdrawals');
        const data = await response.json();
        
        if (data.success) {
            const withdrawals = data.withdrawals;
            
            if (withdrawals.length === 0) {
                container.innerHTML = '<div class="empty-state">No withdrawal requests found</div>';
                return;
            }
            
            let html = '';
            withdrawals.forEach(withdrawal => {
                html += `
                    <div class="withdrawal-card">
                        <div class="withdrawal-header">
                            <div class="withdrawal-amount">₹${withdrawal.amount.toLocaleString()}</div>
                            <span class="status-badge status-${withdrawal.status}">${withdrawal.status.toUpperCase()}</span>
                        </div>
                        <p><strong>User ID:</strong> ${withdrawal.userId}</p>
                        <p><strong>Requested:</strong> ${new Date(withdrawal.timestamp).toLocaleString()}</p>
                        ${withdrawal.bankDetails ? `
                            <div style="margin-top: 10px; padding: 10px; background: #1e2329; border-radius: 8px;">
                                <p><strong>Bank:</strong> ${withdrawal.bankDetails.bankName}</p>
                                <p><strong>Account:</strong> ${withdrawal.bankDetails.accountNumber}</p>
                                <p><strong>IFSC:</strong> ${withdrawal.bankDetails.ifscCode}</p>
                                <p><strong>Holder:</strong> ${withdrawal.bankDetails.accountHolder}</p>
                            </div>
                        ` : ''}
                        ${withdrawal.status === 'pending' ? `
                            <div style="margin-top: 15px;">
                                <button class="btn btn-success" onclick="approveWithdrawal('${withdrawal.id}')">✓ Approve</button>
                                <button class="btn btn-danger" onclick="rejectWithdrawal('${withdrawal.id}')">✗ Reject</button>
                            </div>
                        ` : ''}
                        ${withdrawal.status === 'approved' ? `
                            <p style="margin-top: 10px; color: #02c076;"><strong>Approved at:</strong> ${new Date(withdrawal.approvedAt).toLocaleString()}</p>
                        ` : ''}
                        ${withdrawal.status === 'rejected' ? `
                            <p style="margin-top: 10px; color: #f84960;"><strong>Rejected at:</strong> ${new Date(withdrawal.rejectedAt).toLocaleString()}</p>
                        ` : ''}
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Failed to load withdrawals:', error);
        container.innerHTML = '<div class="empty-state">Failed to load withdrawals</div>';
        showNotification('Failed to load withdrawals', 'error');
    }
}

// Approve withdrawal
async function approveWithdrawal(id) {
    if (!confirm('Are you sure you want to approve this withdrawal?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/withdrawals/${id}/approve`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            loadWithdrawals();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to approve withdrawal:', error);
        showNotification('Failed to approve withdrawal', 'error');
    }
}

// Reject withdrawal
async function rejectWithdrawal(id) {
    if (!confirm('Are you sure you want to reject this withdrawal? The amount will be refunded to the user.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/withdrawals/${id}/reject`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            loadWithdrawals();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to reject withdrawal:', error);
        showNotification('Failed to reject withdrawal', 'error');
    }
}

async function saveSettings() {
    const maintenanceMode = document.getElementById('maintenanceMode').value;
    const tradingStatus = document.getElementById('tradingStatus').value;
    const maxTradeAmount = document.getElementById('maxTradeAmount').value;
    const minTradeAmount = document.getElementById('minTradeAmount').value;

    try {
        // Save maintenance mode to backend
        const response = await fetch('/api/admin/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maintenanceMode })
        });
        const data = await response.json();
        if (!data.success) {
            showNotification('Failed to save maintenance mode', 'error');
            return;
        }
    } catch (error) {
        showNotification('Failed to save maintenance mode', 'error');
        return;
    }

    // Save other settings locally or send to backend as needed
    const settings = {
        tradingStatus,
        maxTradeAmount,
        minTradeAmount
    };
    
    localStorage.setItem('admin_settings', JSON.stringify(settings));
    showNotification('Settings saved successfully', 'success');
}

// Load settings including maintenance mode from backend
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/maintenance');
        const data = await response.json();
        if (data.success) {
            document.getElementById('maintenanceMode').value = data.maintenanceMode;
        }
    } catch (error) {
        showNotification('Failed to load maintenance mode', 'error');
    }

    const settings = JSON.parse(localStorage.getItem('admin_settings') || '{}');
    
    if (settings.tradingStatus) {
        document.getElementById('tradingStatus').value = settings.tradingStatus;
    }
    if (settings.maxTradeAmount) {
        document.getElementById('maxTradeAmount').value = settings.maxTradeAmount;
    }
    if (settings.minTradeAmount) {
        document.getElementById('minTradeAmount').value = settings.minTradeAmount;
    }
}

// Load settings
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('admin_settings') || '{}');
    
    if (settings.maintenanceMode) {
        document.getElementById('maintenanceMode').value = settings.maintenanceMode;
    }
    if (settings.tradingStatus) {
        document.getElementById('tradingStatus').value = settings.tradingStatus;
    }
    if (settings.maxTradeAmount) {
        document.getElementById('maxTradeAmount').value = settings.maxTradeAmount;
    }
    if (settings.minTradeAmount) {
        document.getElementById('minTradeAmount').value = settings.minTradeAmount;
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('admin_authenticated');
        localStorage.removeItem('admin_username');
        window.location.href = '/admin-login';
    }
}

// Toggle maintenance mode
function toggleMaintenance() {
    const currentMode = localStorage.getItem('maintenance_mode') || 'off';
    const newMode = currentMode === 'off' ? 'on' : 'off';
    
    localStorage.setItem('maintenance_mode', newMode);
    showNotification(`Maintenance mode ${newMode === 'on' ? 'enabled' : 'disabled'}`, 'success');
}

// Export functions for global access
window.switchTab = switchTab;
window.loadStats = loadStats;
window.loadUsers = loadUsers;
window.toggleUserStatus = toggleUserStatus;
window.submitAdminDeposit = submitAdminDeposit;
window.loadWithdrawals = loadWithdrawals;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.saveSettings = saveSettings;
window.logout = logout;
window.toggleMaintenance = toggleMaintenance;
