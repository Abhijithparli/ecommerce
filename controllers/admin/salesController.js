import * as salesService from "../../services/admin/salesService.js";

export const loadSalesReport = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    const limit = 10;

    const data = await salesService.getSalesReportData({
      filter,
      startDate,
      endDate,
      page,
      limit,
    });

    res.render("admin/sales", {
      orders: data.orders,
      metrics: data.metrics,
      currentPageNum: data.currentPage,
      totalPages: data.totalPages,
      totalOrders: data.totalOrders,
      filter: data.filter,
      startDate: data.startDate,
      endDate: data.endDate,
      currentPage: "sales",
      error: req.session.error || null,
      success: req.session.success || null,
    });

    delete req.session.error;
    delete req.session.success;
  } catch (error) {
    console.error("Load sales report error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const downloadPdfReport = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    const data = await salesService.getAllFilteredOrders({
      filter,
      startDate,
      endDate,
    });

    await salesService.generatePdfReport(res, data);
  } catch (error) {
    console.error("Download PDF report error:", error);
    res.status(500).send("Error generating PDF report.");
  }
};

export const downloadExcelReport = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    const data = await salesService.getAllFilteredOrders({
      filter,
      startDate,
      endDate,
    });

    await salesService.generateExcelReport(res, data);
  } catch (error) {
    console.error("Download Excel report error:", error);
    res.status(500).send("Error generating Excel report.");
  }
};
