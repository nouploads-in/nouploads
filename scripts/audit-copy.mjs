import assert from 'node:assert/strict';

export function auditCopy(pages) {
  for (const [path, html] of pages) {
    assert.doesNotMatch(html, /supplied research|URL pending|repo-url-pending/i, path + ': internal copy');
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(html + '\n' + visible, /[\p{L}\p{N}]\s+\?\s+[\p{L}\p{N}]/u, path + ': question-mark separator');
    if (!path.startsWith('/hi/')) continue;
    assert.doesNotMatch(html, /मुफ्त/, path + ': glossary');
    const twin = pages.get(path.slice(3));
    if (!twin) continue;
    const title = source => source.match(/<title>([^<]+)<\/title>/)[1];
    assert.equal(/\bKB\b/.test(title(html)), /\bKB\b/.test(title(twin)), path + ': KB title parity');
  }
}
