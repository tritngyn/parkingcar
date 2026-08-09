let ioInstance = null;

const latestData = {
  rfid: null,
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

module.exports = {
  initSocket,
  getIO,
  latestData
};
