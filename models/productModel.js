import mongoose from "mongoose";

const productSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    required: true
  },

  brand: {
    type: String,
    required: true
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },

  regularPrice: {
    type: Number,
    required: true
  },

  salePrice: {
    type: Number,
    required: true
  },

  quantity: {
    type: Number,
    required: true
  },

  images: [{
    type: String
  }],
  
  highlights: [
  {
    type: String
  }
],

  isBlocked: {
    type: Boolean,
    default: false
  },

  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

const Product = mongoose.model("Product", productSchema);

export default Product;