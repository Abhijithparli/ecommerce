import Order from "../../models/orderModel.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

/**
 * Service to handle Sales Report queries and document generation
 */

export const getDateRange = (filter = "monthly", customStart = null, customEnd = null) => {
  const now = new Date();
  let start = new Date();
  let end = new Date(now);

  if (filter === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "weekly") {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (filter === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
  } else if (filter === "yearly") {
    start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
  } else if (filter === "custom" && customStart && customEnd) {
    start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
  } else {
    // Default: monthly
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

export const getSalesReportData = async ({
  filter = "monthly",
  startDate = null,
  endDate = null,
  page = 1,
  limit = 10,
}) => {
  const { start, end } = getDateRange(filter, startDate, endDate);

  // Match orders created within range and not cancelled or returned
  const matchQuery = {
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ["Cancelled", "Returned"] },
  };

  // Aggregate summary metrics
  const summaryAgg = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalSalesCount: { $sum: 1 },
        totalGrossAmount: { $sum: "$totalPrice" },
        totalDiscountAmount: { $sum: "$discount" },
        totalNetAmount: { $sum: "$finalPrice" },
      },
    },
  ]);

  const metrics = summaryAgg.length > 0
    ? summaryAgg[0]
    : {
        totalSalesCount: 0,
        totalGrossAmount: 0,
        totalDiscountAmount: 0,
        totalNetAmount: 0,
      };

  const skip = (page - 1) * limit;
  const totalOrders = await Order.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalOrders / limit) || 1;

  const orders = await Order.find(matchQuery)
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    orders,
    metrics,
    currentPage: page,
    totalPages,
    totalOrders,
    filter,
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
};

export const getAllFilteredOrders = async ({ filter = "monthly", startDate = null, endDate = null }) => {
  const { start, end } = getDateRange(filter, startDate, endDate);
  const matchQuery = {
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ["Cancelled", "Returned"] },
  };

  const summaryAgg = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalSalesCount: { $sum: 1 },
        totalGrossAmount: { $sum: "$totalPrice" },
        totalDiscountAmount: { $sum: "$discount" },
        totalNetAmount: { $sum: "$finalPrice" },
      },
    },
  ]);

  const metrics = summaryAgg.length > 0
    ? summaryAgg[0]
    : {
        totalSalesCount: 0,
        totalGrossAmount: 0,
        totalDiscountAmount: 0,
        totalNetAmount: 0,
      };

  const orders = await Order.find(matchQuery)
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  return {
    orders,
    metrics,
    filter,
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
};

/**
 * Generate PDF Sales Report
 */
