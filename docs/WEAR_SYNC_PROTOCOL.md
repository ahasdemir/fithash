# FitHash Wear OS ↔ Phone Sync Protocol Specification

This document specifies the complete wire protocol between the FitHash React Native / Expo phone application (`android/app` + `src/`) and the native Wear OS companion application (`android/wear`).

All protocol extensions are **additive and backward-compatible** with legacy message paths and DataItem URIs.

---

## 1. Architecture Overview

FitHash uses a **dual-transport Data Layer architecture** via Google Play Services Wearable (`com.google.android.gms:play-services-wearable:18.2.0`):

1. **`DataClient` (`PutDataMapRequest` with `.setUrgent()`)**:
   - Provides **eventual consistency and offline durability** across Bluetooth/Wi-Fi disconnects or app restarts.
   - Both the phone (`WearPhoneListenerService`) and watch (`WearDataLayerListenerService`) declare `com.google.android.gms.wearable.DATA_CHANGED` and `com.google.android.gms.wearable.MESSAGE_RECEIVED` for scheme `wear://*/fithash*`.
   - On startup, foreground resume, and ambient exit, the watch calls `WearWorkoutManager.syncFromDataClient()` to reconcile state from `DataClient`.
   - On startup, the phone calls `WearSyncModule.getPendingWearWorkouts()` (which also queries `DataClient` for `wear://*/fithash/workouts/*` with `FILTER_PREFIX`) so no completed watch workout is ever dropped even if the phone service was not running when the DataItem landed.

2. **`MessageClient` (`sendMessage`)**:
   - Provides **low-latency real-time push** when both devices are connected and awake.
   - Every state change writes the authoritative `DataItem` **and** sends a real-time message to all connected nodes.

3. **Monotonic Revisioning & Echo Loop Prevention**:
   - Mutable mirrored states (`active_session` and `rest_timer`) carry:
     - `revision: Long` (epoch milliseconds, monotonically increasing via `maxOf(System.currentTimeMillis(), lastRevision + 1)`).
     - `origin: String` (`"phone"` or `"watch"`).
     - `cleared: Boolean` (`true` when the session or timer is finished/cancelled).
   - Receivers **ignore** events whose `origin` matches their own side (e.g. the watch ignores `origin == "watch"` DataItem reflections) and **ignore** stale payloads where `revision < localRevision`.

---

## 2. DataItem Paths (`DataClient`)

