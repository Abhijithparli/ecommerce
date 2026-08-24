import * as productService from "../../services/productService.js";

export const loadProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) {
      page = 1;
    }
    const limit = 5;
    const data = await productService.getAdminProducts(search, page, limit);

    res.render("admin/products", {
      products: data.products,
      categories: data.categories,
      search: data.search,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      totalProducts: data.totalProducts,
      success: req.session.success,
      error: req.session.error,
      errors: {},
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    console.error("Load products admin controller error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const loadAddProduct = async (req, res) => {
  try {
    const categories = await productService.getActiveCategories();
    res.render("admin/addProduct", {
      categories,
      errors: {},
      success: null,
      error: null,
    });
  } catch (error) {
    console.error("Load add product admin controller error:", error);
    res.redirect("/admin/products");
  }
};

export const addProduct = async (req, res) => {
  try {
    await productService.addProduct(req.body, req.files);
    req.session.success = "Product added successfully";
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Add product admin controller error:", error);
    if (error.validationErrors) {
      const categories = await productService.getActiveCategories();
      const products = await productService.getAdminProducts();
      return res.render("admin/addProduct", {
        products: products.products,
        categories,
        success: null,
        error: error.message,
        errors: error.validationErrors,
      });
    }
    req.session.error = error.message || "Failed to add product";
    res.redirect("/admin/products");
  }
};

export const loadEditProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    const categories = await productService.getActiveCategories();

    res.render("admin/editProduct", {
      product,
      categories,
      error: req.session.error,
    });
    req.session.error = null;
  } catch (error) {
    console.error("Load edit product admin controller error:", error);
    req.session.error = error.message;
    res.redirect("/admin/products");
  }
};

export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await productService.updateProduct(id, req.body, req.files);

    req.session.success = "Product updated successfully";
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Edit product error:", error);

    req.session.error = error.message || "Failed to update product";

    res.redirect(`/admin/products/${req.params.id}/edit`);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id);
    req.session.success = "Product deleted successfully";
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Delete product admin controller error:", error);
    req.session.error = error.message || "Failed to delete product";
    res.redirect("/admin/products");
  }
};

export const blockProduct = async (req, res) => {
  try {
    await productService.blockProduct(req.params.id);
    req.session.success = "Product blocked successfully";
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Block product admin controller error:", error);
    req.session.error = error.message || "Failed to block product";
    res.redirect("/admin/products");
  }
};

export const unblockProduct = async (req, res) => {
  try {
    await productService.unblockProduct(req.params.id);
    req.session.success = "Product unblocked successfully";
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Unblock product admin controller error:", error);
    req.session.error = error.message || "Failed to unblock product";
    res.redirect("/admin/products");
  }
};
