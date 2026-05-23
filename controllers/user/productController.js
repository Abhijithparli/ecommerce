import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Review from "../../models/reviewModel.js";

//load product listing profileImage
export const loadProducts = async (req, res) => {
  try {
    // QUERY PARAMS
    const search = req.query.search?.trim() || "";
    const category = req.query.category || "";
    const sort = req.query.sort || "";
    const price = req.query.price || "";
    const brand = req.query.brand || "";

    const page = parseInt(req.query.page) || 1;

    const limit = 8;

    const skip = (page - 1) * limit;

    // FILTER
    let filter = {
      isDeleted: false,
    };

    // SEARCH
    if (search) {
      filter.name = {
        $regex: search,

        $options: "i",
      };
    }

    // CATEGORY FILTER
    if (category) {
      filter.category = category;
    }

    // PRICE FILTER
    if (price === "0-1000") {
      filter.salePrice = {
        $gte: 0,

        $lte: 1000,
      };
    } else if (price === "1000-3000") {
      filter.salePrice = {
        $gte: 1000,

        $lte: 3000,
      };
    } else if (price === "3000-above") {
      filter.salePrice = {
        $gte: 3000,
      };
    }
    //brand filter
    if (brand) {
      filter.brand = brand;
    }

    // SORT
    let sortOption = {
      createdAt: -1,
    };

    if (sort === "low-high") {
      sortOption.salePrice = 1;
    } else if (sort === "high-low") {
      sortOption.salePrice = -1;
    } else if (sort === "a-z") {
      sortOption.name = 1;
    } else if (sort === "z-a") {
      sortOption.name = -1;
    }

    // PRODUCTS
    const products = await Product.find(filter)

      .populate("category")

      .sort(sortOption)

      .skip(skip)

      .limit(limit);

    // TOTAL PRODUCTS
    const totalProducts = await Product.countDocuments(filter);

    const totalPages = Math.ceil(totalProducts / limit);

    // CATEGORIES
    const brands = await Product.distinct("brand");
    const categories = await Category.find({
      isDeleted: false,
    });

    // render
    res.render("user/products", {
      products,
      categories,
      brands,

      currentPage: page,

      totalPages,

      search,
      category,
      sort,
      price,
      brand,
    });
  } catch (error) {
    console.log(error);

    res.redirect("/");
  }
};

// LOAD PRODUCT DETAILS
export const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,

      isDeleted: false,
    })

      .populate("category");

    // PRODUCT NOT FOUND
    if (!product) {
      return res.redirect("/products");
    }

    // LOAD REVIEWS
    const reviews = await Review.find({
      product: product._id,
    })

      .populate("user")

      .sort({ createdAt: -1 });

    // AVERAGE RATING
    let averageRating = 0;

    if (reviews.length > 0) {
      const totalRatings = reviews.reduce(
        (sum, review) => sum + review.rating,

        0,
      );

      averageRating = totalRatings / reviews.length;
    }
    // RELATED PRODUCTS
    const relatedProducts = await Product.find({
      category: product.category._id,

      _id: { $ne: product._id },

      isDeleted: false,
    })

      .limit(4);

    res.render("user/productDetails", {
      product,

      relatedProducts,

      reviews,

      averageRating,
    });
  } catch (error) {
    console.log(error);

    res.redirect("/products");
  }
};

// ADD REVIEW
export const addReview = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;

    const { rating, comment } = req.body;

    // VALIDATION
    if (!rating || !comment) {
      return res.redirect(`/products/${productId}`);
    }

    // CHECK PRODUCT
    const product = await Product.findById(productId);

    if (!product || product.isDeleted) {
      return res.redirect("/products");
    }

    // CHECK ALREADY REVIEWED
    const existingReview = await Review.findOne({
      user: userId,

      product: productId,
    });

    if (existingReview) {
      return res.redirect(`/products/${productId}`);
    }

    // CREATE REVIEW
    const review = new Review({
      user: userId,

      product: productId,

      rating,

      comment,
    });

    await review.save();

    res.redirect(`/products/${productId}`);
  } catch (error) {
    console.log(error);

    res.redirect("/products");
  }
};
