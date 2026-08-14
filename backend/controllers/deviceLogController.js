const DeviceLog = require("../models/DeviceLog");

exports.getDeviceLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = {};

    if (req.query.component) filter.component = req.query.component;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;

    const [data, total] = await Promise.all([
      DeviceLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      DeviceLog.countDocuments(filter),
    ]);

    res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
