// Expo config plugin: sign release builds with the team's keystore instead of the
// generated debug keystore. Applied at `expo prebuild`, so it survives `--clean`.
//
// It reads apps/mobile/credentials/keystore.properties (gitignored):
//   storeFile=credentials/release.keystore
//   storePassword=...
//   keyAlias=medifirstcard
//   keyPassword=...
// When that file is missing (CI, a teammate without the keystore) the release build
// silently falls back to debug signing, exactly like the Expo template.
const { withAppBuildGradle } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PROPS_LOADER = `def keystorePropsFile = rootProject.file("../credentials/keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystorePropsFile.withInputStream { stream -> keystoreProps.load(stream) }
}

android {`;

const RELEASE_SIGNING = `        release {
            if (keystorePropsFile.exists()) {
                storeFile rootProject.file("../" + keystoreProps["storeFile"])
                storePassword keystoreProps["storePassword"]
                keyAlias keystoreProps["keyAlias"]
                keyPassword keystoreProps["keyPassword"]
            }
        }
    }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    const propsPath = path.join(cfg.modRequest.projectRoot, "credentials", "keystore.properties");
    if (!fs.existsSync(propsPath)) {
      console.warn("[withReleaseSigning] credentials/keystore.properties not found - release build will be debug-signed");
    }
    let gradle = cfg.modResults.contents;
    if (gradle.includes("keystorePropsFile")) return cfg; // already applied

    // 1) release buildType uses the release signing config when the keystore exists.
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig keystorePropsFile.exists() ? signingConfigs.release : signingConfigs.debug",
    );
    // 2) add signingConfigs.release after the debug config.
    // RELEASE_SIGNING ends with the closing brace of signingConfigs, so it replaces the original one.
    gradle = gradle.replace(/signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\}\s*\}/, (block) => block.replace(/\}\s*$/, RELEASE_SIGNING));
    // 3) load the properties file before the android { } block.
    gradle = gradle.replace(/^android \{/m, PROPS_LOADER);

    if (!gradle.includes("signingConfigs.release")) {
      throw new Error("[withReleaseSigning] could not patch android/app/build.gradle - template changed?");
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
