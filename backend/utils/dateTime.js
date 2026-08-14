const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Trả về ISO 8601 theo giờ Việt Nam, ví dụ:
 * 2026-08-14T01:58:06.888+07:00
 */
function toVietnamISOString(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Việt Nam dùng UTC+7 quanh năm và không áp dụng daylight saving time.
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${vietnamTime.toISOString().slice(0, -1)}+07:00`;
}

module.exports = { VIETNAM_TIME_ZONE, toVietnamISOString };
