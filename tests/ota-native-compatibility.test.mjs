import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { nativeSnapshot, verifySnapshot, canonical, nativeConfig } = require('../scripts/check-ota-native.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('OTA native compatibility guard', () => {
  it('accepts the current source against the verified preview APK baseline', () => {
    const baseline = JSON.parse(readFileSync(resolve(root, '.eas/ota-native-baseline.json'), 'utf8'));
    expect(() => verifySnapshot(nativeSnapshot(root), baseline.snapshot)).not.toThrow();
  });

  it.each(['config', 'dependencies'])('rejects changed native %s', (field) => {
    const baseline = nativeSnapshot(root);
    expect(() => verifySnapshot({ ...baseline, [field]: 'changed' }, baseline)).toThrow('No OTA was published');
  });

  it('rejects changed or newly introduced native files', () => {
    const baseline = nativeSnapshot(root);
    expect(() => verifySnapshot({ ...baseline, files: { ...baseline.files, 'plugins/new.cjs': 'changed' } }, baseline)).toThrow();
  });

  it('does not depend on JSON property ordering', () => {
    expect(canonical({ b: 2, a: { d: 4, c: 3 } })).toEqual({ a: { c: 3, d: 4 }, b: 2 });
  });

  it('allows build-counter changes without changing native compatibility', () => {
    const app = { version: '1.0.0', android: { versionCode: 25 }, ios: { buildNumber: '25' } };
    expect(nativeConfig({ ...app, android: { versionCode: 26 }, ios: { buildNumber: '26' } })).toEqual(nativeConfig(app));
    expect(app.android.versionCode).toBe(25);
  });

  it('preserves runtime and permission changes in the native configuration', () => {
    const app = { version: '1.0.0', android: { permissions: ['LOCATION'] } };
    expect(nativeConfig({ ...app, version: '1.0.1' })).not.toEqual(nativeConfig(app));
    expect(nativeConfig({ ...app, android: { permissions: ['LOCATION', 'CAMERA'] } })).not.toEqual(nativeConfig(app));
  });

  function fixture() {
    const dir = mkdtempSync(resolve(tmpdir(), 'ota-native-'));
    for (const file of ['app.json', 'package.json', ...Object.keys(nativeSnapshot(root).files)]) {
      mkdirSync(dirname(resolve(dir, file)), { recursive: true });
      cpSync(resolve(root, file), resolve(dir, file));
    }
    return dir;
  }

  it.each(['app.config.ts', 'app.config.mts', 'app.config.cts', 'app.config.mjs', 'app.config.cjs'])(
    'discovers and rejects an alternative config %s', file => {
      const dir = fixture();
      try {
        const baseline = nativeSnapshot(dir);
        writeFileSync(resolve(dir, file), 'export default { android: { permissions: ["CAMERA"] } };');
        expect(() => verifySnapshot(nativeSnapshot(dir), baseline)).toThrow();
      } finally { rmSync(dir, { recursive: true, force: true }); }
    },
  );

  it('discovers and rejects a new native-transforming install hook', () => {
    const dir = fixture();
    try {
      const baseline = nativeSnapshot(dir);
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
      pkg.scripts.postinstall = 'patch-package';
      writeFileSync(resolve(dir, 'package.json'), JSON.stringify(pkg));
      expect(() => verifySnapshot(nativeSnapshot(dir), baseline)).toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});