import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import Cart from "../models/cartModel.js";
import Order from "../models/orderModel.js";
import * as productService from "../services/productService.js";
import * as orderService from "../services/orderService.js";

async function runVerification() {
  console.log("=== STARTING COMPREHENSIVE VERIFICATION ===");
  await connectDB();

  try {
    // -------------------------------------------------------------
    // 1. TEST PRODUCT CREATION WITH VARIANT-SPECIFIC PRICING
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Variant Pricing in Product Service ---");
    
    // Create test categories
    let cat1 = await Category.findOne({ name: "Verification Cat A" });
    if (!cat1) {
      cat1 = await Category.create({ name: "Verification Cat A", description: "Test Category A", isListed: true });
    }
    let cat2 = await Category.findOne({ name: "Verification Cat B" });
    if (!cat2) {
      cat2 = await Category.create({ name: "Verification Cat B", description: "Test Category B", isListed: true });
    }

    const testProductData = {
      name: "Test Helmet Variant Price " + Date.now(),
      brand: "Axor Pro",
      category: cat1._id.toString(),
      description: "A high-performance aerodynamic helmet designed for testing variant pricing.",
      highlights: ["DOT Certified", "Dual Visor", "Removable Lining"],
      variants: [
        { size: "S", price: 1000, stock: 10 },
        { size: "M", price: 1200, stock: 15 },
        { size: "L", price: 1400, stock: 20 },
        { size: "XL", price: 1600, stock: 8 }
      ]
    };

    const mockFiles = [
      { filename: "test1.jpg" },
      { filename: "test2.jpg" },
      { filename: "test3.jpg" }
    ];

    const createdProduct = await productService.addProduct(testProductData, mockFiles);
    console.log("✓ Product created successfully with ID:", createdProduct._id);
    console.log("  Variants stored:", createdProduct.variants.map(v => `${v.size}: ₹${v.price} (Stock: ${v.stock})`).join(", "));
    console.log("  Auto-synced salePrice (min):", createdProduct.salePrice);
    console.log("  Auto-synced regularPrice (max):", createdProduct.regularPrice);

    if (createdProduct.salePrice !== 1000 || createdProduct.regularPrice !== 1600) {
      throw new Error(`Price auto-sync failed! Expected salePrice=1000, regularPrice=1600, got ${createdProduct.salePrice}, ${createdProduct.regularPrice}`);
    }

    // -------------------------------------------------------------
    // 2. TEST PRODUCT UPDATE WITH VARIANT PRICING
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Updating Product with New Variant Pricing ---");
    const updateProductData = {
      name: createdProduct.name,
      brand: createdProduct.brand,
      category: cat1._id.toString(),
      description: createdProduct.description,
      variants: [
        { size: "S", price: 1050, stock: 8 },
        { size: "M", price: 1250, stock: 12 },
        { size: "L", price: 1450, stock: 18 }
      ]
    };

    const updatedProduct = await productService.updateProduct(createdProduct._id, updateProductData, []);
    console.log("✓ Product updated successfully.");
    console.log("  Updated variants:", updatedProduct.variants.map(v => `${v.size}: ₹${v.price} (Stock: ${v.stock})`).join(", "));
    console.log("  Updated salePrice:", updatedProduct.salePrice, "regularPrice:", updatedProduct.regularPrice);

    if (updatedProduct.salePrice !== 1050 || updatedProduct.regularPrice !== 1450) {
      throw new Error(`Updated price sync failed! Expected 1050/1450, got ${updatedProduct.salePrice}/${updatedProduct.regularPrice}`);
    }

    // -------------------------------------------------------------
    // 3. TEST CART & ORDER FLOW WITH VARIANT PRICES & STOCK
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Cart & Order with Variant Price & Stock Management ---");
    
    // Find or create a test user
    let testUser = await User.findOne({ email: "test_verifier@example.com" });
    if (!testUser) {
      testUser = await User.create({
        name: "Test Verifier",
        email: "test_verifier@example.com",
        password: "hashedpassword123",
        addresses: [{
          name: "Test Verifier",
          phone: "9876543210",
          street: "123 Test Street",
          city: "Kochi",
          state: "Kerala",
          pincode: "682001",
          type: "Home",
          isDefault: true
        }]
      });
    }

    const testAddressId = testUser.addresses[0]._id;

    // Create Cart for user with 2 units of Size M (price ₹1250, initial stock 12)
    await Cart.deleteMany({ user: testUser._id });
    const userCart = await Cart.create({
      user: testUser._id,
      items: [{
        product: updatedProduct._id,
        size: "M",
        quantity: 2
      }]
    });
    console.log("✓ Cart created with 2 units of size M");

    // Create Order
    const order = await orderService.createOrder({
      userId: testUser._id,
      addressId: testAddressId,
      paymentMethod: "COD"
    });

    console.log("✓ Order created successfully with Order ID:", order.orderId);
    console.log("  Order item price:", order.items[0].price, "(Expected: 1250)");
    console.log("  Order totalPrice:", order.totalPrice, "(Expected: 2500)");

    if (order.items[0].price !== 1250 || order.totalPrice !== 2500) {
      throw new Error(`Order price calculation failed! Item price: ${order.items[0].price}, total: ${order.totalPrice}`);
    }

    // Check variant stock decremented
    const prodAfterOrder = await Product.findById(updatedProduct._id);
    const varMAfterOrder = prodAfterOrder.variants.find(v => v.size === "M");
    console.log("  Stock of Size M after order:", varMAfterOrder.stock, "(Expected: 10, was 12)");

    if (varMAfterOrder.stock !== 10) {
      throw new Error(`Stock decrement failed! Expected 10, got ${varMAfterOrder.stock}`);
    }

    // Cancel Order & check variant stock restored
    console.log("\n--- TEST 4: Order Cancellation Stock Restoration ---");
    const cancelledOrder = await orderService.cancelOrder(order._id, testUser._id);
    console.log("✓ Order cancelled successfully. Status:", cancelledOrder.status);

    const prodAfterCancel = await Product.findById(updatedProduct._id);
    const varMAfterCancel = prodAfterCancel.variants.find(v => v.size === "M");
    console.log("  Stock of Size M after cancel:", varMAfterCancel.stock, "(Expected: 12, restored)");

    if (varMAfterCancel.stock !== 12) {
      throw new Error(`Stock restoration failed! Expected 12, got ${varMAfterCancel.stock}`);
    }

    // -------------------------------------------------------------
    // 5. TEST MULTI-CATEGORY SIMULTANEOUS FILTERING (TASK 3)
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Simultaneous Multiple Category Filtering ---");
    
    // Create product in cat2
    const productInCat2 = await productService.addProduct({
      name: "Cat B Helmet " + Date.now(),
      brand: "Axor Pro",
      category: cat2._id.toString(),
      description: "Helmet in Category B for multi-category testing.",
      variants: [{ size: "M", price: 900, stock: 5 }]
    }, mockFiles);

    // Test multi-category query with array of category IDs
    const multiCatResult = await productService.getPublicProducts({
      category: [cat1._id.toString(), cat2._id.toString()]
    });

    console.log("✓ Multi-category query executed.");
    console.log("  Returned products count:", multiCatResult.products.length);
    console.log("  Selected categories:", multiCatResult.selectedCategories);
    console.log("  Category query string:", multiCatResult.categoryQueryString);

    const foundProd1 = multiCatResult.products.some(p => p._id.toString() === createdProduct._id.toString());
    const foundProd2 = multiCatResult.products.some(p => p._id.toString() === productInCat2._id.toString());

    if (!foundProd1 || !foundProd2) {
      throw new Error(`Multi-category filtering failed! Product 1 found: ${foundProd1}, Product 2 found: ${foundProd2}`);
    }
    console.log("✓ Both Category A and Category B products returned successfully!");

    // Test combined filter: multiple categories + price filter (0-1000)
    console.log("\n--- TEST 6: Multi-category + Price Filter Combination ---");
    const combinedResult = await productService.getPublicProducts({
      category: [cat1._id.toString(), cat2._id.toString()],
      price: "0-1000"
    });
    console.log("✓ Combined filter query (Multi-cat + Price 0-1000):", combinedResult.products.length, "product(s) found");
    const prodInCat2Found = combinedResult.products.some(p => p._id.toString() === productInCat2._id.toString());
    const prodInCat1Found = combinedResult.products.some(p => p._id.toString() === createdProduct._id.toString());
    
    console.log("  Product in Cat2 (₹900) included:", prodInCat2Found, "(Expected: true)");
    console.log("  Product in Cat1 (₹1050) included:", prodInCat1Found, "(Expected: false)");

    if (!prodInCat2Found || prodInCat1Found) {
      throw new Error("Combined filter failed!");
    }

    // Cleanup test data
    console.log("\n--- CLEANING UP TEST DATA ---");
    await Product.deleteMany({ _id: { $in: [createdProduct._id, productInCat2._id] } });
    await Order.deleteMany({ _id: order._id });
    await Category.deleteMany({ _id: { $in: [cat1._id, cat2._id] } });
    await User.deleteOne({ email: "test_verifier@example.com" });
    console.log("✓ Cleaned up test database records.");

    console.log("\n==========================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED!");
    console.log("==========================================");

  } catch (err) {
    console.error("\n❌ VERIFICATION FAILED:", err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runVerification();
