import { useEffect, useRef, useState, useCallback } from 'react'
import { useCall } from '../context/CallContext'
import Avatar from './Avatar'

// ── Ringtone via Web Audio API (no file needed) ───────────────────────────
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const ring = useCallback(() => {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    let running = true

    const playBurst = (startAt: number) => {
      if (!running) return
      // Two-tone UK-style ring: 400Hz + 450Hz for 0.4s, silence 0.2s, repeat × 2, then 2s silence
      [0, 0.6].forEach((offset) => {
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.frequency.value = 400
        osc2.frequency.value = 450
        gain.gain.value = 0.18
        osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
        const t = startAt + offset
        osc1.start(t); osc2.start(t)
        osc1.stop(t + 0.4); osc2.stop(t + 0.4)
      })
    }

    const schedule = () => {
      if (!running) return
      const now = ctx.currentTime
      playBurst(now)
      // next ring cycle in 2.5s
      setTimeout(() => schedule(), 2500)
    }

    schedule()
    stopRef.current = () => { running = false; ctx.close() }
  }, [])

  useEffect(() => {
    if (active) {
      ring()
    } else {
      stopRef.current?.()
      stopRef.current = null
      ctxRef.current = null
    }
    return () => { stopRef.current?.(); stopRef.current = null }
  }, [active, ring])
}

