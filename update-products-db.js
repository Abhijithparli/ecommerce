import connectDB from "./config/db.js";
import Category from "./models/categoryModel.js";
import Product from "./models/productModel.js";
import mongoose from "mongoose";

async function run() {
  await connectDB();
  
  // Find fullface category
  const fullfaceCategory = await Category.findOne({ name: "fullface" });
  // Find axor category
  const axorCategory = await Category.findOne({ name: "axor" });
  
  if (fullfaceCategory && axorCategory) {
    console.log(`Found fullface category ID: ${fullfaceCategory._id}`);
    console.log(`Found axor category ID: ${axorCategory._id}`);
    
    // Update all products in category 'axor' to category 'fullface'
    const result = await Product.updateMany(
      { category: axorCategory._id },
      { category: fullfaceCategory._id }
    );
    
    console.log(`Updated products count: ${result.modifiedCount}`);
  } else {
    console.log("Could not find categories in database.");
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
