const mqtt = require('mqtt');

async function runTests() {
  console.log("=== STARTING PARKING SYSTEM TESTS ===");

  let token = '';
  try {
    await fetch('http://localhost:5000/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testadmin', password: '123' })
    });
  } catch (e) {}

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: '123' })
  }).then(r => r.json());
  
  token = loginRes.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const UID_VIP = "VIP_123";
  const UID_GUEST = "GUEST_456";
  try {
    await fetch('http://localhost:5000/api/cards', {
      method: 'POST', headers, body: JSON.stringify({ uid: UID_VIP, balance: 100 })
    });
    await fetch('http://localhost:5000/api/cards', {
      method: 'POST', headers, body: JSON.stringify({ uid: UID_GUEST, balance: 0 })
    });
  } catch (e) {}

  const client = mqtt.connect('mqtt://127.0.0.1');
  client.on('connect', async () => {
    console.log("-> MQTT Connected. Simulating ESP32...");
    client.subscribe('parking/group17/gate/command');
    client.on('message', (topic, msg) => {
      if (topic === 'parking/group17/gate/command') {
        const cmd = JSON.parse(msg.toString());
        console.log(`\n[ESP32] Received command from Backend: ACTION=${cmd.action}, LANE=${cmd.lane}`);
      }
    });

    console.log("\n--- TEST CASE 1: VIP ENTRY ---");
    client.publish('parking/group17/rfid/scan', JSON.stringify({ eventId: "evt-in-1", deviceId: "esp-01", uid: UID_VIP, lane: "in" }));
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("\n--- TEST CASE 2: VIP EXIT (Has Balance) ---");
    client.publish('parking/group17/rfid/scan', JSON.stringify({ eventId: "evt-out-1", deviceId: "esp-01", uid: UID_VIP, lane: "out" }));
    await new Promise(r => setTimeout(r, 1000));

    console.log("\n--- TEST CASE 3: GUEST ENTRY ---");
    client.publish('parking/group17/rfid/scan', JSON.stringify({ eventId: "evt-in-2", deviceId: "esp-01", uid: UID_GUEST, lane: "in" }));
    await new Promise(r => setTimeout(r, 1000));

    console.log("\n--- TEST CASE 4: GUEST EXIT (No Balance) ---");
    client.publish('parking/group17/rfid/scan', JSON.stringify({ eventId: "evt-out-2", deviceId: "esp-01", uid: UID_GUEST, lane: "out" }));
    await new Promise(r => setTimeout(r, 1000));

    const activeRes = await fetch('http://localhost:5000/api/sessions/active', { headers }).then(r => r.json());
    console.log(`\nActive Sessions in DB:`, activeRes.map(s => ({uid: s.uid, status: s.status})));

    console.log("\n--- TEST CASE 5: ADMIN MANUAL CHECKOUT ---");
    const guestSession = activeRes.find(s => s.uid === UID_GUEST);
    if (guestSession) {
      console.log(`Admin clicks checkout for session: ${guestSession._id}`);
      await fetch(`http://localhost:5000/api/sessions/${guestSession._id}/checkout`, { method: 'POST', headers });
    }

    setTimeout(() => { client.end(); process.exit(0); }, 1000);
  });
}

runTests();
