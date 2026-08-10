require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");
const Card = require("../models/Card");
require("../models/User");
const ParkingSession = require("../models/ParkingSession");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const uid = String(process.argv[2] || "39B21405").toUpperCase();
  const card = await Card.findOne({ uid }).populate("owner", "fullName phone balance").lean();
  const sessions = await ParkingSession.find({ uid }).sort({ entryTime: -1 }).limit(5).lean();
  console.log(JSON.stringify({ database: mongoose.connection.name, card, sessions }, null, 2));
}

inspect()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
