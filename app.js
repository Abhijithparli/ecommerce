import dotenv from "dotenv";



import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "./config/passport.js";

import adminRouter from "./routes/admin/adminRouter.js";
import userRouter from "./routes/user/userRoute.js";
import connectDB from "./config/db.js";

dotenv.config();
connectDB();
console.log('jo');


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Session (MUST be before passport)
app.use(
  session({
    secret: "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: false,
    },
  })
);

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});


app.use(passport.initialize());
app.use(passport.session());

// View engine
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views"),
]);

// Routes
app.use("/admin", adminRouter);
app.use("/", userRouter);

app.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT);
});

export default app;