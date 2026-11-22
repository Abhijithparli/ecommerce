import * as offerService from "../../services/admin/offerService.js";

export const loadOffers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const type = req.query.type || "";
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    const limit = 8;

    const data = await offerService.getOffers(search, type, page, limit);

    res.render("admin/offers", {
      offers: data.offers,
      search: data.search,
      type: data.type,
      currentPageNum: data.currentPage,
      totalPages: data.totalPages,
      totalOffers: data.totalOffers,
      currentPage: "offers",
      success: req.session.success || null,
      error: req.session.error || null,
    });

    delete req.session.success;
    delete req.session.error;
  } catch (error) {
    console.error("Load offers error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const loadAddOffer = async (req, res) => {
  try {
    const { products, categories } = await offerService.getActiveOfferOptions();

    res.render("admin/addOffer", {
      products,
      categories,
      currentPage: "offers",
      error: req.session.error || null,
      formData: req.session.formData || {},
    });

    delete req.session.error;
    delete req.session.formData;
  } catch (error) {
    console.error("Load add offer error:", error);
    res.redirect("/admin/offers");
  }
};

export const addOffer = async (req, res) => {
  try {
    await offerService.createOffer(req.body);
    req.session.success = "Offer created successfully!";
    res.redirect("/admin/offers");
  } catch (error) {
    console.error("Add offer error:", error);
    req.session.error = error.message || "Failed to create offer.";
    req.session.formData = req.body;
    res.redirect("/admin/offers/add");
  }
};

export const loadEditOffer = async (req, res) => {
  try {
    const offer = await offerService.getOfferById(req.params.id);
    const { products, categories } = await offerService.getActiveOfferOptions();

    res.render("admin/editOffer", {
      offer,
      products,
      categories,
      currentPage: "offers",
      error: req.session.error || null,
    });

    delete req.session.error;
  } catch (error) {
    console.error("Load edit offer error:", error);
    req.session.error = error.message || "Offer not found.";
    res.redirect("/admin/offers");
  }
};

export const updateOffer = async (req, res) => {
  try {
    await offerService.updateOffer(req.params.id, req.body);
    req.session.success = "Offer updated successfully!";
    res.redirect("/admin/offers");
  } catch (error) {
    console.error("Update offer error:", error);
    req.session.error = error.message || "Failed to update offer.";
    res.redirect(`/admin/offers/edit/${req.params.id}`);
  }
};

export const toggleOffer = async (req, res) => {
  try {
    const offer = await offerService.toggleOfferStatus(req.params.id);
    const statusText = offer.isActive ? "activated" : "deactivated";
    req.session.success = `Offer "${offer.name}" ${statusText} successfully!`;

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({ success: true, isActive: offer.isActive, message: req.session.success });
    }
    res.redirect("/admin/offers");
  } catch (error) {
    console.error("Toggle offer error:", error);
    req.session.error = error.message || "Failed to toggle offer status.";
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.redirect("/admin/offers");
  }
};

export const deleteOffer = async (req, res) => {
  try {
    await offerService.deleteOffer(req.params.id);
    req.session.success = "Offer deleted successfully!";

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({ success: true, message: "Offer deleted successfully!" });
    }
    res.redirect("/admin/offers");
  } catch (error) {
    console.error("Delete offer error:", error);
    req.session.error = error.message || "Failed to delete offer.";
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.redirect("/admin/offers");
  }
};
