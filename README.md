# 💕 Sparks

> A modern, real-time dating & social app built with React 19, Supabase, and Tailwind CSS v4. Connect with people, spark conversations, and find your match.

---

## Features

- **Smart Matching** — Send and receive connection requests; manage your connections list
- **Real-time Messaging** — Instant chat powered by Supabase Realtime; message notifications with unread badges
- **Live Presence** — Online/Away/Busy/DND status that updates across all sessions instantly
- **3-Step Signup** — Guided onboarding flow: account → profile → preferences
- **Social Feed** — Home feed with posts, likes, and comments from your connections
- **Notifications** — Connection request alerts with accept/decline actions
- **Delete Conversations** — Delete for yourself or delete for both parties
- **Profile Management** — Edit your profile, manage connections, and delete your account
- **Gender-themed UI** — Blue accents for men, pink for women throughout the app
- **Responsive Design** — Full mobile support with bottom nav; desktop sidebar with collapsible states
- **Cross-platform Desktop** — Ships as a native Electron app for Windows, macOS, and Linux

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Build | Vite 8 |
| Backend | Supabase (PostgreSQL + Realtime + Auth + RLS) |
| Desktop | Electron 41 |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

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

---

## Project Structure

```
src/
├── components/       # UI components (ChatPage, HomePage, ProfilePage, ...)
├── context/          # React contexts (Auth, Presence, Notifications, Messages)
├── lib/              # Supabase client + shared types
└── index.css         # Global styles
electron/             # Electron main process
```

---

## License

Private — all rights reserved.
