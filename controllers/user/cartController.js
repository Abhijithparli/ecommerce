import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";

//add to cart
export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;
    const size = (req.body.size || "M").toUpperCase();
    const quantity = parseInt(req.body.quantity) || 1;

    // check products
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });

    // product not found
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if the size variant exists
    const variant = product.variants.find(
      (v) => v.size.toUpperCase() === size
    );

    if (!variant) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} variant is not available for this product`,
      });
    }

    // OUT OF STOCK Check for variant
    if (variant.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} is out of stock`,
      });
    }

    if (quantity > variant.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} item(s) available for Size ${size}`,
      });
    }

    // FIND USER CART
    let cart = await Cart.findOne({
      user: userId,
    });

    // CREATE NEW CART
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [
          {
            product: productId,
            size: size,
            quantity: quantity,
          },
        ],
      });

      await cart.save();

      return res.json({
        success: true,
        message: "Product added to cart",
      });
    }

    // CHECK PRODUCT + SIZE EXISTS IN CART
    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === productId &&
        item.size.toUpperCase() === size
    );

    // IF ALREADY EXISTS
    if (existingItem) {
      // STOCK VALIDATION
      if (existingItem.quantity + quantity > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${variant.stock} item(s) available in stock.`,
        });
      }

      existingItem.quantity += quantity;
    }
    // NEW PRODUCT + SIZE
    else {
      cart.items.push({
        product: productId,
        size: size,
        quantity: quantity,
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: "Product added to cart",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// LOAD CART PAGE
export const loadCart = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // FIND CART
    const cart = await Cart.findOne({
      user: userId,
    })

      .populate("items.product");

    // CART TOTAL
    let total = 0;

    if (cart) {
      cart.items.forEach((item) => {
        total += item.product.salePrice * item.quantity;
      });
    }

    res.render("user/cart", {
      cart,
      total,
    });
  } catch (error) {
    console.log(error);

    res.redirect("/");
  }
};

// UPDATE CART QUANTITY
export const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, action } = req.body;
    const size = (req.body.size || "M").toUpperCase();

    // FIND CART
    const cart = await Cart.findOne({
      user: userId,
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // FIND ITEM
    const item = cart.items.find(
      (item) =>
        item.product.toString() === productId &&
        item.size.toUpperCase() === size
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // PRODUCT
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variant = product.variants.find(
      (v) => v.size.toUpperCase() === size
    );

    if (!variant) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} variant is not available`,
      });
    }

    // INCREASE
    if (action === "increase") {
      // STOCK VALIDATION
      if (item.quantity >= variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variant.stock} item(s) available in stock.`,
        });
      }

      item.quantity += 1;
    }

    // DECREASE
    if (action === "decrease") {
      if (item.quantity > 1) {
        item.quantity -= 1;
      }
    }

    await cart.save();

    // Populate products to calculate new grandTotal
    const populatedCart = await Cart.findById(cart._id).populate("items.product");
    let grandTotal = 0;
    populatedCart.items.forEach(item => {
      if (item.product) {
        grandTotal += item.product.salePrice * item.quantity;
      }
    });

    res.json({
      success: true,
      quantity: item.quantity,
      subtotal: product.salePrice * item.quantity,
      grandTotal: grandTotal
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// REMOVE CART ITEM
export const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;
    const size = (req.query.size || "M").toUpperCase();

    // FIND CART
    const cart = await Cart.findOne({
      user: userId,
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // REMOVE ITEM BY ID AND SIZE
    cart.items = cart.items.filter(
      (item) =>
        !(
          item.product.toString() === productId &&
          item.size.toUpperCase() === size
        )
    );

    await cart.save();

    // Populate products to calculate new grandTotal
    const populatedCart = await Cart.findById(cart._id).populate("items.product");
    let grandTotal = 0;
    populatedCart.items.forEach(item => {
      if (item.product) {
        grandTotal += item.product.salePrice * item.quantity;
      }
    });

    res.json({
      success: true,
      message: "Item removed",
      grandTotal: grandTotal,
      cartEmpty: populatedCart.items.length === 0
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// LOAD CHECKOUT PAGE
export const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // CART
    const cart = await Cart.findOne({
      user: userId,
    })

      .populate("items.product");

    // USER ADDRESSES
    const user = await User.findById(userId);

    // EMPTY CART
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    // TOTAL
    let total = 0;

    cart.items.forEach((item) => {
      total += item.product.salePrice * item.quantity;
    });

    res.render("user/checkout", {
      cart,

      addresses: user.addresses,

      total,
    });
  } catch (error) {
    console.log(error);

    res.redirect("/cart");
  }
};
