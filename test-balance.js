const database = require('./lib/database');

async function testBalance() {
  try {
    console.log('Testing balance system...');
    
    // Create test user
    const testUser = await database.createUser({
      username: 'testuser123',
      realBalance: 0,
      demoBalance: 50000,
      totalDeposits: 0
    });
    
    console.log('Created test user:', testUser);
    
    // Update balance
    await database.updateUser(testUser.id, {
      realBalance: 1000,
      totalDeposits: 1000
    });
    
    // Check updated balance
    const updatedUser = await database.getUserByUsername('testuser123');
    console.log('Updated user balance:', {
      realBalance: updatedUser.realBalance,
      demoBalance: updatedUser.demoBalance,
      totalDeposits: updatedUser.totalDeposits
    });
    
    console.log('Balance system test completed successfully!');
  } catch (error) {
    console.error('Balance test failed:', error);
  }
}

testBalance();