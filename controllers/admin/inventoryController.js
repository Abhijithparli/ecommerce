import * as inventoryService from "../../services/admin/inventoryService.js";


// load inventory stock management page
export const loadInventoryPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const data = await inventoryService.getAllInventory(search, page, limit);

    res.render("admin/inventory", {
      products: data.products,
      currentPage: "inventory",
      currentPageNum: data.currentPage,
      totalPages: data.totalPages,
      totalProducts: data.totalProducts,
      search,
      error: req.session.error || null,
      success: req.session.success || null,
    });

    delete req.session.error;
    delete req.session.success;
  } catch (error) {
    console.error("Load inventory page error:", error);
    res.redirect("/admin/dashboard");
  }
};


//update stock for one variant
export const updateStockAction = async (req, res) => {
  try {
    const { productId } = req.params;
    const { size, quantity } = req.body;

    await inventoryService.updateVariantStock(productId, size, quantity);

    req.session.success = `Stock updated successfully for size ${size}.`;
    res.redirect("/admin/inventory");
  } catch (error) {
    console.error("Update stock error:", error);
    req.session.error = error.message || "Failed to update stock.";
    res.redirect("/admin/inventory");
  }
};