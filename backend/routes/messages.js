import express from "express";
import Message from "../models/Message.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { senderId, receiverId, content, room } = req.body;

    if (!senderId || !content || (!receiverId && !room)) {
      return res.status(400).json({
        error: "senderId, content and either receiverId or room are required",
      });
    }

    const message = await Message.create({
      sender: senderId,
      ...(receiverId ? { receiver: receiverId } : {}),
      ...(room ? { room } : {}),
      content,
    });

    return res.status(201).json(message);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/conversation", async (req, res) => {
  try {
    const { user1, user2 } = req.query;

    if (!user1 || !user2) {
      return res
        .status(400)
        .json({ error: "user1 and user2 query params are required" });
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: "roomId param is required" });
    }

    const messages = await Message.find({ room: roomId }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).sort({ createdAt: -1 });

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/conversation", async (req, res) => {
  try {
    const { user1, user2 } = req.query;

    if (!user1 || !user2) {
      return res
        .status(400)
        .json({ error: "user1 and user2 query params are required" });
    }

    const result = await Message.deleteMany({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    });

    return res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: "roomId param is required" });
    }

    const result = await Message.deleteMany({ room: roomId });

    return res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    const deleted = await Message.findByIdAndDelete(messageId);
    if (!deleted) {
      return res.status(404).json({ error: "Message not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
