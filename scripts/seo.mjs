import { createHash } from 'node:crypto';

export const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');
export const scriptHash = value => "'sha256-" + createHash('sha256').update(value).digest('base64') + "'";
export function socialTags(title, description, url, lang = 'en') {
  const image = new URL('/share.png', url).href;
  return Object.entries({ 'og:type': 'website', 'og:site_name': 'nouploads', 'og:title': title, 'og:description': description, 'og:url': url, 'og:locale': lang === 'hi' ? 'hi_IN' : 'en_IN', 'og:image': image, 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': 'nouploads.in', 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': 'nouploads.in' }).map(([key, value]) => '<meta ' + (key.startsWith('og:') ? 'property' : 'name') + '="' + key + '" content="' + escape(value) + '">').join('');
}