export const generatePdfReport = async (res, { filter, startDate, endDate, orders, metrics }) => {
  const doc = new PDFDocument({ margin: 36, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=HeadShield_Sales_Report_${filter}_${startDate}_to_${endDate}.pdf`
  );

  doc.pipe(res);

  // Brand Header
  doc
    .fillColor("#ea580c")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("HEADSHIELD", 36, 36)
    .fillColor("#374151")
    .fontSize(10)
    .font("Helvetica")
    .text("Premium Motorcycle Helmets & Gear | Executive Sales Report", 36, 62);

  // Report Info Box
  doc
    .rect(36, 80, 523, 44)
    .fillAndStroke("#f9fafb", "#e5e7eb");

  doc
    .fillColor("#111827")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(`Report Period: ${filter.toUpperCase()}`, 46, 88)
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#4b5563")
    .text(`Date Range: ${startDate} to ${endDate}  |  Generated on: ${new Date().toLocaleString()}`, 46, 104);

  // KPI Metrics Grid
  const cardY = 135;
  const cardW = 125;
  const cardH = 46;

  const kpis = [
    { label: "Overall Sales Count", val: `${metrics.totalSalesCount} Orders` },
    { label: "Gross Order Amount", val: `INR ${metrics.totalGrossAmount.toLocaleString()}` },
    { label: "Total Discounts", val: `INR ${metrics.totalDiscountAmount.toLocaleString()}` },
    { label: "Net Sales Revenue", val: `INR ${metrics.totalNetAmount.toLocaleString()}` },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 36 + idx * (cardW + 8);
    doc.rect(x, cardY, cardW, cardH).fillAndStroke("#f3f4f6", "#d1d5db");
    doc.fillColor("#6b7280").fontSize(7).font("Helvetica").text(kpi.label.toUpperCase(), x + 8, cardY + 8);
    doc.fillColor("#ea580c").fontSize(11).font("Helvetica-Bold").text(kpi.val, x + 8, cardY + 24);
  });

  // Table Headers
  const tableY = 195;
  doc.rect(36, tableY, 523, 20).fill("#1f2937");

  doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
  doc.text("ORDER ID", 42, tableY + 6);
  doc.text("DATE", 130, tableY + 6);
  doc.text("CUSTOMER", 190, tableY + 6);
  doc.text("PAYMENT", 290, tableY + 6);
  doc.text("STATUS", 355, tableY + 6);
  doc.text("DISCOUNT", 420, tableY + 6);
  doc.text("NET AMOUNT", 485, tableY + 6);

  // Table Rows
  let curY = tableY + 22;
  doc.font("Helvetica").fontSize(7.5);

  orders.forEach((order, index) => {
    if (curY > 750) {
      doc.addPage();
      curY = 36;
      // Re-draw headers on new page
      doc.rect(36, curY, 523, 20).fill("#1f2937");
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
      doc.text("ORDER ID", 42, curY + 6);
      doc.text("DATE", 130, curY + 6);
      doc.text("CUSTOMER", 190, curY + 6);
      doc.text("PAYMENT", 290, curY + 6);
      doc.text("STATUS", 355, curY + 6);
      doc.text("DISCOUNT", 420, curY + 6);
      doc.text("NET AMOUNT", 485, curY + 6);
      curY += 22;
      doc.font("Helvetica").fontSize(7.5);
    }

    if (index % 2 === 0) {
      doc.rect(36, curY - 2, 523, 16).fill("#f9fafb");
    }

    doc.fillColor("#111827");
    doc.text(order.orderId || "N/A", 42, curY);
    doc.text(new Date(order.createdAt).toLocaleDateString(), 130, curY);
    doc.text(order.user ? order.user.name.substring(0, 18) : "Guest", 190, curY);
    doc.text(order.paymentMethod || "COD", 290, curY);
    doc.text(order.status || "Placed", 355, curY);
    doc.fillColor("#dc2626").text(`INR ${order.discount || 0}`, 420, curY);
    doc.fillColor("#16a34a").font("Helvetica-Bold").text(`INR ${order.finalPrice}`, 485, curY);
    doc.font("Helvetica");

    curY += 16;
  });

  doc.end();
};

/**
 * Generate Excel Sales Report (.xlsx)
 */
export const generateExcelReport = async (res, { filter, startDate, endDate, orders, metrics }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HeadShield Admin";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Sales Report");

  // Title Block
  worksheet.mergeCells("A1:H1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "HEADSHIELD - EXECUTIVE SALES REPORT";
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Metadata
  worksheet.addRow([]);
  worksheet.addRow(["Report Period:", filter.toUpperCase(), "Date Range:", `${startDate} to ${endDate}`]);
  worksheet.addRow(["Generated On:", new Date().toLocaleString(), "", ""]);
  worksheet.addRow([]);

  // Summary Metrics Block
  worksheet.addRow(["OVERALL SUMMARY METRICS"]);
  worksheet.getCell("A6").font = { bold: true, size: 12 };

  worksheet.addRow(["Total Sales Count", metrics.totalSalesCount]);
  worksheet.addRow(["Gross Order Amount", metrics.totalGrossAmount]);
  worksheet.addRow(["Total Discounts", metrics.totalDiscountAmount]);
  worksheet.addRow(["Net Sales Revenue", metrics.totalNetAmount]);
  worksheet.addRow([]);

  // Table Headers
  const headerRow = worksheet.addRow([
    "Order ID",
    "Date",
    "Customer Name",
    "Customer Email",
    "Payment Method",
    "Order Status",
    "Gross Amount (INR)",
    "Discount (INR)",
    "Net Amount (INR)",
  ]);

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  headerRow.height = 24;

  // Add Data Rows
  orders.forEach((order) => {
    worksheet.addRow([
      order.orderId,
      new Date(order.createdAt).toLocaleDateString(),
      order.user ? order.user.name : "Guest",
      order.user ? order.user.email : "N/A",
      order.paymentMethod,
      order.status,
      order.totalPrice,
      order.discount || 0,
      order.finalPrice,
    ]);
  });

  // Auto-fit column widths
  worksheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 10;
      if (len > maxLen) maxLen = Math.min(len + 3, 35);
    });
    col.width = maxLen;
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=HeadShield_Sales_Report_${filter}_${startDate}_to_${endDate}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
};
