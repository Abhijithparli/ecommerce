import express from "express";
import dotenv from "dotenv";
import path from  "path";
import { fileURLToPath } from "url";

import adminrouter from "./routes/adminRouter.js";
import userroutern from "./routes/userRouter.js";