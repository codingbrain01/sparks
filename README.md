# 💕 Sparks

> A modern, real-time dating & social app built with React 19, Supabase, and Tailwind CSS v4. Connect with people, spark conversations, and find your match.

---

## Features

### Matching & Discovery
- **Explore page** — Browse profiles you haven't connected with yet; filter by gender, preference, and age range; live search by name or username
- **Connection requests** — Send, cancel, accept, or decline requests; real-time notification badges
- **Smart filtering** — Explore page excludes already-connected and pending profiles automatically

### Messaging
- **Real-time chat** — Instant messaging powered by Supabase Realtime
- **Read receipts** — Single ✓ when sent, double ✓✓ when the other person has read it
- **Image sharing** — Send photos inline; tap to view full-size with a save option
- **Video sharing** — Send video clips (mp4, mov, webm); tap the thumbnail to open a full-screen player with save option
- **Voice messages** — Hold mic button to record, live timer shows duration; compact inline player with progress bar, play/pause, and seek on the receiving end
- **25 MB file limit** — Enforced client-side for all uploads (images, videos, voice); error toast shown if exceeded
- **Typing indicators** — Live "..." bubble when the other person is typing, auto-hides after 4 seconds of silence
- **Message notifications** — Badge on the Chat tab + toast popup when a message arrives; disappears automatically when on the chat tab
- **Unread count per conversation** — Badge counts unique conversations with unread messages, not individual messages
- **Delete conversations** — Delete for yourself only, or delete for both parties (removes DB rows and storage files)

### Profiles
- **Profile photos** — Upload, change, or remove your avatar; photo appears everywhere across the app (chat, explore, feed, notifications)
- **Photo gallery** — Upload multiple photos to your profile (images only, 25 MB limit); 3-column grid view; tap any photo to view full-size, set it as your avatar, or delete it
- **Gallery on other profiles** — View a person's photo gallery when opening their profile modal from Explore or the home feed
- **3-step signup** — Guided onboarding: account → profile → preferences
- **Edit profile** — Update name, username, age, bio, looking for, and hobbies
- **My Posts** — View, edit, delete your posts; click any post to open a detail view with full comments and comment input
- **Connections list** — View and message your connections from your profile
- **Delete account** — Permanently removes your profile, posts, connections, and messages

### Presence
- **Live status** — Online, Away, Busy, DND, Invisible; shown across chat, explore, and profiles
- **Auto-away** — Automatically switches to Away when you switch tabs or minimize the window; restores your status when you return
- **Multi-device sync** — Status changes on one device instantly propagate to all other logged-in devices via DB listener
- **Multi-device conflict resolution** — Intentional statuses (Busy, DND) take priority over auto-away across devices

### Social Feed
- **Home feed** — Posts from your connections with likes and comments
- **Gender-themed UI** — Blue accents for men, pink for women throughout the app
- **Privacy controls** — Set posts to Public, Friends only, or Private

### Platform
- **URL routing** — Clean browser URLs (`/login`, `/home`, `/chat`, `/profile`, `/explore`) via React Router; protected routes redirect unauthenticated users to `/login`
- **Responsive design** — Full mobile support with bottom nav; collapsible desktop sidebar
- **Cross-platform desktop** — Ships as a native Electron app for Windows, macOS, and Linux; reload shortcuts blocked in production kiosk mode
- **Frosted glass UI** — Rose/pink/fuchsia romantic theme with backdrop blur throughout
- **Click-outside-to-close** — All dropdowns and action panels (post menu, privacy picker, delete confirm) dismiss when clicking anywhere outside

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 |
| Build | Vite 8 |
| Backend | Supabase (PostgreSQL + Realtime + Auth + Storage + RLS) |
| Desktop | Electron 41 |

---

## Getting Started

### Tools you'll need

| Tool | What for | Where |
|---|---|---|
| **Node.js 18+** | Runtime + npm | https://nodejs.org |
| **Git** | Clone the repo | https://git-scm.com |
| **Supabase account** | Database, auth, realtime, storage | https://supabase.com |
| **Metered.ca account** | TURN server for calls (optional but recommended) | https://metered.ca |

### Step 1 — Clone and install

```bash
git clone https://github.com/codingbrain01/sparks.git
cd sparks
npm install
```

### Step 2 — Create a Supabase project

