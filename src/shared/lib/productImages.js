import { SUPABASE_ORIGIN } from './supabase';

export function getProductImageUrl(product) {
  const url = product?.image_url;
  if (!url) return null;

  if (typeof window !== 'undefined') {
    if (SUPABASE_ORIGIN && url.startsWith(`${SUPABASE_ORIGIN}/storage/`)) {
      return url.replace(SUPABASE_ORIGIN, `${window.location.origin}/sb`);
    }
    const sbIdx = url.indexOf('/sb/storage/');
    if (sbIdx !== -1 && /^https?:\/\//i.test(url)) {
      return `${window.location.origin}${url.slice(sbIdx)}`;
    }
  }

  return url;
}
