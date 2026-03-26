# PTAB Internal Message Mobile

React Native frontend for internal chat and notifications, aligned with:
- `docs-internal-chat/00_SINGLE_SOURCE_OF_TRUTH.md`
- `docs-internal-chat/10_Mobile App Architecture.md`
- `docs-internal-chat/14_API SPECIFICATION.md`

## Implemented Scope

- Authentication (`/auth/login`, `/auth/me`, `/auth/logout`)
- Dashboard summary (chat unread + notification unread)
- Chat list + chat room + send message + mark read
- Notification center + mark read + mark all read
- Realtime hooks (Laravel Echo private channels)
- Push notification hooks (OneSignal)

Out of scope in this iteration:
- Attendance Requests UI module (explicitly removed)

Compatibility note:
- Navigation uses `@react-navigation/stack` (JS stack) for RN 0.76 stability.
- Android `newArchEnabled=false` is set in `android/gradle.properties`.

## Project Structure

```
src/
  api/
  components/
  config/
  hooks/
  navigation/
  screens/
  services/
  store/
  theme/
  types/
  utils/
```

## Required Configuration

Use local override config:
- Reference template: `src/config/appConfig.local.example.ts`
- Local file: `src/config/appConfig.local.ts` (gitignored)

Set:
- `apiBaseUrl`
- `broadcastAuthUrl`
- `wsHost`, `wsPort`, `wsAppKey`, `wsCluster`, `wsScheme`
- `oneSignalAppId`

For Android emulator, `10.0.2.2` is used by default.

Realtime parser tolerates multiple payload shapes (`message`, `notification`, `data`, `payload`) for easier backend event alignment.

## Run

```bash
npm install
npm start
npm run android
```

iOS:

```bash
cd ios && pod install && cd ..
npm run ios
```

## Checks

```bash
npm run lint
npm run typecheck
npm test -- --watchAll=false
```

## Integration QA

Use:
- `docs/BACKEND_INTEGRATION_CHECKLIST.md`

Dashboard includes `Realtime Connection` status + last event for debugging websocket integration.

## Android Build Baseline

Validated with:
- JDK 17 (Android Studio JBR)
- Android SDK at `%LOCALAPPDATA%\\Android\\Sdk`
- Command: `cd android && gradlew.bat clean assembleDebug --no-daemon`
