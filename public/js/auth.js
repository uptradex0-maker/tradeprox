// Authentication JavaScript

// Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Mock authentication - replace with real API call
    if (username && password) {
        // Store user session (in real app, use JWT tokens)
        localStorage.setItem('user', JSON.stringify({
            username: username,
            balance: 10000,
            loginTime: new Date().toISOString()
        }));
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
    } else {
        alert('Please enter username and password');
    }
});

// Register Form Handler
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    // Mock registration - replace with real API call
    const userData = {
        username: username,
        email: email,
        balance: 0,
        registrationTime: new Date().toISOString()
    };
    
    localStorage.setItem('user', JSON.stringify(userData));
    alert('Registration successful! Please login.');
    window.location.href = '/';
});

// Username availability check
document.getElementById('username')?.addEventListener('input', function(e) {
    const username = e.target.value;
    const statusElement = document.getElementById('usernameStatus');
    
    if (username.length < 3) {
        statusElement.textContent = '';
        return;
    }
    
    // Mock availability check - replace with real API call
    setTimeout(() => {
        const isAvailable = !['admin', 'test', 'user', 'demo'].includes(username.toLowerCase());
        
        if (isAvailable) {
            statusElement.textContent = '✓ Available';
            statusElement.className = 'availability available';
        } else {
            statusElement.textContent = '✗ Taken';
            statusElement.className = 'availability taken';
        }
    }, 500);
});

// Check if user is logged in
function checkAuth() {
    const user = localStorage.getItem('user');
    if (!user && window.location.pathname === '/dashboard') {
        window.location.href = '/';
    }
    return user ? JSON.parse(user) : null;
}

// Logout function
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Initialize auth check on page load
document.addEventListener('DOMContentLoaded', function() {
    const user = checkAuth();
    
    // Update balance display if on dashboard
    if (user && document.getElementById('userBalance')) {
        document.getElementById('userBalance').textContent = user.balance.toLocaleString();
    }
});