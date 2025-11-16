import express from "express";
import User from "../models/User.js";
const router = express.Router();

// Create User (Signup)
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const user = await User.create({ name, email, password });

    return res.json({ message: "User Created", user });
  } catch (err) {
    if (err && err.code === 11000) {
      return res
        .status(409)
        .json({ error: "A user with this email already exists" });
    }

    return res.status(500).json({ error: "Failed to create user" });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Update user profile (name, email)
router.put("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email } = req.body;

    const updated = await User.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
