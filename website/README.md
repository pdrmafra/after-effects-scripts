# transversal.tools

An English-only static site for Transversal's free After Effects tools. Built with Astro; ready for Cloudflare Pages.

## Local development

```sh
npm ci
ASTRO_TELEMETRY_DISABLED=1 npm run dev
```

```sh
ASTRO_TELEMETRY_DISABLED=1 npm run build
ASTRO_TELEMETRY_DISABLED=1 npm run preview
```

The telemetry environment variable is useful in a restricted local filesystem. It is optional in a normal development environment.

## Content

- `src/data/tools.ts`: the five published tools, descriptions, categories and guide links.
- `src/data/github.json`: the inspected source commit and verified release asset.
- `src/pages/index.astro`: the page and interactions.
- `src/styles/global.css`: layout, type and responsive styles.
- `public/media/`: the three original GitHub GIFs, optimized MP4 versions and PNG posters. The MP4 animations contain the same visual content. Font Inspector and Depth Map have illustrative graphic covers, not product screenshots.

The catalog covers all five end-user tools listed in the source repository README. Development scripts and test fixtures are not listed as standalone products. No paid tools were supplied for this draft.

## Update the download

Run `npm run sync:github` and rebuild to point the download buttons to the newest downloadable release, including beta releases. GitHub's `/releases/latest` is deliberately avoided because it excludes prereleases. Existing metadata is preserved if GitHub is unavailable. Catalog descriptions and media are curated separately; they do not silently change on each page visit.

Source repository: https://github.com/pdrmafra/after-effects-scripts

Media was copied from the commit recorded in `src/data/github.json`. To update a demo, replace its GIF from `docs/media/` in the source repository, then use FFmpeg:

```sh
ffmpeg -i public/media/NAME.gif -an -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart public/media/NAME.mp4
ffmpeg -ss 2 -i public/media/NAME.gif -frames:v 1 public/media/NAME.png
```

## Deploy to Cloudflare Pages

1. This site lives in the `website/` directory of `pdrmafra/after-effects-scripts`. Push source changes to that repository, excluding `node_modules`, `.astro` and `dist`.
2. Connect `pdrmafra/after-effects-scripts` to a Cloudflare Pages project named `transversal-tools`, with production branch `main`.
3. Choose the Astro preset. Set **Root directory** to `website`, **Build command** to `npm run build`, and **Build output directory** to `dist`. The output path is relative to the selected root directory. `.node-version` pins Node 22.22.0, which meets Astro's runtime requirement; if overriding Node in the dashboard, use that version or a compatible newer version.
4. Add `transversal.tools` under the Pages project's Custom domains. Follow Cloudflare's DNS setup and verify HTTPS.
5. Optionally add `www.transversal.tools` and redirect it to the root domain.

For a manual upload, run the build and upload the contents of `dist` to a Pages Direct Upload project. Choose either the Git integration or Direct Upload approach when creating the Cloudflare project.

The project has no backend, visitor login, external font requests or analytics. The scripts' root-level build, tests and release packaging are separate from this website.

## Accessibility and media

Filters use native buttons with pressed states and a live result count. Videos pause off-screen and when the tab is hidden; a visible button controls each demo. Reduced-motion preferences disable autoplay. All tools and native video controls remain available without JavaScript.

The brand follows the supplied **Degrau v2** identity in `00 Marca/Logo/folha-da-marca.html`: ink `#121212`, paper `#F3F1EC`, and signal orange `#FF5A1F`. Official horizontal and stacked SVG signatures, the symbol, and the adaptive small-size favicon are copied unmodified into `public/brand/` and `public/favicon.svg`. Archived v1 artwork is not used. Logo clear space is at least twice the bar thickness.

Switzer Regular, Medium and Semibold are self-hosted from the installed brand font files (ITF/Fontshare license). The supplied SVG logo lettering is already outlined. Supporting monospaced labels retain self-hosted IBM Plex Mono from Fontsource. Regenerate the sharing image with `node scripts/create-social-card.mjs`; it uses the same brand assets and Switzer files. The source tool code is MIT-licensed; Depth Map models and dependencies have separate terms linked in its guide.
