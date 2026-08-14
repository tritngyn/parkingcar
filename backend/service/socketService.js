let ioInstance = null;
const assignmentScans = new Map();

const latestData = {
  rfid: null,
  device: {
    deviceId: null,
    status: "offline",
    receivedAt: null,
  },
  gates: {
    in: {
      status: "unknown",
      source: null,
      uid: null,
      fee: 0,
      receivedAt: null
    },
    out: {
      status: "unknown",
      source: null,
      uid: null,
      fee: 0,
      receivedAt: null
    }
  }
};

function initSocket(io) {
  ioInstance = io;
  return ioInstance;
}

function getIO() {
  return ioInstance;
}

function startAssignmentScan(socketId, durationMs = 60000) {
  stopAssignmentScan(socketId);
  const timer = setTimeout(() => assignmentScans.delete(socketId), durationMs);
  assignmentScans.set(socketId, timer);
}

function stopAssignmentScan(socketId) {
  const timer = assignmentScans.get(socketId);
  if (timer) clearTimeout(timer);
  assignmentScans.delete(socketId);
}

function emitAssignmentCard(data) {
  if (!ioInstance || assignmentScans.size === 0) return false;
  console.log(`Đã nhận thẻ gán ${data.uid} cho ${assignmentScans.size} phiên chờ`);
  for (const socketId of assignmentScans.keys()) {
    ioInstance.to(socketId).emit("assignment-card", data);
    stopAssignmentScan(socketId);
  }
  return true;
}

module.exports = {
  initSocket,
  getIO,
  latestData,
  startAssignmentScan,
  stopAssignmentScan,
  emitAssignmentCard,
};