| Path | Direction | Trigger | DataMap Fields | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/fithash/state/routines` | Phone → Watch | Routine created/edited/deleted/reordered, settings updated, or watch requests sync | `routinesJson: String` (JSON `Routine[]`)<br>`settingsJson: String` (JSON `AppSettings`)<br>`revision: Long` (epoch ms) | Syncs the user's routines and workout settings (`defaultRestSeconds`, `autoStartRestTimer`, `defaultRir`). |
| `/fithash/state/workouts_history` | Phone → Watch | Workout saved/updated/deleted on phone, watch workout imported, or watch requests sync | `workoutsJson: String` (JSON `WorkoutSession[]`)<br>`revision: Long` (epoch ms) | Syncs completed/saved workouts history to the watch's **Kayıtlı Antrenmanlar** screen. Merged and deduplicated by `id` with local watch history. |
| `/fithash/state/active_session` | Bidirectional (`Phone ↔ Watch`) | Workout started, set completed/uncompleted, weight/reps/RIR edited, set added/removed, exercise added/removed/swapped, or workout finished/cancelled | `sessionJson: String` (JSON `WorkoutSession` / `WearWorkoutSession`, or `""` when cleared)<br>`revision: Long` (epoch ms)<br>`origin: String` (`"phone"` \| `"watch"`)<br>`cleared: Boolean` | Mirrors the live active workout session between phone and watch idempotently. |
| `/fithash/state/rest_timer` | Bidirectional (`Phone ↔ Watch`) | Rest timer started (auto or manual), adjusted (`+15s` / `-15s`), or skipped/cancelled/expired | `endTimeMs: Long` (epoch ms deadline, `0L` when cleared)<br>`totalSeconds: Int` (total duration in s, `0` when cleared)<br>`revision: Long` (epoch ms)<br>`origin: String` (`"phone"` \| `"watch"`)<br>`cleared: Boolean` | Synchronizes the live rest countdown deadline across both devices. |
| `/fithash/workouts/{workoutId}` | Watch → Phone | User taps "Kaydet & Eşitle" (`finishWorkout()`) on watch | `workoutId: String`<br>`sessionJson: String` (JSON `WearWorkoutSession`)<br>`completedAt: Long` (epoch ms) | Durable per-workout record stored in DataClient until the phone imports it and calls `acknowledgeWearWorkout(workoutId)`, which deletes the DataItem and sends `/fithash/workout_ack`. |

---

## 3. Message Paths (`MessageClient`)

| Path | Direction | Payload Encoding (UTF-8 `ByteArray`) | Trigger & Behavior |
| :--- | :--- | :--- | :--- |
| `/fithash/request_sync` | Watch → Phone | Empty (`ByteArray(0)`) | Sent on watch app launch, "Telefondan Eşitle" button tap, or screen entry. Wakes phone JS (`onWearRequestSync`) **and** immediately replies from native `SharedPreferences("fithash_wear_state")` cache with routines, workouts history, active session, and active rest timer even if the RN JS bridge is dead. |
| `/fithash/sync_routines` | Phone → Watch | Raw JSON array string: `Routine[]` | Immediate push companion to `/fithash/state/routines`. |
| `/fithash/sync_workouts_history` | Phone → Watch | Raw JSON array string: `WorkoutSession[]` | Immediate push companion to `/fithash/state/workouts_history`. |
| `/fithash/active_session_update` | Bidirectional (`Phone ↔ Watch`) | JSON object:<br>`{ "sessionJson": string, "revision": number, "origin": "phone"\|"watch", "cleared": boolean }` | Immediate push companion to `/fithash/state/active_session`. |
| `/fithash/rest_timer_update` | Bidirectional (`Phone ↔ Watch`) | JSON object:<br>`{ "endTimeMs": number, "totalSeconds": number, "revision": number, "origin": "phone"\|"watch", "cleared": boolean }` | Immediate push companion to `/fithash/state/rest_timer`. |
| `/fithash/workout_completed` | Watch → Phone | Raw JSON object string: `WearWorkoutSession` | Immediate push companion to `/fithash/workouts/{workoutId}`. Queued into `SharedPreferences("fithash_wear_inbox")` and emitted to JS via `onWearWorkoutCompleted`. |
| `/fithash/workout_ack` | Phone → Watch | Raw string: `workoutId` | Sent by `WearSyncModule.acknowledgeWearWorkout(workoutId)`. Removes `workout_{workoutId}` from watch's persistent outbox (`SharedPreferences("fithash_wear_outbox")`). |

---

## 4. Payload Schemas

### 4.1 `WorkoutSession` / `WearWorkoutSession` JSON Schema
Both phone and watch serialize/deserialize a superset-compatible JSON object for active and completed sessions:

| Field | Type | Nullable / Optional | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Required | Unique session ID (`session_...` or `wear_session_...`) |
| `name` | `string` | Required | Routine or workout display name |
| `routineId` | `string` | Optional | Source routine ID if started from a routine |
| `date` | `string` | Required | Local date in `YYYY-MM-DD` format |
| `startTime` | `number` (`Long`) | Required | Epoch timestamp (ms) when session started |
| `endTime` | `number` (`Long`) | Optional | Epoch timestamp (ms) when completed |
| `durationSeconds` | `number` (`Long`) | Required | Elapsed duration in seconds |
| `exercises` | `WorkoutExercise[]` | Required | Ordered list of exercises in the session |
| `totalVolume` | `number` (`Double`) | Required | Sum of `weight * reps` across completed sets |
| `totalSets` | `number` (`Int`) | Required | Total completed sets count |
| `avgRir` | `number` (`Double`) | Optional | Average logged RIR across completed working sets |
| `totalCaloriesBurned` | `number` (`Double`) | Optional | Preserved during bidirectional sync |
| `totalCardioDistanceKm` | `number` (`Double`) | Optional | Preserved during bidirectional sync |
| `totalCardioMinutes` | `number` (`Double`) | Optional | Preserved during bidirectional sync |
| `completed` | `boolean` | Required | `false` while active, `true` when finished |
| `notes` | `string` | Optional | Workout notes |

### 4.2 `WorkoutExercise` / `WearWorkoutExercise` JSON Schema

| Field | Type | Nullable / Optional | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Required | Unique exercise instance ID (`wex_...`) |
| `exerciseId` | `string` | Required | Library exercise ID (`ex_...`) |
| `exerciseName` | `string` | Required | Display name |
| `category` | `string` | Required | Turkish muscle category (`Göğüs`, `Sırt`, `Bacak`, `Omuz`, `Ön Kol`, `Arka Kol`, `Karın`, `Kardiyo`) |
| `equipment` | `string` | Required | Equipment type (`Barbell`, `Dumbbell`, `Makine`, `Kablo`, `Vücut Ağırlığı`, `Kardiyo Cihazı`, `Diğer`) |
| `sets` | `ExerciseSet[]` | Required | Ordered list of sets |
| `notes` | `string` | Optional | Preserved across sync |

### 4.3 `ExerciseSet` / `WearExerciseSet` JSON Schema

| Field | Type | Nullable / Optional | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Required | Unique set ID (`set_...`) — used as Compose list key |
| `setNumber` | `number` (`Int`) | Required | 1-based working or warmup set number |
| `weight` | `number` (`Double`) | Required | Weight in kg |
| `reps` | `number` (`Int`) | Required | Repetitions |
| `rir` | `number` (`Int`) | Optional | Actual logged RIR (`0`, `1`, `2`, `3`) |
| `targetRir` | `number` (`Int`) | Optional | Routine target RIR (`null` if unset); preserved by watch when phone updates sets |
| `completed` | `boolean` | Required | Set completion status |
| `isWarmup` | `boolean` | Optional | `true` for warmup sets (`ISINMA`), `false`/`null` for working sets |
| `isPR` | `boolean` | Optional | Preserved across sync |
| `durationSeconds` | `number` (`Int`) | Optional | Isometric hold duration (s) |
| `durationMinutes` | `number` (`Double`) | Optional | Cardio duration (min) |
| `distanceKm` | `number` (`Double`) | Optional | Cardio distance (km) |
| `avgSpeedKmh` | `number` (`Double`) | Optional | Cardio speed (km/h) |
| `caloriesBurned` | `number` (`Double`) | Optional | Set calories |

---

## 5. Native Bridge API (`WearSyncModule`)

### 5.1 Methods Exposed to React Native (`NativeModules.WearSyncModule`)

1. **`syncRoutinesToWatch(routinesJson: string, settingsJson: string): Promise<number>`** *(Existing)*
   - Caches `routinesJson` & `settingsJson` in `SharedPreferences("fithash_wear_state")`.
   - Writes DataItem `/fithash/state/routines` and sends `/fithash/sync_routines`.
2. **`syncWorkoutsHistoryToWatch(workoutsJson: string): Promise<number>`** *(New)*
   - Caches `workoutsJson` in `SharedPreferences("fithash_wear_state")`.
   - Writes DataItem `/fithash/state/workouts_history` and sends `/fithash/sync_workouts_history`.
3. **`syncActiveSessionToWatch(sessionJson: string | null, revision: number): Promise<number>`** *(New)*
   - Caches active session state in `SharedPreferences("fithash_wear_state")`.
   - Pass `sessionJson = JSON.stringify(session)` when active, or `null` / `""` when finished or cancelled.
   - Writes DataItem `/fithash/state/active_session` (`origin: "phone"`) and sends `/fithash/active_session_update`.
4. **`syncRestTimerToWatch(endTimeMs: number, totalSeconds: number, revision: number): Promise<number>`** *(New)*
   - Caches rest timer state in `SharedPreferences("fithash_wear_state")`.
   - Pass `endTimeMs > Date.now()` and `totalSeconds > 0` when starting/adjusting rest timer, or `endTimeMs = 0, totalSeconds = 0` when cancelling/dismissing.
   - Writes DataItem `/fithash/state/rest_timer` (`origin: "phone"`) and sends `/fithash/rest_timer_update`.
5. **`getPendingWearWorkouts(): Promise<string[]>`** *(Enhanced)*
   - Queries `DataClient.getDataItems("wear://*/fithash/workouts", FILTER_PREFIX)` in addition to draining `SharedPreferences("fithash_wear_inbox")`.
6. **`acknowledgeWearWorkout(workoutId: string): Promise<null>`** *(Enhanced)*
   - Removes `workout_{workoutId}` from phone inbox, deletes `wear://*/fithash/workouts/{workoutId}` from `DataClient`, and sends `/fithash/workout_ack` to the watch so the watch clears its persistent outbox.
