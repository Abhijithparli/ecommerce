import mongoose from "mongoose";

const productSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },

  description: {
    type: String, 
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },

  brand: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
   
  regularPrice: {
    type: Number,
    required: false,
    min: 0.01,
    max: 1000000
  },

  salePrice: {
    type: Number,
    required: false,
    min: 0.01,
    max: 1000000
  },

  variants: [
    {
      size: {
        type: String,
        required: true,
        trim: true,
        enum: ["S", "M", "L", "XL"]
      },
      price: {
        type: Number,
        required: true,
        min: 0.01,
        max: 1000000
      },
      stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
      }
    }
  ],

  images: [{
    type: String
  }],
  
  highlights: [
    {
      type: String,
      trim: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total quantity (sum of all variant stock)
productSchema.virtual("quantity").get(function () {
  if (!this.variants || this.variants.length === 0) return 0;
  return this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
});

const Product = mongoose.model("Product", productSchema);

export default Product;