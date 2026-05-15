import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";

// ADD TO CART
export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const productId = req.params.productId;

    // CHECK PRODUCT
    const product = await Product.findOne({
      _id: productId,

      isDeleted: false,
    });

    // PRODUCT NOT FOUND
    if (!product) {
      return res.status(404).json({
        success: false,

        message: "Product not found",
      });
    }

    // OUT OF STOCK
    if (product.quantity <= 0) {
      return res.status(400).json({
        success: false,

        message: "Product out of stock",
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

            quantity: 1,
          },
        ],
      });

      await cart.save();

      return res.json({
        success: true,

        message: "Product added to cart",
      });
    }

    // CHECK PRODUCT EXISTS IN CART
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId,
    );

    // IF ALREADY EXISTS
    if (existingItem) {
      // STOCK VALIDATION
      if (existingItem.quantity >= product.quantity) {
        return res.status(400).json({
          success: false,

          message: "Maximum stock reached",
        });
      }

      existingItem.quantity += 1;
    }

    // NEW PRODUCT
    else {
      cart.items.push({
        product: productId,

        quantity: 1,
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
      (item) => item.product.toString() === productId,
    );

    if (!item) {
      return res.status(404).json({
        success: false,

        message: "Item not found",
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

    // INCREASE
    if (action === "increase") {
      // STOCK VALIDATION
      if (item.quantity >= product.quantity) {
        return res.status(400).json({
          success: false,

          message: "Maximum stock reached",
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

    res.json({
      success: true,

      quantity: item.quantity,
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

    // REMOVE ITEM
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );

    await cart.save();

    res.json({
      success: true,

      message: "Item removed",
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
