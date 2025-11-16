import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

import authRoutes from "./routes/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to DB");
    app.listen(process.env.PORT, () =>
      console.log(`Server running`)
    );
  })
  .catch((err) => console.log(err));
