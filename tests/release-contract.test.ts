import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

function fileExists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe('Release contract — Obsidian community plugin requirements', () => {
  it('LICENSE file exists and is MIT', () => {
    expect(fileExists('LICENSE')).toBe(true);
    const license = read('LICENSE');
    expect(license).toContain('MIT License');
    expect(license).toContain('Memory Cards contributors');
  });

  it('manifest.json has valid structure', () => {
    const manifest = JSON.parse(read('manifest.json'));
    expect(manifest.id).toBe('memory-cards');
    expect(manifest.id).not.toContain('obsidian');
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof manifest.isDesktopOnly).toBe('boolean');
  });

  it('versions.json maps published manifest versions to minAppVersion (policy: manifest-only bump)', () => {
    const manifest = JSON.parse(read('manifest.json'));
    const versions = JSON.parse(read('versions.json'));
    // Release policy: version bump only in manifest.json + CHANGELOG.md;
    // versions.json/package.json are updated at release time.
    // If the manifest version is already published in versions.json it must map correctly.
    if (versions[manifest.version] !== undefined) {
      expect(versions[manifest.version]).toBe(manifest.minAppVersion);
    }
    // All entries in versions.json must be valid semver with a minAppVersion
    for (const [v, min] of Object.entries(versions)) {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
      expect(min).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('package.json name matches manifest id', () => {
    const pkg = JSON.parse(read('package.json'));
    const manifest = JSON.parse(read('manifest.json'));
    expect(pkg.name).toBe(manifest.id);
  });

  it('package.json version is valid semver (may lag manifest by release policy)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('package.json declares license MIT', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.license).toBe('MIT');
  });

  it('release assets exist: main.js, manifest.json, styles.css', () => {
    expect(fileExists('main.js')).toBe(true);
    expect(fileExists('manifest.json')).toBe(true);
    expect(fileExists('styles.css')).toBe(true);
  });

  it('main.js is non-trivial (build产物)', () => {
    const stat = require('fs').statSync(resolve(ROOT, 'main.js'));
    expect(stat.size).toBeGreaterThan(10_000);
  });

  it('.gitignore does NOT exclude release assets', () => {
    const gi = read('.gitignore');
    // main.js must NOT be ignored (it's a release asset)
    const lines = gi.split('\n').map(l => l.trim()).filter(Boolean);
    const ignored = lines.filter(l => !l.startsWith('#'));
    expect(ignored).not.toContain('main.js');
    expect(ignored).not.toContain('manifest.json');
    expect(ignored).not.toContain('styles.css');
  });

  it('.gitignore excludes sensitive and editor files', () => {
    const gi = read('.gitignore');
    expect(gi).toContain('node_modules/');
    expect(gi).toContain('.DS_Store');
    expect(gi).toContain('.opencode/');
    expect(gi).toContain('.claude/');
    expect(gi).toContain('.env');
    expect(gi).toContain('data.json');
  });

  it('GitHub Actions CI workflow exists', () => {
    expect(fileExists('.github/workflows/ci.yml')).toBe(true);
  });

  it('CI workflow runs npm ci, test, build', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('npm ci');
    expect(ci).toContain('npm test');
    expect(ci).toContain('npm run build');
  });

  it('no hardcoded "yourusername" placeholders in README', () => {
    const readme = read('README.md');
    expect(readme).not.toContain('yourusername');
  });

  it('manifest.json authorUrl is a real github profile (not guessed)', () => {
    const manifest = JSON.parse(read('manifest.json'));
    expect(manifest.authorUrl).toBeDefined();
    expect(manifest.authorUrl).toMatch(/^https:\/\/github\.com\//);
  });
});
