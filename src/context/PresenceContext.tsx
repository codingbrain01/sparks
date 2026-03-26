import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { UserStatus } from '../lib/types'

interface PresenceContextType {
  // userId → status for all other online users (invisible users excluded)
  onlineMap: Record<string, UserStatus>
  myStatus: UserStatus
  setMyStatus: (status: UserStatus) => Promise<void>
}

const PresenceContext = createContext<PresenceContextType | null>(null)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [myStatus, setMyStatusState] = useState<UserStatus>('online')
  const [onlineMap, setOnlineMap] = useState<Record<string, UserStatus>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const myStatusRef = useRef<UserStatus>('online')

  useEffect(() => {
    if (!user) return

    const setup = async () => {
      // Load persisted status
      const { data } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single()
      const saved = (data?.status as UserStatus) ?? 'online'
      setMyStatusState(saved)
      myStatusRef.current = saved

      // Presence channel
      if (channelRef.current) supabase.removeChannel(channelRef.current)

      channelRef.current = supabase.channel('app-presence', {
        config: { presence: { key: user.id } },
      })

      channelRef.current
        .on('presence', { event: 'sync' }, () => {
          const state = channelRef.current!.presenceState<{ status: UserStatus }>()
          const map: Record<string, UserStatus> = {}
          Object.entries(state).forEach(([uid, payloads]) => {
            if (uid === user.id) return
            const status = payloads[0]?.status ?? 'online'
            if (status !== 'invisible') map[uid] = status
          })
          setOnlineMap(map)
        })
        .subscribe(async (s) => {
          if (s === 'SUBSCRIBED') {
            await channelRef.current!.track({ status: myStatusRef.current })
          }
        })
    }

    setup()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [user])

  const setMyStatus = async (status: UserStatus) => {
    myStatusRef.current = status
    setMyStatusState(status)
    await channelRef.current?.track({ status })
    await supabase.from('profiles').update({ status }).eq('id', user!.id)
  }

  return (
    <PresenceContext.Provider value={{ onlineMap, myStatus, setMyStatus }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
