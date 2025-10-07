let selectedPaymentMethod = '';
let depositAmount = 0;

// Crypto addresses
const cryptoAddresses = {
    btc: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    usdt: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5oREqjK',
    eth: '0x742d35Cc6634C0532925a3b8D4C9db96590b5c8e',
    sol: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
};

document.addEventListener('DOMContentLoaded', function() {
    loadUserBalance();
    loadUserId();
});

function loadUserBalance() {
    // Get balance from localStorage or default
    const balance = localStorage.getItem('user_balance') || '0';
    document.getElementById('currentBalance').textContent = balance;
}

function loadUserId() {
    const userId = localStorage.getItem('tradepro_user_id') || localStorage.getItem('tradepro_username');
    if (!userId) {
        console.error('User ID not found in localStorage');
        return;
    }
    const userIdDisplay = document.getElementById('userIdDisplay');
    if (userIdDisplay) {
        userIdDisplay.textContent = userId;
    }
}

function setAmount(amount) {
    document.getElementById('depositAmount').value = amount;
}

function selectPayment(method) {
    selectedPaymentMethod = method;
    depositAmount = parseInt(document.getElementById('depositAmount').value) || 0;
    
    if (depositAmount < 2720) {
        showNotification('Minimum deposit amount is ₹2,720', 'error');
        return;
    }
    
    switch(method) {
        case 'upi':
        case 'paytm':
        case 'phonepe':
        case 'gpay':
            showUPIModal();
            break;
        case 'amazon':
            showNotification('Amazon Pay coming soon!', 'info');
            return;
        case 'btc':
        case 'usdt':
        case 'eth':
        case 'sol':
            showNotification('Crypto payments coming soon!', 'info');
            return;
        case 'bank':
            showNotification('Bank transfer coming soon!', 'info');
            return;
        default:
            showNotification('Payment method coming soon!', 'info');
    }
}

function showUPIModal() {
    document.getElementById('upiAmount').textContent = depositAmount;
    
    // Get QR code from server
    fetch('/get-qr-code')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('qrCodeImage').src = data.qrCode;
        }
    })
    .catch(() => {
        document.getElementById('qrCodeImage').src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZTwvdGV4dD48L3N2Zz4=';
    });
    
    document.getElementById('upiModal').style.display = 'block';
}

// Listen for QR code updates from admin
if (typeof io !== 'undefined') {
    const socket = io();
    
    socket.on('qrCodeUpdated', function(data) {
        // Update QR code in modal if it's open
        const qrImage = document.getElementById('qrCodeImage');
        if (qrImage) {
            qrImage.src = data.qrCode;
        }
        showNotification('QR Code updated by admin', 'info');
    });
}

function showCryptoModal(crypto) {
    const cryptoNames = {
        btc: 'Bitcoin (BTC)',
        usdt: 'USDT (TRC20)',
        eth: 'Ethereum (ETH)',
        sol: 'Solana (SOL)'
    };
    
    document.getElementById('cryptoTitle').textContent = `${cryptoNames[crypto]} Payment`;
    document.getElementById('cryptoAmount').textContent = depositAmount;
    document.getElementById('cryptoAddress').value = cryptoAddresses[crypto];
    document.getElementById('cryptoModal').style.display = 'block';
    
    // Generate QR code (placeholder)
    document.getElementById('qrCode').innerHTML = `
        <div style="width: 150px; height: 150px; background: #f0f0f0; margin: 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
            <span style="color: #666;">QR Code<br>${crypto.toUpperCase()}</span>
        </div>
    `;
}

function closePaymentModal() {
    document.getElementById('upiModal').style.display = 'none';
    document.getElementById('cryptoModal').style.display = 'none';
}

function submitUTR() {
    const utrNumber = document.getElementById('utrNumber').value.trim();
    
    if (!utrNumber || utrNumber.length !== 12) {
        showNotification('Please enter valid 12-digit UTR number', 'error');
        return;
    }
    
    // Submit deposit request
    fetch('/submit-deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: depositAmount,
            utr: utrNumber,
            userId: localStorage.getItem('tradepro_user_id')
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification('Order has been submitted! Waiting for admin approval.', 'success');
            closePaymentModal();
            document.getElementById('utrNumber').value = '';
        } else {
            showNotification(data.message || 'Failed to submit request', 'error');
        }
    })
    .catch(() => showNotification('Network error. Please try again.', 'error'));
}



function copyAddress() {
    const addressInput = document.getElementById('cryptoAddress');
    addressInput.select();
    document.execCommand('copy');
    showNotification('Address copied to clipboard!', 'success');
}

function confirmCryptoPayment() {
    showNotification('Payment confirmation received! Processing...', 'info');
    
    // Simulate crypto payment processing
    setTimeout(() => {
        const currentBalance = parseInt(localStorage.getItem('user_balance') || '0');
        const newBalance = currentBalance + depositAmount;
        localStorage.setItem('user_balance', newBalance.toString());
        loadUserBalance();
        showNotification(`₹${depositAmount} deposited successfully!`, 'success');
        closePaymentModal();
    }, 3000);
}

function showBankTransferInfo() {
    const bankInfo = `
        Bank Transfer Details:
        
        Account Name: TrustX Trading
        Account Number: 1234567890
        IFSC Code: HDFC0001234
        Bank: HDFC Bank
        Branch: Mumbai Main
        
        Please transfer ₹${depositAmount} and send screenshot to support.
    `;
    
    alert(bankInfo);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
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
        animation: slideIn 0.3s ease;
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
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function goBack() {
    window.history.back();
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);