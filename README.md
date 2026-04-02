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

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with:
  - `profiles`, `connections`, `conversations`, `conversation_participants`, `messages`, `posts`, `post_comments`, `post_likes` tables
  - `messages` table requires `read_at TIMESTAMPTZ` and `image_url TEXT` columns
  - A public `avatars` storage bucket for profile photos
  - A public `chat-images` storage bucket for chat image uploads
  - RLS policies for authenticated reads/writes on both buckets

### Setup

```bash
# Install dependencies
npm install

# Add your Supabase credentials
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### Development

```bash
# Web (browser)
npm run dev

# Desktop (Electron)
npm run electron:dev
```

### Build

```bash
# Web
npm run build

# Desktop installer
npm run electron:build
```

> **Web production note:** configure your server to redirect all routes to `index.html` (e.g. Netlify `_redirects`, Vercel rewrites) for client-side routing to work on refresh.

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
