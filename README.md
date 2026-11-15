# nouploads.in

Photo, signature and PDF tools for Indian exam and document forms, running fully in your browser. Crop, resize and compress photos and signatures, or remove a known PDF password, without uploading your files.

Visit [nouploads.in](https://nouploads.in). Contact: contact@nouploads.in.

## Verify the privacy claim

Inspect the source and your browser's Network panel while processing a file. The production Content Security Policy restricts connections with `connect-src 'self'`. Files are processed locally in the browser using JavaScript and WebAssembly.

Load the production site once and let its service worker finish caching, then disconnect from the internet and reload. The cached tools work offline. A first visit needs a connection to download the application; some exam pages may need to be visited before they are available offline.

## Run, test and build

Use Node.js 22.12+ or 24 LTS and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The build generates English and Hindi pages and writes the static site, including its service worker and third-party notices, to `dist/`. Use the production build and preview server to check offline behaviour and the production CSP.

## Licence

Copyright (C) 2026 nouploads.in

The code is licensed under the GNU Affero General Public License version 3 only (AGPL-3.0-only). See [LICENSE](LICENSE) for the full AGPL-3.0 text.

The nouploads name and logo are not licensed for reuse.

The exam and document data in `presets/` and the four research files read by the build or tests (`round2-raw.json`, `round5-banking-pdf.json`, `gujarat-tet-2026-10.json`, and `rrb-station-master-2026-10.json` in `research/`) are included for reproducibility. This data is not covered by the AGPL grant; all rights reserved.

The Anek fonts are licensed under OFL-1.1. See [public/fonts/OFL.txt](public/fonts/OFL.txt).

Third-party components retain their own licences. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), also served at `/THIRD-PARTY-NOTICES.md` on the built site.
