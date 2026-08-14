process.env.TELEGRAM_DRY_RUN = "true";
process.env.TELEGRAM_ADMIN_CHAT_ID ||= "admin-dry-run";

const assert = require("assert");
const {
  sendUserNotification,
  sendAdminNotification,
  notifyParkingTooLong,
} = require("../service/telegramService");
const { recordRFIDScan, notifySystemError } = require("../service/notificationMonitorService");

async function run() {
  const userTypes = ["LOW_BALANCE", "PARKING_TOO_LONG", "PAYMENT_SUCCESS"];
  for (const type of userTypes) {
    assert.strictEqual(await sendUserNotification({
      chatId: "user-dry-run",
      type,
      data: { uid: "TEST1234", fee: 20000, balance: 5000, entryTime: new Date(), durationMs: 9 * 60 * 60 * 1000 },
    }), true);
  }

  const adminTypes = ["RFID_SPAM", "PARKING_TOO_LONG", "SYSTEM_ERROR", "DEVICE_RESTARTED", "DEVICE_OFFLINE", "DEVICE_ONLINE"];
  for (const type of adminTypes) {
    assert.strictEqual(await sendAdminNotification({
      type,
      data: { uid: "TEST1234", count: 5, seconds: 10, source: "test", message: "Kiểm tra hệ thống", deviceId: "esp32-test", resetReason: "test", reason: "test", entryTime: new Date(), durationMs: 9 * 60 * 60 * 1000 },
    }), true);
  }

  const combined = await notifyParkingTooLong({
    userChatId: "user-dry-run",
    uid: "TEST1234",
    entryTime: new Date(),
    durationMs: 9 * 60 * 60 * 1000,
  });
  assert.strictEqual(combined.length, 2);
  assert.ok(combined.every((result) => result.status === "fulfilled" && result.value === true));

  for (let index = 0; index < 4; index += 1) {
    assert.strictEqual(recordRFIDScan({ uid: "SPAMTEST", deviceId: "test-device" }), false);
  }
  assert.strictEqual(recordRFIDScan({ uid: "SPAMTEST", deviceId: "test-device" }), true);
  assert.strictEqual(recordRFIDScan({ uid: "SPAMTEST", deviceId: "test-device" }), false);
  assert.strictEqual(await notifySystemError("test", "Kiểm tra cooldown"), true);
  assert.strictEqual(await notifySystemError("test", "Kiểm tra cooldown"), false);

  console.log("Notification dry-run passed: user=3, admin=6, combined=2, spam/cooldown=passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