7. **`getPendingActiveSessionState(): Promise<{ sessionJson: string; revision: number; cleared: boolean }>`** *(New)*
   - Reads the latest cached active session state from native `SharedPreferences("fithash_wear_state")` (useful when phone app launches after a workout was started on the watch).
8. **`getPendingRestTimerState(): Promise<{ endTimeMs: number; totalSeconds: number; revision: number; cleared: boolean }>`** *(New)*
   - Reads the latest cached rest timer state from native `SharedPreferences("fithash_wear_state")`.

### 5.2 Events Emitted to React Native (`NativeEventEmitter(WearSyncModule)`)

| Event Name | Payload Shape | Trigger |
| :--- | :--- | :--- |
| `onWearWorkoutCompleted` | `{ sessionJson: string }` | Watch finishes and saves a workout (`/fithash/workouts/{id}` or `/fithash/workout_completed`). |
| `onWearRequestSync` | `null` | Watch requests a full state sync (`/fithash/request_sync`). |
| `onWearActiveSessionUpdated` | `{ sessionJson: string, revision: number, origin: "watch", cleared: boolean }` | Watch starts, updates (set completed, weight/reps/RIR changed, set added), finishes, or cancels an active workout. |
| `onWearRestTimerUpdated` | `{ endTimeMs: number, totalSeconds: number, revision: number, origin: "watch", cleared: boolean }` | Watch starts, adjusts (`+15s` / `-15s`), or cancels a rest timer. |

