import { mkdir, writeFile } from 'node:fs/promises';
import { localChrome } from './chrome-local.mjs';

const browser = await localChrome('public');
try {
  await browser.send('Page.navigate', { url: browser.origin + '/mark.svg' });
  await browser.wait('document.readyState === "complete"');
  await mkdir('public/icons', { recursive:true });
  for (const [name, size, maskable] of [['icon-192',192,false],['icon-512',512,false],['maskable-512',512,true]]) {
    const data = await browser.evaluate('(async () => { const image = new Image(); image.src = "/mark.svg"; await image.decode(); const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas"); canvas.width = canvas.height = ' + size + '; const context = canvas.getContext("2d"); context.fillStyle = "#285c43"; context.fillRect(0,0,' + size + ',' + size + '); const padding = ' + (maskable ? size * .15 : 0) + '; context.drawImage(image,padding,padding,' + size + '-padding*2,' + size + '-padding*2); return canvas.toDataURL("image/png").split(",")[1]; })()');
    await writeFile('public/icons/' + name + '.png', Buffer.from(data,'base64'));
  }
  console.log('Generated three PNG icons from public/mark.svg');
  const share = await browser.evaluate('(async () => { const image = new Image(); image.src = "/share.svg"; await image.decode(); const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas"); canvas.width = 1200; canvas.height = 630; canvas.getContext("2d").drawImage(image,0,0); return canvas.toDataURL("image/png").split(",")[1]; })()');
  await writeFile('public/share.png', Buffer.from(share, 'base64'));
  console.log('Generated 1200x630 share PNG from public/share.svg');
} finally { await browser.close(); }
