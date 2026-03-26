import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface MessageNotif {
  senderName: string
  content: string
  conversationId: number
}

interface MessageNotificationsContextType {
  unreadCount: number
  latestNotif: MessageNotif | null
  clearUnread: () => void
  dismissNotif: () => void
}

const MessageNotificationsContext = createContext<MessageNotificationsContextType | null>(null)

export function MessageNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unreadConvIds, setUnreadConvIds] = useState<Set<number>>(new Set())
  const [latestNotif, setLatestNotif] = useState<MessageNotif | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    channelRef.current = supabase
      .channel('message-notifs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string; conversation_id: number }
          if (msg.sender_id === user.id) return

          const { data: sender } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', msg.sender_id)
            .single()

          setUnreadConvIds((prev) => new Set(prev).add(msg.conversation_id))
          setLatestNotif({
            senderName: sender ? `${sender.first_name} ${sender.last_name}` : 'Someone',
            content: msg.content,
            conversationId: msg.conversation_id,
          })

          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setLatestNotif(null), 4500)
        }
      )
      .subscribe()

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [user])

  const clearUnread = () => setUnreadConvIds(new Set())
  const dismissNotif = () => {
    setLatestNotif(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return (
    <MessageNotificationsContext.Provider value={{ unreadCount: unreadConvIds.size, latestNotif, clearUnread, dismissNotif }}>
      {children}
    </MessageNotificationsContext.Provider>
  )
}

export function useMessageNotifications() {
  const ctx = useContext(MessageNotificationsContext)
  if (!ctx) throw new Error('useMessageNotifications must be used within MessageNotificationsProvider')
  return ctx
}
