export const MESSAGES = Object.freeze({
  COMMON: Object.freeze({
    SERVER_ERROR: "Server error",
    SOMETHING_WENT_WRONG: "Something went wrong",
    ALL_FIELDS_REQUIRED: "All fields are required",
    SESSION_EXPIRED: "Session expired",
    UNAUTHORIZED: "Unauthorized"
  }),

  AUTH: Object.freeze({
    INVALID_CREDENTIALS: "Invalid credentials",
    PASSWORDS_DO_NOT_MATCH: "Passwords do not match",
    INVALID_OTP: "Invalid OTP code",
    OTP_EXPIRED: "OTP has expired",
    ACCOUNT_BLOCKED: "Your account has been blocked by admin"
  }),

  PRODUCT: Object.freeze({
    NOT_FOUND: "Product not found",
    ADDED: "Product added successfully",
    UPDATED: "Product updated successfully",
    DELETED: "Product deleted successfully",
    BLOCKED: "Product blocked successfully",
    UNBLOCKED: "Product unblocked successfully"
  }),

  CATEGORY: Object.freeze({
    NOT_FOUND: "Category not found",
    ADDED: "Category added successfully",
    UPDATED: "Category updated successfully",
    DELETED: "Category deleted successfully"
  }),

  ORDER: Object.freeze({
    NOT_FOUND: "Order not found",
    PLACED: "Order placed successfully!",
    CANCELLED: "Order cancelled successfully!"
  }),

  CART: Object.freeze({
    NOT_FOUND: "Cart not found",
    ADDED: "Product added to cart successfully",
    ITEM_REMOVED: "Item removed from cart",
    EMPTY: "Your cart is empty",
    MAX_QUANTITY_REACHED: "Maximum quantity limit of 5 reached for this item",
    OUT_OF_STOCK: "This item/variant is currently out of stock",
    INSUFFICIENT_STOCK: "Requested quantity exceeds available stock",
    PRODUCT_UNAVAILABLE: "This product is no longer available",
    VARIANT_UNAVAILABLE: "Selected size variant is not available",
    MIN_QUANTITY_REACHED: "Minimum quantity is 1",
    HAS_UNAVAILABLE_ITEMS: "Please remove unavailable or out-of-stock items before checkout"
  }),

  USER: Object.freeze({
    NOT_FOUND: "User not found",
    BLOCKED: "User blocked successfully",
    UNBLOCKED: "User unblocked successfully",
    PROFILE_UPDATED: "Profile updated successfully",
    EMAIL_UPDATED: "Email updated successfully"
  }),

  ADDRESS: Object.freeze({
    NOT_FOUND: "Address not found",
    ADDED: "Address added successfully",
    UPDATED: "Address updated",
    DELETED: "Address deleted",
    DEFAULT_UPDATED: "Default address updated"
  }),

  VALIDATION: Object.freeze({
    REQUIRED_FIELD: "This field is required",
    INVALID_ID: "Invalid ID format",
    CATEGORY: Object.freeze({
      NAME_REQUIRED: "Category name is required",
      NAME_MIN: "Category name must be at least 3 characters long",
      NAME_MAX: "Category name must not exceed 50 characters",
      NAME_INVALID: "Category name can only contain letters, numbers, spaces, hyphens (-), and ampersands (&)",
      NAME_NO_LETTER: "Category name must contain at least one letter",
      EXISTS: "A category with this name already exists",
      DESC_REQUIRED: "Description is required",
      DESC_MIN: "Description must be at least 5 characters long",
      DESC_MAX: "Description cannot exceed 500 characters"
    }),
    PRODUCT: Object.freeze({
      NAME_REQUIRED: "Product name is required",
      NAME_MIN: "Product name must be at least 3 characters long",
      NAME_MAX: "Product name must not exceed 100 characters",
      NAME_EXISTS: "Product name already exists",
      BRAND_REQUIRED: "Brand is required",
      BRAND_MIN: "Brand must be at least 2 characters long",
      BRAND_MAX: "Brand must not exceed 50 characters",
      CATEGORY_REQUIRED: "Please select a category",
      CATEGORY_INVALID: "Please select a valid active category",
      REGULAR_PRICE_REQUIRED: "Regular price is required",
      REGULAR_PRICE_INVALID: "Regular price must be a valid number greater than 0",
      REGULAR_PRICE_MAX: "Regular price cannot exceed 1,000,000",
      SALE_PRICE_REQUIRED: "Sale price is required",
      SALE_PRICE_INVALID: "Sale price must be a valid number greater than 0",
      SALE_PRICE_EXCEEDS_REGULAR: "Sale price cannot be greater than regular price",
      DESCRIPTION_REQUIRED: "Description is required",
      DESCRIPTION_MIN: "Description must be at least 10 characters long",
      DESCRIPTION_MAX: "Description cannot exceed 2000 characters",
      HIGHLIGHTS_MAX: "Highlights cannot exceed 500 characters",
      IMAGES_MIN: "Minimum 3 product images are required",
      VARIANTS_REQUIRED: "At least one size variant is required",
      VARIANT_SIZE_REQUIRED: "Size is required for all variants",
      VARIANT_SIZE_INVALID: "Allowed sizes are S, M, L, XL",
      VARIANT_SIZE_DUPLICATE: "Duplicate variant size is not allowed",
      VARIANT_PRICE_REQUIRED: "Price is required for all variants",
      VARIANT_PRICE_INVALID: "Price must be a valid number greater than 0 and cannot exceed 1,000,000",
      VARIANT_STOCK_REQUIRED: "Stock quantity is required for all variants",
      VARIANT_STOCK_INVALID: "Stock must be a non-negative whole integer (0 or greater)"
    })
  })
});