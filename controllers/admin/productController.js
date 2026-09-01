import * as productService from "../../services/productService.js";
import { MESSAGES } from "../../constants/messages.js";

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
      formData: {},
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
    req.session.success = MESSAGES.PRODUCT.ADDED;
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Add product admin controller error:", error);
    const categories = await productService.getActiveCategories();
    const parsedVariants = productService.parseVariants(req.body);

    return res.status(400).render("admin/addProduct", {
      categories,
      formData: {
        ...req.body,
        variants: parsedVariants
      },
      success: null,
      error: error.message || "Failed to add product",
      errors: error.validationErrors || {},
    });
  }
};

export const loadEditProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    const categories = await productService.getActiveCategories();

    res.render("admin/editProduct", {
      product,
      categories,
      formData: null,
      errors: req.session.errors || {},
      error: req.session.error || null,
    });
    req.session.error = null;
    req.session.errors = null;
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
    req.session.success = MESSAGES.PRODUCT.UPDATED;
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Edit product error:", error);
    const categories = await productService.getActiveCategories();
    let product = null;

    try {
      product = await productService.getProductById(req.params.id);
    } catch {
      product = { _id: req.params.id, images: [], variants: [] };
    }

    const parsedVariants = productService.parseVariants(req.body);
    const productObj = product.toObject ? product.toObject() : product;

    return res.status(400).render("admin/editProduct", {
      product: {
        ...productObj,
        ...req.body,
        _id: req.params.id,
        variants: parsedVariants.length > 0 ? parsedVariants : (productObj.variants || [])
      },
      categories,
      formData: {
        ...req.body,
        variants: parsedVariants
      },
      errors: error.validationErrors || {},
      error: error.message || "Failed to update product",
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id);
req.session.success = MESSAGES.PRODUCT.DELETED;
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
    req.session.success = MESSAGES.PRODUCT.BLOCKED;
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
    req.session.success = MESSAGES.PRODUCT.UNBLOCKED
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Unblock product admin controller error:", error);
    req.session.error = error.message || "Failed to unblock product";
    res.redirect("/admin/products");
  }
};
