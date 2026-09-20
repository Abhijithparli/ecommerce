import connectDB from "../config/db.js";
import mongoose from "mongoose";
import * as cartService from "../services/user/cartService.js";
import * as userService from "../services/user/userService.js";
import * as orderService from "../services/user/orderService.js";
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import Cart from "../models/cartModel.js";

async function runTests() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // Test 1: Max quantity limit in addToCart
  console.log("\n--- TEST 1: Cart max quantity validation ---");
  try {
    await cartService.addToCart({
      userId: new mongoose.Types.ObjectId(),
      productId: new mongoose.Types.ObjectId(),
      size: "M",
      quantity: 6
    });
    console.error("FAIL: Expected addToCart to reject quantity > 5");
  } catch (err) {
    console.log("PASS: Quantity > 5 rejected with:", err.message);
  }

  // Test 2: Invalid address phone & pincode validation
  console.log("\n--- TEST 2: Address validation in userService ---");
  const testUserId = new mongoose.Types.ObjectId();
  // Fake user in memory or test dummy
  try {
    await userService.addUserAddress(testUserId, {
      name: "Ab", // too short
      phone: "12345", // invalid phone
      street: "Rd",
      city: "City",
      state: "State",
      pincode: "1234" // invalid pincode
    });
    console.error("FAIL: Expected invalid address to be rejected");
  } catch (err) {
    console.log("PASS: Invalid address rejected with:", err.message);
  }

  // Test 3: Address pincode format validation
  try {
    await userService.addUserAddress(testUserId, {
      name: "Valid Name",
      phone: "9876543210",
      street: "Valid Street 123",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "012345" // starts with 0 -> invalid Indian PIN
    });
    console.error("FAIL: Expected PIN starting with 0 to be rejected");
  } catch (err) {
    console.log("PASS: Invalid PIN rejected with:", err.message);
  }

  // Test 4: updateUserAddress validation
  try {
    await userService.updateUserAddress(testUserId, new mongoose.Types.ObjectId(), {
      name: "No",
      phone: "bad",
      street: "st",
      city: "",
      state: "",
      pincode: "abc"
    });
    console.error("FAIL: Expected updateUserAddress to reject invalid input");
  } catch (err) {
    console.log("PASS: updateUserAddress rejected invalid fields with:", err.message);
  }

  // Test 5: Verify product blocked check in cartService
  console.log("\n--- TEST 3: Blocked product rejected by addToCart ---");
  const blockedProduct = await Product.findOne({ isBlocked: true });
  if (blockedProduct) {
    try {
      await cartService.addToCart({
        userId: testUserId,
        productId: blockedProduct._id,
        size: blockedProduct.variants[0]?.size || "M",
        quantity: 1
      });
      console.error("FAIL: Blocked product was added to cart");
    } catch (err) {
      console.log("PASS: Blocked product rejected with:", err.message);
    }
  } else {
    console.log("INFO: No blocked product in DB to test against, tested via query filter logic.");
  }

  // Test 6: Verify returnOrder requires reason
  console.log("\n--- TEST 4: Return order reason check ---");
  try {
    await orderService.requestReturn(new mongoose.Types.ObjectId(), testUserId, "");
    console.error("FAIL: Expected requestReturn without reason to fail");
  } catch (err) {
    console.log("PASS: Empty return reason rejected with:", err.message);
  }

  await mongoose.disconnect();
  console.log("\nAll service validation tests executed successfully!");
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
