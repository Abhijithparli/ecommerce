import * as categoryService from "../../services/categoryService.js";

// ================= LOAD CATEGORY PAGE =================
export const loadCategories = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const data = await categoryService.getCategories(search, page, limit);

    res.render("admin/categories", {
      categories: data.categories,
      search: data.search,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      success: req.session.success,
      error: req.session.error
    });

    req.session.success = null;
    req.session.error = null;
  } catch (error) {
    console.error("Load categories error:", error);
    res.redirect("/admin/dashboard");
  }
};

// ================= LOAD ADD CATEGORY PAGE =================
export const loadAddCategory = async (req, res) => {
  try {
    res.render("admin/addCategory", {
      error: req.session.error
    });
    req.session.error = null;
  } catch (error) {
    console.error("Load add category page error:", error);
    res.redirect("/admin/categories");
  }
};

// ================= ADD CATEGORY =================
export const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    await categoryService.addCategory({ name, description });

    req.session.success = "Category added successfully";
    res.redirect("/admin/categories");
  } catch (err) {
    console.error("Add category controller error:", err);
    req.session.error = err.message || "Something went wrong";
    res.redirect("/admin/categories");
  }
};

// ================= LOAD EDIT CATEGORY PAGE =================
export const loadEditCategory = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);

    res.render("admin/editCategory", {
      category,
      error: req.session.error,
    });
    req.session.error = null;
  } catch (error) {
    console.error("Load edit category page error:", error);
    req.session.error = error.message;
    res.redirect("/admin/categories");
  }
};

// ================= EDIT CATEGORY =================
export const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    await categoryService.updateCategory(id, { name, description });

    req.session.success = "Category updated successfully";
    res.redirect("/admin/categories");
  } catch (err) {
    console.error("Edit category controller error:", err);
    req.session.error = err.message || "Update failed";
    res.redirect("/admin/categories");
  }
};

// ================= SOFT DELETE =================
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