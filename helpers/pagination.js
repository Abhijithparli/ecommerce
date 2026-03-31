// //  users listing with pagination, search, and sorting
// export const listUsers = async (req, res) => {
//   try { 
//     // Session already checked by middleware

//     // Get query parameters
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 5;
//     const searchQuery = req.query.search || "";
//     const filterStatus = req.query.status || "all";
    
//     const skip = (page - 1) * limit;