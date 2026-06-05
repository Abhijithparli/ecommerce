import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";

const connectDB = async () => {
  try {
    console.log(" connect to MongoDB...");
    
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/headshield");
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Self-healing database migration
    try {
      const fullfaceCategory = await Category.findOne({ name: "fullface" });
      const axorCategory = await Category.findOne({ name: "axor" });
      
      if (fullfaceCategory && axorCategory) {
        const fullfaceCount = await Product.countDocuments({ category: fullfaceCategory._id });
        if (fullfaceCount === 0) {
          console.log("[MIGRATION] Found 0 products in 'fullface' category. Migrating 'axor' category products to 'fullface'...");
          const updateResult = await Product.updateMany(
            { category: axorCategory._id },
            { category: fullfaceCategory._id }
          );
          console.log(`[MIGRATION] Successfully migrated ${updateResult.modifiedCount} products to 'fullface'.`);
        }
      }
    } catch (migError) {
      console.error("[MIGRATION ERROR]", migError);
    }
  } catch (error) {
    console.error("DB Connection Failed!");
    console.error("Error message:", error.message);
    process.exit(1);
  }
};

export default connectDB;


