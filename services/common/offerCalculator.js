import Offer from "../../models/offerModel.js";

/**
 * Calculates and applies the best offer (product offer vs category offer)
 * Rule: Apply the largest between product and category offer
 */

export const getActiveOffers = async () => {
  const now = new Date();
  return await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
};

/**
 * Given a product and all active offers, determine the best offer.
 * Returns { bestOffer, discountPercentage, offerType } or null
 */
export const calculateProductBestOffer = (product, activeOffers = []) => {
  if (!product) return null;

  const productId = product._id?.toString() || product.id?.toString();
  const categoryId = (product.category?._id || product.category)?.toString();

  let productOffer = null;
  let categoryOffer = null;

  for (const offer of activeOffers) {
    if (offer.offerType === "product" && offer.product?.toString() === productId) {
      if (!productOffer || offer.discountValue > productOffer.discountValue) {
        productOffer = offer;
      }
    } else if (offer.offerType === "category" && offer.category?.toString() === categoryId) {
      if (!categoryOffer || offer.discountValue > categoryOffer.discountValue) {
        categoryOffer = offer;
      }
    }
  }

  // If neither offer exists
  if (!productOffer && !categoryOffer) {
    return null;
  }

  // Determine which offer is larger
  const pDiscount = productOffer ? productOffer.discountValue : 0;
  const cDiscount = categoryOffer ? categoryOffer.discountValue : 0;

  if (pDiscount >= cDiscount) {
    return {
      offer: productOffer,
      discountPercentage: pDiscount,
      offerType: "product",
      offerName: productOffer.name,
      label: `${pDiscount}% OFF (Product Offer)`,
    };
  } else {
    return {
      offer: categoryOffer,
      discountPercentage: cDiscount,
      offerType: "category",
      offerName: categoryOffer.name,
      label: `${cDiscount}% OFF (Category Offer)`,
    };
  }
};

/**
 * Applies the best offer to an array of products or a single product
 */
export const applyOffersToProducts = async (products) => {
  const isArray = Array.isArray(products);
  const list = isArray ? products : [products];
  if (!list.length) return isArray ? [] : null;

  const activeOffers = await getActiveOffers();

  const processed = list.map((prod) => {
    // If it's a mongoose document, convert or attach directly
    const p = prod.toObject ? prod.toObject({ virtuals: true }) : { ...prod };
    const best = calculateProductBestOffer(p, activeOffers);

    if (best) {
      p.bestOffer = best;
      p.offerDiscount = best.discountPercentage;
      p.offerLabel = best.label;
      p.offerName = best.offerName;

      // Adjust regular & sale prices
      const origRegular = p.regularPrice || 0;
      p.originalRegularPrice = origRegular;
      p.discountedPrice = Math.round(origRegular * (1 - best.discountPercentage / 100));

      // Adjust variants if present
      if (p.variants && p.variants.length > 0) {
        p.variants = p.variants.map((v) => {
          const originalPrice = v.price;
          const discountedVariantPrice = Math.round(
            originalPrice * (1 - best.discountPercentage / 100)
          );
          return {
            ...v,
            originalPrice,
            discountedPrice: discountedVariantPrice,
            price: discountedVariantPrice, // Use discounted price as effective price
          };
        });
      }
    } else {
      p.bestOffer = null;
      p.offerDiscount = 0;
      if (p.variants && p.variants.length > 0) {
        p.variants = p.variants.map((v) => ({
          ...v,
          originalPrice: v.price,
          discountedPrice: v.price,
        }));
      }
    }

    return p;
  });

  return isArray ? processed : processed[0];
};

/**
 * Helper to get the discounted price for a specific variant/size of a product
 */
export const getEffectiveItemPrice = async (product, size) => {
  const activeOffers = await getActiveOffers();
  const best = calculateProductBestOffer(product, activeOffers);

  const variant = product.variants?.find(
    (v) => (v.size || "").toUpperCase() === (size || "M").toUpperCase()
  );

  const basePrice = variant ? variant.price : (product.salePrice || product.regularPrice || 0);

  if (best && best.discountPercentage > 0) {
    const discounted = Math.round(basePrice * (1 - best.discountPercentage / 100));
    return {
      price: discounted,
      originalPrice: basePrice,
      discount: basePrice - discounted,
      discountPercentage: best.discountPercentage,
      offerName: best.offerName,
      offerType: best.offerType,
    };
  }

  return {
    price: basePrice,
    originalPrice: basePrice,
    discount: 0,
    discountPercentage: 0,
    offerName: null,
    offerType: null,
  };
};
