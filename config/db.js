
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log(" connect to MongoDB...");
    
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/headshield");
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("DB Connection Failed!");
    console.error("Error message:", error.message);
    process.exit(1);
  }
};

export default connectDB;


