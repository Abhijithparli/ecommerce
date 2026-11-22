import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    offerType: {
      type: String,
      enum: ["product", "category", "referral"],
      required: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      default: "percentage",
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    // For referral offers: wallet bonus amounts
    referralReward: {
      type: Number,
      default: 100, // Credited to the referring user's wallet
    },
    refereeReward: {
      type: Number,
      default: 50, // Credited to the newly registered user's wallet
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to check if offer is currently active by date and flag
offerSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    (!this.startDate || this.startDate <= now) &&
    (!this.endDate || this.endDate >= now)
  );
});

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
