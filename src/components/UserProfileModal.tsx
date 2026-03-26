import type { Profile, ConnStatus, UserStatus } from '../lib/types'
import { usePresence } from '../context/PresenceContext'
import StatusDot, { STATUS_META } from './StatusDot'
import Avatar from './Avatar'

const CONNECT_LABEL: Record<ConnStatus, string> = {
  none: 'Connect',
  pending_sent: 'Cancel Request',
  pending_received: 'Accept',
  accepted: '✓ Connected',
}

const CONNECT_STYLE: Record<ConnStatus, string> = {
  none: 'bg-linear-to-r from-rose-500 to-pink-400 text-white shadow-sm hover:shadow-md',
  pending_sent: 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500',
  pending_received: 'bg-green-500 text-white shadow-sm hover:shadow-md',
  accepted: 'bg-green-50 text-green-600',
}

const STATUS_BADGE: Record<UserStatus, string> = {
  online:    'bg-green-50 text-green-600',
  away:      'bg-yellow-50 text-yellow-600',
  busy:      'bg-red-50 text-red-500',
  dnd:       'bg-red-50 text-red-500',
  invisible: 'bg-gray-50 text-gray-500',
}

interface Props {
  profile: Profile
  connStatus: ConnStatus
  onConnect: () => void
  onClose: () => void
  onMessage?: () => void
}

export default function UserProfileModal({ profile, connStatus, onConnect, onClose, onMessage }: Props) {
  const { onlineMap } = usePresence()
  const presenceStatus = onlineMap[profile.id]

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full md:max-w-sm bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header row with close button */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Profile</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mx-5 mb-5" />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Avatar + Name block */}
          <div className="flex flex-col items-center px-5 mb-5">
            <Avatar
              firstName={profile.first_name}
              lastName={profile.last_name}
              gender={profile.gender}
              avatarUrl={profile.avatar_url}
              className="w-24 h-24 rounded-full shadow-md mb-4"
              textClassName="text-3xl font-bold"
            />
            <h2 className="text-xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</h2>
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-400">@{profile.username} · </span>
              <span className={`text-sm font-semibold ${profile.gender === 'Man' ? 'text-blue-500' : 'text-pink-500'}`}>
                {profile.age} yrs
              </span>
              {presenceStatus && (
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[presenceStatus]}`}>
                  <StatusDot status={presenceStatus} size="sm" border={false} />
                  {STATUS_META[presenceStatus].label}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-5 mb-5">
            {onMessage && (
              <button
                onClick={onMessage}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message
              </button>
            )}
            <button
              onClick={onConnect}
              disabled={connStatus === 'accepted'}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:cursor-default ${CONNECT_STYLE[connStatus]}`}
            >
              {CONNECT_LABEL[connStatus]}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 mx-5 mb-5" />

          {/* Details */}
          <div className="px-5 pb-8 space-y-5">

            {/* Gender + looking for */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                profile.gender === 'Man' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
              }`}>
                {profile.gender === 'Man' ? '👨' : '👩'} {profile.gender}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600">
                ❤️ Looking for {profile.looking_for}
              </span>
            </div>

            {/* Bio */}
            {profile.bio ? (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">About</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No bio yet.</p>
            )}

            {/* Hobbies */}
            {(profile.hobbies ?? []).length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Hobbies</p>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.hobbies ?? []).map((h) => (
                    <span key={h} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}