import assert from 'node:assert/strict';
import { localChrome } from './chrome-local.mjs';

const browser = await localChrome('dist', { cleanUrls: true });
const photo = (width, height) => `(async () => {
  const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, ${width}, ${height});
  gradient.addColorStop(0, '#3a7'); gradient.addColorStop(1, '#fa5');
  context.fillStyle = gradient; context.fillRect(0, 0, ${width}, ${height});
  for (let i = 0; i < 30; i++) { context.fillStyle = 'hsl(' + (i * 47 % 360) + ',60%,55%)'; context.beginPath(); context.arc((i * 977) % ${width}, (i * 613) % ${height}, ${Math.floor(height / 10)}, 0, 7); context.fill(); }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'p.jpg', { type: 'image/jpeg' }));
  const input = document.getElementById('file'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
})()`;
const output = `(async () => {
  const blob = window.__outputBlobs.get(document.getElementById('download').href);
  const image = await createImageBitmap(blob);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes: blob.size, width: image.width, height: image.height, magic: [bytes[0], bytes[1], bytes[bytes.length - 2], bytes[bytes.length - 1]], status: document.getElementById('status').textContent, warning: document.getElementById('warning').hidden };
})()`;
const create = async (path, prepare) => {
  await browser.navigate(path);
  await browser.wait('!!document.getElementById("file")');
  if (prepare) await browser.evaluate(prepare);
  await browser.evaluate(photo(4000, 3000));
  await browser.wait('!document.getElementById("generate").disabled');
  await browser.evaluate('document.getElementById("generate").click()');
  await browser.wait('!document.getElementById("result").hidden');
  return browser.evaluate(output);
};
try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__outputBlobs = new Map(); const create = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { const url = create(blob); window.__outputBlobs.set(url, blob); return url; };' });
  const signature = await create('/exam/ibps-po/', 'document.querySelector("input[value=signature]").click()');
  assert.equal(signature.width, 140);
  assert.equal(signature.height, 60);
  assert.ok(signature.bytes >= 10 * 1024 && signature.bytes < 20 * 1024, 'signature padded into 10-20 KB: ' + signature.bytes);
  assert.deepEqual(signature.magic.slice(0, 2), [255, 216]);
  assert.deepEqual(signature.magic.slice(2), [255, 217]);
  assert.equal(signature.warning, true);
  const compressed = await create('/compress-photo/', 'document.getElementById("general-max").value="30";document.getElementById("general-max").dispatchEvent(new Event("input",{bubbles:true}))');
  assert.ok(compressed.bytes < 30 * 1024, 'compress-photo under 30 KB: ' + compressed.bytes);
  assert.ok(compressed.width < 4000, 'pixels reduced: ' + compressed.width);
  assert.match(compressed.status, /pixel size was also reduced/);
  const exam = await create('/exam/ibps-po/', null);
  assert.equal(exam.width, 200);
  assert.equal(exam.height, 230);
  console.log('Fit checks passed: signature padded to ' + signature.bytes + ' bytes, 12 MP photo reduced to ' + compressed.width + 'x' + compressed.height + ' at ' + compressed.bytes + ' bytes.');
} finally { await browser.close(); }
