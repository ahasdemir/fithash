# FitHash — Expo SDK 54 → 57 Migration Plan

> Status: **PLAN ONLY — no source/config/dependency in this repo has been changed.**
> Researched against the versioned Expo v57 docs (https://docs.expo.dev/versions/v57.0.0/) and the `sdk-57` branch of expo/expo on 2026-11-19.
> FitHash context: bare workflow (committed `android/`), custom Wear OS gradle module (`android/wear`, 12 Kotlin files), custom native modules in `android/app` (WearSync, StreakWidget), Health Connect integration, Turkish UI, Expo SDK 54.0.36 / RN 0.81.5 / React 19.1.0.

---

## 1. Executive summary

| | |
|---|---|
| **What changes** | JS deps: 14 packages bump (5 are big jumps: `expo`, `react-native` 0.81.5→0.86.3, `react` 19.1→19.2.3, `expo-notifications` 0.32→57.x, `expo-file-system` 19→57.x). JS/TS source: **zero required code changes found** in `src/` — the app already uses the v57-recommended APIs (new `File`/`Paths` file-system API, new notification handler fields, typed triggers). Native: significant alignment work — Gradle wrapper 8.13→9.3.1, root `build.gradle`/`settings.gradle` rewrite to the new `expo-root-project`/`expo-autolinking-settings` plugin architecture, `MainApplication.kt` rewrite to `ExpoReactHostFactory`, manifest tweaks, `newArchEnabled=true` **forced** (legacy architecture support was removed after SDK 54). |
| **Why it matters** | Google Play requires targetSdk 36 for app updates since Aug 31, 2026 (https://developer.android.com/google/play/requirements/target-api). FitHash currently targets **34** (app **and** wear module) — Play updates are already blocked. The v57 toolchain brings compileSdk/targetSdk 36. |
| **Expected effort** | ~1.5–2.5 focused engineer-days: 0.5d dependency bump + native file alignment, 0.5–1d build/device verification (app + wear + Health Connect + notifications), buffer for new-architecture interop issues in the two custom native bridges. |
| **Risk level** | **MEDIUM.** Low JS risk (no API breaks found in our call sites). Medium native risk: (1) legacy architecture is gone — `WearSyncModule` / `StreakWidgetModule` are classic `NativeModules` bridges that have never run under Fabric/TurboModule interop; (2) the committed native project is based on a template **older than SDK 54** (it still carries an `ext` block and `kotlin 1.9.25` that even SDK 54's template had already dropped), so the upgrade helper diff under-covers the real delta; (3) `react-native-health-connect` has no official RN 0.86 statement (see §9). |
| **Key advantage** | SDK 57 is a deliberately small release: RN 0.86 has *no user-facing breaking changes* (https://reactnative.dev/blog/2026/06/11/react-native-0.86) and Expo frames 56→57 as "equivalent to a minor release" (https://expo.dev/changelog/sdk-57). Our 54→57 jump folds in the *real* breaking waves from SDK 55 (legacy arch removal, package version renumbering) and SDK 56 (Hermes v1, TS 6, file-system async `copy`/`move`). |

---

## 2. Dependency diff (current → SDK 57)

Source of truth for every Expo-managed version: `packages/expo/bundledNativeModules.json` on the `sdk-57` branch
(https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json) — this is exactly what `npx expo install expo@^57.0.0 --fix` writes. Cross-checked against the v57 reference table (https://docs.expo.dev/versions/v57.0.0/) and the 54→57 bare template diff (https://docs.expo.dev/bare/upgrade/?fromSdk=54&toSdk=57).

| Package | Current (installed) | SDK 57 target | Notes / citation |
|---|---|---|---|
| `expo` | `~54.0.0` (54.0.36) | `^57.0.0` → latest `~57.0.x` (**≥ 57.0.17**, see note) | 57.0.17 moves to RN 0.86.3 (dev-startup regression fix); 57.0.23 adds opt-in iOS scene support; template currently at ~57.0.30. https://expo.dev/changelog/sdk-57 |
| `react` | `19.1.0` | `19.2.3` | Pinned exact. https://docs.expo.dev/versions/v57.0.0/ ("Each Expo SDK version depends on a React Native version") |
| `react-dom` | `19.1.0` | `19.2.3` | Same as `react`. |
| `react-native` | `0.81.5` | `0.86.3` | Pinned exact. https://reactnative.dev/blog/2026/06/11/react-native-0.86 |
| `@expo/metro-runtime` | `~6.1.2` | `~57.0.18` | Needed for the web export runtime. bundledNativeModules.json |
| `@expo/vector-icons` | `^15.0.3` (15.1.1) | `^15.0.2` — **no forced change** | Current range already satisfies it. Note: deprecated in SDK 56 in favor of scoped `@react-native-vector-icons/*` (codemod: `npx @react-native-vector-icons/codemod`) — optional, not required for 57. https://expo.dev/changelog/sdk-56 |
| `@react-native-async-storage/async-storage` | `2.2.0` | `2.2.0` — **no change** | bundledNativeModules.json |
| `expo-document-picker` | `~14.0.8` | `~57.0.3` | Used in `SettingsModal.tsx` backup import. bundledNativeModules.json |
| `expo-file-system` | `~19.0.23` | `~57.0.7` | New API is default since SDK 54; see §3.1 — **no code change needed**. https://docs.expo.dev/versions/v57.0.0/sdk/filesystem.md |
| `expo-font` | `~14.0.12` | `~57.0.4` | Only used as an `app.json` config plugin today. bundledNativeModules.json |
| `expo-notifications` | `~0.32.17` | `~57.0.25` | Major-looking jump is the SDK 55 renumbering (all Expo packages now share the SDK major). JS API at our call sites is unchanged — see §3.2. https://docs.expo.dev/versions/v57.0.0/sdk/notifications.md, https://expo.dev/changelog/sdk-55 |
| `expo-sharing` | `~14.0.8` | `~57.0.26` | Used in `SettingsModal.tsx` export/share. bundledNativeModules.json |
| `expo-status-bar` | `~3.0.9` | `~57.0.1` | **Not imported anywhere in JS** (`App.tsx` uses RN core `StatusBar`) — bump for parity, or remove the dep entirely (decision for owner). bundledNativeModules.json |
| `react-native-health-connect` | `^4.1.2` (4.1.2) | `^4.1.3` (already covered by existing caret) | Community package, **not** in bundledNativeModules.json. 4.1.3 (2026-08-06) is latest; library's own devDeps use `react-native 0.86.2` / `react 19.2.3`; peerDeps are `expo/react/react-native: *`; v4.1.0 bumped Health Connect client to `androidx.health.connect:connect-client:1.1.0` stable. https://github.com/matinzd/react-native-health-connect/releases — risk detail in §9 |
| `react-native-safe-area-context` | `~5.6.0` | `~5.7.0` | bundledNativeModules.json |
| `react-native-svg` | `15.12.1` | `15.15.4` | bundledNativeModules.json |
| `react-native-web` | `^0.21.0` (0.21.2) | `~0.21.0` — **no change** | v57 docs table confirms RNW stays on 0.21.0 for SDK 57. https://docs.expo.dev/versions/v57.0.0/ |
| `typescript` (dev) | `^5.3.3` | `~6.0.3` (via `--fix`) | SDK 56 bumped templates to TS 6.0.3 and `expo install --fix` pulls it in. **Opt-out available** via `"expo": { "install": { "exclude": ["typescript"] } }` in package.json. https://expo.dev/changelog/sdk-56 |
| `@types/react` (dev) | `~19.1.10` | `~19.2.x` | Follow React 19.2.3 (standard template convention). |
| `vitest` (dev) | `^5.1.1` | unchanged | Not SDK-managed. See §6 regression gate. |

Toolchain floors for SDK 57 (https://docs.expo.dev/versions/v57.0.0/):
- **Node ≥ 22.13.x** — local machine has v26.13.1 ✅
- **compileSdk 36 / targetSdk 36, Android 7+** — current repo: compileSdk 36 ✅, targetSdk **34 ❌** (app and wear)
- **iOS 16.4+ / Xcode 26.4+** (repo's `ios/` is gitignored and out of scope here, but prebuild regeneration will require this — §9)
- JDK: Gradle 9.3.1 runs on JDK 17+; the repo pins `org.gradle.java.home=/usr/lib/jvm/java-17-openjdk`, which stays valid (JDK 21 also fine if you want to unpin).

---

## 3. Breaking API changes affecting THIS codebase

### 3.1 `expo-file-system` (~19 → ~57): **already on the new API — no code change**

`src/screens/SettingsModal.tsx` (lines 31, 226–231, 274–275) uses:

```ts
import { File, Paths } from 'expo-file-system';
// export:
const file = new File(Paths.document, filename);
if (!file.exists) file.create();
file.write(exportContent);
const fileUri = file.uri;
// import (from DocumentPicker asset):
const selectedFile = new File(fileAsset.uri);
const text = await selectedFile.text();
```

This is byte-for-byte the v57-recommended usage (`new File(Paths.cache, 'x')`, `file.create()`, `file.write()`, `file.text()`) — see the canonical examples at https://docs.expo.dev/versions/v57.0.0/sdk/filesystem.md. What changed around it:

- The **legacy** API (`readAsStringAsync`, `writeAsStringAsync`, `downloadAsync`, `uploadAsync`, `getInfoAsync`, …) moved to the `expo-file-system/legacy` subpath; the top-level deprecated methods now **throw at runtime**. FitHash imports none of them — verified by grep across `src/`.
- SDK 56 made `File.copy()` / `Directory.move()` **async** (return Promise; use `copySync()`/`moveSync()` for sync) — SettingsModal does not call copy/move. https://expo.dev/changelog/sdk-56
- **Action: bump the dependency only.** The only file-system follow-up is optional: `File.pickFileAsync()` (new in the modern API) could later replace the DocumentPicker import, but that is a post-migration nicety, not a requirement.

### 3.2 `expo-notifications` (0.32 → 57.0.25): **call-site compatible**

`src/services/notifications.ts` was audited against https://docs.expo.dev/versions/v57.0.0/sdk/notifications.md:

| Our usage | v57 status |
|---|---|
| `setNotificationHandler` with `shouldShowBanner` / `shouldShowList` | ✅ Current API shape (old `shouldShowAlert` split was SDK 52/53-era; we're already on the new fields) |
| `setNotificationChannelAsync` × 3 (`fithash`, `fithash_timers`, `fithash_achievements`) with importance/vibration/lightColor/lockscreenVisibility/bypassDnd | ✅ Unchanged, incl. `bypassDnd` |
| `scheduleNotificationAsync` with typed triggers (`SchedulableTriggerInputTypes.TIME_INTERVAL`, `.DAILY`, `channelId`, `identifier`) | ✅ Unchanged |
| `requestPermissionsAsync` / `getPermissionsAsync` | ✅ Unchanged (Android 13+ `POST_NOTIFICATIONS` prompt still requires ≥1 channel to exist first — our code already creates channels) |
| app.json plugin `[expo-notifications, { color, defaultChannel }]` | ✅ Both props still valid plugin props in v57 (plus new `icon`, `sounds`, `enableBackgroundRemoteNotifications` we don't need) |

Relevant breaking changes that we **don't** hit (for the record, from https://expo.dev/changelog/sdk-55):
- The root `expo.notification` app.json field was removed → **we already use the plugin form**, fine.
- Push notifications in Expo Go now throw → we only use **local** notifications, fine.
- SDK 55 updated the Android Firebase dependency → bare app, local notifications only, no FCM credentials involved.

**Action: bump the dependency; no TS changes.** On-device behavior (exact alarms, channels) is in the §7 checklist because Android 14+ exact-alarm policy is orthogonal to the SDK bump.

### 3.3 Legacy architecture is gone — `newArchEnabled=false` must become `true`

- SDK 54 was the **last** release with legacy ("Paper") architecture support; SDK 55+ is New Architecture only, and the `newArchEnabled` app.json option was removed entirely (https://expo.dev/changelog/sdk-55). RN's 0.86 notes likewise describe legacy-architecture removal as complete (https://reactnative.dev/blog/2026/06/11/react-native-0.86).
- FitHash has `newArchEnabled=false` in `android/gradle.properties` → must flip to `true` (and expect `expo run:android`/gradle to enforce it anyway).
- **Exposure:** the two custom bridges use the classic `NativeModules` path:
  - `src/services/wearSyncService.ts` → `const { WearSyncModule } = NativeModules` (+ `NativeEventEmitter`)
  - `src/services/widgetService.ts` → `const { StreakWidgetModule } = NativeModules`

  RN 0.86 runs classic native modules on New Arch through the interop layer, and `react-native-health-connect` ships a TurboModule (`codegenConfig` with `RNHealthConnectSpec`), so the *expected* outcome is "works unchanged" — but these two hand-written bridges have **never executed under Fabric in this app**. This is the single biggest functional unknown; it's verification item #8 in §7 and risk #2 in §9.

### 3.4 `MainApplication.kt` — required rewrite (custom packages must survive it)

The 54→57 template diff (https://docs.expo.dev/bare/upgrade/?fromSdk=54&toSdk=57) replaces the whole host setup. Our file currently follows the old pattern:

```kotlin
// BEFORE (android/app/src/main/java/com/fithash/app/MainApplication.kt — current)
override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : DefaultReactNativeHost(this) {
      override fun getPackages(): List<ReactPackage> {
        val packages = PackageList(this).packages.toMutableList()
        packages.add(StreakWidgetPackage())
        packages.add(WearSyncPackage())
        return packages
      }
      override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"
      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }
)
override val reactHost: ReactHost
  get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)
// onCreate(): SoLoader.init(...) + conditional load()
```

**AFTER — v57 pattern, adapted to keep our two custom packages** (target content, per the SDK 57 template https://github.com/expo/expo/blob/sdk-57/templates/expo-template-bare-minimum/android/app/src/main/java/com/helloworld/MainApplication.kt):

```kotlin
package com.fithash.app

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(StreakWidgetPackage())
          add(WearSyncPackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
```

Notes: `reactNativeHost` disappears entirely; `SoLoader.init` is dropped (template no longer needs it); `BuildConfig.REACT_NATIVE_RELEASE_LEVEL` comes from a new `buildConfigField` that must be added to `app/build.gradle` (§4). `MainActivity.kt` is **already identical to the v57 template** — no changes.

### 3.5 `AndroidManifest.xml` — two template-mandated edits + one recommended

From the 54→57 helper diff:

```diff
-<manifest xmlns:android="http://schemas.android.com/apk/res/android">
+<manifest xmlns:android="http://schemas.android.com/apk/res/android"
+  xmlns:tools="http://schemas.android.com/tools">
…
-  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
-  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
+  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" tools:replace="android:maxSdkVersion"/>
+  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" tools:replace="android:maxSdkVersion"/>
…
-    <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode" …
+    <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths" …
```

**Recommended for FitHash:** the app only writes to app-scoped dirs (`Paths.document`) — consider deleting the READ/WRITE_EXTERNAL_STORAGE lines outright instead of carrying `maxSdkVersion="32"` dead weight. Everything else in our manifest (health permissions, `<queries>` for Health Connect, `StreakWidgetProvider` receiver, `WearPhoneListenerService`) is custom and must be **preserved as-is**.

### 3.6 `app.json` plugins — no changes required

- `expo-font`, `[expo-notifications, { color: "#C6F035", defaultChannel: "default" }]`, `react-native-health-connect` all remain valid in v57. The v57 notifications doc lists `color` + `defaultChannel` as current plugin props (https://docs.expo.dev/versions/v57.0.0/sdk/notifications.md).
- `react-native-health-connect` **v4.0.0 was a breaking change for Expo users** — it now bundles its own config plugin and the separate `expo-health-connect` plugin package was dropped; leaving the old plugin installed fails the build with a duplicate class. FitHash already lists `react-native-health-connect` directly (correct v4 form) and has the plugin's manifest output hand-baked into the committed manifest (health permissions + rationale activity + activity-alias), so there is nothing to change; just **do not** add `expo-health-connect`.
- Remember that in this bare project app.json plugins only take effect via prebuild/EAS — since `android/` is committed and managed by hand, the plugin entries are effectively declarative. Keep them in sync with reality.

### 3.7 Things that could have bitten but don't (verified, no action)

- `expo/fetch` becomes `globalThis.fetch` in SDK 56 → grep found **no direct `fetch()`/network calls** in `src/`.
- `react-native-reanimated`/`worklets` Hermes v1 memory regression (SDK 55/56) → **not installed**.
- `expo-status-bar` `backgroundColor`/`translucent` props deprecated as no-ops (SDK 55, edge-to-edge) → the dependency is unused in JS; `App.tsx` uses RN core `StatusBar`, whose `backgroundColor` prop will simply stop painting on Android 15+ — visual check in §7, optional follow-up to drop the prop.
- `@expo/vector-icons` must stay an **explicit** dependency (the `expo` package no longer depends on it — SDK 56 breaking change). FitHash already lists it explicitly ✅.
- Node 26.13.1 ≥ 22.13 floor ✅.

---

## 4. Native / Gradle changes required

> ⛔ **WARNING — do NOT run `npx expo prebuild` (or `expo run:android --device` fresh-generation flows) against this repo's `android/`.**
> Since SDK 57, `expo prebuild` **clears and regenerates the native directories by default** (https://expo.dev/changelog/sdk-57, "expo prebuild: now clears and regenerates the native android and ios directories by default; pass --no-clean …"). On FitHash that would delete:
> - `android/wear/**` (the entire custom Wear OS module — 12 Kotlin files, own gradle module, not represented in app.json at all),
> - custom app-module sources: `WearSyncModule.kt`, `WearSyncPackage.kt`, `WearPhoneListenerService.kt`, `StreakWidgetModule.kt`, `StreakWidgetPackage.kt`, `StreakWidgetProvider.kt`,
> - hand-maintained manifest entries (health permissions, widget receiver, wear listener service) and gradle customizations (wear deps in `app/build.gradle`, `include ':wear'`).
> **Safe procedure instead:** apply the 54→57 diff by hand from the upgrade helper (https://docs.expo.dev/bare/upgrade/?fromSdk=54&toSdk=57), and if you want a full generated reference, run `npx create-expo-app@latest ref57 --template bare-minimum` **in a scratch directory** (e.g. `/tmp/opencode/`) and diff files against the repo. If a prebuild experiment is ever unavoidable, do it in a throwaway **copy/worktree of the repo** with `--no-clean`, never on the working tree, and expect it to still churn plugin-managed files.

### 4.1 File-by-file delta (current repo → SDK 57 template)

| File | Current | Target (SDK 57) | Source |
|---|---|---|---|
| `android/gradle/wrapper/gradle-wrapper.properties` | `gradle-8.13-all.zip` | `gradle-9.3.1-bin.zip` + regenerate `gradlew`, `gradlew.bat`, `gradle-wrapper.jar` (all changed in template) | upgrade-helper diff; template |
| `android/settings.gradle` | old autolinking style: `apply from: .../scripts/autolinking.gradle`, `useExpoModules()`, `dependencyResolutionManagement { versionCatalogs { reactAndroidLibs … } }` | new `expo-autolinking-settings` plugin style: `pluginManagement` includeBuilds RN gradle plugin **and** `expo-modules-autolinking/../android/expo-gradle-plugin`; `expoAutolinking.useExpoModules()`; **`expoAutolinking.useExpoVersionCatalog()`**; no `dependencyResolutionManagement` block; **keep `include ':app'` + `include ':wear'`** | template settings.gradle (sdk-57) |
| `android/build.gradle` | old-style `buildscript { ext { buildToolsVersion 35.0.0 / minSdk 26 / compileSdk 36 / **targetSdk 34** / **kotlinVersion 1.9.25** / ndkVersion 26.1.10909125 } }` + `apply plugin: "com.facebook.react.rootproject"` | drop the whole `ext` block (values are supplied by the new **`expo-root-project`** plugin from the `expo-gradle-plugin` included build); keep `classpath('com.android.tools.build:gradle')`, `classpath('com.facebook.react:react-native-gradle-plugin')`, `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')` (versionless — resolved by the RN gradle plugin); add `apply plugin: "expo-root-project"`; keep jitpack repo | template build.gradle (sdk-54 == sdk-57 here; our repo is simply older than SDK 54's template) |
| `android/app/build.gradle` | hermesCommand via `react-native/sdks/hermesc`, `jscFlavor 'org.webkit:android-jsc:+'`, fresco via `reactAndroidLibs.versions.fresco`, no `REACT_NATIVE_RELEASE_LEVEL` | hermesCommand via new **`hermes-compiler`** npm package (Hermes v1); add `enableBundleCompression` line; `jscFlavor 'io.github.react-native-community:jsc-android:2026004.+'`; fresco via **`expoLibs.versions.fresco`** (catalog renamed — requires `useExpoVersionCatalog()` in settings.gradle); add `buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", "\"${findProperty('reactNativeReleaseLevel') ?: 'stable'}\""`; **keep** our wear deps block (`play-services-wearable:18.2.0`, `kotlinx-coroutines-play-services`) | upgrade-helper diff; template app/build.gradle |
| `android/gradle.properties` | `newArchEnabled=false`, no `edgeToEdgeEnabled`, no `org.gradle.parallel`, `reactNativeArchitectures=arm64-v8a,x86_64`, `org.gradle.java.home=/usr/lib/jvm/java-17-openjdk` | **`newArchEnabled=true`** (mandatory), **`edgeToEdgeEnabled=true`**, `org.gradle.parallel=true`; keep `hermesEnabled=true`, keep our trimmed `reactNativeArchitectures` (valid choice), keep or drop the java.home pin (JDK 17 still meets the floor) | template gradle.properties (sdk-57) |
| `android/app/src/main/AndroidManifest.xml` | see §3.5 | two template edits + optional permission cleanup; preserve all custom entries | upgrade-helper diff |
| `MainApplication.kt` | old `DefaultReactNativeHost` pattern | §3.4 rewrite | template + helper diff |
| `MainActivity.kt` | already identical to template | **no change** | template comparison |
| `android/wear/build.gradle` | `compileSdk rootProject.ext.compileSdkVersion`, **`targetSdk 34`**, minSdk 30, Compose 1.4.0 / Compose UI 1.6.8 | **bump `targetSdk` 34 → 36** (Play deadline applies to Wear OS updates too). `rootProject.ext.compileSdkVersion` is expected to keep working because the `expo-root-project` plugin now defines the root `ext` values that `expo-module-gradle-plugin`/subprojects read (its absence only produces a warning + default per `expo-module-gradle-plugin`'s `Warnings.kt`). **Safer option:** stop depending on root `ext` and hardcode `compileSdk 36` in the wear module. Also consider bumping `wear_compose_version`/`compose_version` opportunistically — not required for the SDK bump | wear/build.gradle (repo) + template root files |
| RN-internal versions (AGP/Kotlin/NDK) | RN 0.81.5 pins AGP 8.11.0 / Kotlin 2.1.20 / buildTools 36.0.0 / NDK 27.1.12297006 (`node_modules/react-native/gradle/libs.versions.toml` — the repo's `1.9.25`/NDK 26 pins are stale leftovers) | after `npm install`, **read `node_modules/react-native/gradle/libs.versions.toml`** and align/verify — do not hand-pin AGP/Kotlin anywhere; the RN gradle plugin supplies them. Expect AGP 8.x (AGP 9 support lands with RN 0.87 / SDK 58 — https://reactnative.dev/blog/2026/08/11/react-native-0.87) | local file + RN blog |

### 4.2 Why the upgrade helper alone is not enough for THIS repo

The official 54→57 helper diff assumes your native project is at the SDK 54 template baseline. FitHash's `android/` is actually at an **older** baseline (root `build.gradle` still has the pre-54 `ext` block; `kotlin 1.9.25`, NDK 26, targetSdk 34, `settings.gradle` in the pre-`expo-autolinking-settings` shape). Two of the most important changes — the root `build.gradle`/`settings.gradle` rewrite and `newArchEnabled=true` — therefore don't appear in the helper output (template 54 == template 57 for those files). They are captured in §4.1 from the template files themselves:

- root build.gradle: https://github.com/expo/expo/blob/sdk-57/templates/expo-template-bare-minimum/android/build.gradle
- settings.gradle: https://github.com/expo/expo/blob/sdk-57/templates/expo-template-bare-minimum/android/settings.gradle
- gradle.properties: https://github.com/expo/expo/blob/sdk-57/templates/expo-template-bare-minimum/android/gradle.properties
- app/build.gradle: https://github.com/expo/expo/blob/sdk-57/templates/expo-template-bare-minimum/android/app/build.gradle

Also expect `npx expo run:android` to **sync plugin output into the existing android/** after the upgrade (that is non-destructive, unlike prebuild) — review the resulting git diff before committing.

---

## 5. Ordered migration procedure (with git safety)

**Phase 0 — freeze & branch (15 min)**

1. Land/merge the concurrent work (services/screens/tests) first — do not start the upgrade on a moving tree.
2. Baseline the gates on SDK 54: `npx tsc --noEmit` ✅, `npm test` ✅ (vitest, `vitest.config.ts`, `tests/**/*.test.ts`), `npx expo export -p web` ✅ — record results (screenshots/terminal logs) as the regression reference.
3. `git checkout main && git pull && git checkout -b upgrade/expo-sdk-57 && git tag pre-sdk57`
4. Lockfile backup outside the repo: `cp package-lock.json /tmp/opencode/package-lock.sdk54.json` (plus the branch itself is the in-repo backup).
5. Optional: `npx create-expo-app@latest ref57 --template bare-minimum` into `/tmp/opencode/ref57` as the native reference mentioned in §4.

**Phase 1 — dependency bump (30–60 min)**

6. `npx expo install expo@^57.0.0 --fix` — updates every SDK-managed dep to the §2 table. Watch for:
   - it bumping `typescript` to ~6.0.3 — decide: accept (then budget time for strict-mode type fixes) or add `"expo": { "install": { "exclude": ["typescript"] } }` to package.json and stay on 5.x for now;
   - `react-native-health-connect` is **not** SDK-managed — verify it resolves to `^4.1.3` (`npm ls react-native-health-connect`).
7. `npm install` (refresh lockfile), then `npx expo-doctor@latest` until clean.
8. Checkpoint commit: `chore(deps): bump Expo SDK 54 -> 57 packages`.
9. Gates (expect possible TS 6 fallout; zero expected JS runtime changes yet): `npx tsc --noEmit`, `npm test`, `npx expo export -p web`. Fix and checkpoint: `fix(types): SDK 57 type alignment`.

**Phase 2 — native alignment (2–4 h)**

10. Apply §4.1 in this order (commit between steps):
    a. `settings.gradle` rewrite (keep `include ':wear'`) — `build(native): SDK 57 settings.gradle + expo-autolinking-settings`
    b. root `build.gradle` rewrite (`expo-root-project`, drop stale `ext` block) — `build(native): adopt expo-root-project plugin`
    c. `gradle.properties`: `newArchEnabled=true`, `edgeToEdgeEnabled=true`, `org.gradle.parallel=true`
    d. Gradle wrapper 8.13 → 9.3.1 (regenerate via `cd android && gradle wrapper --gradle-version 9.3.1 --distribution-type bin` or copy from the scratch template) — `build(native): gradle wrapper 9.3.1`
    e. `app/build.gradle`: hermes-compiler, `enableBundleCompression`, `expoLibs` catalog, `REACT_NATIVE_RELEASE_LEVEL` buildConfigField, jscFlavor; keep wear deps
    f. `AndroidManifest.xml` per §3.5 — `build(native): SDK 57 manifest updates`
    g. `MainApplication.kt` rewrite per §3.4 — `feat(native): ExpoReactHostFactory host with custom packages`
    h. `android/wear/build.gradle`: `targetSdk 36` (and compileSdk hardcode or verified `rootProject.ext` path)
11. After each of c/g run `cd android && ./gradlew help` (fast smoke of settings/plugin resolution); after all steps: `./gradlew assembleDebug`.
12. First `npx expo run:android` on a device/emulator, then `git diff android/` and review every plugin-synced change before committing — `build(native): SDK 57 full native alignment`.

**Phase 3 — verification (0.5–1 d)** — full §7 checklist, then a final checkpoint commit and PR to `main` (merge commit message referencing this doc). Tag `post-sdk57-verified`.

---

## 6. Vitest as the regression gate

The vitest suite (`vitest.config.ts`, node environment, `tests/**/*.test.ts`) is being introduced concurrently with this plan. Wire it into the upgrade as a **hard gate**:

- Run before starting (baseline), after Phase 1 (deps), after Phase 2 (native — proves no behavioral drift in services), and before merging.
- The suite covers `src/services/**` (storage/settings/notifications/health-connect/wear-sync logic), which is exactly the layer touched by the SDK bump; UI text/components are unaffected at the API level.
- Command: `npm test` (i.e. `vitest run`). If the concurrent work adds coverage flags, prefer running with coverage to spot newly-unexercised branches after the bump.
- Type-check gate: `npx tsc --noEmit` (tsconfig extends `expo/tsconfig.base` + `strict: true` — the TS 6 decision in Phase 1 directly affects strictness here).

---

## 7. Verification checklist

**Static / build**
- [ ] `npx expo-doctor@latest` — zero warnings
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — vitest suite green
- [ ] `npx expo export -p web` — bundle produced in `dist/`, no resolution errors (`@expo/metro-runtime` ~57.0.18)
- [ ] `cd android && ./gradlew assembleRelease` — app module builds (New Arch codegen, Hermes v1 via `hermes-compiler`)
- [ ] `./gradlew :wear:assembleRelease` — **wear module builds** (its `rootProject.ext.compileSdkVersion` / hardcoded 36 works; Compose compiler under new Kotlin toolchain)
- [ ] `node_modules/react-native/gradle/libs.versions.toml` reviewed — no local stale pins contradict it

**Runtime — app (physical device, Android 13+ and ideally Android 15/16)**
- [ ] App launches; all 4 tabs render (Workout / Analytics / History / Library); Turkish UI intact
- [ ] `WearSyncModule` + `StreakWidgetModule` resolve via `NativeModules` under New Arch interop: "Rutinleri Saate Eşitle" completes, streak widget updates after finishing a workout
- [ ] Edge-to-edge visual pass on Android 15/16: status bar (the RN `StatusBar backgroundColor={COLORS.surface}` in `App.tsx:246` is now a no-op — confirm no visual regression behind insets), all `SafeAreaView`/`useSafeAreaInsets` screens and modals, keyboard behavior in `ActiveWorkoutModal`
- [ ] Backup round-trip: JSON export → "Dosya Olarak İndir" writes + shares a real file (new `File`/`Paths` API); "Dosyadan Seç" import restores; clipboard/web download path works after `npx expo export` sanity

**Runtime — Health Connect (device with Health Connect installed)**
- [ ] Settings toggle: permission rationale flow (`ACTION_SHOW_PERMISSIONS_RATIONALE` activity-alias still functional), grant path turns toggle "Aktif"
- [ ] "Tüm Geçmişi Health Connect'a Aktar" — records appear in the Health Connect app: ExerciseSession (STRENGTH_TRAINING etc.), ActiveCaloriesBurned, TotalCaloriesBurned, Distance
- [ ] Daily summary read (`readTodayHealthData`) returns steps/calories/distance
- [ ] No duplicate-class build errors from the plugin (confirms §3.6 health-connect v4 setup)

**Runtime — notifications**
- [ ] All 3 channels created (check system settings: FitHash Genel / Dinlenme Zamanlayıcısı / Başarı ve PR)
- [ ] Android 13+ `POST_NOTIFICATIONS` prompt appears (channel must exist first — our `configureNotifications` order already does this)
- [ ] Rest-timer notification fires when countdown ends (exact alarm path: `SCHEDULE_EXACT_ALARM` on Android 12+); PR & streak notifications trigger; daily 18:00 reminder reschedules after reboot (`RECEIVE_BOOT_COMPLETED`)
- [ ] Foreground presentation shows banner + list (handler fields)

**Store-facing**
- [ ] Both APKs target API 36 (Play requirement since Aug 31, 2026); `versionCode` bumped in `app.json` + both build.gradies when actually shipping
- [ ] Review `USE_EXACT_ALARM` in the manifest — Play policy restricts it to alarm/calendar apps; consider keeping only `SCHEDULE_EXACT_ALARM` with a graceful in-app fallback (pre-existing issue, good moment to fix)

---

## 8. Rollback plan

- **Branch containment:** all work happens on `upgrade/expo-sdk-57`; `main` stays on SDK 54 and shippable at all times. `git tag pre-sdk57` marks the exact starting commit.
- **Abort mid-migration:** `git checkout main` (branch can simply be abandoned/deleted). Working tree clean-up if you stopped mid-phase: `git checkout -- .` on the branch or `git clean -fd android/` (careful — never run clean commands on `main`).
- **Dependency rollback:** `git checkout pre-sdk57 -- package.json package-lock.json && npm ci` — or the out-of-repo copy: `cp /tmp/opencode/package-lock.sdk54.json package-lock.json && npm ci`.
- **Native rollback:** native changes are checkpointed per file group (§5 phase 2 commits); `git revert <sha>` selectively, or `git checkout pre-sdk57 -- android/` to restore the entire native tree in one shot.
- **Post-merge discovery of a bad regression:** `git revert -m 1 <merge-commit>` (clean revert since Phase 1/2/3 are separate commits), or if nothing shipped yet, hard-reset `main` to `pre-sdk57`. Previous release APKs (v1.1.0, versionCode 3) remain valid store rollback artifacts.
- **Worst case (custom native code broken under New Arch beyond quick fixes):** the two bridge modules are ~2 small Kotlin files each; a contained fallback is migrating `WearSyncModule`/`StreakWidgetModule` to spec-based TurboModules — still cheaper than staying on SDK 54 (which stops receiving fixes; SDK 54's support window ends with the next SDK release cycle, per https://expo.dev/changelog/sdk-57 "SDK releases continue to have a lifetime of approximately one year").

---

## 9. "Do not upgrade yet" — open risks the owner must accept

1. **`react-native-health-connect` ↔ RN 0.86 / New Architecture — unverified officially.** Strong positive signals: v4.1.3's own devDependencies build against `react-native 0.86.2` + `react 19.2.3`; peerDeps are fully open (`react-native: "*"`); it ships TurboModule codegen (`RNHealthConnectSpec`); Health Connect client is now `1.1.0` stable. But the maintainers publish no explicit RN-compat matrix, and its Android gradle file still uses the classic `apply plugin: "kotlin-android"` + root-ext lookup style, which we're also changing at the root (§4.1). **Acceptance condition:** full §7 Health Connect pass on a release build before merging.
2. **Classic `NativeModules` bridges (`WearSyncModule`, `StreakWidgetModule`) under New Architecture.** They have only ever run on Paper (repo has `newArchEnabled=false`). RN 0.86's interop layer should carry them, but this is the app's most custom, least-standard code path, and it is also the path the Wear OS feature depends on. **Acceptance condition:** §7 runtime checks on device; budget for a TurboModule migration if interop fails.
3. **Wear module toolchain drift.** `android/wear` pins Compose 1.4.0 / UI 1.6.8 / play-services-wearable 18.2.0 and compiles with the root project's Kotlin. The root Kotlin/AGP jump (≥2.1/8.11 → whatever 0.86.3 pins) plus `compileSdk 36`/`targetSdk 36` is expected to compile cleanly but is not guaranteed — the wear module is exercised only via `:wear:assembleRelease`, which nobody but us can gate. **Acceptance condition:** wear release APK builds AND installs on a watch (or emulator) with the phone-side sync flow exercised.
4. **TypeScript 6 decision.** `expo install --fix` will pull TS ~6.0.3 (SDK 56 policy). TS 6 under this repo's `strict: true` may surface new errors across the (concurrently changing) codebase, and the vitest/esbuild toolchain must digest it. Mitigation is one package.json line (`expo.install.exclude`), but the owner should pick deliberately: take TS 6 now (recommended — one-time cost, stays on the supported path) or defer with the exclude flag.
5. **`expo prebuild` foot-gun is now the default behavior.** Any teammate or agent running plain `npx expo prebuild` on SDK 57 CLI wipes `android/wear` and all hand-maintained native files (§4 warning). Until the team internalizes this, consider a repo-level guard (e.g. an `AGENTS.md`/`CLAUDE.md` note and a CI check that `android/wear/` exists in every PR touching `android/`).
6. **SDK 58 already exists** (per the upgrade helper and upgrade walkthrough listing SDK 58 release notes; it targets RN 0.88 / React 19.3 / AGP 9, wrapper 9.4.1). Choosing 57 now is still sound — it's the stable, fully-patched RN 0.86 line — but expect the *next* migration (57→58) within months, and note SDK 57's ~1-year support window. If the wear-module risk items (1–3) already force a long verification cycle, weigh whether to jump 54→58 directly with the same amount of native work — the owner explicitly chose 57, and this plan targets 57; the delta for 58 is documented at https://docs.expo.dev/bare/upgrade/?fromSdk=57&toSdk=58.
7. **iOS is out of scope here** (`ios/` is gitignored on this Linux machine). If it's ever regenerated: SDK 57 requires iOS 16.4+ / Xcode 26.4+, the AppDelegate/SceneDelegate scene-lifecycle changes apply when building with the iOS 27 SDK, and the Podfile gains precompiled-modules/Hermes-v1 env lines — see the iOS hunks of the upgrade-helper diff and https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md.
8. **Pre-existing Play compliance debt surfaces now:** targetSdk 34 on both APKs is already below the Play floor (updates blocked since Aug 31, 2026) and `USE_EXACT_ALARM` is policy-restricted. The SDK upgrade forces the targetSdk fix; the exact-alarm permission should be triaged in the same release.

---

## Appendix — sources

- Expo v57 versioned docs index & compat tables: https://docs.expo.dev/versions/v57.0.0/
- SDK 57 release notes: https://expo.dev/changelog/sdk-57 · SDK 56: https://expo.dev/changelog/sdk-56 · SDK 55: https://expo.dev/changelog/sdk-55
- Upgrade walkthrough: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough.md
- **Native project upgrade helper (54→57), primary diff for §3.4/§3.5/§4:** https://docs.expo.dev/bare/upgrade/?fromSdk=54&toSdk=57
- SDK 57 pinned dependency matrix: https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json
- v57 bare-minimum template files (build.gradle / settings.gradle / gradle.properties / app build.gradle / MainApplication.kt / MainActivity.kt / wrapper): https://github.com/expo/expo/tree/sdk-57/templates/expo-template-bare-minimum/android
- FileSystem v57 (recommended version `~57.0.7`, new-API usage, legacy subpath): https://docs.expo.dev/versions/v57.0.0/sdk/filesystem.md
- Notifications v57 (recommended version `~57.0.25`, plugin props, channel/permission behavior): https://docs.expo.dev/versions/v57.0.0/sdk/notifications.md
- React Native 0.86 release notes (no user-facing breaking changes; edge-to-edge; legacy-arch deprecations): https://reactnative.dev/blog/2026/06/11/react-native-0.86
- react-native-health-connect releases (4.1.3 latest; 4.1.0 → Health Connect client 1.1.0 stable; 4.0.0 expo-plugin breaking change): https://github.com/matinzd/react-native-health-connect/releases
- Google Play target API requirements: https://developer.android.com/google/play/requirements/target-api
