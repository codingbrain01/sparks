import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../context/PresenceContext'
import type { Profile, ConnStatus, Gender, LookingFor } from '../lib/types'
import UserProfileModal from './UserProfileModal'
import Avatar from './Avatar'

type GenderFilter = 'All' | Gender
type LookingForFilter = 'All' | LookingFor

interface Props {
  onStartChat?: (p: Profile) => void
}

export default function ExplorePage({ onStartChat }: Props) {
  const { user } = useAuth()
  const { onlineMap } = usePresence()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [connStatuses, setConnStatuses] = useState<Record<string, ConnStatus>>({})
  const [loading, setLoading] = useState(true)
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null)

  // Filters
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('All')
  const [lookingForFilter, setLookingForFilter] = useState<LookingForFilter>('All')
  const [minAge, setMinAge] = useState(18)
  const [maxAge, setMaxAge] = useState(60)
  const [search, setSearch] = useState('')

  const fetchProfiles = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: connData } = await supabase
      .from('connections')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const excludedIds = new Set<string>([user.id])
    for (const c of connData ?? []) {
      excludedIds.add(c.requester_id)
      excludedIds.add(c.addressee_id)
    }

    let query = supabase
      .from('profiles')
      .select('*')
      .not('id', 'in', `(${[...excludedIds].join(',')})`)
      .gte('age', minAge)
      .lte('age', maxAge)
      .order('online', { ascending: false })

    if (genderFilter !== 'All') query = query.eq('gender', genderFilter)
    if (lookingForFilter !== 'All') query = query.eq('looking_for', lookingForFilter)

    const { data } = await query
    setProfiles(data ?? [])
    setConnStatuses({})
    setLoading(false)
  }, [user, genderFilter, lookingForFilter, minAge, maxAge])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const sendRequest = async (profileId: string) => {
    await supabase.from('connections').insert({
      requester_id: user!.id,
      addressee_id: profileId,
      status: 'pending',
    })
    setConnStatuses((prev) => ({ ...prev, [profileId]: 'pending_sent' }))
  }

  const cancelRequest = async (profileId: string) => {
    await supabase.from('connections').delete()
      .eq('requester_id', user!.id)
      .eq('addressee_id', profileId)
      .eq('status', 'pending')
    setConnStatuses((prev) => ({ ...prev, [profileId]: 'none' }))
  }

  const toggleConnect = (profileId: string, status: ConnStatus) => {
    if (status === 'none') sendRequest(profileId)
    else if (status === 'pending_sent') cancelRequest(profileId)
  }

  const displayed = profiles.filter((p) => {
    if (search === '') return true
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || p.username.toLowerCase().includes(q)
  })

  const viewConnStatus: ConnStatus = viewingProfile
    ? (connStatuses[viewingProfile.id] ?? 'none')
    : 'none'

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-rose-100/60 px-4 pt-4 pb-3 shrink-0">
        <h1 className="text-xl font-bold bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent mb-3">
          Explore
        </h1>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-rose-400"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Gender */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white shrink-0">
            {(['All', 'Man', 'Woman'] as GenderFilter[]).map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  genderFilter === g
                    ? 'bg-linear-to-r from-rose-500 to-pink-400 text-white'
                    : 'text-gray-500 hover:text-rose-500'
                }`}
              >
                {g === 'All' ? 'Any' : g === 'Man' ? '👨 Men' : '👩 Women'}
              </button>
            ))}
          </div>

          {/* Looking for */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white shrink-0">
            {(['All', 'Men', 'Women'] as LookingForFilter[]).map((l) => (
              <button
                key={l}
                onClick={() => setLookingForFilter(l)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  lookingForFilter === l
                    ? 'bg-linear-to-r from-fuchsia-500 to-violet-400 text-white'
                    : 'text-gray-500 hover:text-fuchsia-500'
                }`}
              >
                {l === 'All' ? 'Any pref' : `Seeks ${l}`}
              </button>
            ))}
          </div>

          {/* Age range */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 shrink-0">
            <span className="text-gray-400">Age</span>
            <input
              type="number"
              min={18}
              max={maxAge}
              value={minAge}
              onChange={(e) => setMinAge(Number(e.target.value))}
              className="w-12 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-xs focus:outline-none focus:border-rose-400"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              min={minAge}
              max={100}
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              className="w-12 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-xs focus:outline-none focus:border-rose-400"
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="px-4 py-2 shrink-0">
          <p className="text-xs text-gray-400 font-medium">
            {displayed.length} {displayed.length === 1 ? 'person' : 'people'} found
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-600 font-semibold">No profiles found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayed.map((p) => {
              const status = connStatuses[p.id] ?? 'none'
              const presenceStatus = onlineMap[p.id]
              const isOnline = presenceStatus === 'online' || presenceStatus === 'away'

              return (
                <button
                  key={p.id}
                  onClick={() => setViewingProfile(p)}
                  className="bg-white/90 border border-rose-100/60 rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-lg hover:shadow-rose-100/50 hover:-translate-y-0.5 transition-all group text-center"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar
                      firstName={p.first_name}
                      lastName={p.last_name}
                      gender={p.gender}
                      avatarUrl={p.avatar_url}
                      className="w-16 h-16 rounded-full shadow-sm"
                      textClassName="text-xl font-bold"
                    />
                    {isOnline && (
                      <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Name */}
                  <div className="w-full">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                    <p className={`text-xs font-semibold ${p.gender === 'Man' ? 'text-blue-500' : 'text-pink-500'}`}>
                      {p.age} yrs · {p.gender}
                    </p>
                  </div>

                  {/* Looking for */}
                  <span className="text-xs font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full truncate max-w-full">
                    ❤️ {p.looking_for}
                  </span>

                  {/* Bio snippet */}
                  {p.bio && (
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 w-full">
                      {p.bio}
                    </p>
                  )}

                  {/* Connect button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleConnect(p.id, status) }}
                    disabled={status === 'accepted'}
                    className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-all mt-auto ${
                      status === 'none'
                        ? 'bg-linear-to-r from-rose-500 to-pink-400 text-white hover:shadow-sm hover:shadow-rose-200/60'
                        : status === 'pending_sent'
                        ? 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
                        : 'bg-green-50 text-green-600 cursor-default'
                    }`}
                  >
                    {status === 'none' ? '+ Connect' : status === 'pending_sent' ? 'Cancel' : '✓ Connected'}
                  </button>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Profile modal */}
      {viewingProfile && (
        <UserProfileModal
          profile={viewingProfile}
          connStatus={viewConnStatus}
          onConnect={() => toggleConnect(viewingProfile.id, viewConnStatus)}
          onClose={() => setViewingProfile(null)}
          onMessage={onStartChat && viewConnStatus === 'accepted'
            ? () => { onStartChat(viewingProfile); setViewingProfile(null) }
            : undefined
          }
        />
      )}
    </div>
  )
}
