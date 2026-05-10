const Database = require('better-sqlite3');
const SIPPSyncService = require('./services/sippSyncService');

async function testService() {
    try {
        const db = new Database(':memory:');
        const service = new SIPPSyncService(db);
        console.log('Testing service.fetchSIPPData()...');
        const data = await service.fetchSIPPData();
        console.log('Parsed data count:', data.length);
        if (data.length > 0) {
            console.log('First item:', data[0]);
        }
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testService();
