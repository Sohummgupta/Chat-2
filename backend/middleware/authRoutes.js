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
    return res.status(500).json({ error: err.message });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

export default router;
