const assert = require("node:assert/strict");
const { calculateParkingFee, PARKING_RATE_PER_HOUR } = require("../utils/parkingFee");

const entry = new Date("2026-01-01T00:00:00.000Z");

assert.equal(PARKING_RATE_PER_HOUR, 20_000);
assert.equal(calculateParkingFee(entry, entry), 20_000);
assert.equal(calculateParkingFee(entry, new Date(entry.getTime() + 1)), 20_000);
assert.equal(calculateParkingFee(entry, new Date(entry.getTime() + 60 * 60 * 1000)), 20_000);
assert.equal(calculateParkingFee(entry, new Date(entry.getTime() + 60 * 60 * 1000 + 1)), 40_000);
assert.throws(() => calculateParkingFee("invalid", entry), TypeError);
assert.throws(() => calculateParkingFee(entry, new Date(entry.getTime() - 1)), RangeError);

console.log("parkingFee tests passed");
