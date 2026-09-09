import connectDB from "./config/db.js";
import { getPublicProducts } from "./services/user/productService.js";
import mongoose from "mongoose";

async function run() {
  await connectDB();
  console.log("Connected.");

  console.log("\n=================== TEST 1: category=fullface ===================");
  const result1 = await getPublicProducts({ category: "fullface" });
  console.log("Result 1 Products:", result1.products.map(p => ({ id: p._id, name: p.name, category: p.category.name })));

  console.log("\n=================== TEST 2: category=half face ===================");
  const result2 = await getPublicProducts({ category: "half face" });
  console.log("Result 2 Products:", result2.products.map(p => ({ id: p._id, name: p.name, category: p.category.name })));

  console.log("\n=================== TEST 3: category= (empty) ===================");
  const result3 = await getPublicProducts({});
  console.log("Result 3 Products count:", result3.products.length);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(console.error);
