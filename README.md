# FitHash 🏋️‍♂️

A privacy-first, local-first workout tracking and progressive overload management app built with **React Native**, **Expo**, and **Wear OS** companion support.

FitHash gives strength athletes, powerlifters, and bodybuilders complete control over their training data, progressive overload recommendations, and Health Connect integration without relying on third-party cloud servers.

---

##  Key Features

* **Workout Logging & Progressive Overload Engine:**
  * Track sets, reps, weight, RPE (Rating of Perceived Exertion), and rest times.
  * Real-time e1RM (Estimated One-Rep Max) calculation using proven formulas (Brzycki / Epley).
  * Automated progressive overload engine that suggests target weights and repetitions based on historical performance.
* **Wear OS Companion Integration:**
  * Standalone Android Wear OS companion module (`android/wear`) for quick set logging, heart rate tracking, and rest timers directly from your smartwatch.
* **Health Connect & Wearables Sync:**
  * Syncs active calories, workouts, heart rate, and steps directly with Android Health Connect.
* **Analytics & Performance Insights:**
  * SVG-powered interactive strength and volume progression charts.
  * Muscle group frequency, weekly volume landmarks, and fatigue tracking.
* **Local-First & Data Sovereignty:**
  * All workouts, templates, and measurements stored locally via `@react-native-async-storage`.
  * One-tap full JSON backup export and import functionality.

---

##  Tech Stack

* **Framework:** React Native 0.81 + Expo SDK 54
* **Language:** TypeScript 5.3
* **Icons & Vector Graphics:** React Native SVG, Expo Vector Icons
* **Wear OS:** Native Android Jetpack Compose for Wear OS
* **Storage:** AsyncStorage (Local-first)
* **Health API:** React Native Health Connect

---

##  Getting Started

### Prerequisites

* Node.js (v18+)
* Yarn or npm
* Android Studio (with Android SDK 34+ and NDK if compiling native modules)
* Java Development Kit (JDK 17)

### Installation

```bash
# Clone repository
git clone git@github.com:ahasdemir/fithash.git
cd fithash

# Install dependencies
npm install
```

### Running the App

```bash
# Start Expo Metro bundler
npm start

# Run on Android (Local device / emulator)
npm run android

# Run on Web
npm run web
```

### Building Android APK / AAB

```bash
cd android
./gradlew assembleRelease
# The generated APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

---

##  Project Structure

```
fitness-tracker/
├── App.tsx                      # Root component & Navigation providers
├── index.ts                     # Entry point
├── package.json                 # Dependencies and scripts
├── src/
│   ├── components/              # UI Components (Charts, Modals, Timers, SetRows)
│   ├── screens/                 # Core tabs (Workout, Routines, Analytics, Settings)
│   ├── services/                # Progression engine, storage, Health Connect sync
│   ├── types/                   # TypeScript schemas for workouts, sets, and exercises
│   └── data/                    # Exercise database and default training templates
└── android/
    ├── app/                     # React Native Android Host
    └── wear/                    # Wear OS Companion Module
```

---

##  License

MIT License. Designed and maintained for personal fitness tracking and open-source contribution.
