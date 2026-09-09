import * as productService from "../../services/user/productService.js";

//load product listing page
export const loadProducts = async (req, res) => {
  try {
    const data = await productService.getPublicProducts(req.query);

    res.render("user/products", {
      products: data.products,
      categories: data.categories,
      brands: data.brands,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      totalProducts: data.totalProducts,
      search: data.search,
      category: data.category,
      selectedCategories: data.selectedCategories || [],
      categoryQueryString: data.categoryQueryString || "",
      sort: data.sort,
      price: data.price,
      brand: data.brand,
      user: req.session.user || null,
      error: req.session.error || null,
      success: req.session.success || null
    });

    req.session.error = null;
    req.session.success = null;
  } catch (error) {
    console.error("Load products user controller error:", error);
    res.redirect("/");
  }
};

// LOAD PRODUCT DETAILS
export const loadProductDetails = async (req, res) => {
  try {
    const data = await productService.getPublicProductDetails(req.params.id);

    res.render("user/productDetails", {
      product: data.product,
      relatedProducts: data.relatedProducts,
      reviews: data.reviews,
      averageRating: data.averageRating,
      user: req.session.user || null
    });
  } catch (error) {
    console.error("Load product details user controller error:", error);
    if (error.isUnavailable) {
      req.session.error = "This product is currently unavailable.";
      return res.redirect("/products");
    }
    res.redirect("/products");
  }
};

// ADD REVIEW
export const addReview = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;
    const { rating, comment } = req.body;

    await productService.addProductReview(userId, productId, rating, comment);

    res.redirect(`/products/${productId}`);
  } catch (error) {
    console.error("Add review user controller error:", error);
    req.session.error = error.message;
    res.redirect(`/products/${req.params.productId}`);
  }
};
