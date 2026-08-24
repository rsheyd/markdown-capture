import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const required = [
  'manifest.json',
  'icons',
  'src',
  'vendor/pdfjs',
  'vendor/webpage'
];

if (manifest.manifest_version !== 3) throw new Error('Chrome Web Store releases must use Manifest V3.');
if (!manifest.icons?.['128']) throw new Error('manifest.json must declare a 128px store icon.');
if (manifest.description.length > 132) throw new Error('Manifest description exceeds 132 characters.');

const outputDir = join(root, 'dist');
const filename = `markdown-capture-${manifest.version}.zip`;
const output = join(outputDir, filename);
mkdirSync(outputDir, { recursive: true });
rmSync(output, { force: true });
execFileSync('/usr/bin/zip', ['-q', '-r', output, ...required], { cwd: root });
console.log(output);
