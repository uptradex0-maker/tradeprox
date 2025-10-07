// Test script for the balance system
const BalanceManager = require('./balance-system');

async function testBalanceSystem() {
    console.log('🧪 Testing Balance System...\n');
    
    const testUserId = 'test_user_' + Date.now();
    
    try {
        // Test 1: Get initial balance
        console.log('1. Testing initial balance...');
        const initialBalance = await BalanceManager.getBalance(testUserId);
        console.log('Initial balance:', initialBalance);
        console.assert(initialBalance.demoBalance === 50000, 'Demo balance should be 50000');
        console.assert(initialBalance.realBalance === 0, 'Real balance should be 0');
        console.log('✅ Initial balance test passed\n');
        
        // Test 2: Add money to demo account
        console.log('2. Testing demo balance addition...');
        const demoAdd = await BalanceManager.addMoney(testUserId, 1000, 'demo');
        console.log('After adding ₹1000 to demo:', demoAdd);
        console.assert(demoAdd.demoBalance === 51000, 'Demo balance should be 51000');
        console.log('✅ Demo addition test passed\n');
        
        // Test 3: Add money to real account
        console.log('3. Testing real balance addition...');
        const realAdd = await BalanceManager.addMoney(testUserId, 5000, 'real');
        console.log('After adding ₹5000 to real:', realAdd);
        console.assert(realAdd.realBalance === 5000, 'Real balance should be 5000');
        console.assert(realAdd.totalDeposits === 5000, 'Total deposits should be 5000');
        console.log('✅ Real addition test passed\n');
        
        // Test 4: Deduct from demo account
        console.log('4. Testing demo balance deduction...');
        const demoDeduct = await BalanceManager.deductMoney(testUserId, 500, 'demo');
        console.log('After deducting ₹500 from demo:', demoDeduct);
        console.assert(demoDeduct.demoBalance === 50500, 'Demo balance should be 50500');
        console.log('✅ Demo deduction test passed\n');
        
        // Test 5: Deduct from real account
        console.log('5. Testing real balance deduction...');
        const realDeduct = await BalanceManager.deductMoney(testUserId, 1000, 'real');
        console.log('After deducting ₹1000 from real:', realDeduct);
        console.assert(realDeduct.realBalance === 4000, 'Real balance should be 4000');
        console.log('✅ Real deduction test passed\n');
        
        // Test 6: Check sufficient balance
        console.log('6. Testing balance checks...');
        const hasEnough = await BalanceManager.hasEnoughBalance(testUserId, 3000, 'real');
        const hasNotEnough = await BalanceManager.hasEnoughBalance(testUserId, 5000, 'real');
        console.assert(hasEnough === true, 'Should have enough balance for ₹3000');
        console.assert(hasNotEnough === false, 'Should not have enough balance for ₹5000');
        console.log('✅ Balance check test passed\n');
        
        // Test 7: Switch account
        console.log('7. Testing account switching...');
        const switched = await BalanceManager.switchAccount(testUserId, 'real');
        console.log('After switching to real account:', switched);
        console.assert(switched.currentAccount === 'real', 'Current account should be real');
        console.log('✅ Account switch test passed\n');
        
        // Test 8: Prevent negative balance
        console.log('8. Testing negative balance prevention...');
        const overDeduct = await BalanceManager.deductMoney(testUserId, 10000, 'real');
        console.log('After trying to deduct ₹10000 from real (should be 0):', overDeduct);
        console.assert(overDeduct.realBalance === 0, 'Real balance should be 0 (not negative)');
        console.log('✅ Negative balance prevention test passed\n');
        
        console.log('🎉 All balance system tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testBalanceSystem().then(() => {
        console.log('\n✨ Balance system is working correctly!');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Balance system test failed:', error);
        process.exit(1);
    });
}

module.exports = testBalanceSystem;