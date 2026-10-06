// Expo config plugin: build native code for real phones only (armeabi-v7a, arm64-v8a).
// The x86 and x86_64 variants exist for Intel emulators, which can run the ARM build anyway;
// leaving them out halves native compile time and disk use and shrinks the APK from ~123 MB
// to ~70 MB. Applied at `expo prebuild`, so it survives `--clean`.
const { withGradleProperties } = require("expo/config-plugins");

const KEY = "reactNativeArchitectures";
const VALUE = "armeabi-v7a,arm64-v8a";

module.exports = function withArmOnly(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === "property" && p.key === KEY));
    props.push({ type: "property", key: KEY, value: VALUE });
    cfg.modResults = props;
    return cfg;
  });
};
