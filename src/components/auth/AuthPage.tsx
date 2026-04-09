import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Gender, LookingFor } from '../../lib/types'

type Mode = 'login' | 'signup'

const STEP_LABELS = ['Account', 'Profile', 'Preferences']

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState<number>(18)
  const [gender, setGender] = useState<Gender>('Man')
  const [lookingFor, setLookingFor] = useState<LookingFor>('Women')

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const switchMode = (m: Mode) => {
    setMode(m); setError(''); setConfirmPassword(''); setStep(1)
  }

  const canAdvance = () => {
    if (step === 1) return email.length > 0 && password.length >= 6 && confirmPassword.length > 0 && !passwordMismatch
    if (step === 2) return firstName.length > 0 && lastName.length > 0 && username.length > 0 && age >= 18
    return true
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  const handleSignup = async () => {
    setLoading(true)
    setError('')
    const { error } = await signUp({ email, password, username, firstName, lastName, age, gender, lookingFor })
    if (error) setError(error)
    else setError('✅ Check your email to confirm your account, then sign in.')
    setLoading(false)
  }

  const inputClass =
    'w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-500 outline-none focus:ring-0 focus:border-rose-400 transition-colors'

  return (
    <div className="min-h-screen w-screen bg-linear-to-br from-rose-50 via-pink-50 to-fuchsia-50 flex items-start sm:items-center justify-center p-0 sm:p-6 lg:p-10">
      <div className="w-full sm:max-w-md lg:max-w-lg bg-white sm:rounded-3xl shadow-none sm:shadow-xl overflow-hidden">

        {/* Banner */}
        <div className="bg-linear-to-r from-rose-500 to-pink-400 px-6 sm:px-8 pt-10 sm:pt-8 pb-6 text-center relative">
          {window.location.protocol === 'file:' && (
            <button
              onClick={() => (window as any).electronAPI?.closeApp()}
              title="Exit app"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 select-none">💕</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Sparks</h1>
          <p className="text-rose-100 text-sm sm:text-base mt-1">Find your spark today</p>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-semibold transition-all ${
                  mode === m ? 'bg-white text-rose-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* ── Login ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
              <input
                type="email" placeholder="Email address" value={email} required
                onChange={(e) => setEmail(e.target.value)} className={inputClass}
              />
              <input
                type="password" placeholder="Password" value={password} required
                onChange={(e) => setPassword(e.target.value)} className={inputClass}
              />
              {error && <p className="text-sm text-rose-500 text-center">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-3 sm:py-3.5 rounded-xl bg-linear-to-r from-rose-500 to-pink-400 text-white font-semibold text-base shadow-sm hover:shadow-md transition-shadow disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── Signup ── */}
          {mode === 'signup' && (
            <div>
              {/* Step indicator */}
              <div className="flex items-center justify-center mb-6">
                {STEP_LABELS.map((label, i) => {
                  const s = i + 1
                  const done = s < step
                  const active = s === step
                  return (
                    <div key={s} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          done    ? 'bg-rose-500 text-white' :
                          active  ? 'bg-rose-500 text-white ring-4 ring-rose-100' :
                                    'bg-gray-100 text-gray-400'
                        }`}>
                          {done ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : s}
                        </div>
                        <span className={`text-xs font-medium hidden sm:block ${active ? 'text-rose-500' : 'text-gray-400'}`}>
                          {label}
                        </span>
                      </div>
                      {s < 3 && (
                        <div className={`h-0.5 w-10 sm:w-16 mx-1 mb-4 sm:mb-5 transition-all ${done ? 'bg-rose-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              <form onSubmit={(e) => e.preventDefault()}>

                {/* Step 1 — Account */}
                {step === 1 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">Email address</label>
                      <input
                        type="email" placeholder="you@example.com" value={email} required
                        onChange={(e) => setEmail(e.target.value)} className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">Password</label>
                      <input
                        type="password" placeholder="At least 6 characters" value={password}
                        required minLength={6} onChange={(e) => setPassword(e.target.value)} className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">Confirm password</label>
                      <input
                        type="password" placeholder="Repeat your password" value={confirmPassword}
                        required onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`${inputClass} ${passwordMismatch ? 'border-rose-400' : ''}`}
                      />
                      {passwordMismatch && (
                        <p className="text-sm text-rose-500 mt-1.5 px-1">Passwords don't match</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2 — Profile */}
                {step === 2 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">First name</label>
                        <input
                          placeholder="Alex" value={firstName} required
                          onChange={(e) => setFirstName(e.target.value)} className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">Last name</label>
                        <input
                          placeholder="Morgan" value={lastName} required
                          onChange={(e) => setLastName(e.target.value)} className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">Username</label>
                      <input
                        placeholder="alex_morgan" value={username} required
                        onChange={(e) => setUsername(e.target.value)} className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">Age</label>
                      <input
                        type="number" placeholder="18" min={18} max={100} value={age} required
                        onChange={(e) => setAge(Number(e.target.value))} className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {/* Step 3 — Preferences */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3 px-1">I am a</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['Man', 'Woman'] as Gender[]).map((opt) => (
                          <button
                            key={opt} type="button" onClick={() => setGender(opt)}
                            className={`py-4 rounded-2xl font-semibold transition-all flex flex-col items-center gap-1.5 border-2 ${
                              gender === opt
                                ? 'bg-linear-to-br from-rose-500 to-pink-400 text-white border-transparent shadow-md'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:bg-rose-50'
                            }`}
                          >
                            <span className="text-3xl">{opt === 'Man' ? '👨' : '👩'}</span>
                            <span className="text-base">{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3 px-1">Looking for</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['Men', 'Women'] as LookingFor[]).map((opt) => (
                          <button
                            key={opt} type="button" onClick={() => setLookingFor(opt)}
                            className={`py-4 rounded-2xl font-semibold transition-all flex flex-col items-center gap-1.5 border-2 ${
                              lookingFor === opt
                                ? 'bg-linear-to-br from-rose-500 to-pink-400 text-white border-transparent shadow-md'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:bg-rose-50'
                            }`}
                          >
                            <span className="text-3xl">{opt === 'Men' ? '👨' : '👩'}</span>
                            <span className="text-base">{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <p className={`text-sm text-center ${error.startsWith('✅') ? 'text-green-600' : 'text-rose-500'}`}>
                        {error}
                      </p>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <div className={`flex gap-3 mt-6 ${step === 1 ? 'mb-4 sm:mb-0' : ''}`}>
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className="px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-base hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={() => canAdvance() && setStep((s) => s + 1)}
                      disabled={!canAdvance()}
                      className="flex-1 py-3 sm:py-3.5 rounded-xl bg-linear-to-r from-rose-500 to-pink-400 text-white font-semibold text-base shadow-sm hover:shadow-md transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSignup}
                      disabled={loading}
                      className="flex-1 py-3 sm:py-3.5 rounded-xl bg-linear-to-r from-rose-500 to-pink-400 text-white font-semibold text-base shadow-sm hover:shadow-md transition-shadow disabled:opacity-60 mb-4 sm:mb-0"
                    >
                      {loading ? 'Creating account…' : 'Create Account'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
