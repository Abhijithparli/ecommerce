import * as categoryService from "../../services/categoryService.js";

// ================= load category page =================
export const loadCategories = async (req, res) => {
  try {
    const search = req.query.search || "";
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) {
      page = 1;
    }
    const limit = 5;

    const data = await categoryService.getCategories(search, page, limit);

    res.render("admin/categories", {
      categories: data.categories,
      search: data.search,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      totalCategories: data.totalCategories,
      success: req.session.success,
      error: req.session.error,
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    console.error("Load categories error:", error);
    res.redirect("/admin/dashboard");
  }
};

// ================= load add category page =================
export const loadAddCategory = async (req, res) => {
  try {
    res.render("admin/addCategory", {
      error: req.session.error || null,
      errors: req.session.errors || {},
      formData: req.session.formData || {},
    });
    req.session.error = null;
    req.session.errors = null;
    req.session.formData = null;
  } catch (error) {
    console.error("Load add category page error:", error);
    res.redirect("/admin/categories");
  }
};

// ================= add category =================
export const addCategory = async (req, res) => {
  const isAjax = req.xhr || req.headers.accept?.includes("application/json") || req.is("json");
  const { name, description } = req.body;

  try {
    const newCategory = await categoryService.addCategory({ name, description });

    if (isAjax) {
      return res.status(201).json({
        success: true,
        message: "Category added successfully",
        category: newCategory,
        redirectUrl: "/admin/categories",
      });
    }

    req.session.success = "Category added successfully";
    return res.redirect("/admin/categories");
  } catch (err) {
    console.error("Add category controller error:", err);
    const validationErrors = err.validationErrors || { name: err.message };

    if (isAjax) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to add category",
        errors: validationErrors,
      });
    }

    return res.status(400).render("admin/addCategory", {
      error: err.message || "Failed to add category",
      errors: validationErrors,
      formData: { name, description },
    });
  }
};

// ================= load edit category page =================
export const loadEditCategory = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);

    res.render("admin/editCategory", {
      category,
      error: req.session.error || null,
      errors: req.session.errors || {},
      formData: { name: category.name, description: category.description },
    });
    req.session.error = null;
    req.session.errors = null;
    req.session.formData = null;
  } catch (error) {
    console.error("Load edit category page error:", error);
    req.session.error = error.message;
    res.redirect("/admin/categories");
  }
};

// ================= edit category =================
export const editCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const isAjax = req.xhr || req.headers.accept?.includes("application/json") || req.is("json");

  try {
    const updatedCategory = await categoryService.updateCategory(id, { name, description });

    if (isAjax) {
      return res.status(200).json({
        success: true,
        message: "Category updated successfully",
        category: updatedCategory,
        redirectUrl: "/admin/categories",
      });
    }

    req.session.success = "Category updated successfully";
    return res.redirect("/admin/categories");
  } catch (err) {
    console.error("Edit category controller error:", err);
    const validationErrors = err.validationErrors || { name: err.message };

    if (isAjax) {
      return res.status(400).json({
        success: false,
        message: err.message || "Update failed",
        errors: validationErrors,
      });
    }

    return res.status(400).render("admin/editCategory", {
      category: { _id: id, name, description },
      error: err.message || "Update failed",
      errors: validationErrors,
      formData: { name, description },
    });
  }
};

// ================= soft delete =================
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await categoryService.deleteCategory(id);
    req.session.success = "Category deleted successfully";
    res.redirect("/admin/categories");
  } catch (err) {
    console.error("Delete category controller error:", err);
    req.session.error = err.message || "Delete failed";
    res.redirect("/admin/categories");
  }
};
