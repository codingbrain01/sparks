import { useState, type JSX } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { usePresence } from '../context/PresenceContext'
import { useMessageNotifications } from '../context/MessageNotificationsContext'
import NotificationPanel from './NotificationPanel'
import StatusDot, { STATUS_META } from './StatusDot'
import type { Tab } from './BottomNav'
import type { UserStatus, Gender } from '../lib/types'

function genderGradient(gender?: Gender) {
  return gender === 'Man' ? 'from-blue-500 to-indigo-400' : 'from-rose-500 to-pink-400'
}

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const navItems: { id: Tab; label: string; icon: (active: boolean) => JSX.Element }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Messages',
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

export default function Sidebar({ activeTab, onTabChange }: Props) {
  const { profile, signOut } = useAuth()
  const { count } = useNotifications()
  const { myStatus, setMyStatus } = usePresence()
  const { unreadCount: msgCount } = useMessageNotifications()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  return (
    <>
    <aside className="hidden md:flex flex-col w-16 lg:w-60 h-full bg-white/70 backdrop-blur-xl border-r border-rose-100/60 shrink-0 shadow-[4px_0_20px_rgba(244,63,94,0.06)]">

      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-rose-100/60 shrink-0 gap-2">
        <span className="text-2xl select-none leading-none">💕</span>
        <h1 className="hidden lg:block text-xl font-bold bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent whitespace-nowrap">
          Sparks
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {/* Notification bell */}
        <button
          onClick={() => setShowNotifications(true)}
          title="Notifications"
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
            count > 0
              ? 'bg-linear-to-r from-rose-500 to-pink-400 text-white shadow-md shadow-rose-200/50'
              : 'text-gray-500 hover:bg-rose-50 hover:text-rose-500'
          }`}
        >
          <div className="relative shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-rose-500 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </div>
          <span className="hidden lg:block text-sm font-medium">Notifications</span>
          {count > 0 && (
            <span className="hidden lg:block ml-auto text-xs font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </button>

        {navItems.map(({ id, label, icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              title={label}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                active
                  ? 'bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-md shadow-rose-200/50'
                  : 'text-gray-500 hover:bg-rose-50 hover:text-rose-500'
              }`}
            >
              <div className="relative shrink-0">
                {icon(active)}
                {id === 'chat' && msgCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {msgCount > 9 ? '9+' : msgCount}
                  </span>
                )}
              </div>
              <span className={`hidden lg:block text-sm ${active ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
              {id === 'chat' && msgCount > 0 && (
                <span className="hidden lg:block ml-auto text-xs font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">
                  {msgCount > 9 ? '9+' : msgCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User mini-profile + sign out */}
      <div className="p-3 border-t border-rose-100/60 shrink-0 bg-rose-50/30">
        <div className="flex items-center gap-3 min-w-0">

          {/* Avatar with status dot */}
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-full bg-linear-to-br ${genderGradient(profile?.gender)} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
              {profile ? `${profile.first_name[0] ?? ''}${profile.last_name[0] ?? ''}` : '?'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={myStatus} size="sm" />
            </span>
          </div>

          <div className="hidden lg:block min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {profile ? `${profile.first_name} ${profile.last_name}` : 'Loading…'}
            </p>
            {/* Status picker trigger */}
            <div className="relative">
              <button
                onClick={() => setShowStatusPicker((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
              >
                <StatusDot status={myStatus} size="sm" border={false} />
                <span>{STATUS_META[myStatus].label}</span>
                <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showStatusPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusPicker(false)} />
                  <div className="absolute bottom-6 left-0 w-44 bg-white rounded-xl shadow-xl border border-rose-100 z-20 overflow-hidden py-1">
                    {(Object.keys(STATUS_META) as UserStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setMyStatus(s); setShowStatusPicker(false) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-rose-50 transition-colors ${myStatus === s ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                      >
                        <StatusDot status={s} size="sm" border={false} />
                        {STATUS_META[s].label}
                        {myStatus === s && (
                          <svg className="w-3.5 h-3.5 ml-auto text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sign out — full sidebar */}
          <button
            onClick={signOut}
            title="Sign out"
            className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-100 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Status picker — icon-only sidebar (tablet) */}
        <div className="lg:hidden mt-2 relative flex justify-center">
          <button
            onClick={() => setShowStatusPicker((v) => !v)}
            title={STATUS_META[myStatus].label}
            className="p-1.5 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <StatusDot status={myStatus} size="md" border={false} />
          </button>
          {showStatusPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStatusPicker(false)} />
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-44 bg-white rounded-xl shadow-xl border border-rose-100 z-20 overflow-hidden py-1">
                {(Object.keys(STATUS_META) as UserStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setMyStatus(s); setShowStatusPicker(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-rose-50 transition-colors ${myStatus === s ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                  >
                    <StatusDot status={s} size="sm" border={false} />
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sign out — icon-only sidebar (tablet) */}
        <button
          onClick={signOut}
          title="Sign out"
          className="lg:hidden mt-1 w-full flex justify-center py-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>

    {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
    </>
  )
}
