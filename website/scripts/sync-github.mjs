import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Releases include prereleases: this repository currently distributes beta builds.
// An explicit release asset is used because GitHub's /latest skips prereleases.
const metadataFile = new URL('../src/data/github.json', import.meta.url);
const prior = JSON.parse(await readFile(metadataFile, 'utf8'));
const response = await fetch('https://api.github.com/repos/pdrmafra/after-effects-scripts/releases?per_page=100', {
  headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'transversal-tools-site' },
});
if (!response.ok) throw new Error(`GitHub returned ${response.status}; existing release metadata was preserved.`);
const releases = await response.json();
const release = releases
  .filter(item => !item.draft && item.assets.some(asset => asset.name.startsWith('after-effects-scripts-') && asset.name.endsWith('.zip')))
  .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
if (!release) throw new Error('No downloadable release found; existing metadata was preserved.');
const asset = release.assets.find(asset => asset.name.startsWith('after-effects-scripts-') && asset.name.endsWith('.zip'));
const updated = { ...prior, releaseTag: release.tag_name, releaseUrl: release.html_url, downloadUrl: asset.browser_download_url, releaseDate: release.published_at };
await writeFile(metadataFile, JSON.stringify(updated, null, 2) + '\n');
console.log(`Updated ${fileURLToPath(metadataFile)} to ${release.tag_name}.`);
