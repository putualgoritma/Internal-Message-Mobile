# App Crash on Incoming Message - Debug Guide

## Problem
App minimizes or closes when a message arrives.

## Root Cause Candidates
1. **Sound service crash** → Now wrapped in try-catch, but needs verification
2. **Chat Room auto-read effect crash** → Added debug logs
3. **Message upsert crash** → Check via logcat

## Rebuild & Test Steps

### 1. Clean & Rebuild
```bash
cd android
./gradlew.bat clean
./gradlew.bat assembleDebug
```

### 2. Clear Old App & Install Fresh
```bash
adb uninstall com.ptabinternalmessagemobile
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Start Logcat Monitoring
Open a terminal and keep this running:
```bash
adb logcat | find "[Realtime]" ""
```
(Or for PowerShell: `adb logcat | findstr "[Realtime]"`)

### 4. Send Test Message
1. Open the app on your device
2. Go to a chat room
3. **Send a message from ANOTHER device/tab** (not the test device)
4. **Watch both the app AND logcat**

### 5. Check Logcat Output

**Expected if working:**
```
[Realtime] onIncomingMessage called for message: <id>
[Realtime] Playing sound for message from sender: <sender_id>
[Realtime] Upserting message to store
[Realtime] Message upserted
[ChatRoom] Auto-read effect: isFocused=true activeConversationId=<id> messagesLength=<n>
[ChatRoom] Latest message: <id> sender_id: <sender_id> currentUserId: <userId>
[ChatRoom] Marking conversation read for message: <id>
```

**If crash happens, look for:**
- Any line with `Error` or `Exception`
- Native crash dump (usually has `FATAL EXCEPTION`)
- `Signal 6 (SIGABRT)` or similar

### 6. Interpret Results

**If app stays open + logs show all messages:**
- ✅ **Crash is fixed!** Move to step 7
- 🟡 Sound may or may not be playing (check device volume)

**If app crashes + logcat shows error in [Realtime] section:**
- ❌ Sound service still crashing → we need more specific error logs

**If app crashes + logcat shows error in [ChatRoom] section:**
- ❌ Auto-read effect crashing → need to investigate markConversationRead

**If app crashes + NO [Realtime] or [ChatRoom] logs appear:**
- ❌ Crash happening at lower level (native/FFI) → need full crash dump

### 7. If App Stays Open

Check if **sound actually plays**:

```bash
# First, verify device media volume (not ringtone volume)
adb shell dumpsys audio | find "Music volume"
```

If sound doesn't play but app doesn't crash:
- ✅ Crash is fixed
- 🟡 Sound asset may not be bundled correctly
- Options:
  1. Check if `android/app/src/main/res/raw/incoming_message.wav` exists
  2. Rebuild Android project to ensure WAV is bundled
  3. Check device media volume level

### 8. Full Crash Dump (Only if Still Crashing)

```bash
# Capture full logcat with crash details
adb logcat > crash_dump.txt

# Or live view with timestamps
adb logcat -t 100  # last 100 lines
```

Share the crash dump in the error output if app still crashes after this.

---

## Quick Disable Sound for Isolation Test

If you want to **temporarily disable sound** to confirm crash isn't sound-related:

Edit `src/services/messageSound.ts`:
```typescript
// Add at the top of playIncomingMessageSound():
export function playIncomingMessageSound(): void {
  console.log('[Sound] Playback currently DISABLED for testing');
  return;  // ← Add this line temporarily
  
  try {
    // ... rest of code ...
  }
}
```

Then rebuild and test. If app still crashes, it's not the sound.

---

## Timeline for Resolving

1. ✅ Sound service wrapped in try-catch (done)
2. ✅ Realtime callback wrapped in try-catch (done)
3. ✅ ChatRoom effect wrapped in try-catch + debug logs (done)
4. 🟡 **Rebuild + test on device** ← YOU ARE HERE
5. 🟡 If crash persists, capture logcat and investigate specific error
