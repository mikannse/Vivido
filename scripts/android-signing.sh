#!/usr/bin/env bash
# Inject a release signing config into the Expo-generated Android Gradle file.
#
# Runs AFTER `npx expo prebuild --platform android` (which regenerates android/).
# Reads signing secrets from environment variables, never from committed files:
#   KEYSTORE_BASE64    base64-encoded release keystore
#   KEYSTORE_PASSWORD  keystore password
#   KEY_ALIAS          key alias
#   KEY_PASSWORD       key password
#
# Expo's CNG template signs the `release` build type with the debug key by
# default. This script (1) restores the real keystore, then (2) adds a `release`
# signingConfig and points the `release` build type at it.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${KEYSTORE_BASE64:?KEYSTORE_BASE64 is required}"
: "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD is required}"
: "${KEY_ALIAS:?KEY_ALIAS is required}"
: "${KEY_PASSWORD:?KEY_PASSWORD is required}"

# 1) Restore the release keystore next to the app module (where build.gradle
#    resolves `file('release.keystore')`). Restrict permissions: the keystore
#    holds the signing key, so keep it owner-readable only.
umask 077
printf '%s' "$KEYSTORE_BASE64" | base64 --decode > android/app/release.keystore
chmod 600 android/app/release.keystore

# 2) Patch android/app/build.gradle.
node <<'NODE'
const fs = require('fs');

const gradlePath = 'android/app/build.gradle';
const escapeGradle = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const storePassword = escapeGradle(process.env.KEYSTORE_PASSWORD);
const keyAlias = escapeGradle(process.env.KEY_ALIAS);
const keyPassword = escapeGradle(process.env.KEY_PASSWORD);

let gradle = fs.readFileSync(gradlePath, 'utf8');

// Extend signingConfigs with a `release` entry (after the template's `debug`).
const debugTail =
  "            keyPassword 'android'\n" +
  "        }\n" +
  "    }";
const signingConfigs =
  "            keyPassword 'android'\n" +
  "        }\n" +
  "        release {\n" +
  "            storeFile file('release.keystore')\n" +
  `            storePassword '${storePassword}'\n` +
  `            keyAlias '${keyAlias}'\n` +
  `            keyPassword '${keyPassword}'\n` +
  "        }\n" +
  "    }";

if (!gradle.includes(debugTail)) {
  throw new Error('Could not find the template debug signingConfig block to extend.');
}
gradle = gradle.replace(debugTail, signingConfigs);

// Point the `release` build type at the new signingConfig.
const releaseAnchor =
  "            // see https://reactnative.dev/docs/signed-apk-android.\n" +
  "            signingConfig signingConfigs.debug";
const releaseReplacement =
  "            // see https://reactnative.dev/docs/signed-apk-android.\n" +
  "            signingConfig signingConfigs.release";

if (!gradle.includes(releaseAnchor)) {
  throw new Error('Could not find the release buildType signingConfig to patch.');
}
gradle = gradle.replace(releaseAnchor, releaseReplacement);

// Optional: inject a monotonic versionCode (e.g. ${{ github.run_number }} in CI).
// Expo's template hardcodes `versionCode 1`, which would block overwrite-install
// of a newer release. Leave unchanged when ANDROID_VERSION_CODE is not set.
const versionCode = process.env.ANDROID_VERSION_CODE;
if (versionCode && /^\d+$/.test(versionCode)) {
  if (/\n\s*versionCode\s+\d+/.test(gradle)) {
    gradle = gradle.replace(/\n(\s*)versionCode\s+\d+/, `\n$1versionCode ${versionCode}`);
    console.log('Injected versionCode', versionCode);
  } else {
    console.warn('versionCode anchor not found; skipped versionCode injection');
  }
}

fs.writeFileSync(gradlePath, gradle);
console.log('Injected release signing config into', gradlePath);
NODE
