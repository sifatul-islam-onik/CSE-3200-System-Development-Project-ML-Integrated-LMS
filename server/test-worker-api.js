// Test script for Worker Management API
// Run with: node test-worker-api.js

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-jwt-token-here';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Helper function to log results
function logResult(title, data) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  console.log(JSON.stringify(data, null, 2));
}

// Test functions
async function testGetAllWorkers() {
  try {
    const response = await api.get('/api/workers');
    logResult('📋 All Workers', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error getting workers:', error.response?.data || error.message);
  }
}

async function testGetWorkerStats() {
  try {
    const response = await api.get('/api/workers/stats');
    logResult('📊 Worker Statistics', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error getting stats:', error.response?.data || error.message);
  }
}

async function testAddWorker(workerId, url, name) {
  try {
    const response = await api.post('/api/workers', {
      workerId,
      url,
      name,
      description: `Test worker ${name}`
    });
    logResult(`➕ Add Worker: ${name}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error adding worker ${name}:`, error.response?.data || error.message);
  }
}

async function testCheckWorkerHealth(workerId) {
  try {
    const response = await api.post(`/api/workers/${workerId}/health-check`);
    logResult(`🏥 Health Check: ${workerId}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error checking health for ${workerId}:`, error.response?.data || error.message);
  }
}

async function testCheckAllWorkersHealth() {
  try {
    const response = await api.post('/api/workers/health-check-all');
    logResult('🏥 Health Check: All Workers', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error checking all workers health:', error.response?.data || error.message);
  }
}

async function testSetWorkerStatus(workerId, isActive) {
  try {
    const response = await api.patch(`/api/workers/${workerId}/status`, { isActive });
    logResult(`⚙️  Set Worker Status: ${workerId} (${isActive ? 'enabled' : 'disabled'})`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error setting worker status:`, error.response?.data || error.message);
  }
}

async function testSetLoadBalanceStrategy(strategy) {
  try {
    const response = await api.patch('/api/workers/config/load-balance-strategy', { strategy });
    logResult(`⚖️  Set Load Balance Strategy: ${strategy}`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error setting load balance strategy:', error.response?.data || error.message);
  }
}

async function testRemoveWorker(workerId) {
  try {
    const response = await api.delete(`/api/workers/${workerId}`);
    logResult(`🗑️  Remove Worker: ${workerId}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error removing worker ${workerId}:`, error.response?.data || error.message);
  }
}

async function testGetQueueStatus() {
  try {
    const response = await api.get('/api/ocr/queue-status');
    logResult('� OCR Server Status (Free/Busy)', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error getting server status:', error.response?.data || error.message);
  }
}

// Main test suite
async function runTests() {
  console.log('\n🚀 Starting Worker Management API Tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Using Admin Token: ${ADMIN_TOKEN.substring(0, 20)}...`);

  // Wait for user to press enter
  if (ADMIN_TOKEN === 'your-admin-jwt-token-here') {
    console.log('\n⚠️  WARNING: Using default token. Please set ADMIN_TOKEN environment variable.');
    console.log('   Get your token by logging in as admin and copying the JWT token.\n');
    console.log('   Usage: ADMIN_TOKEN=your_token node test-worker-api.js\n');
    process.exit(1);
  }

  try {
    // Test 1: Get all workers
    await testGetAllWorkers();
    await sleep(1000);

    // Test 2: Get worker statistics
    await testGetWorkerStats();
    await sleep(1000);

    // Test 3: Check all workers health
    await testCheckAllWorkersHealth();
    await sleep(1000);

    // Test 4: Add a test worker (optional - uncomment to test)
    // await testAddWorker('test-worker', 'http://localhost:9000', 'Test Worker');
    // await sleep(1000);

    // Test 5: Check specific worker health
    // await testCheckWorkerHealth('worker-1');
    // await sleep(1000);

    // Test 6: Set load balance strategy
    await testSetLoadBalanceStrategy('least-load');
    await sleep(1000);

    // Test 7: Set load balance strategy back
    await testSetLoadBalanceStrategy('round-robin');
    await sleep(1000);

    // Test 8: Get OCR server status (free/busy)
    await testGetQueueStatus();
    await sleep(1000);

    // Test 9: Disable/Enable worker (optional - uncomment to test)
    // await testSetWorkerStatus('worker-1', false);
    // await sleep(2000);
    // await testSetWorkerStatus('worker-1', true);
    // await sleep(1000);

    // Test 10: Remove test worker (optional - uncomment to test)
    // await testRemoveWorker('test-worker');

    console.log('\n✅ All tests completed!\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
runTests();
