
// // require("dotenv").config();
// const path = require("path");

import express from "express";
import dotenv from "dotenv";
import path from  "path";
import { fileURLToPath } from "url";

import adminrouter from "./routes/adminRouter.js";
import userrouter from "./routes/userRouter.js";

//env load

dotenv.config();

console.log(import.meta.url)

const __filename = fileURLToPath(import.meta.url);
console.log(__filename)
const __dirname = path.dirname(__filename);
console.log(__dirname)

const app = express();

//middlewares

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));
// app.use("/admin",adminrouter);
// app.use("/",userrouter);

//view engine

app.set('view engine','ejs');
app.set("views",[
    path.join(__dirname,"views/user"),
    path.join(__dirname,"views")
]);
// app.set("views",path.join(__dirname,"views"));
// app.set("views",path.join(__dirname,"home"));


//routes

app.use('/admin',adminrouter);
app.use("/",userrouter);


// connectDB();



app.listen(process.env.PORT,()=>{
    console.log("server Running on port ",process.env.PORT);
    
});
 export default app;














// const express = require('express');
// const app = express();
// const env = require("dotenv").config();
// // const db = require("./config/db");
// // const { connect } = require("mongoose");
// const connectDB = require("./config/db");
// const userRouter = require("./routes/userRouter");
// const adminRouter=require("./routes/adminRouter");
// const dashboardRouter = require("./routes/dashboardRouter");
 

// // app.set("view engine","ejs");
// app.use(express.urlencoded({extended:true}));
// app.use(express.json());

// app.set("view engine","ejs");
// app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
// app.use(express.static(path.join(__dirname, "public/public")));


// app.use("/",userRouter);
// app.use("/admin",adminRouter);
// app.use("/dashboard",dashboardRouter);

// connectDB();

// console.log(process.env.PORT);

// app.listen(process.env.PORT,()=>{
//     console.log("server Running");
    
// })

// module.exports = app;

// // console.log(process.env.MONGO_URI); // should NOT be undefined

// // mongoose.connect(process.env.MONGO_URI)
// //   .then(() => console.log('DB connected successfully'))
// //   .catch(err => console.error('DB connection error', err));


 
                       