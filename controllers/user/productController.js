import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

//load product listing profileImage
export const loadProducts = async(req,res)=>{
    try{
        //query params

        const search = req.query.search || "";
        const category = req.query.category || "";
        const sort = req.query.sort || "";
        const page = parseInt(req.query.page)||1;
        const limit = 8;
        const skip = (page - 1)*limit;

        //filter object
        let filter = {
            isDeleted :false
        };

        //search
        if(search){
            filter.name = {
                $regex:search,
                $options:"i"
            };
        }

        //category filter
        if(category){
            filter.category = category;
        }

        //sorting
        let sortOption = {
            createAt: -1
        };

        if(sort === "low-high"){
            sortOption.salePrice = 1;
        }
        else if (sort === "high-low"){
            sortOption.salePrice = -1;
        }
        else if(sort === "a-z"){
            sortOption.name = 1;
        }
        else if(sort === "z-a"){
            sortOption.name = -1;
        }
        
        //products 
        const products = await product.find(filter)
        .populate("category")
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

        //total peoducts
        const totalProducts = await products.countDocuments(filter);

        const totalpages = Math.ceil(totalProducts/limit);

        //categories
        const categories = await category.find({
            isDeleted:false
        });

        //render
        res.render("user/products",{
            products,
            categories,
            CurrentPage:page,
            totalpages,

            search,
            category,
            sort
        });
    }catch (error){
        console.log(error);
        res.redirect("/"); 
    }
};

// LOAD PRODUCT DETAILS
export const loadProductDetails = async (req, res) => {

  try {

    const product = await Product.findOne({

      _id: req.params.id,

      isDeleted: false
    })

    .populate("category");


    // PRODUCT NOT FOUND
    if (!product) {

      return res.redirect("/products");
    }


    // RELATED PRODUCTS
    const relatedProducts = await Product.find({

      category: product.category._id,

      _id: { $ne: product._id },

      isDeleted: false
    })

    .limit(4);


    res.render("user/productDetails", {

      product,
      relatedProducts
    });

  } catch (error) {

    console.log(error);

    res.redirect("/products");
  }
};
