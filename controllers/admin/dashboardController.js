import * as dashboardService from "../../services/admin/dashboardService.js";

export const loadDashboard = async (req, res) => {
  try {
    const overview = await dashboardService.getDashboardOverview();
    const rankings = await dashboardService.getTop10Rankings();
    const initialChart = await dashboardService.getChartData("monthly");

    res.render("admin/dashboard", {
      overview,
      topProducts: rankings.topProducts,
      topCategories: rankings.topCategories,
      topBrands: rankings.topBrands,
      initialChart,
      currentPage: "dashboard",
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.status(500).send("Server error loading dashboard");
  }
};

export const getChartData = async (req, res) => {
  try {
    const period = req.query.period || "monthly";
    const data = await dashboardService.getChartData(period);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({ success: false, message: "Error fetching chart data" });
  }
};

export const loadLedgerBook = async (req, res) => {
  try {
    const ledger = await dashboardService.getLedgerBook();
    res.render("admin/ledger", {
      ledger,
      currentPage: "dashboard",
    });
  } catch (error) {
    console.error("Error loading ledger book:", error);
    res.redirect("/admin/dashboard");
  }
};
