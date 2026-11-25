export function getProductImageUrl(product) {
  if (product?.image_url) return product.image_url;
  return null;
}
