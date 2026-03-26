import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Profile } from '../lib/types'

export interface ConnectionRequest {
  id: number
  requester_id: string
  created_at: string
  profiles: Profile
}

interface NotificationsContextType {
  requests: ConnectionRequest[]
  count: number
  acceptRequest: (requesterId: string) => Promise<void>
  declineRequest: (requesterId: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [requests, setRequests] = useState<ConnectionRequest[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchRequests = async () => {
    if (!user) return
    const { data } = await supabase
      .from('connections')
      .select('id, requester_id, created_at, profiles!requester_id(*)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
    const normalized: ConnectionRequest[] = (data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
    }))
    setRequests(normalized)
  }

  useEffect(() => {
    if (!user) return
    fetchRequests()

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connections',
        filter: `addressee_id=eq.${user.id}`,
      }, fetchRequests)
      .subscribe()

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [user])

  const acceptRequest = async (requesterId: string) => {
    await supabase.from('connections').update({ status: 'accepted' })
      .eq('requester_id', requesterId).eq('addressee_id', user!.id)
    setRequests((prev) => prev.filter((r) => r.requester_id !== requesterId))
  }

  const declineRequest = async (requesterId: string) => {
    await supabase.from('connections').delete()
      .eq('requester_id', requesterId).eq('addressee_id', user!.id)
    setRequests((prev) => prev.filter((r) => r.requester_id !== requesterId))
  }

  return (
    <NotificationsContext.Provider value={{ requests, count: requests.length, acceptRequest, declineRequest }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
