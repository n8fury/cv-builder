#!/usr/bin/env node
// Convert the four local TTF faces the resume template needs into woff2
// under public/fonts/ (gitignored — see SPEC §3, §8).
//
// Source TTFs are not vendored: CharterBT (Bitstream Charter) is
// commercial, so each machine supplies its own installed copies. Override
// the lookup directory with CV_FONT_DIR if yours live elsewhere.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compress } from 'wawoff2';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'public', 'fonts');

const { LOCALAPPDATA, WINDIR, HOME, CV_FONT_DIR } = process.env;

const searchDirs = CV_FONT_DIR
  ? [CV_FONT_DIR]
  : [
      LOCALAPPDATA && path.join(LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'),
      path.join(WINDIR ?? 'C:\Windows', 'Fonts'),
      HOME && path.join(HOME, '.local', 'share', 'fonts'),
      HOME && path.join(HOME, 'Library', 'Fonts'),
      '/usr/share/fonts',
    ].filter(Boolean);

const faces = [
  { out: 'charter-roman.woff2', source: 'Charter BT Roman.ttf' },
  { out: 'charter-bold.woff2', source: 'Charter Bd BT Bold.ttf' },
  { out: 'charter-italic.woff2', source: 'Charter BT Italic.ttf' },
  { out: 'charis-italic.woff2', source: 'CharisSIL-Italic.ttf' },
];

function locate(fileName) {
  for (const dir of searchDirs) {
    const candidate = path.join(dir, fileName);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const missing = [];
const resolved = [];

for (const face of faces) {
  const found = locate(face.source);
  if (found) resolved.push({ ...face, path: found });
  else missing.push(face.source);
}

if (missing.length > 0) {
  console.error('build-fonts: missing required font file(s):');
  for (const name of missing) console.error(`  - ${name}`);
  console.error('\nSearched:');
  for (const dir of searchDirs) console.error(`  ${dir}`);
  console.error(
    '\nInstall the fonts, or set CV_FONT_DIR to the directory holding them.',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

for (const face of resolved) {
  const ttf = await readFile(face.path);
  const woff2 = Buffer.from(await compress(ttf));
  if (woff2.length === 0) {
    console.error(`build-fonts: empty woff2 produced for ${face.source}`);
    process.exit(1);
  }
  await writeFile(path.join(outDir, face.out), woff2);
  const ratio = ((1 - woff2.length / ttf.length) * 100).toFixed(0);
  console.log(
    `${face.out.padEnd(22)} ${String(woff2.length).padStart(7)} bytes  (-${ratio}% from ${face.source})`,
  );
}

console.log(`\nWrote ${resolved.length} faces to public/fonts/`);
