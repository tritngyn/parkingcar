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
  await database.collection("cards").updateMany({}, { $unset: { type: "", __v: "" } });

  await database.collection("parkingsessions").updateMany(
    {},
    [
      {
        $set: {
          device: { $ifNull: ["$exitDeviceId", "$entryDeviceId"] },
          direction: {
            $cond: [
              { $or: [{ $ne: ["$exitTime", null] }, { $eq: ["$status", "completed"] }] },
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

  // Older versions stored fees in thousands of VND (20 meant 20,000 VND).
  // Normalize those records once; the range makes this migration idempotent.
  const migratedFees = await database.collection("parkingsessions").updateMany(
    { fee: { $gt: 0, $lt: 20000 } },
    [{ $set: { fee: { $multiply: ["$fee", 1000] } } }],
  );

  const cards = await database.collection("cards")
    .find({ owner: { $type: "objectId" } }, { projection: { uid: 1, owner: 1 } })
    .toArray();

  for (const card of cards) {
    await database.collection("parkingsessions").updateMany(
      { uid: card.uid, user: { $exists: false } },
      { $set: { user: card.owner } },
    );

    const activeSession = await database.collection("parkingsessions").findOne({
      uid: card.uid,
      exitTime: null,
      status: { $in: ["active", "pending_payment"] },
    });
    await database.collection("users").updateOne(
      { _id: card.owner },
      { $set: { parkingStatus: activeSession ? "IN" : "OUT" } },
    );
  }

  await database.collection("users").updateMany(
    { parkingStatus: { $exists: false } },
    { $set: { parkingStatus: "OUT" } },
  );

  await database.collection("admins").updateMany({}, { $unset: { __v: "" } });
  console.log(`Database migration completed (${migratedFees.modifiedCount} legacy fees normalized)`);
}

migrateDatabase()
  .catch((error) => {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
