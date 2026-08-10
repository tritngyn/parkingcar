const mongoose = require("mongoose");
const Card = require("../models/Card");
const ParkingSession = require("../models/ParkingSession");

const inMemoryStore = {
  cards: [
    { uid: "GUEST123", type: "GUEST", createdAt: new Date() },
    { uid: "VIP789", type: "VIP", createdAt: new Date() }
  ],
  sessions: []
};

function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

const db = {
  isDBConnected,
  inMemoryStore,
  cards: {
    findOne: async (query) => {
      if (isDBConnected()) {
        try { return await Card.findOne(query); } catch (e) { /* fallback */ }
      }
      return inMemoryStore.cards.find(c => c.uid === query.uid) || null;
    },
    save: async (cardData) => {
      if (isDBConnected()) {
        try {
          const card = new Card(cardData);
          return await card.save();
        } catch (e) { /* fallback */ }
      }
      const newCard = { ...cardData, createdAt: new Date() };
      inMemoryStore.cards.push(newCard);
      return newCard;
    },
    find: async () => {
      if (isDBConnected()) {
        try { return await Card.find().populate("owner", "fullName phone email balance").sort({ createdAt: -1 }); } catch (e) { /* fallback */ }
      }
      return [...inMemoryStore.cards].sort((a, b) => b.createdAt - a.createdAt);
    },
    deleteOne: async (uid) => {
      if (isDBConnected()) {
        try { return await Card.findOneAndDelete({ uid }); } catch (e) { /* fallback */ }
      }
      const index = inMemoryStore.cards.findIndex(c => c.uid === uid);
      if (index === -1) return null;
      return inMemoryStore.cards.splice(index, 1)[0];
    }
  },
  sessions: {
    findActive: async (uid) => {
      if (isDBConnected()) {
        try {
          return await ParkingSession.findOne({
            uid: uid.toUpperCase(),
            status: { $in: ["active", "pending_payment"] }
          }).sort({ entryTime: -1 });
        } catch (e) { /* fallback */ }
      }
      return inMemoryStore.sessions.find(s => s.uid.toUpperCase() === uid.toUpperCase() && ["active", "pending_payment"].includes(s.status)) || null;
    },
    save: async (sessionData) => {
      if (isDBConnected()) {
        try {
          if (sessionData.save && typeof sessionData.save === "function") {
            return await sessionData.save();
          }
          const session = new ParkingSession(sessionData);
          return await session.save();
        } catch (e) { /* fallback */ }
      }
      const id = sessionData._id;
      if (id) {
        const existingIndex = inMemoryStore.sessions.findIndex(s => s._id === id || String(s._id) === String(id));
        if (existingIndex !== -1) {
          inMemoryStore.sessions[existingIndex] = {
            ...inMemoryStore.sessions[existingIndex],
            ...sessionData,
            updatedAt: new Date()
          };
          return inMemoryStore.sessions[existingIndex];
        }
      }
      const newSession = {
        _id: sessionData._id || `sess-${Date.now()}`,
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryStore.sessions.push(newSession);
      return newSession;
    },
    findActiveAll: async () => {
      if (isDBConnected()) {
        try {
          return await ParkingSession.find({
            status: { $in: ["active", "pending_payment"] }
          }).sort({ entryTime: -1 });
        } catch (e) { /* fallback */ }
      }
      return inMemoryStore.sessions
        .filter(s => ["active", "pending_payment"].includes(s.status))
        .sort((a, b) => b.entryTime - a.entryTime);
    },
    findAll: async () => {
      if (isDBConnected()) {
        try {
          return await ParkingSession.find().sort({ entryTime: -1 });
        } catch (e) { /* fallback */ }
      }
      return [...inMemoryStore.sessions].sort((a, b) => b.entryTime - a.entryTime);
    },
    findById: async (id) => {
      if (isDBConnected()) {
        try { return await ParkingSession.findById(id); } catch (e) { /* fallback */ }
      }
      return inMemoryStore.sessions.find(s => s._id === id || String(s._id) === String(id)) || null;
    }
  }
};

module.exports = db;
