import type { JSX } from "react";
import { useMessageNotifications } from '../context/MessageNotificationsContext'

export type Tab = 'home' | 'chat' | 'profile'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function BottomNav({ activeTab, onTabChange }: Props) {
  const { unreadCount: msgCount } = useMessageNotifications()
  const tabs: { id: Tab; label: string; icon: (active: boolean) => JSX.Element }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-t border-rose-100/80 shrink-0 shadow-[0_-4px_20px_rgba(244,63,94,0.08)]">
      <div className="flex justify-around items-center py-2 px-3">
        {tabs.map(({ id, label, icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-200 ${
                active
                  ? 'bg-linear-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-lg shadow-rose-300/40 scale-105'
                  : 'text-gray-400 hover:text-rose-400'
              }`}
            >
              <div className="relative">
                {icon(active)}
                {id === 'chat' && msgCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {msgCount > 9 ? '9+' : msgCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
