const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function nativeConfig(value) {
  const app = structuredClone(value);
  // EAS auto-increments these counters; they do not change native capabilities.
  if (app.android) delete app.android.versionCode;
  if (app.ios) delete app.ios.buildNumber;
  return canonical(app);
}

function nativeSnapshot(root) {
  const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const app = readJson('app.json').expo;
  const pkg = readJson('package.json');
  const files = new Set(['app.config.js', 'pnpm-lock.yaml']);
  // Expo can select these ahead of app.config.js. New alternatives must block OTA.
  for (const file of [
    'app.config.ts', 'app.config.mts', 'app.config.cts', 'app.config.mjs', 'app.config.cjs',
    'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs',
  ]) {
    if (fs.existsSync(path.join(root, file))) files.add(file);
  }
  const icons = [
    app.icon, app.splash?.image,
    ...Object.values(app.android?.adaptiveIcon || {}).filter(value => typeof value === 'string' && value.startsWith('.')),
    ...(app.plugins || []).flatMap(plugin => Array.isArray(plugin) ? [plugin[1]?.icon] : []),
  ];
  icons.filter(Boolean).forEach(file => files.add(file.replace(/^\.\//, '')));
  function walk(directory) {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else files.add(child);
    }
  }
  ['plugins', 'android', 'ios', 'patches'].forEach(walk);
  const scripts = { ...(pkg.scripts || {}) };
  // This exact read-only check was added after the verified APK.
  if (scripts.typecheck === 'tsc --noEmit') delete scripts.typecheck;
  return {
    config: digest(JSON.stringify(nativeConfig(app))),
    dependencies: digest(JSON.stringify(canonical({
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      scripts,
      packageManager: pkg.packageManager,
      pnpm: pkg.pnpm,
      overrides: pkg.overrides,
      resolutions: pkg.resolutions,
    }))),
    files: Object.fromEntries([...files].sort().map(file => [
      file, digest(fs.readFileSync(path.join(root, file))),
    ])),
  };
}

function verifySnapshot(actual, baseline) {
  if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(baseline))) {
    throw new Error('Native sources differ from the verified preview APK. Bump expo.version, build and install a new preview APK, then review and refresh the OTA native baseline. No OTA was published.');
  }
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const baseline = JSON.parse(fs.readFileSync(path.join(root, '.eas/ota-native-baseline.json'), 'utf8'));
    verifySnapshot(nativeSnapshot(root), baseline.snapshot);
    console.log('Native sources match the verified Android preview APK.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { nativeSnapshot, verifySnapshot, canonical, nativeConfig };