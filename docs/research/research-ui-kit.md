# MediFirstCard — UI kit, icons, illustrations, animation, fonts, visual conventions (research, 2026-09-03)

Scope: React Native (Expo) medical app, Android-first on Windows 10, Thai + English, elderly / chronically ill primary users, 5 weeks to demo (7 Oct 2026), zero budget. Sources: prior agent digest (~100 fetches) plus this run's npm-registry queries (`npm view`, run 2026-09-03), 12 WebFetch calls and 2 curl reads of GitHub raw files.

Verification legend used below: **[npm-today]** = `npm view` on 2026-09-03; **[fetch-today]** = WebFetch/curl succeeded today; **[digest]** = a fetched result recorded in the prior agent's digest; **[unverified]** = search-snippet only or memory.

---

## 0. Baseline platform facts the recommendations depend on

| Fact | Evidence |
|---|---|
| Expo SDK latest = **57.0.19** (dist-tag `latest`, modified 2026-09-02); dist-tags also list sdk-56 56.0.21, sdk-55 55.0.31, sdk-54 54.0.37 | [npm-today] https://registry.npmjs.org/expo |
| SDK 57 targets React Native **0.86**, React **19.2.3**, min Node 22.13, Android 7+, compileSdk 36 | [digest] https://docs.expo.dev/versions/latest/ |
| SDK 57 changelog published **June 30, 2026**; Expo Go for SDK 57 available via `eas go` / Expo CLI while store approval pending | [digest] https://expo.dev/changelog/sdk-57 |
| **New Architecture is mandatory from SDK 55** ("SDK 55 and later run entirely on the New Architecture… cannot be disabled"); legacy arch frozen June 2025; check libs with `npx expo-doctor@latest` + reactnative.directory | [digest] https://docs.expo.dev/guides/new-architecture/ |
| react-native-reanimated latest **4.6.0** (peer RN `0.83 - 0.87`, react-native-worklets 0.12.x); react-native-svg **15.15.5** | [npm-today] https://registry.npmjs.org/react-native-reanimated , https://registry.npmjs.org/react-native-svg |

Consequence: any UI kit or animation library chosen must be New-Architecture-compatible and work with RN 0.86 / React 19.2.

---

## 1. UI component kits — comparison

### 1.1 React Native Paper (MD3) — RECOMMENDED
- Latest **5.15.3** (published 2026-05-26; registry modified 2026-06-15), MIT. Peer deps: `react: *`, `react-native: *`, `react-native-safe-area-context: *`. Deps: `color`, `use-latest-callback`, `@callstack/react-theme-provider`. dist-tag `alpha` = **6.0.0-alpha.0** (June 15, 2026: "Major redesign with Material Design 3 compliance; TextInput completely rewritten", adds react-native-reanimated as peer dep, "upgrade Expo SDK 56"). [npm-today] https://registry.npmjs.org/react-native-paper ; [digest] https://github.com/callstack/react-native-paper/releases
- Release cadence 2026: 5.15.0 (Feb 4), 5.15.1 (Apr 14), 5.15.2 (May 8, "positioning issues for portals, dialogs, and modals on React Native 0.85"), 5.15.3 (May 26). [digest] releases page
- GitHub 14.5k stars; README: "Follows material design guidelines", Expo Snack demo. [digest] https://github.com/callstack/react-native-paper
- New Architecture: issue #4454 "Timeline to official New Architecture support?" opened 2024-07-14, still **open**; author states "Apps built with Paper will run in New Architecture projects without any changes, but there are a significant number of small bugs caused by the upgrade" (input handling cited). [fetch-today] https://github.com/callstack/react-native-paper/issues/4454 . 5.15.2 fixing RN 0.85 issues shows active New-Arch maintenance.
- Theming (from Paper docs, canonical API; docs site returned 403 today, marked [unverified] for exact wording): `MD3LightTheme` / `MD3DarkTheme`, spread `colors` overrides, `configureFonts({ config: { fontFamily: 'Sarabun_400Regular' } })`, `<PaperProvider theme={theme}>`. Docs: https://callstack.github.io/react-native-paper/docs/guides/theming (redirects to http://oss.callstack.com/react-native-paper/docs/guides/theming)
- Install (canonical, docs 403 today so [unverified] wording): `npx expo install react-native-paper react-native-safe-area-context` ; optional `react-native-paper/babel` plugin in `babel.config.js` env.production to tree-shake; icons default to MaterialCommunityIcons through `@expo/vector-icons` (already in Expo projects) or `react-native-vector-icons`.
- Pros: Material 3 = native look on Android (the demo platform); built-in dark theme; large-touch components (Button, FAB, Card, List.Item, Chip, Banner, Snackbar, Dialog, Appbar, TextInput, Switch, SegmentedButtons); accessibility props wired; zero build-tool config (no Tailwind/PostCSS/Metro transformer); AI agents have huge training exposure to its API; works in Expo Go.
- Cons: not "custom-designed" look; v5 is in maintenance mode while v6 alpha brews; New-Arch small bugs.