---

## 6. Watch Rest Timer & Ambient Notification Behavior

1. **Wall-Clock Deadline Driven (`endTimeMs`)**:
   - `WearWorkoutManager` stores `endTimeMs` (`Long`) and `totalSeconds` (`Int`) in `StateFlow` and `SharedPreferences("fithash_wear_prefs")`.
   - Remaining seconds are computed as `ceil((endTimeMs - System.currentTimeMillis()) / 1000.0)` every 250ms and immediately refreshed on `AmbientLifecycleCallback.onEnterAmbient()`, `onUpdateAmbient()`, `onExitAmbient()`, and `Activity.onResume()`.
2. **Ongoing Notification with Native Chronometer & Progress**:
   - `ActiveWorkoutService` runs as a foreground service (`FOREGROUND_SERVICE_TYPE_HEALTH | FOREGROUND_SERVICE_TYPE_DATA_SYNC`) whenever an active workout session **or** an active rest timer is running.
   - While rest is active, notification `1001` (`active_workout_channel`) configures:
     - `.setUsesChronometer(true)`
     - `.setChronometerCountDown(true)`
     - `.setWhen(restEndMs)`
     - `.setProgress(restTotal, restSecs, false)`
     - Interactive notification actions: **`+15 sn`** (`ACTION_ADD_REST_15`) and **`Atla`** (`ACTION_SKIP_REST`).
   - Because Android's `Chronometer` renders countdowns directly in system UI using `when = restEndMs`, the countdown remains accurate even when the watch CPU is throttled in Ambient Mode.
