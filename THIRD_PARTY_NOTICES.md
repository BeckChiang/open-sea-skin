# Third-party notices

Open Sea Skin vendors the following dependencies so the extension and both
Harness installation paths make no runtime network requests.

## three.js 0.178.0

- Project: https://threejs.org/
- Source: https://github.com/mrdoob/three.js/tree/r178
- License: MIT
- Copyright: © 2010–2025 three.js authors
- Local license copy: `shared/vendor/licenses/three-LICENSE.txt`

The vendored WebGPU/TSL build is minified and patched only to use local relative
imports. The optional remote WebGPU debugging import from the upstream build is
intentionally absent.

## Geist fonts

- Project: https://vercel.com/font
- Source: https://github.com/vercel/geist-font
- License: SIL Open Font License 1.1
- Local license copy: `shared/vendor/licenses/geist-OFL.txt`

The `.woff2` files are self-hosted. The font license applies to the font files;
the repository's own source code remains under the MIT License.

## Star catalogue (magnitude and colour)

- Project: d3-celestial (star data derived from the HYG database)
- Source: https://github.com/ofrohn/d3-celestial (`data/stars.6.json`), npm package `d3-celestial@0.7.35`
- License: CC BY-SA 4.0 (data); the HYG database itself is CC BY-SA 4.0
- Attribution: © Olaf Frohn / the HYG database authors (David Nash)

`shared/stars-catalog.js` is a derived, reduced table generated from that file:
2851 stars with visual magnitude ≤ 5.5, keeping right ascension, declination,
magnitude and the B−V colour index, rounded to two decimals, sorted brightest
first. The derived table is distributed under the same CC BY-SA 4.0 licence.
The constellation stick figures in `shared/stars-data.js` are unchanged from the
upstream Open Sea Skin project and are not part of this catalogue.

## Original showcase CDN dependencies

`site/` is the unchanged original reference implementation and loads three.js
0.178.0 and Geist from jsDelivr. It is kept byte-for-byte for provenance. The
self-contained extension and Harness installers do not use those CDN URLs.
