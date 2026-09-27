import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();

function fixture(t, heading, version = '0.7.4', previous = '0.7.4') {
  const root = mkdtempSync(join(tmpdir(), 'markdown-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  copyFileSync(resolve('scripts/create-github-release.sh'), join(root, 'scripts/release.sh'));
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version }, null, 2) + '\n');
  writeFileSync(join(root, 'CHANGELOG.md'), `# Changelog\n\n${heading}\n\n- New feature.\n\n## ${previous} — 2026-09-26\n\n- Previous feature.\n`);
  const git = (...args) => execFileSync(realGit, args, { cwd: root, encoding: 'utf8' });
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Release Test');
  git('remote', 'add', 'origin', 'https://github.com/rsheyd/markdown-capture.git');
  const stub = (name, body) => writeFileSync(join(root, 'bin', name), `#!/bin/bash\nset -e\n${body}\n`, { mode: 0o755 });
  stub('git', `case "$*" in\n  *"ls-remote"*) exit 0 ;;\n  *"push origin"*) echo push >> "$RELEASE_TEST_ROOT/actions"; exit 0 ;;\nesac\nexec "$REAL_GIT" "$@"`);
  stub('gh', `echo "gh $*" >> "$RELEASE_TEST_ROOT/actions"\nif [[ $1 == release && $2 == view ]]; then exit 1; fi\nif [[ $1 == release && $2 == create ]]; then echo https://example.com/release; fi`);
  stub('npm', `echo "npm $*" >> "$RELEASE_TEST_ROOT/actions"\nif [[ $1 == run && $2 == package ]]; then\n  mkdir -p dist\n  version=$(node -p "require('./manifest.json').version")\n  cp manifest.json "dist/markdown-capture-$version.zip"\nfi`);
  stub('unzip', `if [[ $1 == -p ]]; then cat "$2"; fi`);
  git('add', '.');
  git('commit', '-m', 'Fixture');
  const env = { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, REAL_GIT: realGit, RELEASE_TEST_ROOT: root };
  return { root, git, run: (...args) => spawnSync('bash', ['scripts/release.sh', ...args], { cwd: root, env, encoding: 'utf8' }), read: name => readFileSync(join(root, name), 'utf8') };
}

test('standalone Unreleased dry run chooses next patch without mutation or network', t => {
  const f = fixture(t, '## Unreleased');
  const result = f.run('--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GitHub release: v0\.7\.5/);
  assert.equal(JSON.parse(f.read('manifest.json')).version, '0.7.4');
  assert.match(f.read('CHANGELOG.md'), /## Unreleased/);
  assert.equal(f.git('status', '--porcelain'), '');
});

test('release prepares matching metadata and package; dated retry retains version', t => {
  const f = fixture(t, '## Unreleased');
  // Ignore the fixture package and action log, as the real repository ignores dist.
  writeFileSync(join(f.root, '.git/info/exclude'), 'dist/\nactions\n');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(f.read('manifest.json')).version, '0.7.5');
  assert.match(f.read('CHANGELOG.md'), /## 0\.7\.5 — \d{4}-\d{2}-\d{2}/);
  assert.equal(JSON.parse(f.read('dist/markdown-capture-0.7.5.zip')).version, '0.7.5');
  assert.equal(f.git('log', '-1', '--format=%s').trim(), 'Release 0.7.5');
  assert.match(f.read('actions'), /gh release create v0\.7\.5/);
  const head = f.git('rev-parse', 'HEAD');
  const retry = f.run();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
});

test('standalone Unreleased retains an explicitly prepared newer version', t => {
  const f = fixture(t, '## Unreleased', '0.8.0');
  const result = f.run('--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GitHub release: v0\.8\.0/);
});

test('numbered Unreleased remains supported', t => {
  const f = fixture(t, '## 0.7.5 — Unreleased', '0.7.5');
  const result = f.run('--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GitHub release: v0\.7\.5/);
});

test('rejects mismatched numbered heading and a manifest older than previous release', t => {
  for (const heading of ['## 0.7.5 — Unreleased', '## Unreleased']) {
    const f = fixture(t, heading, '0.7.3');
    assert.equal(f.run('--dry-run').status, 1);
  }
});