3. **Completion Haptics & High-Priority Alert Notification**:
   - When `now >= endTimeMs`, `WearWorkoutManager.onRestTimerExpired()` fires:
     - Multi-pulse max-amplitude waveform vibration (`[0, 500, 150, 500, 150, 600]`) via `VibratorManager` / `Vibrator`.
     - High-importance alert notification `1002` on `rest_timer_alert_channel` (`IMPORTANCE_HIGH`, `CATEGORY_ALARM`, default notification sound + vibration pattern, 15s auto-timeout) titled **"⏰ Dinlenme Süresi Doldu!"** with the next exercise name.

---

## 7. Required Phone-Side TypeScript Changes (Follow-Up Contract)

Because `src/**` and `App.tsx` were locked during concurrent subagent work, the following exact TypeScript changes must be applied in the follow-up integration step to complete the phone-side wiring:

### 7.1 `src/services/wearSyncService.ts`
Add helper functions and extend `initWearSyncListener`:

1. **`syncWorkoutsHistoryToWearable(workouts: WorkoutSession[]): Promise<number>`**
   ```ts
   export const syncWorkoutsHistoryToWearable = async (
     workouts: WorkoutSession[]
   ): Promise<number> => {
     if (Platform.OS !== 'android' || !WearSyncModule?.syncWorkoutsHistoryToWatch) {
       return 0;
     }
     try {
       // Send most recent 30 completed workouts to keep DataItem payload compact (<100KB)
       const recent = workouts.filter(w => w.completed !== false).slice(0, 30);
       return await WearSyncModule.syncWorkoutsHistoryToWatch(JSON.stringify(recent));
     } catch (error) {
       console.warn('Failed to sync workouts history to Wear OS:', error);
       return 0;
     }
   };
   ```

2. **`syncActiveSessionToWearable(session: WorkoutSession | null, revision: number = Date.now()): Promise<number>`**
   ```ts
   export const syncActiveSessionToWearable = async (
     session: WorkoutSession | null,
     revision: number = Date.now()
   ): Promise<number> => {
     if (Platform.OS !== 'android' || !WearSyncModule?.syncActiveSessionToWatch) {
       return 0;
     }
     try {
       const json = session && !session.completed ? JSON.stringify(session) : null;
       return await WearSyncModule.syncActiveSessionToWatch(json, revision);
     } catch (error) {
       console.warn('Failed to sync active session to Wear OS:', error);
       return 0;
     }
   };
   ```

3. **`syncRestTimerToWearable(endTimeMs: number | null, totalSeconds: number = 0, revision: number = Date.now()): Promise<number>`**
   ```ts
   export const syncRestTimerToWearable = async (
     endTimeMs: number | null,
     totalSeconds: number = 0,
     revision: number = Date.now()
   ): Promise<number> => {
     if (Platform.OS !== 'android' || !WearSyncModule?.syncRestTimerToWatch) {
       return 0;
     }
     try {
       const endMs = endTimeMs && endTimeMs > Date.now() ? endTimeMs : 0;
       const total = endMs > 0 ? Math.max(1, Math.round(totalSeconds || (endMs - Date.now()) / 1000)) : 0;
       return await WearSyncModule.syncRestTimerToWatch(endMs, total, revision);
     } catch (error) {
       console.warn('Failed to sync rest timer to Wear OS:', error);
       return 0;
     }
   };
   ```

