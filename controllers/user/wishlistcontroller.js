import * as wishlistService from "../../services/user/wishlistService.js";

//load wishlist page

export const loadWishlistPage = async (req,res)=>{
  try{
    const userId = req.session.user.id;
    const wishlist = await wishlistService.getUserWishlist(userId);

    res.render("user/wishlist",{
      wishlist,
      user:req.session.user, 

    });

  }catch (error){
    console.error("Load wishlist error:",error);
    res.redirect("/");
  }
};

// add a product to wishlist

export const addToWishlistAction = async(req,res)=>{
  try{
    const userId = req.session.user.id;
    const productId = req.params.productId;

    await wishlistService.addToWishlist(userId,productId);

    res.json({
      success: true,
      message:"Added to wishlist successfully"
    });
  }catch(error){
    console.error("Add to wishlist error:",error);
    res.status(error.statuscode || 500).json({
      success:false,
      message:error.message || "Failed to add to wishlist.",
    });
  }
};

//remove a product from wishlist

export const removeFromWishlistAction = async(req,res)=>{
  try{
    const userId = req.session.user.id;
    const productId = req.params.productId;

    await wishlistService.removeFromWishlist(userId,productId);

    res.json({
      success:true,
      message:"Removed from wishlist successfully",
    });
  }catch(error){
    console.error("Remove from wishlist error:",error);
    res.status(error.statuscode || 500).json({
      success:false,
      message:error.message || "Failed to remove from wishlist.",
    });
  }
};