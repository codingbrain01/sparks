import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Electron loads bundled files via file:// so it needs relative asset paths.
// Browser/Vercel deploys need absolute paths so SPA fallback on subroutes
// (e.g. /profile → /index.html) still resolves /assets/... correctly.
// Pick the Electron base only when explicitly building with --mode electron.
export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' && mode === 'electron' ? './' : '/',
}))
