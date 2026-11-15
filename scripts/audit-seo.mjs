import assert from 'node:assert/strict';
import { scriptHash } from './seo.mjs';

const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
export function auditSeo(pages) {
  const titles = new Set();
  const descriptions = new Set();
  const canonicals = new Map();
  for (const [path, html] of pages) {
    const title = decode(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '');
    const meta = key => decode(html.match(new RegExp('<meta (?:name|property)="' + key + '" content="([^"]+)"'))?.[1] ?? '');
    const description = meta('description');
    assert.ok(title.length > 0 && title.length <= 60, path + ': title length');
    assert.ok(!titles.has(title), path + ': duplicate title');
    titles.add(title);
    assert.ok(description.length >= 120 && description.length <= 160, path + ': description length ' + description.length);
    assert.ok(!descriptions.has(description), path + ': duplicate description');
    descriptions.add(description);
    assert.equal([...html.matchAll(/<h1\b/gi)].length, 1, path + ': H1');
    let previous = 0;
    for (const heading of html.matchAll(/<h([1-6])\b/gi)) {
      const level = Number(heading[1]);
      assert.ok(level <= previous + 1, path + ': skipped heading');
      previous = level;
    }
    assert.ok(html.includes('<html lang="' + (path.startsWith('/hi/') ? 'hi' : 'en') + '"'), path + ': language');
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical, 'https://nouploads.in' + path.replace(/index.html$/, '').replace('/pdf-unlock.html', '/pdf-unlock'), path + ': canonical');
    canonicals.set(canonical, html);
    assert.equal(meta('og:title'), title, path + ': og title');
    assert.equal(meta('og:description'), description, path + ': og description');
    assert.equal(meta('og:url'), canonical, path + ': og URL');
    assert.equal(meta('og:type'), 'website', path + ': og type');
    assert.equal(meta('og:image'), 'https://nouploads.in/share.png', path + ': same-origin image');
    assert.equal(meta('twitter:card'), 'summary_large_image', path + ': Twitter card');
    assert.equal(meta('twitter:title'), title, path + ': Twitter title');
    assert.equal(meta('twitter:description'), description, path + ': Twitter description');
    assert.equal(meta('twitter:image'), meta('og:image'), path + ': Twitter image');
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length > 0, path + ': JSON-LD missing');
    const policy = decode(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '');
    const data = scripts.map(match => {
      assert.ok(policy.includes(scriptHash(match[1])), path + ': JSON-LD hash');
      const value = JSON.parse(match[1]);
      assert.equal(value['@context'], 'https://schema.org');
      return value;
    });
    if (/^\/(hi\/)?(?:index|pdf-unlock)\.html$/.test(path)) {
      const app = data.find(value => value['@type'] === 'WebApplication');
      assert.ok(app, path + ': WebApplication');
      assert.equal(app.offers.price, '0');
      assert.equal(app.isAccessibleForFree, true);
      assert.ok(app.featureList.some(value => /offline|ऑफ़लाइन/i.test(value)));
    }
    if (path.includes('/exam/')) {
      const breadcrumb = data.find(value => value['@type'] === 'BreadcrumbList');
      assert.ok(breadcrumb, path + ': breadcrumbs');
      assert.equal(breadcrumb.itemListElement.at(-1).item, canonical);
      assert.equal([...html.matchAll(/hreflang="/g)].length, html.includes('hreflang="hi"') ? 3 : 2, path + ': alternate count');
    }
  }
  for (const [url, html] of canonicals) {
    for (const alternate of html.matchAll(/rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
      const target = canonicals.get(alternate[2]);
      assert.ok(target, url + ': alternate target exists');
      assert.ok(target.includes('hreflang="' + (url.includes('/hi/') ? 'hi' : 'en') + '" href="' + url + '"'), url + ': symmetric alternate');
      assert.ok(target.includes('<html lang="' + (alternate[1] === 'x-default' ? 'en' : alternate[1]) + '"'), url + ': alternate language');
    }
  }
}
