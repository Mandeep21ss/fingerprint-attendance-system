/**
 * Check Device Status with Authentication
 * Gets the current device online/offline status via backend API
 */

const BACKEND_URL = "https://fingerprint-attendance-system-6b1s.onrender.com";

// Test credentials (from backend seed.js defaults)
const TEST_ADMIN = {
  email: "admin@attendance.com",
  password: "Admin@123"
};

let authToken = null;

async function login() {
  const url = `${BACKEND_URL}/api/auth/login`;
  
  try {
    console.log(`\n🔐 Logging in as: ${TEST_ADMIN.email}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_ADMIN.email,
        password: TEST_ADMIN.password,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Login failed: ${response.status} ${response.statusText}`);
      const error = await response.json();
      console.error("Error details:", error);
      return false;
    }

    const data = await response.json();
    authToken = data.token;
    console.log(`✅ Login successful!`);
    console.log(`📝 Token: ${authToken.substring(0, 20)}...`);
    return true;

  } catch (error) {
    console.error(`❌ Login Error:`, error.message);
    return false;
  }
}

async function checkDeviceStatus() {
  if (!authToken) {
    console.error("❌ No auth token. Cannot check status.");
    return;
  }

  const url = `${BACKEND_URL}/api/device/status`;
  
  try {
    console.log(`\n📊 Checking Device Status...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Status check failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`\n✅ Device Status:`);
    console.log(JSON.stringify(data.device, null, 2));

    // Check if online
    if (data.device.isOnline) {
      console.log("\n✅ DEVICE IS ONLINE! ✅");
    } else {
      console.log("\n❌ DEVICE IS OFFLINE ❌");
      console.log("\nℹ️  Reasons device shows offline:");
      console.log("  1. No poll received in last 10 seconds");
      console.log("  2. ESP32 not connected/not polling");
      console.log("  3. Backend restarted (resets poll time)");
    }

  } catch (error) {
    console.error(`❌ Status Check Error:`, error.message);
  }
}

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  Device Status Checker");
  console.log("═══════════════════════════════════════════");
  console.log(`Backend: ${BACKEND_URL}`);

  const loginOk = await login();
  if (!loginOk) {
    console.log("\n⚠️  Tip: Update TEST_ADMIN credentials in this script if using different admin account");
    return;
  }

  await checkDeviceStatus();
}

run();
