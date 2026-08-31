import mongoose, { trusted } from "mongoose";

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

  variants: [
    {
      size: {
        type: String,
        required: true,
        trim:true
      },
      stock: {
        type: Number,
        required: true,
        default: 0,
        min:0
      }
    }
  ],

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