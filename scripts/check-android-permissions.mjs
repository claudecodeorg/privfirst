#!/usr/bin/env node
// Fails the build if the merged Android manifest's permission list drifts from
// docs/android-permissions.txt (the audited allowlist). Run after `npm run android:debug`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const apk = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const allowlistPath = join(root, 'docs/android-permissions.txt');

const androidHome = process.env.ANDROID_HOME || join(process.env.HOME ?? '', 'android-sdk');
const aapt2Dirs = execFileSync('find', [join(androidHome, 'build-tools'), '-maxdepth', '1', '-mindepth', '1'])
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort();
const aapt2 = join(aapt2Dirs[aapt2Dirs.length - 1], 'aapt2');

let out;
try {
  out = execFileSync(aapt2, ['dump', 'permissions', apk]).toString();
} catch (e) {
  console.error(`Could not run aapt2 on ${apk}. Build it first with: npm run android:debug`);
  console.error(e.message);
  process.exit(1);
}

const actual = [...out.matchAll(/^(?:uses-)?permission: name='([^']+)'/gm)]
  .map((m) => m[1])
  .filter((name, i, arr) => arr.indexOf(name) === i)
  .sort();

const allowlist = readFileSync(allowlistPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).sort();

const extra = actual.filter((p) => !allowlist.includes(p));
const missing = allowlist.filter((p) => !actual.includes(p));

if (extra.length || missing.length) {
  console.error('Android permission allowlist mismatch (docs/android-permissions.txt):');
  if (extra.length) console.error('  Unexpected (merged in but not allowlisted):', extra.join(', '));
  if (missing.length) console.error('  Missing (allowlisted but not in the built APK):', missing.join(', '));
  process.exit(1);
}

console.log('Android permissions match the allowlist:', actual.join(', '));
