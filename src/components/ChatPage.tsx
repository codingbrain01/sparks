import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import type { Message, ConversationWithPartner, Profile } from '../lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import StatusDot, { STATUS_META } from './StatusDot'

function avatarGradient(gender?: string) {
  return gender === 'Man' ? 'from-blue-500 to-indigo-400' : 'from-rose-500 to-pink-400'
}

function getInitials(p: Profile) {
  return `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase()
}

// ─── Call overlay ──────────────────────────────────────────────────────────
function CallOverlay({
  type, person, onEnd,
}: {
  type: 'audio' | 'video'
  person: Profile
  onEnd: () => void
}) {
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)

  return (
    <div className="fixed inset-0 z-60 bg-gray-900 flex flex-col items-center justify-between py-16 px-6">
      <div className="flex flex-col items-center gap-4 mt-8">
        <div className={`w-24 h-24 rounded-full bg-linear-to-br ${avatarGradient(person.gender)} flex items-center justify-center text-white text-3xl font-bold shadow-lg`}>
          {getInitials(person)}
        </div>
        <div className="text-center">
          <p className="text-white text-xl font-bold">{person.first_name} {person.last_name}</p>
          <p className="text-gray-400 text-sm mt-1">{type === 'video' ? 'Video calling…' : 'Calling…'}</p>
        </div>
      </div>

      {type === 'video' && !camOff && (
        <div className="w-full max-w-xs aspect-video bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">You</div>
            <p className="text-gray-400 text-xs">Your camera</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6">
        {type === 'video' && (
          <button
            onClick={() => setCamOff((v) => !v)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${camOff ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setMuted((v) => !v)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg"
        >
          <svg className="w-7 h-7 rotate-135" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function ChatPage({
  chatTarget,
  onChatTargetConsumed,
}: {
  chatTarget?: Profile | null
  onChatTargetConsumed?: () => void
}) {
  const { user } = useAuth()
  const { onlineMap } = usePresence()
  const [conversations, setConversations] = useState<ConversationWithPartner[]>([])
  const [activeConv, setActiveConv] = useState<ConversationWithPartner | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Profile[]>([])
  const [message, setMessage] = useState('')
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Delete conversation
  const [deleteConv, setDeleteConv] = useState<ConversationWithPartner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteForMe = async () => {
    if (!deleteConv || !user) return
    setDeleting(true)
    await supabase
      .from('conversation_participants')
      .update({ hidden: true })
      .eq('conversation_id', deleteConv.id)
      .eq('user_id', user.id)
    setConversations((prev) => prev.filter((c) => c.id !== deleteConv.id))
    if (activeConv?.id === deleteConv.id) setActiveConv(null)
    setDeleteConv(null)
    setDeleting(false)
  }

  const deleteForBoth = async () => {
    if (!deleteConv || !user) return
    setDeleting(true)
    await supabase.from('conversations').delete().eq('id', deleteConv.id)
    setConversations((prev) => prev.filter((c) => c.id !== deleteConv.id))
    if (activeConv?.id === deleteConv.id) setActiveConv(null)
    setDeleteConv(null)
    setDeleting(false)
  }

  // Compose / new message search
  const [showCompose, setShowCompose] = useState(false)
  const [composeSearch, setComposeSearch] = useState('')
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Fetch conversations ──────────────────────────────────────────────────
  const fetchConversations = async () => {
    if (!user) return

    const { data: myParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)
      .eq('hidden', false)

    if (!myParts?.length) { setLoadingConvs(false); return }

    const convIds = myParts.map((p) => p.conversation_id)

    const [{ data: others }, { data: lastMessages }] = await Promise.all([
      supabase
        .from('conversation_participants')
        .select('conversation_id, profiles(*)')
        .in('conversation_id', convIds)
        .neq('user_id', user.id),
      supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
    ])

    const convMap: Record<number, ConversationWithPartner> = {}
    others?.forEach((o) => {
      const last = lastMessages?.find((m) => m.conversation_id === o.conversation_id)
      convMap[o.conversation_id] = {
        id: o.conversation_id,
        updated_at: last?.created_at ?? '',
        partner: o.profiles as unknown as Profile,
        last_message: last?.content ?? '',
        unread_count: 0,
      }
    })

    setConversations(
      Object.values(convMap).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    )
    setLoadingConvs(false)
  }

  // ── Online users from presence ───────────────────────────────────────────
  useEffect(() => {
    const ids = Object.keys(onlineMap)
    if (!ids.length) { setOnlineUsers([]); return }
    supabase.from('profiles').select('*').in('id', ids).limit(20)
      .then(({ data }) => setOnlineUsers((data as Profile[]) ?? []))
  }, [onlineMap])

  useEffect(() => { fetchConversations() }, [user])

  // ── Fetch messages + realtime when conversation changes ──────────────────
  useEffect(() => {
    if (!activeConv) return

    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeConv.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []))

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    channelRef.current = supabase
      .channel(`messages-${activeConv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe()

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [activeConv])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!message.trim() || !activeConv || !user) return
    const text = message.trim()
    setMessage('')
    await supabase.from('messages').insert({
      conversation_id: activeConv.id,
      sender_id: user.id,
      content: text,
    })
  }

  // ── Start conversation with a user ───────────────────────────────────────
  const startConversation = async (partner: Profile) => {
    if (!user) return

    // Fast path: already in local state
    const existing = conversations.find((c) => c.partner.id === partner.id)
    if (existing) { setActiveConv(existing); return }

    // DB check: find a conversation both users share
    const { data: myParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (myParts?.length) {
      const myConvIds = myParts.map((p) => p.conversation_id)
      const { data: shared } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', partner.id)
        .in('conversation_id', myConvIds)
        .limit(1)

      if (shared?.length) {
        const convId = shared[0].conversation_id
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const found: ConversationWithPartner = {
          id: convId,
          updated_at: lastMsg?.created_at ?? '',
          partner,
          last_message: lastMsg?.content ?? '',
          unread_count: 0,
        }
        setConversations((prev) =>
          prev.some((c) => c.id === convId) ? prev : [found, ...prev]
        )
        setActiveConv(found)
        return
      }
    }

    // No existing conversation — create one
    const { data: conv } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single()

    if (!conv) return

    await supabase.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: partner.id },
    ])

    const newConv: ConversationWithPartner = {
      id: conv.id,
      updated_at: new Date().toISOString(),
      partner,
      last_message: '',
      unread_count: 0,
    }
    setConversations((prev) => [newConv, ...prev])
    setActiveConv(newConv)
  }

  // ── Auto-open conversation from external navigation ───────────────────────
  useEffect(() => {
    if (!chatTarget) return
    startConversation(chatTarget)
    onChatTargetConsumed?.()
  }, [chatTarget])

  // ── Compose: fetch all users ──────────────────────────────────────────────
  const openCompose = async () => {
    setShowCompose(true)
    setComposeSearch('')
    if (allUsers.length) return
    setLoadingUsers(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user!.id)
      .order('first_name')
    setAllUsers((data as Profile[]) ?? [])
    setLoadingUsers(false)
  }

  const filteredUsers = composeSearch.trim()
    ? allUsers.filter((u) => {
        const q = composeSearch.toLowerCase()
        return (
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
        )
      })
    : allUsers

  return (
    <>
      {callType && activeConv && (
        <CallOverlay type={callType} person={activeConv.partner} onEnd={() => setCallType(null)} />
      )}

      {/* Delete conversation modal */}
      {deleteConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteConv(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Delete conversation</h3>
            <p className="text-sm text-gray-500 mb-5">
              Chat with <span className="font-semibold text-gray-700">{deleteConv.partner.first_name} {deleteConv.partner.last_name}</span>
            </p>
            <div className="space-y-2.5">
              <button
                onClick={deleteForMe}
                disabled={deleting}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-rose-200 hover:bg-rose-50 transition-colors text-left disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Delete for me only</p>
                  <p className="text-xs text-gray-400 mt-0.5">Removes the chat from your inbox. The other person can still see it.</p>
                </div>
              </button>
              <button
                onClick={deleteForBoth}
                disabled={deleting}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-600">Delete for both</p>
                  <p className="text-xs text-gray-400 mt-0.5">Permanently deletes the conversation and all messages for everyone.</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setDeleteConv(null)}
              disabled={deleting}
              className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {deleting && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                <div className="w-6 h-6 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="h-full flex overflow-hidden">

        {/* ── Panel 1: Conversation list ─────────────────────────────── */}
        <div className={[
          'flex flex-col bg-white/80 backdrop-blur-sm border-r border-rose-100/60',
          'w-full shrink-0',
          'md:w-72 lg:w-80 xl:w-96',
          activeConv ? 'hidden md:flex' : 'flex',
        ].join(' ')}>

          {/* List header */}
          <div className="shrink-0 px-4 py-3 lg:px-6 lg:py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold bg-linear-to-r from-rose-500 to-pink-400 bg-clip-text text-transparent">
                Messages
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {onlineUsers.length} people online
              </p>
            </div>
            <button
              onClick={openCompose}
              title="New message"
              className="w-9 h-9 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>

          {/* Compose panel */}
          {showCompose && (
            <div className="shrink-0 border-b border-gray-100 bg-white">
              <div className="px-4 py-3 flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={composeSearch}
                  onChange={(e) => setComposeSearch(e.target.value)}
                  placeholder="Search people…"
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-rose-300"
                />
                <button
                  onClick={() => setShowCompose(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                {loadingUsers ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No users found</p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { startConversation(u); setShowCompose(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-full bg-linear-to-br ${avatarGradient(u.gender)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {getInitials(u)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                      </div>
                      {u.online && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 ml-auto" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Online now */}
          {onlineUsers.length > 0 && (
            <div className="shrink-0 px-4 py-3 border-b border-rose-100/60 bg-linear-to-r from-rose-50/60 to-pink-50/40">
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide mb-3">Online Now ✨</p>
              <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
                {onlineUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="flex flex-col items-center gap-1 shrink-0"
                  >
                    <div className={`w-12 h-12 rounded-full bg-linear-to-br ${avatarGradient(u.gender)} flex items-center justify-center text-white font-bold text-sm relative`}>
                      {getInitials(u)}
                      <span className="absolute bottom-0 right-0">
                        <StatusDot status={onlineMap[u.id] ?? 'online'} size="sm" />
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 truncate w-14 text-center">
                      {u.first_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loadingConvs ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-4 text-gray-400">
                <div className="text-4xl mb-2 select-none">💬</div>
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Tap the compose button above to message anyone</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div key={conv.id} className="relative group">
                  <button
                    onClick={() => setActiveConv(conv)}
                    className={`w-full px-4 py-3 lg:px-5 lg:py-4 flex items-center gap-3 transition-colors text-left ${
                      activeConv?.id === conv.id
                        ? 'bg-linear-to-r from-rose-50 to-pink-50 border-l-2 border-rose-400'
                        : 'hover:bg-rose-50/40'
                    }`}
                  >
                    <div className={`w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-linear-to-br ${avatarGradient(conv.partner.gender)} flex items-center justify-center text-white font-bold relative shrink-0`}>
                      {getInitials(conv.partner)}
                      {onlineMap[conv.partner.id] && (
                        <span className="absolute bottom-0 right-0">
                          <StatusDot status={onlineMap[conv.partner.id]} size="sm" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-900 text-sm">
                          {conv.partner.first_name} {conv.partner.last_name}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {conv.last_message || 'Start a conversation'}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center shrink-0 font-medium">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                  {/* Three-dot delete trigger */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConv(conv) }}
                    title="Delete conversation"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panel 2: Active chat or empty state ────────────────────── */}
        <div className={[
          'flex-1 flex flex-col min-w-0',
          activeConv ? 'flex' : 'hidden md:flex',
        ].join(' ')}>

          {activeConv ? (
            <>
              {/* Chat header */}
              <div className="shrink-0 bg-white/90 backdrop-blur-md border-b border-rose-100/60 px-4 py-3 lg:px-6 flex items-center gap-3 shadow-[0_2px_12px_rgba(244,63,94,0.08)]">
                <button
                  onClick={() => setActiveConv(null)}
                  className="md:hidden text-gray-500 hover:text-gray-700 p-1 -ml-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-linear-to-br ${avatarGradient(activeConv.partner.gender)} flex items-center justify-center text-white font-bold text-sm relative shrink-0`}>
                  {getInitials(activeConv.partner)}
                  {onlineMap[activeConv.partner.id] && (
                    <span className="absolute bottom-0 right-0">
                      <StatusDot status={onlineMap[activeConv.partner.id]} size="sm" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm lg:text-base truncate">
                    {activeConv.partner.first_name} {activeConv.partner.last_name}
                  </p>
                  <p className={`text-xs ${onlineMap[activeConv.partner.id] ? 'text-green-500' : 'text-gray-400'}`}>
                    {onlineMap[activeConv.partner.id]
                      ? STATUS_META[onlineMap[activeConv.partner.id]].label
                      : 'Offline'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setCallType('audio')}
                    title="Audio call"
                    className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-green-50 hover:bg-green-100 flex items-center justify-center text-green-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCallType('video')}
                    title="Video call"
                    className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-3 bg-linear-to-b from-rose-50/30 via-fuchsia-50/20 to-white">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8 select-none">
                    Say hi to {activeConv.partner.first_name}! 👋
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender_id !== user?.id && (
                      <div className={`w-7 h-7 rounded-full bg-linear-to-br ${avatarGradient(activeConv.partner.gender)} flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 self-end`}>
                        {activeConv.partner.first_name[0]}
                      </div>
                    )}
                    <div className={`max-w-[72%] lg:max-w-[60%] px-4 py-2.5 rounded-2xl ${
                      msg.sender_id === user?.id
                        ? 'bg-linear-to-r from-rose-500 to-pink-400 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-rose-100' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="shrink-0 bg-white border-t border-gray-100 px-4 lg:px-6 py-3">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message…"
                    className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-rose-300 transition-shadow"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="w-10 h-10 rounded-full bg-linear-to-r from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50">
              <div className="text-6xl mb-4 select-none">💬</div>
              <p className="text-xl font-semibold text-gray-600 mb-2">Your Messages</p>
              <p className="text-gray-400 text-sm">Select a conversation on the left to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
