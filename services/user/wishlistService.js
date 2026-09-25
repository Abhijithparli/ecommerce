import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import { MESSAGES } from "../../constants/messages.js";

export const addToWishlist = async (userId, productId) => {
const product = await Product.findOne({
   _id: productId,
    isDeleted:false,
    isBlocked:false,
    }).populate("category");

    if (!product || (product.category && product.category.isDeleted)) {
        const error = new Error(MESSAGES.PRODUCT.NOT_FOUND);
       error.statusCode = 404;
        throw error;
        
    }
    let wishlist = await Wishlist.findOne({ user: userId });

    if(!wishlist){
        wishlist = new Wishlist({
            user:userId,
            products:[{product:productId}],
        });
        await wishlist.save();
        return wishlist;
    }

    //check if already in wishlist
    const alreadyExists = wishlist.products.some(
        (item) => item.product.toString() === productId.toString()
    );

    if(alreadyExists){
        const error = new Error("Product is already in your wishlist");
        error.statusCode = 400;
        throw error;
    }

   wishlist.products.push({ product: productId });
    await wishlist.save();
    return wishlist;
};

export const removeFromWishlist = async(userId,productId)=>{
    const wishlist = await Wishlist.findOne({ user: userId });

    if(!wishlist){
        return null;
    }
      wishlist.products = wishlist.products.filter(
    (item) => item.product.toString() !== productId.toString()
  );

  await wishlist.save();
  return wishlist;
};

export const getUserWishlist = async (userId) => {
  const wishlist = await Wishlist.findOne({ user: userId }).populate(
    "products.product"
  );

  if (!wishlist) {
    return { products: [] };
  }

  return wishlist;
};
