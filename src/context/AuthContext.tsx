import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile, Gender } from '../lib/types'

interface SignUpData {
  email: string
  password: string
  username: string
  firstName: string
  lastName: string
  age: number
  gender: Gender
  lookingFor: 'Men' | 'Women'
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (data: SignUpData) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      setProfile(data as Profile)
      return
    }

    // Profile row missing (trigger failed) — create it from auth metadata
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const meta = user.user_metadata ?? {}
    const { data: created } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username: meta.username || `user_${userId.slice(0, 8)}`,
        first_name: meta.first_name || '',
        last_name: meta.last_name || '',
        age: meta.age || 18,
        gender: meta.gender || 'Man',
        looking_for: meta.looking_for || 'Women',
      })
      .select()
      .maybeSingle()

    if (created) setProfile(created as Profile)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async ({ email, password, username, firstName, lastName, age, gender, lookingFor }: SignUpData) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          first_name: firstName,
          last_name: lastName,
          age,
          gender,
          looking_for: lookingFor,
        },
      },
    })
    return { error: error?.message ?? null }
  }

  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    // Small visual buffer so the transition doesn't feel jarringly instant.
    await new Promise((r) => setTimeout(r, 600))
    setUser(null)
    setProfile(null)
    setSigningOut(false)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
      {signingOut && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
            <p className="text-base font-medium text-gray-700">Logging out…</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
