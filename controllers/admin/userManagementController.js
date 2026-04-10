import User from "../../models/userModel.js";

// user block
export const blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    await User.findByIdAndUpdate(userId, { isBlocked: true });
    
    res.status(200).json({ 
      success: true, 
      message: "User blocked successfully" 
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error blocking user" 
    });
  }
};

//user unblock
export const unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    await User.findByIdAndUpdate(userId, { isBlocked: false });
    
    res.status(200).json({ 
      success: true, 
      message: "User unblocked successfully" 
    });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error unblocking user" 
    });
  }
};

//  users listing with pagination, search, and sorting:

export const listUsers = async (req, res) => {
  try { 
    // Session already checked by middleware

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const searchQuery = req.query.search || "";
    const filterStatus = req.query.status || "all";
    
    const skip = (page - 1) * limit;

    // Build filter object   
    let filter = {};
    
    if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } }
      ];
    }

    if (filterStatus === "blocked") {
      filter.isBlocked = true;
    } else if (filterStatus === "unblocked") {
      filter.isBlocked = false;
    }

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-password");

    res.render("admin/userManagementpage", { 
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      searchQuery,
      filterStatus,
      limit
    });

  } catch (error) {
    console.error("Error listing users:", error);
    res.render("admin/userManagementpage", { 
      users: [],
      currentPage: 1,
      totalPages: 0,
      totalUsers: 0,
      searchQuery: "",
      filterStatus: "all",
      limit: 10,
      error: "Error loading users"
    });
  }
};

