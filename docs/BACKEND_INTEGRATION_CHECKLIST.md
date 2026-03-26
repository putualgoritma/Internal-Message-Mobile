# Backend Integration Checklist

Scope:
- Auth
- Chat
- Notifications
- Realtime channels (`internal-ops.conversation.{id}`, `internal-ops.user.{id}`)

Out of scope:
- Attendance Request UI

## 1. Configuration

1. Copy `src/config/appConfig.local.example.ts` to `src/config/appConfig.local.ts`.
2. Set:
   - `apiBaseUrl` (Laravel `/api/v1`)
   - `broadcastAuthUrl` (Laravel `/broadcasting/auth`)
   - `wsHost`, `wsPort`, `wsScheme`, `wsAppKey`, `wsCluster`
   - `oneSignalAppId` (optional for first pass)
3. Run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test -- --watchAll=false`

## 2. Auth Contract

1. Login with valid credentials.
2. Expected:
   - `/auth/login` returns token + user
   - App navigates to `Dashboard`
   - Restart app keeps session (`/auth/me` success)
3. Logout expected:
   - Local token cleared
   - Return to login screen

## 3. Chat Contract

1. Open `Chat` tab.
2. Expected:
   - `/chat/conversations` loads list
   - `/chat/unread-total` updates tab badge
3. Open a conversation.
4. Expected:
   - `/chat/conversations/{id}/messages` loads history
   - `/chat/conversations/{id}/read` called on open
5. Send message.
6. Expected:
   - `/chat/messages` success
   - Message appears immediately in chat room

## 4. Notification Contract

1. Open `Notifications` tab.
2. Expected:
   - `/notifications` loads list
3. Tap one unread notification.
4. Expected:
   - `/notifications/{id}/read` called
   - If payload contains `conversation_id`, app opens `ChatRoom`
5. Tap `Mark all read`.
6. Expected:
   - `/notifications/read-all` called
   - Badge becomes `0`

## 5. Realtime Contract

Observe `Dashboard > Realtime Connection` card.

1. After login expected status:
   - `CONNECTING` -> `CONNECTED`
2. Chat message event expected:
   - Last event changes to `internal-ops.conversation.{id}:internal-ops.message.sent` (or equivalent)
   - Incoming message inserted in room
3. User channel events expected:
   - `internal-ops.user.{id}:internal-ops.notification.created` updates notification list
   - `internal-ops.user.{id}:UnreadUpdated` updates chat/notification badges (if enabled)

## 6. Event Payload Compatibility

Current mobile parser accepts event envelope variants:
- `message`
- `notification`
- `data`
- `payload`

Minimum fields needed:

Message:
- `id`
- `conversation_id`
- `content`
- `type`
- `created_at`

Notification:
- `id`
- `title` or `body`
- `type`
- `is_read`
- `created_at`
- optional `data.conversation_id`

Unread:
- `total` or `unread_total`
- optional `conversation_id` + `unread_count`
- optional `notification_unread`

## 7. Failure Cases to Verify

1. Expired token:
   - API returns unauthorized
   - User can re-login
2. Websocket offline:
   - Realtime status moves from `CONNECTED` to `DISCONNECTED`/`ERROR`
   - App still works via API refresh
3. Missing fields in events:
   - App ignores malformed events without crash
