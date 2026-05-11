/**
 * Debug Device Status Timing
 * Diagnoses why device shows offline despite recent polls
 */

const BACKEND_URL = "https://fingerprint-attendance-system-6b1s.onrender.com";

const TEST_ADMIN = {
  email: "admin@attendance.com",
  password: "Admin@123"
};

let authToken = null;

async function login() {
  const url = `${BACKEND_URL}/api/auth/login`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_ADMIN),
    });
    if (!response.ok) return false;
    const data = await response.json();
    authToken = data.token;
    return true;
  } catch {
    return false;
  }
}

async function debugDeviceStatus() {
  if (!authToken) return;

  try {
    console.log(`\n🔍 DEBUGGING DEVICE STATUS TIMING\n`);
    
    // First poll to ensure device is "active"
    console.log("📡 Step 1: Sending ESP32 poll...");
    const pollResponse = await fetch(`${BACKEND_URL}/api/device/mode`);
    const pollData = await pollResponse.json();
    console.log(`✅ Poll successful`);
    
    // Wait 1 second
    await new Promise(r => setTimeout(r, 1000));

    // Check status
    const statusResponse = await fetch(`${BACKEND_URL}/api/device/status`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const statusData = await statusResponse.json();
    const device = statusData.device;

    console.log(`\n📊 Device Status Data:`);
    console.log(`  lastPollTime (ISO): ${device.lastPollTime}`);
    console.log(`  isOnline: ${device.isOnline}`);

    // Calculate timing locally
    const pollTimeMs = new Date(device.lastPollTime).getTime();
    const nowMs = Date.now();
    const diffMs = nowMs - pollTimeMs;

    console.log(`\n⏱️  TIMING CALCULATION:`);
    console.log(`  Last Poll Time (ms): ${pollTimeMs}`);
    console.log(`  Current Time (ms): ${nowMs}`);
    console.log(`  Difference: ${diffMs}ms`);
    console.log(`  Timeout threshold: 10000ms`);
    console.log(`  Should be online? ${diffMs < 10000}`);

    if (diffMs < 0) {
      console.log("\n⚠️  ERROR: Poll time is in the FUTURE!");
      console.log("    This suggests backend and client time are out of sync.");
    } else if (diffMs > 10000) {
      console.log("\n⚠️  TIMEOUT: More than 10 seconds since poll!");
      console.log(`    Device went offline ${diffMs - 10000}ms ago`);
    } else {
      console.log(`\n✅ Device should be ONLINE (${10000 - diffMs}ms before timeout)`);
      if (!device.isOnline) {
        console.log("   BUT backend says isOnline = false");
        console.log("   BUG: Backend online calculation is broken!");
      }
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  Device Status Debug");
  console.log("═══════════════════════════════════════════");
  
  const ok = await login();
  if (ok) {
    await debugDeviceStatus();
  } else {
    console.log("Login failed");
  }
}

run();
