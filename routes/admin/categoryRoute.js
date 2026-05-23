// routes/admin/adminRoute.js
import {
  loadCategories,
  addCategory,
  editCategory,
  deleteCategory
} from "../../controllers/admin/categoryController.js";

router.get("/categories", isAdminAuthenticated, loadCategories);
router.post("/categories/add", isAdminAuthenticated, addCategory);
router.post("/categories/:id/edit", isAdminAuthenticated, editCategory);
router.post("/categories/:id/delete", isAdminAuthenticated, deleteCategory);