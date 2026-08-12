require("dotenv").config();
const mongoose = require("mongoose");

async function migrateDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("Chưa khai báo MONGO_URI trong file .env");
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const database = mongoose.connection.db;

  await database.collection("cards").updateMany(
    { status: { $exists: false } },
    { $set: { status: "AVAILABLE", owner: null } }
  );
  await database.collection("cards").updateMany({}, { $unset: { __v: "" } });

  await database.collection("parkingsessions").updateMany(
    {},
    [
      {
        $set: {
          device: { $ifNull: ["$exitDeviceId", "$entryDeviceId"] },
          direction: {
            $cond: [
              { $or: [{ $ne: ["$exitTime", null] }, { $gt: ["$fee", 0] }] },
              "OUT",
              "IN",
            ],
          },
        },
      },
      {
        $unset: [
          "entryDeviceId",
          "exitDeviceId",
          "entryEventId",
          "exitEventId",
          "__v",
        ],
      },
    ]
  );

  await database.collection("admins").updateMany({}, { $unset: { __v: "" } });
  console.log("Database migration completed");
}

migrateDatabase()
  .catch((error) => {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
