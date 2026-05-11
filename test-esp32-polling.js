/**
 * ESP32 Polling Simulator
 * Tests if backend /api/device/mode is working and returns online status
 */

const BACKEND_URL = "https://fingerprint-attendance-system-6b1s.onrender.com";
const DEVICE_LABEL = "ESP32-01";

async function pollServerForMode() {
  const url = `${BACKEND_URL}/api/device/mode`;
  
  try {
    console.log(`\n📡 Polling: GET ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Response Status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Response Data:`, JSON.stringify(data, null, 2));
    return true;

  } catch (error) {
    console.error(`❌ Poll Failed:`, error.message);
    return false;
  }
}

async function checkBackendHealth() {
  const healthUrl = `${BACKEND_URL}/api/health`;
  
  try {
    console.log(`\n🏥 Checking Backend Health: GET ${healthUrl}`);
    const response = await fetch(healthUrl);
    const data = await response.json();
    console.log(`✅ Backend Health:`, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Health Check Failed:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log("═══════════════════════════════════════════");
  console.log("  ESP32 Polling Simulator - Backend Test");
  console.log("═══════════════════════════════════════════");
  console.log(`Backend: ${BACKEND_URL}`);

  // Check health first
  const healthOk = await checkBackendHealth();
  if (!healthOk) {
    console.error("\n❌ Backend is not responding. Check if it's deployed and running.");
    return;
  }

  // Simulate 5 polls (like real ESP32)
  console.log("\n📍 Starting 5 simulated polls (like ESP32 every 3 seconds)...\n");

  for (let i = 1; i <= 5; i++) {
    console.log(`\n─── Poll #${i} ───`);
    await pollServerForMode();
    
    if (i < 5) {
      console.log("⏳ Waiting 3 seconds before next poll...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ Test Complete!");
  console.log("═══════════════════════════════════════════");
  console.log("\nℹ️  If polls succeeded:");
  console.log("  1. Backend is working");
  console.log("  2. Device should show ONLINE in frontend");
  console.log("  3. Refresh frontend page if still shows offline");
  console.log("\nℹ️  If polls failed:");
  console.log("  1. Backend is down or unreachable");
  console.log("  2. Check Render deployment status");
  console.log("  3. Check network/firewall issues");
}

runTests();
