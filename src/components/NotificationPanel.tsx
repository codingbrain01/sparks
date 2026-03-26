import { useNotifications } from '../context/NotificationsContext'
import type { Gender } from '../lib/types'

function avatarGradient(gender?: Gender) {
  return gender === 'Man' ? 'from-blue-500 to-indigo-400' : 'from-rose-500 to-pink-400'
}

interface Props {
  onClose: () => void
}

export default function NotificationPanel({ onClose }: Props) {
  const { requests, acceptRequest, declineRequest } = useNotifications()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-rose-100">

        {/* Header */}
        <div className="bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h3 className="text-base font-bold text-white">Connection Requests</h3>
            {requests.length > 0 && (
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                {requests.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {requests.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-5xl mb-3 select-none">💌</div>
            <p className="text-sm font-semibold text-gray-600">No pending requests</p>
            <p className="text-xs text-gray-400 mt-1">When someone wants to connect, they'll appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-rose-50 max-h-96 overflow-y-auto">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 px-5 py-4 hover:bg-rose-50/40 transition-colors">
                <div className={`w-11 h-11 rounded-full bg-linear-to-br ${avatarGradient(req.profiles.gender)} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm`}>
                  {req.profiles.first_name[0]}{req.profiles.last_name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {req.profiles.first_name} {req.profiles.last_name}
                  </p>
                  <p className="text-xs text-gray-400">wants to connect with you 💕</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => declineRequest(req.requester_id)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => acceptRequest(req.requester_id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-linear-to-r from-rose-500 to-pink-400 hover:shadow-md rounded-full transition-all shadow-sm"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