1. Go to https://supabase.com/dashboard and click **New project**.
2. Pick a name, a strong **database password** (save it — you'll need it for backups), and the closest region.
3. Wait ~2 minutes for the project to provision.

### Step 3 — Apply the schema

The repo includes a complete schema dump that creates every table, sequence, constraint, RLS policy, function, trigger, and storage bucket the app needs.

1. In your Supabase dashboard, open **SQL Editor → New query**.
2. Copy the entire contents of [supabase/schema.sql](supabase/schema.sql) and paste it in.
3. Click **Run**. You should see no errors.

This creates 10 tables (`profiles`, `connections`, `conversations`, `conversation_participants`, `messages`, `posts`, `post_comments`, `post_likes`, `profile_photos`, `calls`), 34 RLS policies, the realtime publication, and the three storage buckets (`avatars`, `chat-images`, `gallery`).

### Step 4 — Add storage RLS policies

The schema dump only covers the `public` schema. Storage object policies live in `storage.objects` and need to be added separately. In the SQL Editor, run:

```sql
-- Allow authenticated users to upload to any of the three buckets
create policy "Authenticated uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'chat-images', 'gallery'));

-- Allow authenticated users to update their own files
create policy "Authenticated updates" on storage.objects
  for update to authenticated
  using (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own files
create policy "Authenticated deletes" on storage.objects
  for delete to authenticated
  using (auth.uid()::text = (storage.foldername(name))[1]);

-- Public reads (the buckets are already marked public, this is redundant but explicit)
create policy "Public reads" on storage.objects
  for select using (bucket_id in ('avatars', 'chat-images', 'gallery'));
```

### Step 5 — Verify Realtime is on

In **Database → Publications → `supabase_realtime`**, confirm these tables are checked:

- `messages`
- `calls`
- `conversations`

The schema includes them already, so this is just a sanity check. If any are missing, toggle them on.

### Step 6 — (Optional) Set up TURN for calls

Without TURN, calls work for users on the same network or with friendly NATs but fail for ~30% of real-world cases. To fix that:

1. Sign up at https://metered.ca (free tier includes 50GB/month, plenty for testing).
2. **Apps → Create New App → TURN Server**. Give it a slug like `sparks-turn`.
3. Store those values as Supabase Edge Function secrets:
   - `METERED_API_KEY`
   - `METERED_APP_NAME` (the app slug)
4. Deploy `supabase/functions/turn-credentials`.

If you skip this, the app falls back to Google's public STUN servers and most calls will still connect, but strict-NAT users won't.

### Step 7 — Configure auth

Default email/password auth is enabled out of the box. For local development:

1. **Authentication → Providers → Email**: confirm enabled.
2. **Authentication → URL Configuration → Site URL**: set to `http://localhost:5173` for dev.
3. **Authentication → Email Templates**: optionally customize. For testing, you may want to **disable email confirmation** at **Authentication → Providers → Email → "Confirm email"** so signup works without checking inbox.

For production, set **Site URL** to your real domain and add it to **Redirect URLs**.

### Step 8 — Fill in `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in:

- `VITE_SUPABASE_URL` — from **Project Settings → API → Project URL**
- `VITE_SUPABASE_ANON_KEY` — from **Project Settings → API → anon public** (not the service_role key)
TURN credentials are intentionally not stored in `.env`; keep them in Supabase function secrets.

### Step 9 — Run it

```bash
# Web (browser at http://localhost:5173)
npm run dev

# Desktop (Electron window)
npm run electron:dev
```

Sign up with any email + password, complete the 3-step onboarding, and you're in.

---

## Build

```bash
# Web bundle (output: dist/)
npm run build

# Desktop installer (output: release/)
npm run electron:build
```

> **Web production note:** configure your server to redirect all routes to `index.html` (e.g. Netlify `_redirects`, Vercel rewrites) for client-side routing to work on refresh.

---

## Refreshing the schema

If you change the database via the Supabase dashboard, regenerate [supabase/schema.sql](supabase/schema.sql) so the repo stays in sync:

```bash
# Get a personal access token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_...
export SUPABASE_PROJECT_REF=your-project-ref

node scripts/dump-supabase-schema.mjs
```

The script uses the Supabase Management API — no DB password required.

---

## Project Structure

```
src/
├── components/       # UI components
│   ├── Avatar.tsx        # Shared avatar component (photo or initials fallback)
│   ├── ChatPage.tsx      # Real-time messaging, read receipts, image sharing
│   ├── ExplorePage.tsx   # Browse & filter profiles
│   ├── HomePage.tsx      # Social feed
│   ├── ProfilePage.tsx   # Profile view, edit, posts, connections
│   └── ...
├── context/          # React contexts
│   ├── AuthContext.tsx               # Auth + session
│   ├── MessageNotificationsContext.tsx  # Message badge + toast
│   ├── NotificationsContext.tsx      # Connection request notifications
│   └── PresenceContext.tsx           # Live status + auto-away + multi-device sync
├── lib/              # Supabase client + shared types
└── index.css         # Global styles + custom scrollbar
electron/             # Electron main process
```

---

## License

Private — all rights reserved.
