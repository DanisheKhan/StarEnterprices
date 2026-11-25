export const PRODUCT_IMAGE_FALLBACKS = {
  'iphone-15-pro-128gb': '/images/products/iphone-15-pro.jpg',
  'samsung-s24-256gb': '/images/products/samsung-s24.jpg',
  'iphone-13-128gb-pre-owned': '/images/products/iphone-13.jpg',
  'apple-20w-adapter': '/images/products/apple-20w-adapter.jpg',
  'oneplus-12-256gb': '/images/products/oneplus-12.jpg',
  'iphone-12-128gb-pre-owned': '/images/products/iphone-12.jpg',
  'apple-airpods-pro-2': '/images/products/airpods-pro-2.jpg',
  'samsung-galaxy-watch-6': '/images/products/galaxy-watch-6.jpg',
  'sony-bravia-55-4k': '/images/products/sony-bravia-55.jpg',
  'samsung-65-crystal-4k': '/images/products/samsung-65-tv.jpg',
  'lg-260l-double-door': '/images/products/lg-refrigerator.jpg',
  'bosch-8kg-front-load': '/images/products/bosch-washer.jpg',
  '3-seater-fabric-recliner-sofa': '/images/products/recliner-sofa.jpg',
  'APL-IP15P-128': '/images/products/iphone-15-pro.jpg',
  'SAM-S24-256': '/images/products/samsung-s24.jpg',
  'APL-IP13-PO': '/images/products/iphone-13.jpg',
  'APL-20W-PWR': '/images/products/apple-20w-adapter.jpg',
  '1PL-12-256': '/images/products/oneplus-12.jpg',
  'APL-IP12-PO': '/images/products/iphone-12.jpg',
  'APL-APP2-USB': '/images/products/airpods-pro-2.jpg',
  'SAM-GW6-44': '/images/products/galaxy-watch-6.jpg',
  'SNY-KD55-4K': '/images/products/sony-bravia-55.jpg',
  'SAM-65C-4K': '/images/products/samsung-65-tv.jpg',
  'LG-GL-T292': '/images/products/lg-refrigerator.jpg',
  'BSH-WAJ28468': '/images/products/bosch-washer.jpg',
  'FUR-SOFA-3S-GRY': '/images/products/recliner-sofa.jpg',
  'symphony-70l-desert-air-cooler': '/images/products/bosch-washer.jpg',
  'SYM-70L-DST': '/images/products/bosch-washer.jpg',
  'lloyd-1-5-ton-inverter-split-ac': '/images/products/sony-bravia-55.jpg',
  'LLD-15T-5S': '/images/products/sony-bravia-55.jpg',
  'haier-190l-single-door-floral': '/images/products/lg-refrigerator.jpg',
  'HAI-190L-FLR': '/images/products/lg-refrigerator.jpg',
  '6-seater-wooden-dining-set': '/images/products/recliner-sofa.jpg',
  'FUR-DIN-6S': '/images/products/recliner-sofa.jpg',
  'moulded-stackable-chairs-set-4': '/images/products/recliner-sofa.jpg',
  'FUR-CHR-SET4': '/images/products/recliner-sofa.jpg',
  'star-luxury-hall-l-shape-sofa': '/images/products/recliner-sofa.jpg',
  'FUR-SOFA-7S-L': '/images/products/recliner-sofa.jpg',
};

export function getProductImageUrl(product) {
  if (product?.image_url) return product.image_url;
  if (product?.slug && PRODUCT_IMAGE_FALLBACKS[product.slug]) {
    return PRODUCT_IMAGE_FALLBACKS[product.slug];
  }
  if (product?.sku && PRODUCT_IMAGE_FALLBACKS[product.sku]) {
    return PRODUCT_IMAGE_FALLBACKS[product.sku];
  }
  return null;
}
