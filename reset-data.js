const fs = require('fs');
const path = require('path');

// Delete all data files
const dataDir = path.join(__dirname, 'data');

if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    files.forEach(file => {
        const filePath = path.join(dataDir, file);
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${file}`);
    });
    console.log('✅ All user data and trades reset successfully!');
} else {
    console.log('No data directory found.');
}

console.log('🚀 Ready for production deployment!');