import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Profile, Gender } from '../lib/types'

type CallType = 'audio' | 'video'

export interface IncomingCall {
  conversationId: number
  callerId: string
  callerName: string
  callerAvatar: string | null
  callerGender: Gender
  type: CallType
  offer: RTCSessionDescriptionInit
}

export interface OutgoingCall {
  conversationId: number
  partner: Profile
  type: CallType
}

export interface ActiveCall {
  conversationId: number
  partner: Profile
  type: CallType
  startedAt: number
}

interface CallContextValue {
  incomingCall: IncomingCall | null
  outgoingCall: OutgoingCall | null
  activeCall: ActiveCall | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
  startCall: (conversationId: number, partner: Profile, type: CallType) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleVideo: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}

async function getIceServers(): Promise<RTCIceServer[]> {
  const apiKey = import.meta.env.VITE_METERED_API_KEY
  const appName = import.meta.env.VITE_METERED_APP_NAME
  if (apiKey && appName) {
    try {
      const res = await fetch(
        `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
      )
      if (res.ok) return await res.json()
    } catch {}
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  // Refs — avoid stale closure issues in channel callbacks
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const sendChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const sendReadyRef = useRef(false)
  const sendQueueRef = useRef<Array<{ event: string; payload: object }>>([])
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const remoteUserIdRef = useRef<string | null>(null)
  const activeCallRef = useRef<ActiveCall | null>(null)
  const outgoingCallRef = useRef<OutgoingCall | null>(null)

  // Keep refs synced with state
  useEffect(() => { activeCallRef.current = activeCall }, [activeCall])
  useEffect(() => { outgoingCallRef.current = outgoingCall }, [outgoingCall])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    if (sendChannelRef.current) {
      supabase.removeChannel(sendChannelRef.current)
      sendChannelRef.current = null
    }
    sendReadyRef.current = false
    sendQueueRef.current = []
    pendingCandidatesRef.current = []
    remoteUserIdRef.current = null
    setIncomingCall(null)
    setOutgoingCall(null)
    setActiveCall(null)
    setIsMuted(false)
    setIsVideoOff(false)
  }, [])

  // ── Signaling helpers ─────────────────────────────────────────────────────
  const initSendChannel = useCallback((targetUserId: string) => {
    const ch = supabase.channel(`user-calls:${targetUserId}`)
    sendChannelRef.current = ch
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        sendReadyRef.current = true
        const queue = [...sendQueueRef.current]
        sendQueueRef.current = []
        queue.forEach(({ event, payload }) => {
          ch.send({ type: 'broadcast', event, payload })
        })
      }
    })
  }, [])

  const sendSignal = useCallback((event: string, payload: object) => {
    if (!sendReadyRef.current) {
      sendQueueRef.current.push({ event, payload })
      return
    }
    sendChannelRef.current?.send({ type: 'broadcast', event, payload })
  }, [])

  // ── Receive channel (always on) ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel(`user-calls:${user.id}`)

    channel
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        // Busy — reject immediately
        if (activeCallRef.current || outgoingCallRef.current) {
          const rejCh = supabase.channel(`user-calls:${payload.callerId}`)
          let rejected = false
          rejCh.subscribe((s) => {
            if (s === 'SUBSCRIBED' && !rejected) {
              rejected = true
              rejCh.send({ type: 'broadcast', event: 'call-end', payload: { reason: 'busy' } })
                .then(() => supabase.removeChannel(rejCh))
                .catch(() => supabase.removeChannel(rejCh))
            }
          })
          return
        }
        remoteUserIdRef.current = payload.callerId
        setIncomingCall({
          conversationId: payload.conversationId,
          callerId: payload.callerId,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar,
          callerGender: payload.callerGender,
          type: payload.type,
          offer: payload.offer,
        })
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer))
        for (const c of pendingCandidatesRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
        }
        pendingCandidatesRef.current = []
        const og = outgoingCallRef.current
        if (og) {
          setActiveCall({ conversationId: og.conversationId, partner: og.partner, type: og.type, startedAt: Date.now() })
          setOutgoingCall(null)
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!pcRef.current) {
          pendingCandidatesRef.current.push(payload.candidate)
          return
        }
        if (pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
        } else {
          pendingCandidatesRef.current.push(payload.candidate)
        }
      })
      .on('broadcast', { event: 'call-end' }, async ({ payload }) => {
        const ac = activeCallRef.current
        if (ac && payload.reason !== 'busy') {
          const duration = Math.floor((Date.now() - ac.startedAt) / 1000)
          await supabase.from('calls').insert({
            conversation_id: ac.conversationId,
            caller_id: remoteUserIdRef.current ?? user.id,
            callee_id: user.id,
            type: ac.type,
            status: 'ended',
            duration_seconds: duration,
          })
        }
        cleanup()
      })
      .on('broadcast', { event: 'call-decline' }, async ({ payload }) => {
        const og = outgoingCallRef.current
        if (og) {
          await supabase.from('calls').insert({
            conversation_id: og.conversationId,
            caller_id: user.id,
            callee_id: og.partner.id,
            type: og.type,
            status: payload.reason === 'busy' ? 'missed' : 'declined',
            duration_seconds: 0,
          })
        }
        cleanup()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, cleanup])

  // ── Start call (caller side) ──────────────────────────────────────────────
  const startCall = useCallback(async (conversationId: number, partner: Profile, type: CallType) => {
    if (!user || !profile) return
    remoteUserIdRef.current = partner.id
    initSendChannel(partner.id)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      })
      localStreamRef.current = stream
      setLocalStream(stream)

      const iceServers = await getIceServers()
      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      const newRemote = new MediaStream()
      setRemoteStream(newRemote)
      pc.ontrack = (e) => {
        const tracks = e.streams[0] ? e.streams[0].getTracks() : [e.track]
        tracks.forEach((t) => { if (!newRemote.getTracks().includes(t)) newRemote.addTrack(t) })
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal('ice-candidate', { candidate: e.candidate.toJSON() })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      setOutgoingCall({ conversationId, partner, type })

      sendSignal('call-offer', {
        conversationId,
        callerId: user.id,
        callerName: `${profile.first_name} ${profile.last_name}`,
        callerAvatar: profile.avatar_url,
        callerGender: profile.gender,
        type,
        offer: pc.localDescription,
      })
    } catch {
      cleanup()
    }
  }, [user, profile, initSendChannel, sendSignal, cleanup])

  // ── Accept call (callee side) ─────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user) return
    initSendChannel(incomingCall.callerId)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === 'video',
      })
      localStreamRef.current = stream
      setLocalStream(stream)

      const iceServers = await getIceServers()
      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      const newRemote = new MediaStream()
      setRemoteStream(newRemote)
      pc.ontrack = (e) => {
        const tracks = e.streams[0] ? e.streams[0].getTracks() : [e.track]
        tracks.forEach((t) => { if (!newRemote.getTracks().includes(t)) newRemote.addTrack(t) })
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal('ice-candidate', { candidate: e.candidate.toJSON() })
      }

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      for (const c of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      }
      pendingCandidatesRef.current = []

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal('call-answer', { answer: pc.localDescription })

      const { data: partnerProfile } = await supabase
        .from('profiles').select('*').eq('id', incomingCall.callerId).single()

      setActiveCall({
        conversationId: incomingCall.conversationId,
        partner: partnerProfile as Profile,
        type: incomingCall.type,
        startedAt: Date.now(),
      })
      setIncomingCall(null)
    } catch {
      cleanup()
    }
  }, [incomingCall, user, initSendChannel, sendSignal, cleanup])

  // ── Decline call ──────────────────────────────────────────────────────────
  const declineCall = useCallback(async () => {
    if (!incomingCall || !user) return
    const rejCh = supabase.channel(`user-calls:${incomingCall.callerId}`)
    rejCh.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        rejCh.send({ type: 'broadcast', event: 'call-decline', payload: { reason: 'declined' } })
        supabase.removeChannel(rejCh)
      }
    })
    await supabase.from('calls').insert({
      conversation_id: incomingCall.conversationId,
      caller_id: incomingCall.callerId,
      callee_id: user.id,
      type: incomingCall.type,
      status: 'declined',
      duration_seconds: 0,
    })
    cleanup()
  }, [incomingCall, user, cleanup])

  // ── End call ──────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    sendSignal('call-end', { reason: 'hangup' })

    if (activeCall && user) {
      const duration = Math.floor((Date.now() - activeCall.startedAt) / 1000)
      await supabase.from('calls').insert({
        conversation_id: activeCall.conversationId,
        caller_id: user.id,
        callee_id: activeCall.partner.id,
        type: activeCall.type,
        status: 'ended',
        duration_seconds: duration,
      })
    } else if (outgoingCall && user) {
      await supabase.from('calls').insert({
        conversation_id: outgoingCall.conversationId,
        caller_id: user.id,
        callee_id: outgoingCall.partner.id,
        type: outgoingCall.type,
        status: 'missed',
        duration_seconds: 0,
      })
    }
    cleanup()
  }, [activeCall, outgoingCall, user, sendSignal, cleanup])

  // ── Media toggles ─────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled })
    setIsMuted((m) => !m)
  }, [])

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled })
    setIsVideoOff((v) => !v)
  }, [])

  return (
    <CallContext.Provider value={{
      incomingCall, outgoingCall, activeCall,
      localStream, remoteStream,
      isMuted, isVideoOff,
      startCall, acceptCall, declineCall, endCall,
      toggleMute, toggleVideo,
    }}>
      {children}
    </CallContext.Provider>
  )
}
