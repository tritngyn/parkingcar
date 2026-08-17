const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const PARKING_RATE_PER_HOUR = 20_000;

/** Calculate the parking fee in VND, rounding every started hour up. */
function calculateParkingFee(entryTime, exitTime = new Date()) {
  const entryMs = new Date(entryTime).getTime();
  const exitMs = new Date(exitTime).getTime();

  if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) {
    throw new TypeError("entryTime and exitTime must be valid dates");
  }
  if (exitMs < entryMs) {
    throw new RangeError("exitTime must not be before entryTime");
  }

  const billedHours = Math.max(1, Math.ceil((exitMs - entryMs) / MILLISECONDS_PER_HOUR));
  return billedHours * PARKING_RATE_PER_HOUR;
}

module.exports = { MILLISECONDS_PER_HOUR, PARKING_RATE_PER_HOUR, calculateParkingFee };
