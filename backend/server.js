import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

import authRoutes from "./middleware/authRoutes.js";
import messageRoutes from "./routes/messages.js";
import typingRoutes from "./routes/typing.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/messages", messageRoutes);
app.use("/typing", typingRoutes);
console.log("MONGO_URI is:", process.env.MONGO_URI);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to DB");
    app.listen(process.env.PORT, () => console.log(`Server running`));
  })
  .catch((err) => console.log(err));