4. **Extend `initWearSyncListener` callbacks**:
   - Accept optional callbacks (or an options object while keeping positional args backward-compatible):
     - `onActiveSessionUpdated?: (session: WorkoutSession | null, revision: number) => void`
     - `onRestTimerUpdated?: (endTimeMs: number | null, totalSeconds: number, revision: number) => void`
   - Subscribe to `wearEmitter.addListener('onWearActiveSessionUpdated', ...)` and `wearEmitter.addListener('onWearRestTimerUpdated', ...)`.
   - In `importWorkout` (when `onWearWorkoutCompleted` fires), also preserve optional fields from `WearExerciseSet` (`isWarmup`, `durationSeconds`, `durationMinutes`, `distanceKm`, `avgSpeedKmh`, `caloriesBurned`) and after `saveWorkout(fullSession)` completes, call `getWorkouts().then(syncWorkoutsHistoryToWearable)` so the watch receives the updated history list.

### 7.2 `App.tsx`
1. **Sync Saved Workouts History**:
   - In `loadAllData()` (around line 112), call `syncWorkoutsHistoryToWearable(wData);` alongside `syncRoutinesToWearable(rData, appSettings);`.
   - In the `onSyncRequested` callback passed to `initWearSyncListener` (lines 73–77), also load `const wData = await getWorkouts();` and call `syncWorkoutsHistoryToWearable(wData);`, and if `activeSession` is present, call `syncActiveSessionToWearable(activeSession);`.
   - In `handleFinishActiveSession` (line 141), `handleDeleteWorkout` (line 206), and `handleUpdateWorkout` (line 213), call `syncWorkoutsHistoryToWearable(updated);`.
2. **Sync Active Workout Session Bidirectionally**:
   - In `handleStartSession(session)` (line 121): call `syncActiveSessionToWearable(session);`.
   - In `handleUpdateActiveSession(session)` (line 128): call `syncActiveSessionToWearable(session);`.
   - In `handleFinishActiveSession(completedSession)` (line 133): call `syncActiveSessionToWearable(null);`.
   - In `handleCancelActiveSession()` (line 175): call `syncActiveSessionToWearable(null);`.
   - Wire `onActiveSessionUpdated` in `initWearSyncListener` so when the watch starts, edits, or cancels an active session:
     - If `session === null`: call `setActiveSession(null); setShowActiveModal(false); clearActiveSession(); cancelSessionReminder();`.
     - If `session !== null`: call `setActiveSession(session); saveActiveSession(session);` (and open or keep `ActiveWorkoutModal` synchronized).

### 7.3 `src/screens/ActiveWorkoutModal.tsx` & `src/components/RestTimerBar.tsx`
1. **Emit Rest Timer Start / Adjust / Cancel to Watch**:
   - In `ActiveWorkoutModal.tsx`:
     - When auto-starting rest timer in `handleToggleSetComplete` (lines 567–573): call `syncRestTimerToWearable(targetEnd, restSecs);`.
     - In `handleRestDeadlineChange` (lines 160–167): when `endTime !== null`, compute `const remainingSecs = Math.max(1, Math.ceil((endTime - Date.now()) / 1000));` and call `syncRestTimerToWearable(endTime, Math.max(restTimerSeconds, remainingSecs));`; when `endTime === null`, call `syncRestTimerToWearable(null, 0);`.
     - When `RestTimerBar` `onClose` is called (lines 888–892) or when session finishes/cancels (lines 797, 826): call `syncRestTimerToWearable(null, 0);`.
2. **Receive Rest Timer Events from Watch**:
   - Listen to `onWearRestTimerUpdated` (or receive `remoteRestTimer` prop from `App.tsx` / `wearSyncService.ts`):
     - When watch starts or adjusts a rest timer (`endTimeMs > Date.now()`):
       - `saveActiveRestTimerEnd(endTimeMs)`
       - `scheduleRestTimerNotification(endTimeMs)`
       - `const remaining = Math.max(1, Math.ceil((endTimeMs - Date.now()) / 1000));`
       - `setRestTimerSeconds(remaining); setRestTimerKey(Date.now()); setShowRestTimer(true);`
     - When watch cancels rest timer (`cleared === true` or `endTimeMs <= Date.now()`):
       - `saveActiveRestTimerEnd(null); cancelRestTimerNotification(); setShowRestTimer(false);`
