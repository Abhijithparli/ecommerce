import Category from "../../models/categoryModel.js";


// ================= LOAD CATEGORY PAGE =================

export const loadCategories = async (req, res) => {
  try {

    // SEARCH
    const search = req.query.search || "";

    // PAGINATION
    const page = parseInt(req.query.page) || 1;

    const limit = 10;

    const skip = (page - 1) * limit;

    // QUERY
    const query = {
      isDeleted: false,
      name: { $regex: search, $options: "i" }
    };

    // TOTAL COUNT
    const totalCategories = await Category.countDocuments(query);

    // TOTAL PAGES
    const totalPages = Math.ceil(totalCategories / limit);

    // FETCH DATA
    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("admin/categories", {
      categories,
      search,

      currentPage: page,
      totalPages,

      success: req.session.success,
      error: req.session.error
    });

    req.session.success = null;
    req.session.error = null;

  } catch (error) {

    console.log(error);

    res.redirect("/admin/dashboard");
  }
};


// ================= ADD CATEGORY =================
export const addCategory = async (req, res) => {
  try {

    let { name, description } = req.body;

    // validation
    if (!name || !name.trim()) {
      req.session.error = "Category name is required";
      return res.redirect("/admin/categories");
    }

    name = name.trim();

    // duplicate check
    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      isDeleted: false
    });

    if (existingCategory) {
      req.session.error = "Category already exists";
      return res.redirect("/admin/categories");
    }

    // create category
    await Category.create({
      name,
      description: description?.trim() || ""
    });

    req.session.success = "Category added successfully";

    res.redirect("/admin/categories");

  } catch (err) {
    console.error("Add category error:", err);

    req.session.error = "Something went wrong";

    res.redirect("/admin/categories");
  }
};


export const loadEditCategory = async (req, res) => {
  try {

    const category = await Category.findById(req.params.id);

    if (!category) {

      req.session.error = "Category not found";

      return res.redirect("/admin/categories");
    }

    res.render("admin/editCategory", {
      category,
      error: req.session.error,
    });

    req.session.error = null;

  } catch (error) {

    console.log(error);

    res.redirect("/admin/categories");
  }
};

// ================= EDIT CATEGORY =================
export const editCategory = async (req, res) => {
  try {

    const { id } = req.params;

    let { name, description } = req.body;

    // validation
    if (!name || !name.trim()) {
      req.session.error = "Category name is required";
      return res.redirect("/admin/categories");
    }

    name = name.trim();

    // duplicate check
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name}$`, $options: "i" },
      isDeleted: false
    });

    if (existingCategory) {
      req.session.error = "Another category already exists";
      return res.redirect("/admin/categories");
    }

    // update
    await Category.findByIdAndUpdate(id, {
      name,
      description: description?.trim() || ""
    });

    req.session.success = "Category updated successfully";

    res.redirect("/admin/categories");

  } catch (err) {
    console.error("Edit category error:", err);

    req.session.error = "Update failed";

    res.redirect("/admin/categories");
  }
};


// ================= SOFT DELETE =================
export const deleteCategory = async (req, res) => {
  try {

    const { id } = req.params;

    await Category.findByIdAndUpdate(id, {
      isDeleted: true
    });

    req.session.success = "Category deleted successfully";

    res.redirect("/admin/categories");

  } catch (err) {
    console.error("Delete category error:", err);

    req.session.error = "Delete failed";

    res.redirect("/admin/categories");
  }
};