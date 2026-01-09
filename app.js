
import express from "express";
import dotenv from "dotenv";
import path from  "path";
import { fileURLToPath } from "url";

import adminRouter from "./routes/admin/adminRouter.js";
// import adminrouter from "./routes/admin/dashboard.js";
import userRouter from "./routes/user/userRoute.js";

import connectDB from "./config/db.js";


//env load
dotenv.config();
connectDB();

// console.log(import.meta.url)
const __filename = fileURLToPath(import.meta.url);
// console.log(__filename)
const __dirname = path.dirname(__filename);
// console.log(__dirname)

const app = express();
 
//middlewares
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

import session from 'express-session';

app.use(session({
  secret: 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly:true,
    secure:false  
  }
}));


//view engine

app.set('view engine','ejs');
app.set("views",[
    path.join(__dirname,"views/user"),
    path.join(__dirname,"views/admin"),
    path.join(__dirname,"views")
]);


//routes

app.use('/admin',adminRouter);
app.use("/",userRouter); 

// connectDB();

app.listen(process.env.PORT,()=>{
    console.log("server Running on port ",process.env.PORT);
    
});
 export default app;
 
                       