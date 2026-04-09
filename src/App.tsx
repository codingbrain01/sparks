import { useEffect } from 'react'
import { HashRouter, BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { PresenceProvider } from './context/PresenceContext'
import { MessageNotificationsProvider, useMessageNotifications } from './context/MessageNotificationsContext'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import HomePage from './components/HomePage'
import ChatPage from './components/ChatPage'
import ProfilePage from './components/ProfilePage'
import ExplorePage from './components/ExplorePage'
import AuthPage from './components/auth/AuthPage'
import type { Profile } from './lib/types'

// ── Spinner shown while auth state loads ─────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-linear-to-br from-rose-50 to-pink-50">
      <div className="text-center">
        <div className="text-5xl mb-4 select-none">💕</div>
        <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}

// ── Only accessible when NOT logged in ───────────────────────────────────────
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/home" replace />
  return <>{children}</>
}

// ── Only accessible when logged in ───────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Authenticated app shell (sidebar, bottom nav, toast) ─────────────────────
function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { latestNotif, clearUnread, dismissNotif } = useMessageNotifications()

  const openChat = (profile: Profile) => {
    navigate('/chat', { state: { chatTarget: profile } })
  }

  useEffect(() => {
    if (pathname === '/chat') clearUnread()
  }, [pathname])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-linear-to-br from-rose-50 via-fuchsia-50/40 to-violet-50/30">

      {/* Message toast notification */}
      {latestNotif && pathname !== '/chat' && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 cursor-pointer"
          onClick={() => { navigate('/chat'); dismissNotif() }}
        >
          <div className="flex items-center gap-3 bg-gray-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-2xl max-w-xs w-max">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-rose-500 to-pink-400 flex items-center justify-center text-xs font-bold shrink-0">
              {latestNotif.senderName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{latestNotif.senderName}</p>
              <p className="text-xs text-gray-300 truncate max-w-45">{latestNotif.content}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissNotif() }}
              className="text-gray-400 hover:text-white ml-1 shrink-0 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Exit button — mobile only, Electron packaged only */}
      {window.location.protocol === 'file:' && (
        <button
          onClick={() => (window as any).electronAPI?.closeApp()}
          title="Exit app"
          className="md:hidden fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/home" element={
              <div className="h-full overflow-y-auto">
                <HomePage onStartChat={openChat} />
              </div>
            } />
            <Route path="/explore" element={
              <div className="h-full overflow-y-auto">
                <ExplorePage onStartChat={openChat} />
              </div>
            } />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/profile" element={
              <div className="h-full overflow-y-auto">
                <ProfilePage onStartChat={openChat} />
              </div>
            } />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>

        <div className="md:hidden shrink-0">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

// ── Root router ───────────────────────────────────────────────────────────────
function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={
        <GuestRoute><AuthPage /></GuestRoute>
      } />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/*" element={
        <ProtectedRoute><AppShell /></ProtectedRoute>
      } />
    </Routes>
  )
}

// Use HashRouter for packaged Electron (file://), BrowserRouter for dev (http://)
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationsProvider>
          <PresenceProvider>
            <MessageNotificationsProvider>
              <AppContent />
            </MessageNotificationsProvider>
          </PresenceProvider>
        </NotificationsProvider>
      </AuthProvider>
    </Router>
  )
}