### 1.2 gluestack-ui v5
- `@gluestack-ui/core` **5.0.15** (modified 2026-06-25), MIT; peers react >=16.8, react-native >=0.64, react-native-svg >=12, react-native-web >=0.19, react-native-safe-area-context >=4, `@gluestack-ui/utils`. [npm-today] https://registry.npmjs.org/@gluestack-ui/core
- CLI: `npx gluestack-ui@latest init` then `npx gluestack-ui@latest add button`; requires Expo >=50, RN >=0.72.5; CLI offers **NativeWind v5** ("Tailwind CSS v4 + PostCSS") or **Uniwind** ("Expo-only… no PostCSS"); `lightningcss` must be pinned to 1.30.1; "v5 does not currently support Next.js". [digest] https://gluestack.io/ui/docs/home/getting-started/installation
- v3 blog (Sept 3, 2025): copy-paste components, NativeWind v4.1, Expo SDK 53. [digest] https://gluestack.io/blogs/gluestack-v3-release ; releases page shows v5.0.0 stable "NativeWind v5 integration with Tailwind v4, first-class Expo Router support". [digest] https://github.com/gluestack/gluestack-ui/releases
- Pros: shadcn-like copy-paste ownership, modern look, Tailwind. Cons: depends on NativeWind v5 (npm `latest` is still 4.2.6; 5.0.0-preview.4 and docs say "pre-release… not intended for production use" [digest] https://www.nativewind.dev/v5) or Uniwind (new); build-tool churn risk in a 5-week window.

### 1.3 Tamagui
- `tamagui` / `@tamagui/config` **2.7.7** (modified 2026-09-02), peer React >=19; GitHub 14.2k stars, MIT. [digest] https://registry.npmjs.org/tamagui , https://github.com/tamagui/tamagui
- Requirements: "React Native 0.81+ with New Architecture enabled (for native apps), React 19+, and TypeScript 5+". Install `yarn add tamagui @tamagui/config`, `@tamagui/babel-plugin`, `tamagui.config.ts` with `defaultConfig` from `@tamagui/config/v5`, `<TamaguiProvider>`; starter `yarn create tamagui@latest --template expo-router` (needs Yarn 4.4+); `expo start -c`. [digest] https://tamagui.dev/docs/intro/installation , https://tamagui.dev/docs/guides/expo
- Pros: very fast, universal, strong theming/tokens. Cons: steepest learning curve, compiler/babel config, Yarn-4 starter, AI agents less reliable with its API; overkill for 3 screens.

### 1.4 NativeWind v4 + react-native-reusables (shadcn for RN)
- `nativewind` **4.2.6** (modified 2026-07-08), MIT, peer `tailwindcss >3.3.0`; docs install: `npm install nativewind react-native-reanimated react-native-safe-area-context` + `npm install --dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11 babel-preset-expo`; babel `jsxImportSource: "nativewind"` + `nativewind/babel`; `withNativeWind(config, { input: './global.css' })` in metro; `global.css`; docs "Last updated January 10, 2026". [npm-today] + [digest] https://www.nativewind.dev/docs/getting-started/installation
- `@react-native-reusables/cli` **0.7.1** (modified 2026-03-14), MIT; repo 8.6k stars; supports NativeWind v4 **and Uniwind**; `npx @react-native-reusables/cli@latest init` / `add`. `@rn-primitives/slot` 1.5.2 (2026-07-02). [npm-today] + [digest] https://github.com/founded-labs/react-native-reusables , https://reactnativereusables.com/docs/installation
- `uniwind` **1.11.0** (modified 2026-08-17), MIT, peers react >=19, react-native >=0.81, tailwindcss >=4, metro/@expo/metro-config; site claims "2x faster than NativeWind, full Tailwind v4 support". [npm-today] https://registry.npmjs.org/uniwind ; [digest] https://docs.uniwind.dev/
- Pros: Tailwind DX, AI agents are excellent at Tailwind class strings, copy-paste ownership. Cons: 4-file config (babel/metro/tailwind/global.css) is the #1 source of "styles don't apply" bugs; NativeWind v4 pins Tailwind v3 while ecosystem moves to v4/Uniwind — mid-transition.

### 1.5 HeroUI Native
- `heroui-native` **1.0.9** (modified 2026-08-31), Apache-2.0; peers react >=19, react-native >=0.81, tailwind-merge ^3.4, tailwind-variants ^3.2, react-native-svg ^15.12, react-native-reanimated ^4.1.1, react-native-worklets >=0.5.1, react-native-gesture-handler ^2.28, react-native-safe-area-context ^5.6; optional @gorhom/bottom-sheet, react-native-screens, expo-blur. v1.0.0 shipped March 19, 2026; requires **Uniwind**; 3.6k stars. [npm-today] + [digest] https://registry.npmjs.org/heroui-native , https://github.com/heroui-inc/heroui-native , https://heroui.com/en/docs/native/getting-started
- Pros: polished modern look, active. Cons: very young (6 months since 1.0), Uniwind + Tailwind v4 setup, small community — risk for a course deadline.

### 1.6 UI Kitten (Eva Design)
- `@ui-kitten/components` **5.3.1** stable (old), peer react-native-svg; **6.0.0-beta.1/2 on Aug 7, 2025** ("React 19, React Native 0.81, Expo 54", functional components, ESM, "New Architecture compatibility enabled"); 10.7k stars, 126 open issues. [digest] https://registry.npmjs.org/@ui-kitten/components , https://github.com/akveo/react-native-ui-kitten/releases
- Cons: stable 5.x predates New Arch; 6.x still beta after 13 months → unmaintained risk.

### 1.7 RNUI (react-native-ui-lib, Wix)
- **9.1.2** (npm), MIT; peers react >=19, react-native >=0.77.3, uilib-native ^5.0.1, reanimated >=3.19.4, gesture-handler >=2.24, safe-area-context >=5.6.2. Releases: 9.0.0 (17 May) "Now supports react-native 0.78 and React 19", 9.1.0 (28 Jun). README: "We are working on upgrading our UI Library to support the new React Native Architecture. Currently, we support React Native 0.73, and we plan to support React Native 0.77 next." [digest] https://registry.npmjs.org/react-native-ui-lib , https://github.com/wix/react-native-ui-lib , https://wix.github.io/react-native-ui-lib/docs/getting-started/setup
- Cons: RN-version lag vs RN 0.86, native `uilib-native` module (no Expo Go).

### 1.8 Restyle (Shopify)
- `@shopify/restyle` **2.4.5**, MIT, 3.4k stars; "a type-enforced system for building UI components… focuses on theming and design systems rather than offering prebuilt components"; `npx expo install @shopify/restyle`. [digest] https://registry.npmjs.org/@shopify/restyle , https://github.com/Shopify/restyle
- Use only as a token/theming layer if building components by hand; no buttons/inputs/dialogs shipped.

### 1.9 Verdict matrix

| Kit | Version | Expo SDK 57 / New Arch | Config burden | Learning curve | Theming/dark | A11y | Fit for 5-week Android demo |
|---|---|---|---|---|---|---|---|
| React Native Paper | 5.15.3 | Works (minor bugs; issue #4454 open) | none | low | MD3 built-in, configureFonts | good | **Best** |
| gluestack-ui v5 | 5.0.15 | Yes (NativeWind v5 preview / Uniwind) | high | medium | Tailwind tokens | good | OK if team already knows Tailwind |
| NativeWind v4 + reusables | 4.2.6 / cli 0.7.1 | Yes | high | medium | Tailwind v3 | good (rn-primitives) | OK |
| Tamagui | 2.7.7 | Yes (requires RN 0.81+ New Arch) | high | high | excellent | good | Overkill |
| HeroUI Native | 1.0.9 | Yes (RN>=0.81, Uniwind) | high | medium | Tailwind v4 | ? | Too young |
| UI Kitten | 5.3.1 / 6 beta | 6 beta only | low | low | Eva | ok | Risky |
| RNUI | 9.1.2 | Lags (RN 0.78 target) | medium | medium | good | ok | No |
| Restyle | 2.4.5 | Yes | low | low | tokens only | n/a | Only as token layer |

---

## 2. Icons

### 2.1 @expo/vector-icons (default in Expo)
- **15.1.1** (modified 2026-08-01), MIT, peers react, expo-font >=14.0.4, react-native; families: AntDesign, Entypo, EvilIcons, Feather, FontAwesome, FontAwesome5, FontAwesome6, Fontisto, Foundation, Ionicons, MaterialCommunityIcons, MaterialIcons, Octicons, SimpleLineIcons, Zocial. [npm-today] + [digest] https://icons.expo.fyi/
- **Deprecation**: Expo blog "Moving away from @expo/vector-icons" (June 9, 2026, SDK 56): recommended replacement is per-set `@react-native-vector-icons/<set>` packages which "integrate directly with expo-font"; codemod `npx @react-native-vector-icons/codemod` then `npx expo doctor`; do NOT add `node_modules/@react-native-vector-icons/` paths to the expo-font plugin; "4 MB bundle reduction"; "`@expo/vector-icons` continues to function and will remain maintained to allow migration time… Around 60% of EAS Build applications currently use this package." [fetch-today] https://expo.dev/blog/moving-away-from-expo-vector-icons ; docs https://docs.expo.dev/guides/icons/ say "@expo/vector-icons will be deprecated and is not recommended". [digest]
- `@react-native-vector-icons/material-design-icons` **13.1.3** and `/ionicons` 13.1.3 (modified 2026-08-20), MIT, peer `@expo/config-plugins >=10`; `@react-native-vector-icons/common` 13.0.2 (peer expo-font). Upstream README: scoped packages, sets incl. MaterialDesignIcons (7,448 icons), Ionicons (1,357), FontAwesome (2,806+ free), Feather (287), AntDesign (449); fonts MIT/OFL. [npm-today] + [digest] https://github.com/oblador/react-native-vector-icons
- Decision: for a 5-week project, **use MaterialCommunityIcons**. Paper's `icon="..."` props resolve to MaterialCommunityIcons out of the box. Start with `@expo/vector-icons` (zero setup, still maintained). Optional migration to `@react-native-vector-icons/material-design-icons` via the codemod later.

### 2.2 lucide-react-native
- **1.39.0**, ISC, peers react ^16.5.1–^19, react-native-svg ^12–^15; `npm install lucide-react-native`; props size/color/strokeWidth/absoluteStrokeWidth; "Medical" category 43 icons; warns importing all icons bloats build. [digest] https://registry.npmjs.org/lucide-react-native , https://lucide.dev/guide/packages/lucide-react-native , https://lucide.dev/icons/categories , https://raw.githubusercontent.com/lucide-icons/lucide/main/categories/medical.json
- Best choice if the team picks a Tailwind/shadcn kit (reusables and HeroUI default to Lucide).

### 2.3 Phosphor
- `@phosphor-icons/react-native` → 404 on npm; the RN package is **`phosphor-react-native` 3.0.6** (modified 2026-04-23), MIT, peer react-native-svg. [npm-today] https://registry.npmjs.org/phosphor-react-native . 6 weights (thin…duotone). Fine alternative; no medical specialization.

### 2.4 Hugeicons
- `@hugeicons/react-native` **1.0.16** (2026-08-21) + `@hugeicons/core-free-icons` **4.3.0** (2026-08-20), both MIT; peers react-native-svg >=12. README: free = "6,000+ Stroke Rounded icons… for unlimited personal and commercial projects"; Pro 60,000+ icons/10 styles ($99/yr or $1,197 one-time). Install `npm install @hugeicons/react-native @hugeicons/core-free-icons react-native-svg`; Expo tsconfig tip `"types": ["@hugeicons/core-free-icons", "@hugeicons/react-native"]`; usage `<HugeiconsIcon icon={SearchIcon} size={24} color="black" strokeWidth={1.5} />`. [npm-today README] https://registry.npmjs.org/@hugeicons/react-native ; pricing [digest] https://hugeicons.com/pricing
- Only one style free; fine but no advantage over MDI/Lucide for this app.

### 2.5 Iconsax
- `iconsax-react-native` **0.0.8**, MIT, peer react-native-svg >=5.3; site: "6,000 Free icons", 44,256 premium; license at https://docs.iconsax.io/license (not fetched, 403). [digest] https://registry.npmjs.org/iconsax-react-native , https://iconsax.io/ . Version 0.0.8 = immature wrapper; skip.

### 2.6 Healthicons.org — RECOMMENDED medical supplement
- Icons are **CC0 public domain** ("has waived all copyright and related or neighboring rights to icons"); site code MIT; hosted by Resolve to Save Lives (public-health nonprofit); began 2021 for DHIS2; Figma plugin; "outline" and "filled" styles; SVG + PNG 48px/96px, many in 24px "material" size; repo 857 stars, 514 commits. [digest] https://healthicons.org/about , https://github.com/resolvetosavelives/healthicons
- RN wrapper `healthicons-react-native` **3.5.0** (modified 2025-07-09), MIT, peers react 18||19, react-native >=0.73, react-native-svg ^15.8.0; `npm i healthicons-react-native react-native-svg`; default import = filled, variants via `healthicons-react-native/[variant]` and 24px via `healthicons-react-native/[variant]-24px`; e.g. `import { BloodBag } from 'healthicons-react-native'` `<BloodBag color="red" height={36} width={36} />`; `HealthIconsProvider` for defaults. [npm-today README] https://registry.npmjs.org/healthicons-react-native ; wrapper repo https://github.com/stnrd/healthicons (20 stars, MIT). Caveat: last publish 14 months ago; fallback = download SVGs from healthicons.org and use `react-native-svg-transformer` or inline.
- Relevant glyphs (from healthicons.org catalogue; names [unverified] individually): blood-bag, blood-drop, blood-pressure, allergies, medicines/pills, stethoscope, ambulance, hospital, emergency-post, syringe, heart-organ, lungs, kidneys, diabetes, doctor, nurse, elderly, wheelchair.

### 2.7 Flaticon
- Free license requires attribution ("Icons made by X from www.flaticon.com"); Premium removes it; also limits usage in products. Exact text not fetchable today (cert error on support page; legal page 403). [unverified] https://www.flaticon.com/legal , https://support.flaticon.com/s/article/Attribution-How-when-and-where-FI . Use only for one-off assets (e.g. app icon inspiration) and credit in README/About screen; prefer CC0/OFL sources above.

---

## 3. Illustrations (licenses)

| Source | License / attribution | Notes | Evidence |
|---|---|---|---|
| **unDraw** — RECOMMENDED | Free incl. commercial, "without permission from or attributing the creator or unDraw"; no bundles/redistribution; explicit ban on AI training use | Color-customizable SVGs; medical set at https://undraw.co/search/medical (e.g. https://undraw.co/illustration/medicine_hqqg) | [digest] https://undraw.co/license |
| Open Peeps | CC0 "Free for commercial and personal use" | Pablo Stanley; SVG/PNG; 584,688+ combos; Blush integration | [digest] https://www.openpeeps.com/ |
| Humaaans | CC0, "Free for commercial or personal use" | Pablo Stanley; Sketch/Studio, SVG; Blush collection | [digest] https://www.humaaans.com/ |
| DrawKit | Free commercial use, "Attribution is not required"; no resale/redistribution/AI training | Health category: https://www.drawkit.com/illustrations/medical-health-illustrations | [digest] https://www.drawkit.com/license |
| Storyset (Freepik) | Free **with attribution** "credited to the Company/Website as stated by the Company"; attribution removed with Flaticon Premium subscription; no resale/logos | Medical/health sets: https://storyset.com/medical , https://storyset.com/health ; styles Rafiki/Bro/Amico/Pana/Cuate; color-customizable | [fetch-today] https://storyset.com/terms |
| Blush | Free plan: license page 403 today; search snippets say irrevocable worldwide license to modify/use; free downloads are low-res/PNG, Pro for SVG/hi-res | https://blush.design/license , https://blush.design/plans | [unverified] |

Attribution line to put in README + About screen if Storyset/Flaticon assets are used: "Illustrations by Storyset (storyset.com); Icons by Flaticon (flaticon.com)".

---

## 4. Animation

### 4.1 lottie-react-native — RECOMMENDED
- **7.5.0** (modified 2026-08-22), Apache-2.0; peers react >=19.2, **react-native >=0.84**, optional @lottiefiles/dotlottie-react ^0.13.5 (web); dist-tags next 8.0.0-rc.0, version-5 5.1.6. README: "Requires React Native 0.84 or newer and the New Architecture. For older React Native versions, use lottie-react-native 7.3.x." [npm-today] https://registry.npmjs.org/lottie-react-native ; [fetch-today curl] https://raw.githubusercontent.com/lottie-react-native/lottie-react-native/master/README.md
- Expo: `npx expo install lottie-react-native` (Expo docs page https://docs.expo.dev/versions/latest/sdk/lottie/ returned 404 in both runs — [unverified] whether the doc URL moved; the package remains in the Expo SDK bundled-native-modules list historically and is what `expo install` pins). Usage: `import LottieView from 'lottie-react-native'; <LottieView source={require('./assets/heartbeat.json')} autoPlay loop style={{width:200,height:200}} />`.
- Expo Go: lottie-react-native has historically been bundled in Expo Go; not re-verified for SDK 57 [unverified]. The project will need a dev build (`npx expo run:android`) anyway for the Android widget, so this is moot.

### 4.2 @lottiefiles/dotlottie-react-native
- **0.12.1** (2026-08-04), MIT; "Expo Go does not bundle the DotLottie native module" — needs `expo prebuild` + dev build; ships `withDotLottie` config plugin; supports `.lottie` files (metro `assetExts` add 'lottie'). [npm-today README] https://registry.npmjs.org/@lottiefiles/dotlottie-react-native ; https://github.com/LottieFiles/dotlottie-react-native
- Use only if you want `.lottie` bundles; JSON via lottie-react-native is simpler.

### 4.3 Rive
- `rive-react-native` **9.8.5** (2026-07-17), MIT; Rive editor Free plan $0: 3 collaborative files, 1 project, 10 MB assets, no watermark mentioned; Cadet $9/seat/mo, Voyager $32, Enterprise $120. [npm-today] + [digest] https://rive.app/pricing . Needs native module (dev build) and design time in Rive editor — skip for 5 weeks.

### 4.4 Free animation sources
- LottieFiles free animations under the "Lottie Simple License (FL 9.13.21)" — commercial use allowed, attribution appreciated but not required (from search snippets; the license page and help-center page both blocked today) [unverified] https://lottiefiles.com/page/license , https://help.lottiefiles.com/hc/en-us/articles/900002475966-how-do-i-give-attribution-for-a-lottie-animation-i-ve-used
- Candidate files (found via search, [digest]): "Heartbeat ECG" https://lottiefiles.com/free-animation/heartbeat-ecg-Iw2NJ9VEwI ; "Heart with ECG" https://lottiefiles.com/free-animation/heart-with-ecg-YmRr0zqixD ; "Heartbeat ECG Loader" https://lottiefiles.com/free-animation/heartbeat-ecg-loader-cqoa6R3aJO ; category pages https://lottiefiles.com/free-animations/ecg , https://lottiefiles.com/free-animations/heartbeat
- Use sparingly: one splash/loading pulse, one "document uploaded" success check, one empty-state. Respect `reduceMotion` (RN `AccessibilityInfo.isReduceMotionEnabled`).

---

## 5. Fonts (Thai + Latin) — legibility for elderly

### 5.1 Research
- Typotheque "The Contemporary Effects of Thai Loops" (published Feb 15, 2025; 3 experiments, Bangkok early 2024, 180 native Thai readers, Chulalongkorn University): "Participants read looped text significantly faster than the same text without loops"; for distance acuity "The looped typeface was easier to read than both its loopless alternate and the Thonburi typeface"; younger readers decoded loopless slightly better at small sizes, **older readers performed better with looped**; recommendation: looped for longer documents, loopless for younger display contexts. [fetch-today] https://www.typotheque.com/research/effects-of-loops-in-thai
- Punsongserm & Suvakunta 2022 (Archives of Design Research), Thai drug labels: minimum type ~0.5–0.75 mm is "diminutive"; older participants read much slower; **conventional (looped) Thai text fonts "facilitated the most participants who varied by age, more than the Roman-like Thai fonts"**; cites US FDA min Tahoma 11pt (~2.1 mm). [digest] https://aodr.org/_PR/view/?aidx=32189&bidx=3034
- Conclusion: for elderly primary users choose a **looped** Thai body font.

### 5.2 Candidate families (all OFL via Google Fonts; all `@expo-google-fonts/*` are "MIT AND OFL-1.1")

| Family | Style | Weights | Designer | @expo-google-fonts pkg | Evidence |
|---|---|---|---|---|---|
| **Sarabun** | Looped (based on TH Sarabun New; official font of Thailand's Government Gazette) | 16 styles 100–800 + italics; exports `Sarabun_400Regular`, `Sarabun_500Medium`, `Sarabun_600SemiBold`, `Sarabun_700Bold`… | Suppakit Chalermlarp; added 2013-10-28; subsets latin, latin-ext, thai, vietnamese | `@expo-google-fonts/sarabun` 0.4.1 | [digest] METADATA.pb + DESCRIPTION, README https://raw.githubusercontent.com/expo/google-fonts/main/font-packages/sarabun/README.md ; [npm-today] |
| Noto Sans Thai | Loopless ("more modern, loopless variant") | variable wght 100–900, wdth 62.5–100; exports `NotoSansThai_100Thin`…`_900Black` | Google, added 2020-11-19 | `@expo-google-fonts/noto-sans-thai` 0.4.2 | [digest] |
| Noto Sans Thai Looped | Looped ("traditional looped form") | 212 glyphs | Google | `@expo-google-fonts/noto-sans-thai-looped` [unverified pkg] | [digest] https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthailooped/DESCRIPTION.en_us.html |
| IBM Plex Sans Thai | Looped grotesque; "excellent legibility in print, web, and mobile interfaces" | 100–700 (7); exports `IBMPlexSansThai_400Regular` etc. | Mike Abbink, Bold Monday; added 2021-06-18 | `@expo-google-fonts/ibm-plex-sans-thai` 0.4.1 | [digest] |
| Anuphan | Loopless adaptation of IBM Plex (Thai drawn from Plex Latin) | variable wght 100–700 | Mint Tantisuwanna, Cadson Demak; added 2023-02-23 | `@expo-google-fonts/anuphan` 0.4.1 | [digest] |
| Prompt | Loopless, geometric, "wide proportions and airy negative space"; disambiguates ก ถ ภ ฤ ฦ, ฎ ฏ, บ ป, ข ช | 100–900 + italics | Cadson Demak | `@expo-google-fonts/prompt` 0.4.1 | [digest] |
| Kanit | Loopless, humanist/geometric, first Thai font hinted with TTFAutohint | 100–900 + italics | Cadson Demak | `@expo-google-fonts/kanit` 0.4.1 | [digest] |
| Bai Jamjuree | Loopless square (Eurostile-like); "headings and small passages" | 200–700 + italics | Cadson Demak | `@expo-google-fonts/bai-jamjuree` 0.4.1 | [digest] |

### 5.3 Loading (Expo docs)
- `npx expo install @expo-google-fonts/sarabun expo-font expo-splash-screen`; `useFonts({ Sarabun_400Regular, Sarabun_700Bold })` in root layout with `SplashScreen.preventAutoHideAsync()`; style `fontFamily: 'Sarabun_700Bold'`. Or embed statically via `expo-font` config plugin `"fonts": ["node_modules/@expo-google-fonts/sarabun/700Bold/Sarabun_700Bold.ttf"]` (needs dev build; naming differs iOS vs Android). [digest] https://docs.expo.dev/develop/user-interface/fonts/ ; expo-font 57.0.3 [npm-today]
- RN gotcha: `fontWeight` does not select a custom face on Android — always pick the family string per weight (`Sarabun_700Bold`), never `fontWeight:'700'` with `Sarabun_400Regular`.

### 5.4 Recommendation
**Single family: Sarabun** for both Thai and Latin (looped → best for elderly per both studies; government-standard familiarity for Thai users; 16 styles; excellent Latin). Weights: 400 body, 500 labels, 600 titles, 700 emergency card values/headlines. Optional display pairing for the emergency card header only: IBM Plex Sans Thai 700 (also looped). Avoid Kanit/Prompt for body text (loopless, worse for older readers); acceptable for a brand wordmark.

---

## 6. Colors, status conventions, accessibility

### 6.1 Rules (WCAG 2.2)
- SC 1.4.3 AA: text 4.5:1; large text (≥18pt or ≥14pt bold) 3:1; AAA 7:1 / 4.5:1; "4.499:1 would not meet" (no rounding). [digest] https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- SC 1.4.11 AA: UI components & graphical objects 3:1 vs adjacent colours (inactive exempt; logos/medical diagrams "essential" exempt). [digest] https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- SC 2.5.8 AA: targets ≥24×24 CSS px; 2.5.5 AAA 44×44. [digest] https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html . Android/Material: 48×48 dp touch targets. [digest] https://support.google.com/accessibility/android/answer/7101858
- Material 3 color roles (primary/onPrimary/primaryContainer, secondary, tertiary, error/onError/errorContainer, surface/surfaceVariant/onSurface, outline) — Paper's MD3 theme exposes these keys directly. [unverified wording; pages returned title only] https://m3.material.io/styles/color/roles

### 6.2 Clinical status convention (brief Category 5 "Clinically meaningful status labels")
Use the triage triad **Normal / Caution / Urgent** with colour + icon + text label (never colour alone, for colour-blind users):
- Normal = green + check-circle; Caution = amber + alert-triangle; Urgent = red + alert-octagon. Red is reserved for allergies/urgent/emergency (hospital red allergy wristband convention; ICE/medical-alert cards are conventionally red with a white cross/star of life). [unverified convention; search only]
- Emergency card visual references: Apple Medical ID (fields: Medical Conditions, Allergies & Reactions, Medications, Blood Type, Organ Donor, Weight/Height, Emergency Contacts; "Show When Locked"; Lock Screen → Emergency → Medical ID) [unverified today; Apple page returned TOC only] https://support.apple.com/guide/iphone/fill-out-your-health-details-iph08022b194/ios ; Android Personal Safety "Emergency information" (blood type, allergies, medications, medical notes, organ donor, emergency contacts; lock screen: swipe up → Emergency → View emergency info; Android 12+). [digest] https://support.google.com/android/answer/9319337
- Figma references (free community files, licence typically CC BY 4.0 per Figma Community Free Resource License https://www.figma.com/legal/community-free-resource-license/ [digest search]): "Medical ID Card Template — For Emergencies & Rapid Response" https://www.figma.com/community/file/1497108250977639244 ; "Emergency Health Information Card Template" https://www.figma.com/community/file/1012361833480678497 ; "medical emergency app ui" https://www.figma.com/community/file/1123089136205638703 ; "Doccure – Free Figma UI Kit for Telemedicine" https://www.figma.com/community/file/1524376159860657786 ; "Medics – Medical App UI Kit" https://www.figma.com/community/file/1106057134887426425 ; "Medical App Components" https://www.figma.com/community/file/1372855577338914754 ; "Health App – Mobile UI Kit" https://www.figma.com/community/file/1482301602828291868 . Verify each file's licence badge before copying screens.

### 6.3 Starter design tokens (`src/theme/tokens.ts`) — contrast ratios computed with the WCAG formula, all ≥4.5:1 for text on its paired background

```ts
export const palette = {
  // brand (calm clinical blue)
  primary: '#005B96',            // on #FFFFFF = 7.6:1
  onPrimary: '#FFFFFF',
  primaryContainer: '#D6EBFF',
  onPrimaryContainer: '#00294A', // 12+:1
  secondary: '#00695C',          // teal, 6.0:1 on white
  onSecondary: '#FFFFFF',
  // clinical status
  normal: '#1B6E3A', normalContainer: '#DCF5E3', onNormalContainer: '#0B3D1E',   // text 7.1:1
  caution: '#8A5A00', cautionContainer: '#FFF3D6', onCautionContainer: '#4A3000', // text 7.2:1
  urgent: '#B3261E', urgentContainer: '#FFDAD6', onUrgentContainer: '#410E0B',   // MD3 error tones, 5.9:1 / 10+:1
  // emergency card
  emergencyHeader: '#C62828', onEmergencyHeader: '#FFFFFF', // 5.7:1
  bloodBadge: '#B3261E', onBloodBadge: '#FFFFFF',
  // neutrals (light)
  surface: '#FFFFFF', surfaceVariant: '#F2F4F7', onSurface: '#1A1C1E', onSurfaceVariant: '#44474E',
  outline: '#74777F', outlineVariant: '#C4C7CF',
};
export const dark = {
  surface: '#121417', surfaceVariant: '#1E2126', onSurface: '#E3E2E6', onSurfaceVariant: '#C4C7CF',
  primary: '#8FCDFF', onPrimary: '#003353', primaryContainer: '#00497A', onPrimaryContainer: '#D6EBFF',
  urgent: '#FFB4AB', onUrgent: '#690005', urgentContainer: '#93000A', onUrgentContainer: '#FFDAD6',
  caution: '#FFCC66', onCaution: '#3D2800', normal: '#7CDB99', onNormal: '#00391A',
  emergencyHeader: '#B3261E', onEmergencyHeader: '#FFFFFF', outline: '#8E9199',
};
// Type scale (Sarabun; elderly-first: body >= 18, nothing < 16; Thai needs 1.5-1.6 line-height for tone marks)
export const type = {
  display: { fontFamily: 'Sarabun_700Bold', fontSize: 34, lineHeight: 44 },
  headline: { fontFamily: 'Sarabun_700Bold', fontSize: 28, lineHeight: 38 },
  title: { fontFamily: 'Sarabun_600SemiBold', fontSize: 22, lineHeight: 32 },
  bodyLarge: { fontFamily: 'Sarabun_400Regular', fontSize: 20, lineHeight: 30 },
  body: { fontFamily: 'Sarabun_400Regular', fontSize: 18, lineHeight: 28 },
  label: { fontFamily: 'Sarabun_500Medium', fontSize: 16, lineHeight: 24 },
  cardValue: { fontFamily: 'Sarabun_700Bold', fontSize: 26, lineHeight: 34 }, // blood type / allergy on card
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, card: 20, pill: 999 };
export const touch = { min: 48 };   // dp (Android Material) ; >= 44 (WCAG AAA)
```
Wire into Paper: `const theme = { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, primary: palette.primary, error: palette.urgent, ... }, fonts: configureFonts({ config: { fontFamily: 'Sarabun_400Regular' } }) }`; use `useColorScheme()` to switch to a dark variant; expose status colours as `theme.colors.custom.*` (Paper allows extra keys via typed theme augmentation).

Contrast sanity (WCAG relative luminance): #005B96/#FFF 7.6:1; #B3261E/#FFF 5.9:1; #8A5A00/#FFF3D6 7.2:1; #1B6E3A/#DCF5E3 5.9:1; #C62828/#FFF 5.7:1. Re-check with https://webaim.org/resources/contrastchecker/ after any tweak.

### 6.4 Elderly-first UI rules for MediFirstCard
1. Body 18sp minimum; card values 26sp bold; support OS font scaling (`allowFontScaling` default true; test at 130 %).
2. Touch targets 48dp; list rows ≥ 56dp; primary actions as full-width buttons at bottom.
3. Status = colour + icon + Thai/English label; red only for allergy/urgent.
4. High-contrast light theme default; dark theme optional; never place text on illustrations.
5. One action per screen; large FAB "Scan document" with camera icon; confirmation Snackbar with plain-language text.
6. Emergency card layout: red header band (name, blood type badge), then Allergies (red chips), Conditions, Medications, Emergency contact with call button; identical layout in-app and in the Android widget (widget uses the same palette hex values in XML).

---

## 7. Final recommended stack and install commands (Expo SDK 57, Android-first)

```bash
# 0. project (if not created)
npx create-expo-app@latest medifirstcard --template blank-typescript   # SDK 57
cd medifirstcard

# 1. UI kit: React Native Paper (MD3)
npx expo install react-native-paper react-native-safe-area-context

# 2. Icons: MaterialCommunityIcons (already available via @expo/vector-icons in Expo SDK 57)
#    optional later migration: npx @react-native-vector-icons/codemod  (Expo recommendation since SDK 56)
#    Medical supplement: Health Icons (CC0)
npx expo install react-native-svg
npm i healthicons-react-native

# 3. Fonts: Sarabun (looped Thai + Latin)
npx expo install @expo-google-fonts/sarabun expo-font expo-splash-screen

# 4. Animation: Lottie (JSON from LottieFiles free library)
npx expo install lottie-react-native

# 5. Run on Android (dev build needed anyway for the widget)
npx expo run:android
```
Pinned versions observed 2026-09-03: react-native-paper 5.15.3, react-native-safe-area-context (expo-pinned), react-native-svg 15.15.5, healthicons-react-native 3.5.0, @expo-google-fonts/sarabun 0.4.1, expo-font 57.0.3, lottie-react-native 7.5.0, @expo/vector-icons 15.1.1.

Illustrations: unDraw (no attribution; set primary colour to #005B96 on the site before download) → `assets/illustrations/*.svg` rendered via `react-native-svg-transformer` or converted to PNG@3x. Figma: duplicate "Medical ID Card Template" + "Doccure" community files for mockups (Week-1 deliverable), credit authors (CC BY 4.0).

Alternative track (only if the team insists on Tailwind): NativeWind 4.2.6 + react-native-reusables CLI 0.7.1 + lucide-react-native 1.39.0 — budget +1 day for config.

---

## 8. Risks
- Paper 5.x on New Architecture: known "small bugs" (issue #4454 open) — test TextInput/Menu/Modal early on the physical phone; 5.15.2/5.15.3 fixed RN 0.85 positioning bugs.
- `@expo/vector-icons` deprecated (SDK 56 blog) but "continues to function"; codemod exists if needed.
- healthicons-react-native last published 2025-07-09 (react 18||19, RN>=0.73, svg ^15.8) — should work; fallback to raw SVG.
- lottie-react-native 7.5.0 requires RN>=0.84 + New Arch (matches SDK 57 only; do NOT downgrade the SDK below 56 without pinning lottie 7.3.x).
- Storyset/Flaticon require attribution; unDraw/Health Icons/Open Peeps do not.
- Thai tone marks clip with tight lineHeight — keep ≥1.5×.
- Custom fonts don't respond to `fontWeight` on Android — map weights to family names.

## 9. Gaps not closed today
- React Native Paper docs (oss.callstack.com) returned 403 both runs — exact wording of install/theming pages unverified (API is stable and widely documented).
- Expo Lottie docs page 404 — Expo Go inclusion for SDK 57 unverified.
- LottieFiles "Lottie Simple License" text, Blush license, Flaticon attribution text — blocked (403/cert) — treat as attribution-required except LottieFiles (attribution optional per search snippets).
- Hugeicons/Iconsax free-icon licence pages not fetched (README says free set is MIT / unlimited commercial).
- Apple Medical ID field list from Apple support page not fetched (page returned TOC only).
- No Figma file licence badges individually verified.
- Material 3 colour-role page returned title only; tokens above are hand-derived and contrast-checked by formula, not by tool.
