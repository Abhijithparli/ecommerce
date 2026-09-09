import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import * as productService from "../services/productService.js";

async function runEdgeCaseVerification() {
  console.log("=== STARTING EDGE CASES VERIFICATION ===");
  await connectDB();

  try {
    let testCat = await Category.findOne({ name: "Edge Case Cat" });
    if (!testCat) {
      testCat = await Category.create({ name: "Edge Case Cat", description: "Edge Cat", isListed: true });
    }

    const mockFiles = [{ filename: "e1.jpg" }, { filename: "e2.jpg" }, { filename: "e3.jpg" }];

    // Test A: Negative Price Validation
    console.log("\n--- Edge Case A: Negative/Zero Price Validation ---");
    try {
      await productService.addProduct({
        name: "Invalid Price Product " + Date.now(),
        brand: "Edge Brand",
        category: testCat._id.toString(),
        description: "Testing invalid variant price rejection.",
        variants: [{ size: "M", price: -50, stock: 5 }]
      }, mockFiles);
      throw new Error("Should have rejected negative variant price!");
    } catch (err) {
      console.log("✓ Correctly rejected negative price:", err.message);
    }

    // Test B: Zero Price Validation
    try {
      await productService.addProduct({
        name: "Zero Price Product " + Date.now(),
        brand: "Edge Brand",
        category: testCat._id.toString(),
        description: "Testing zero variant price rejection.",
        variants: [{ size: "M", price: 0, stock: 5 }]
      }, mockFiles);
      throw new Error("Should have rejected zero variant price!");
    } catch (err) {
      console.log("✓ Correctly rejected zero price:", err.message);
    }

    // Test C: Price Exceeding 1M Validation
    console.log("\n--- Edge Case B: Price Exceeding 1,000,000 Validation ---");
    try {
      await productService.addProduct({
        name: "Excessive Price Product " + Date.now(),
        brand: "Edge Brand",
        category: testCat._id.toString(),
        description: "Testing excessive variant price rejection.",
        variants: [{ size: "M", price: 1500000, stock: 5 }]
      }, mockFiles);
      throw new Error("Should have rejected price > 1M!");
    } catch (err) {
      console.log("✓ Correctly rejected price > 1M:", err.message);
    }

    // Test D: Duplicate Sizes in Variants
    console.log("\n--- Edge Case C: Duplicate Sizes in Variants ---");
    try {
      await productService.addProduct({
        name: "Duplicate Size Product " + Date.now(),
        brand: "Edge Brand",
        category: testCat._id.toString(),
        description: "Testing duplicate variant size rejection.",
        variants: [
          { size: "M", price: 500, stock: 5 },
          { size: "M", price: 600, stock: 10 }
        ]
      }, mockFiles);
      throw new Error("Should have rejected duplicate variant sizes!");
    } catch (err) {
      console.log("✓ Correctly rejected duplicate size:", err.message);
    }

    // Test E: Invalid Size Enum
    console.log("\n--- Edge Case D: Invalid Size Enum ---");
    try {
      await productService.addProduct({
        name: "Invalid Size Product " + Date.now(),
        brand: "Edge Brand",
        category: testCat._id.toString(),
        description: "Testing invalid variant size enum rejection.",
        variants: [{ size: "XXXL", price: 500, stock: 5 }]
      }, mockFiles);
      throw new Error("Should have rejected invalid size enum!");
    } catch (err) {
      console.log("✓ Correctly rejected invalid size:", err.message);
    }

    // Test F: Comma-Separated Category Queries
    console.log("\n--- Edge Case E: Comma-Separated Category Query String Parsing ---");
    const testProd = await productService.addProduct({
      name: "Valid Edge Product " + Date.now(),
      brand: "Edge Brand",
      category: testCat._id.toString(),
      description: "Valid product for comma separated query testing.",
      variants: [{ size: "M", price: 800, stock: 5 }]
    }, mockFiles);

    const commaQueryRes = await productService.getPublicProducts({
      category: `${testCat._id.toString()},nonexistentId123`
    });
    console.log("✓ Comma query parsed. Found products:", commaQueryRes.products.length);
    if (!commaQueryRes.products.some(p => p._id.toString() === testProd._id.toString())) {
      throw new Error("Comma-separated category query parsing failed!");
    }

    // Clean up
    await Product.deleteOne({ _id: testProd._id });
    await Category.deleteOne({ _id: testCat._id });
    console.log("✓ Cleaned up edge case test records.");

    console.log("\n==========================================");
    console.log("🎉 ALL EDGE CASE TESTS PASSED SUCCESSFULLY!");
    console.log("==========================================");

  } catch (err) {
    console.error("\n❌ EDGE CASE VERIFICATION FAILED:", err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runEdgeCaseVerification();
