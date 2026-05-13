import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";

export const loadProducts = async (req, res) => {

  try {

    const products = await Product.find({
      isDeleted: false
    })
    .populate("category")
    .sort({ createdAt: -1 });

    const categories = await Category.find({
      isDeleted: false
    });

    res.render("admin/products", {
      products,
      categories,
      success: req.session.success,
      error: req.session.error
    });

    req.session.success = null;
    req.session.error = null;

  } catch (error) {

    console.log(error);

    res.redirect("/admin/dashboard");
  }
};

export const addProduct = async (req, res) => {

  try {

    const {
      name,
      description,
      brand,
      category,
      regularPrice,
      salePrice,
      quantity
    } = req.body;

    // VALIDATION

    if (
      !name ||
      !description ||
      !brand ||
      !category ||
      !regularPrice ||
      !salePrice ||
      !quantity
    ) {

      req.session.error = "All fields are required";

      return res.redirect("/admin/products");
    }

    // MINIMUM 3 IMAGES

    if (!req.files || req.files.length < 3) {

      req.session.error = "Minimum 3 product images required";

      return res.redirect("/admin/products");
    }

    // image path

   const imagePaths = [];

for (let i = 0; i < req.files.length; i++) {

  const file = req.files[i];

  const fileName = Date.now() + "-" + i + ".webp";

  const uploadPath = path.join(
    "public/uploads/products",
    fileName
  );

  // RESIZE + COMPRESS
  await sharp(file.buffer)

    .resize(800, 800)

    .webp({ quality: 80 })

    .toFile(uploadPath);

  imagePaths.push("/uploads/products/" + fileName);
}

    // CREATE PRODUCT

    const newProduct = new Product({

      name,
      description,
      brand,
      category,

      regularPrice,
      salePrice,
      quantity,

      images: imagePaths
    });

    await newProduct.save();

    req.session.success = "Product added successfully";

    res.redirect("/admin/products");

  } catch (error) {

    console.log(error);

    req.session.error = "Something went wrong";

    res.redirect("/admin/products");
  }
}; 


export const loadEditProduct = async (req, res) => {

  try {

    const product = await Product.findById(req.params.id);

    const categories = await Category.find({
      isDeleted: false
    });

    if (!product) {

      req.session.error = "Product not found";

      return res.redirect("/admin/products");
    }

    res.render("admin/editProduct", {

      product,
      categories,

      error: req.session.error
    });

    req.session.error = null;

  } catch (error) {

    console.log(error);

    res.redirect("/admin/products");
  }
};
   
export const editProduct = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      name,
      description,
      brand,
      category,
      regularPrice,
      salePrice,
      quantity
    } = req.body;

    const product = await Product.findById(id);

    if (!product) {

      req.session.error = "Product not found";

      return res.redirect("/admin/products");
    }

    // VALIDATION
    if (
      !name ||
      !description ||
      !brand ||
      !category ||
      !regularPrice ||
      !salePrice ||
      !quantity
    ) {

      req.session.error = "All fields are required";

      return res.redirect(`/admin/products/${id}/edit`);
    }

    // keep old images 
    let images = product.images;

    if (req.files && req.files.length > 0) {

     images = [];

for (let i = 0; i < req.files.length; i++) {

  const file = req.files[i];

  const fileName = Date.now() + "-" + i + ".webp";

  const uploadPath = path.join(
    "public/uploads/products",
    fileName
  );

  await sharp(file.buffer)

    .resize(800, 800)

    .webp({ quality: 80 })

    .toFile(uploadPath);

  images.push("/uploads/products/" + fileName);
}
    }
    
    // update product 
    await Product.findByIdAndUpdate(id, {

      name,
      description,
      brand,
      category,

      regularPrice,
      salePrice,
      quantity,

      images
    });

    req.session.success = "Product updated successfully";

    res.redirect("/admin/products");

  } catch (error) {

    console.log(error);

    req.session.error = "Something went wrong";

    res.redirect("/admin/products");
  }
};  


// delete product (soft delete)
export const deleteProduct = async (req, res) => {

  try {

    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {

      req.session.error = "Product not found";

      return res.redirect("/admin/products");
    }

    // soft delete
    product.isDeleted = true;

    await product.save();

    req.session.success = "Product deleted successfully";

    res.redirect("/admin/products");

  } catch (error) {

    console.log(error);

    req.session.error = "Something went wrong";

    res.redirect("/admin/products");
  }
};

