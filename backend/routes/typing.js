import express from "express";

const router = express.Router();

// In-memory typing status. This resets when the server restarts.
// Structure: Map<chatKey, Record<userId, timestamp>>
const typingState = new Map();
const TYPING_TTL_MS = 4000;

function getChatKey({ roomId, user1, user2 }) {
  if (roomId) {
    return `room:${roomId}`;
  }
  const ids = [user1, user2].sort();
  return `dm:${ids[0]}:${ids[1]}`;
}

function cleanupExpired(now) {
  for (const [key, value] of typingState.entries()) {
    const remaining = {};
    for (const [userId, ts] of Object.entries(value)) {
      if (now - ts <= TYPING_TTL_MS) {
        remaining[userId] = ts;
      }
    }
    if (Object.keys(remaining).length === 0) {
      typingState.delete(key);
    } else {
      typingState.set(key, remaining);
    }
  }
}

// Update typing status for a user in a DM or room
router.post("/", (req, res) => {
  try {
    const { userId, partnerId, roomId, isTyping } = req.body || {};

    if (!userId || (!partnerId && !roomId)) {
      return res
        .status(400)
        .json({ error: "userId and partnerId or roomId are required" });
    }

    const key = getChatKey({ roomId, user1: userId, user2: partnerId });
    const now = Date.now();

    cleanupExpired(now);

    const existing = typingState.get(key) || {};

    if (!isTyping) {
      delete existing[userId];
      if (Object.keys(existing).length === 0) {
        typingState.delete(key);
      } else {
        typingState.set(key, existing);
      }
    } else {
      existing[userId] = now;
      typingState.set(key, existing);
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get list of other users currently typing in this chat
router.get("/", (req, res) => {
  try {
    const { userId, partnerId, roomId } = req.query;

    if (!userId || (!partnerId && !roomId)) {
      return res
        .status(400)
        .json({ error: "userId and partnerId or roomId are required" });
    }

    const key = getChatKey({ roomId, user1: userId, user2: partnerId });
    const now = Date.now();

    cleanupExpired(now);

    const state = typingState.get(key) || {};

    const userIds = Object.entries(state)
      .filter(([id, ts]) => id !== userId && now - ts <= TYPING_TTL_MS)
      .map(([id]) => id);

    return res.json({ userIds });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
