import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { UserStatus } from '../lib/types'

interface PresenceContextType {
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
  const statusSyncRef = useRef<RealtimeChannel | null>(null)
  const myStatusRef = useRef<UserStatus>('online')
  // What the user deliberately chose — auto-away never overwrites this
  const intentionalStatusRef = useRef<UserStatus>('online')

  useEffect(() => {
    if (!user) return

    const setup = async () => {
      // Load persisted status from DB
      const { data } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single()
      const saved = (data?.status as UserStatus) ?? 'online'
      setMyStatusState(saved)
      myStatusRef.current = saved
      intentionalStatusRef.current = saved

      // ── Presence channel (who is online + their status) ──────────────────
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
            // Resolve across multiple devices: intentional statuses beat auto-away
            const status =
              payloads.some((p) => p.status === 'busy') ? 'busy'
              : payloads.some((p) => p.status === 'dnd') ? 'dnd'
              : payloads.some((p) => p.status === 'online') ? 'online'
              : payloads.some((p) => p.status === 'away') ? 'away'
              : payloads[0]?.status ?? 'online'
            if (status !== 'invisible') map[uid] = status
          })
          setOnlineMap(map)
        })
        .subscribe(async (s) => {
          if (s === 'SUBSCRIBED') {
            await channelRef.current!.track({ status: myStatusRef.current })
          }
        })

      // ── Cross-device status sync ──────────────────────────────────────────
      // When the user changes their status on another device (DB update),
      // this device picks it up and re-broadcasts so presence stays consistent.
      if (statusSyncRef.current) supabase.removeChannel(statusSyncRef.current)

      statusSyncRef.current = supabase
        .channel('profile-status-sync')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newStatus = payload.new.status as UserStatus
            if (!newStatus || newStatus === intentionalStatusRef.current) return

            // Another device changed the intentional status — adopt it here too
            intentionalStatusRef.current = newStatus

            // Only update the live broadcast if we're not currently auto-awayed
            if (myStatusRef.current !== 'away' || intentionalStatusRef.current === 'away') {
              myStatusRef.current = newStatus
              setMyStatusState(newStatus)
              channelRef.current?.track({ status: newStatus })
            }
          }
        )
        .subscribe()
    }

    setup()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (statusSyncRef.current) supabase.removeChannel(statusSyncRef.current)
    }
  }, [user])

  // ── Auto-away on tab hide / window blur ───────────────────────────────────
  useEffect(() => {
    if (!user) return

    const goAway = () => {
      // Only auto-away if intentional status is online — respect Busy/DND/etc.
      if (intentionalStatusRef.current !== 'online') return
      myStatusRef.current = 'away'
      setMyStatusState('away')
      channelRef.current?.track({ status: 'away' })
      // No DB write — transient only
    }

    const comeBack = () => {
      const restore = intentionalStatusRef.current
      myStatusRef.current = restore
      setMyStatusState(restore)
      channelRef.current?.track({ status: restore })
    }

    const onVisibilityChange = () => {
      if (document.hidden) goAway()
      else comeBack()
    }

    // blur covers window minimize — skip if visibilitychange already handled it
    const onBlur = () => { if (!document.hidden) goAway() }
    const onFocus = () => comeBack()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [user])

  const setMyStatus = async (status: UserStatus) => {
    intentionalStatusRef.current = status
    myStatusRef.current = status
    setMyStatusState(status)
    await channelRef.current?.track({ status })
    // DB write triggers the cross-device sync listener on other devices
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