// Attaches a MediaStream to a <video> element
function VideoEl({
  stream, muted, className,
}: {
  stream: MediaStream | null
  muted?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={!!muted} className={className} />
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function CallOverlay() {
  const {
    incomingCall, outgoingCall, activeCall,
    localStream, remoteStream,
    isMuted, isVideoOff,
    acceptCall, declineCall, endCall, toggleMute, toggleVideo,
  } = useCall()

  const [elapsed, setElapsed] = useState(0)
  const [accepting, setAccepting] = useState(false)
  const [isSpeakerOff, setIsSpeakerOff] = useState(false)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const toggleSpeaker = () => setIsSpeakerOff((v) => !v)

  // Attach remote stream to a hidden audio element — works for both audio and video calls
  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream
  }, [remoteStream])

  // Ring on incoming call
  useRingtone(!!incomingCall)

  // Call timer
  useEffect(() => {
    if (!activeCall) { setElapsed(0); return }
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [activeCall])

  if (!incomingCall && !outgoingCall && !activeCall) return null

  // ── Incoming call ──────────────────────────────────────────────────────────
  if (incomingCall) {
    return (
      <div className="fixed inset-0 z-60 bg-gray-900/98 flex flex-col items-center justify-between py-20 px-6">
        {/* Caller info */}
        <div className="flex flex-col items-center gap-5 mt-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping scale-110" />
            <Avatar
              firstName={incomingCall.callerName.split(' ')[0]}
              lastName={incomingCall.callerName.split(' ')[1] ?? ''}
              gender={incomingCall.callerGender as any}
              avatarUrl={incomingCall.callerAvatar}
              className="w-28 h-28 rounded-full shadow-2xl relative"
              textClassName="text-4xl font-bold"
            />
          </div>
          <div className="text-center">
            <p className="text-white text-2xl font-bold">{incomingCall.callerName}</p>
            <p className="text-gray-400 text-sm mt-1.5 flex items-center gap-1.5 justify-center">
              {incomingCall.type === 'video' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              )}
              Incoming {incomingCall.type} call…
            </p>
          </div>
        </div>

        {/* Accept / Decline */}
        <div className="flex items-center gap-16 mb-8">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={declineCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg"
            >
              <svg className="w-7 h-7 rotate-135" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </button>
            <span className="text-gray-400 text-xs">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              disabled={accepting}
              onClick={async () => { setAccepting(true); await acceptCall(); setAccepting(false) }}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors shadow-lg disabled:opacity-70"
            >
              {accepting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              )}
            </button>
            <span className="text-gray-400 text-xs">Accept</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Outgoing call (ringing) ────────────────────────────────────────────────
  if (outgoingCall) {
    return (
      <div className="fixed inset-0 z-60 bg-gray-900/98 flex flex-col items-center justify-between py-20 px-6">
        <div className="flex flex-col items-center gap-5 mt-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping scale-110" />
            <Avatar
              firstName={outgoingCall.partner.first_name}
              lastName={outgoingCall.partner.last_name}
              gender={outgoingCall.partner.gender}
              avatarUrl={outgoingCall.partner.avatar_url}
              className="w-28 h-28 rounded-full shadow-2xl relative"
              textClassName="text-4xl font-bold"
            />
          </div>
          <div className="text-center">
            <p className="text-white text-2xl font-bold">
              {outgoingCall.partner.first_name} {outgoingCall.partner.last_name}
            </p>
            <p className="text-gray-400 text-sm mt-1.5">
              {outgoingCall.type === 'video' ? 'Video calling…' : 'Calling…'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mb-8">
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg"
          >
            <svg className="w-7 h-7 rotate-135" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
          <span className="text-gray-400 text-xs">Cancel</span>
        </div>
      </div>
    )
  }

  // ── Active call ───────────────────────────────────────────────────────────
  if (activeCall) {
    // Shared controls bar
    const Controls = ({ overlay }: { overlay?: boolean }) => (
      <div className={`flex items-center justify-center gap-5 py-8 ${
        overlay
          ? 'absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-6'
          : 'bg-gray-900'
      }`}>
        {/* Mute mic */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-white text-gray-900' : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
          </button>
          <span className="text-gray-300 text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>

        {/* End call */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg"
          >
            <svg className="w-7 h-7 rotate-135" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
          <span className="text-gray-300 text-xs">End</span>
        </div>

        {/* Speaker (mute remote audio) */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isSpeakerOff ? 'bg-white text-gray-900' : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isSpeakerOff ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M9.172 16.828A4 4 0 016 13V11a4 4 0 013.172-3.828M15.536 8.464A5 5 0 0118 12a5 5 0 01-2.464 3.536" />
              )}
            </svg>
          </button>
          <span className="text-gray-300 text-xs">{isSpeakerOff ? 'Speaker off' : 'Speaker'}</span>
        </div>

        {/* Camera toggle (video only) */}
        {activeCall.type === 'video' && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff ? 'bg-white text-gray-900' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <span className="text-gray-300 text-xs">{isVideoOff ? 'Cam on' : 'Cam off'}</span>
          </div>
        )}
      </div>
    )

    return (
      <div className="fixed inset-0 z-60 bg-gray-900 flex flex-col">

        {/* Hidden audio output — handles speaker for both call types */}
        <audio ref={remoteAudioRef} autoPlay muted={isSpeakerOff} className="hidden" />

        {/* Video call — controls overlaid on video */}
        {activeCall.type === 'video' ? (
          <div className="relative flex-1 bg-black overflow-hidden">
            {/* Remote video muted — audio comes from hidden <audio> element above */}
            <VideoEl stream={remoteStream} muted className="w-full h-full object-cover" />
            {!isVideoOff && (
              <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl bg-gray-800">
                <VideoEl stream={localStream} muted className="w-full h-full object-cover" />
              </div>
            )}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-2xl px-4 py-2">
              <p className="text-white font-semibold text-sm">
                {activeCall.partner.first_name} {activeCall.partner.last_name}
              </p>
              <p className="text-gray-300 text-xs">{fmtTime(elapsed)}</p>
            </div>
            <Controls overlay />
          </div>
        ) : (
          /* Audio call */
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <Avatar
                firstName={activeCall.partner.first_name}
                lastName={activeCall.partner.last_name}
                gender={activeCall.partner.gender}
                avatarUrl={activeCall.partner.avatar_url}
                className="w-28 h-28 rounded-full shadow-2xl"
                textClassName="text-4xl font-bold"
              />
              <div className="text-center">
                <p className="text-white text-2xl font-bold">
                  {activeCall.partner.first_name} {activeCall.partner.last_name}
                </p>
                <p className="text-green-400 text-sm mt-1 font-medium">{fmtTime(elapsed)}</p>
              </div>
            </div>
            <Controls />
          </>
        )}
      </div>
    )
  }

  return null
}
