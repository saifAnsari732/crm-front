# Project Context & Today's Updates (Sept 6)

## 1. Expo SDK 57 Upgrade & Stability Fixes
- **Upgraded to Expo SDK 57**: Successfully ran `npx expo install expo@latest` and `npx expo install --fix`, syncing 30+ native modules to Expo SDK 57.
- **Fixed `expo-notifications` Crashes**: Resolved major app crash loops on startup that occurred in Expo Go (SDK 53+) by replacing static `import * as Notifications from 'expo-notifications'` with dynamic `require()` wrapped in `try/catch` blocks (`services/trackingNotification.js`, `hooks/useLocationTracker.js`, `ProfileScreen.js`).

## 2. API & Environment Migration
- **Production Routing**: Re-routed all API calls away from `localhost:5000`. Updated `.env` and `services/api.js` to point to `process.env.EXPO_PUBLIC_API_URL` (currently `https://kisanteamapp.online/api`).
- **Cleaned up Git History**: Reverted the incorrect `1ed880a` commit from Render and force pushed `c359b36` back to `origin/main` to unbreak the deployment.

## 3. Mandatory Selfie Check-In & Validation Rules
- **Strict Validations**: Added validation rules so an employee cannot punch in without allowing Device GPS, Foreground Location, Background Location ("Allow all the time"), and Camera access.
- **Mandatory Photo Check**: Before starting a tracking session (`handleClockToggle` in `EmployeeDashboardScreen.js`), the app forces `ImagePicker.launchCameraAsync` to take a selfie check-in. The shift will not start unless the selfie is uploaded successfully.

## 4. UI Overhaul (Emerald Teal Theme & Floating Tab Bar)
- **Glassmorphism Redesign**: Redesigned `EmployeeDashboardScreen.js` to follow the user's Dark Emerald Teal gradient reference images with glassmorphic stats cards.
- **Rider Mode Easter Egg**: Added dynamic image swapping so when tracking is off, it shows a "Waving Boy," and when tracking is on, it swaps to a 3D Pixar "Biker Boy" indicating Rider Mode. The shift button turns crimson red when active.
- **Floating Bottom Tab Bar**: Replaced the default Expo Router tab bar in `app/(employee)/_layout.js` with a sleek custom floating capsule layout, including a bulging central Map button wrapped in a gradient.
- **Admin Profile Setup**: Created `AdminProfileScreen.js` inside `screens/admin` with ImageKit upload, settings toggles, and logout, and linked it via Expo Router.

## 5. Fixed "Unsupported FormDataPart implementation" Image Upload Error
- **The Issue**: React Native's `fetch` in recent Expo SDKs strictly requires strings or Blob objects and throws `[Error: Unsupported FormDataPart implementation]` when attempting to append native `{uri, type, name}` object literals to `FormData`.
- **The Fix**: Rewrote the upload logic in `services/api.js` and all screens.
  - Intercepted the native mobile platform execution (`Platform.OS !== 'web'`).
  - Passed the image `uri` directly to `uploadAPI.uploadImageFormData` and `uploadAPI.uploadImageDirect`.
  - Replaced the failing `fetch` call with `FileSystem.uploadAsync` from `expo-file-system`, which processes multipart uploads natively on Android/iOS without throwing FormData blob errors.
  - Kept the standard `FormData` blob approach for `Platform.OS === 'web'`.
- **Affected Screens**: Fixed the upload mechanisms on:
  - `screens/employee/EmployeeDashboardScreen.js` (Punch-in Selfie)
  - `screens/employee/ExpensesScreen.js` (Expense Receipts)
  - `screens/employee/MeetingsScreen.js` (Meeting Selfies)
  - `screens/employee/ProfileScreen.js` (Employee Avatars)
  - `screens/admin/AdminProfileScreen.js` (Admin Avatars)

## 6. App Keystore & SHA Certificates
- Details of the keystores stored in the app directory for authenticating Google Maps, Firebase, and Google Login:

**Release Keystore Keys (Play Store / Production - `release.keystore`)**
- SHA-1: `24:CD:FC:27:D4:17:33:28:F8:17:A2:75:E9:7F:25:BC:FF:FC:CA:00`
- SHA-256: `73:25:9D:0A:63:F6:B8:11:71:1E:2C:DD:6C:F9:23:89:F8:0F:DA:9C:AF:08:EA:2B:70:01:A5:F9:AD:C7:C2:90`

**Debug Keystore Keys (Local Testing / Expo Go - `debug.keystore`)**
- SHA-1: `17:CB:52:06:62:C2:5A:59:25:01:DC:BF:42:4D:EE:6B:FB:C4:54:97`
- SHA-256: `CA:74:3F:AB:07:4D:9D:C4:D6:03:3F:BE:50:1E:48:19:0E:F9:39:72:D4:98:4C:74:11:16:91:AC:05:C0:84:1C`
