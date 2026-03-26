import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Gender, LookingFor, Post, PostComment, Privacy, Profile } from '../lib/types'
import Avatar from './Avatar'

function genderGradient(gender?: Gender) {
  return gender === 'Man'
    ? 'from-blue-500 to-indigo-400'
    : 'from-rose-500 to-pink-400'
}
function genderGradientLight(gender?: Gender) {
  return gender === 'Man'
    ? 'from-blue-400 to-indigo-300'
    : 'from-rose-400 to-pink-300'
}
import UserProfileModal from './UserProfileModal'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const PRIVACY_ICON: Record<Privacy, string> = { public: '🌐', friends: '👥', private: '🔒' }


const ALL_HOBBIES = [
  'Hiking', 'Cooking', 'Photography', 'Reading', 'Yoga',
  'Gaming', 'Travel', 'Music', 'Art', 'Fitness',
  'Dancing', 'Movies', 'Cycling', 'Swimming', 'Coffee',
]

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-300 transition-shadow'

interface Draft {
  username: string
  firstName: string
  lastName: string
  age: number
  lookingFor: LookingFor
  bio: string
  hobbies: string[]
}

export default function ProfilePage({ onStartChat }: { onStartChat?: (profile: Profile) => void }) {
  const { profile, refreshProfile, signOut } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Connections
  const [connections, setConnections] = useState<Profile[]>([])
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null)

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const uploadPhoto = async (file: File) => {
    if (!profile) return
    setUploadingPhoto(true)
    const path = `${profile.id}/avatar`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('id', profile.id)
      await refreshProfile()
    }
    setUploadingPhoto(false)
  }

  const removePhoto = async () => {
    if (!profile?.avatar_url) return
    setUploadingPhoto(true)
    await supabase.storage.from('avatars').remove([`${profile.id}/avatar`])
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
    await refreshProfile()
    setUploadingPhoto(false)
  }

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const deleteAccount = async () => {
    setDeletingAccount(true)
    await supabase.rpc('delete_own_account')
    signOut()
  }

  // My posts
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editPrivacyId, setEditPrivacyId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Post detail modal
  const [viewingPost, setViewingPost] = useState<Post | null>(null)
  const [postComments, setPostComments] = useState<PostComment[]>([])
  const [postCommentsLoading, setPostCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  const profileToDraft = (): Draft => ({
    username: profile?.username ?? '',
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    age: profile?.age ?? 18,
    lookingFor: (profile?.looking_for ?? 'Women') as LookingFor,
    bio: profile?.bio ?? '',
    hobbies: profile?.hobbies ?? [],
  })

  const [draft, setDraft] = useState<Draft>(profileToDraft)

  // Sync draft when profile loads from Supabase
  useEffect(() => {
    if (profile) setDraft(profileToDraft())
  }, [profile])

  const toggleHobby = (hobby: string) => {
    setDraft((prev) => ({
      ...prev,
      hobbies: prev.hobbies.includes(hobby)
        ? prev.hobbies.filter((h) => h !== hobby)
        : [...prev.hobbies, hobby],
    }))
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    setSaveError('')
    const { error } = await supabase
      .from('profiles')
      .update({
        username: draft.username,
        first_name: draft.firstName,
        last_name: draft.lastName,
        age: draft.age,
        looking_for: draft.lookingFor,
        bio: draft.bio,
        hobbies: draft.hobbies,
      })
      .eq('id', profile.id)

    if (error) {
      setSaveError(error.message)
    } else {
      await refreshProfile()
      setEditing(false)
    }
    setSaving(false)
  }

  const cancelEdit = () => {
    setDraft(profileToDraft())
    setSaveError('')
    setEditing(false)
  }

  // ── Connections ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const [{ data: sent }, { data: received }] = await Promise.all([
        supabase.from('connections').select('profiles!addressee_id(*)').eq('requester_id', profile.id).eq('status', 'accepted'),
        supabase.from('connections').select('profiles!requester_id(*)').eq('addressee_id', profile.id).eq('status', 'accepted'),
      ])
      const profiles = [
        ...((sent ?? []).map((r: any) => r.profiles)),
        ...((received ?? []).map((r: any) => r.profiles)),
      ].filter(Boolean) as Profile[]
      setConnections(profiles)
    }
    load()
  }, [profile?.id])

  // ── My posts ────────────────────────────────────────────────────────────
  const fetchMyPosts = async () => {
    if (!profile) return
    setPostsLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*, profiles!user_id(*), like_count:post_likes(count), comment_count:post_comments(count)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setPosts(
      (data ?? []).map((p) => ({
        ...p,
        like_count: (p.like_count as { count: number }[])?.[0]?.count ?? 0,
        comment_count: (p.comment_count as { count: number }[])?.[0]?.count ?? 0,
        user_liked: false,
      })) as Post[]
    )
    setPostsLoading(false)
  }

  useEffect(() => { if (profile) fetchMyPosts() }, [profile?.id])

  const savePostEdit = async (postId: number) => {
    if (!editContent.trim()) return
    await supabase.from('posts').update({ content: editContent.trim() }).eq('id', postId)
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, content: editContent.trim() } : p))
    setEditingPostId(null)
    setEditContent('')
  }

  const savePrivacy = async (postId: number, privacy: Privacy) => {
    await supabase.from('posts').update({ privacy }).eq('id', postId)
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, privacy } : p))
    setEditPrivacyId(null)
    setMenuOpenId(null)
  }

  const deletePost = async (postId: number) => {
    await supabase.from('posts').delete().eq('id', postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setDeleteConfirmId(null)
  }

  const openPost = async (post: Post) => {
    setViewingPost(post)
    setPostCommentsLoading(true)
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles!user_id(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setPostComments((data ?? []) as PostComment[])
    setPostCommentsLoading(false)
  }

  const addComment = async () => {
    if (!newComment.trim() || !viewingPost || !profile) return
    setAddingComment(true)
    const { data } = await supabase
      .from('post_comments')
      .insert({ post_id: viewingPost.id, user_id: profile.id, content: newComment.trim() })
      .select('*, profiles!user_id(*)')
      .single()
    if (data) {
      setPostComments((prev) => [...prev, data as PostComment])
      setPosts((prev) => prev.map((p) =>
        p.id === viewingPost.id ? { ...p, comment_count: p.comment_count + 1 } : p
      ))
      setViewingPost((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev)
    }
    setNewComment('')
    setAddingComment(false)
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
    <div className="min-h-full pb-8">

      {/* ── Banner ── */}
      <div className={`bg-linear-to-br ${genderGradient(profile.gender)} pt-10 lg:pt-14 pb-20 px-4 relative`}>
        <div className="max-w-3xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-white text-xl lg:text-2xl font-bold">My Profile</h1>
            <p className="text-rose-100 text-xs lg:text-sm mt-0.5">
              Update your info to find better matches
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors backdrop-blur-sm"
              >
                Edit Profile
              </button>
            )}
            {/* Sign out — mobile only (desktop has sidebar) */}
            <button
              onClick={signOut}
              title="Sign out"
              className="md:hidden bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-full border-4 border-white shadow-xl overflow-hidden">
              <Avatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                gender={profile.gender}
                avatarUrl={profile.avatar_url}
                className="w-full h-full rounded-full"
                textClassName="text-3xl font-bold"
              />
            </div>
            {/* Camera button */}
            <label className="absolute -bottom-0.5 -right-0.5 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:bg-rose-50 transition-colors border border-rose-100">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }}
              />
              {uploadingPhoto ? (
                <div className="w-4 h-4 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mt-16 px-4 max-w-3xl mx-auto lg:px-0">

        {editing ? (
          /* ══ Edit form ══ */
          <div className="space-y-4">

            {/* Personal info */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal Info</p>

              {/* Photo management */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-rose-100 shrink-0">
                  <Avatar
                    firstName={profile.first_name}
                    lastName={profile.last_name}
                    gender={profile.gender}
                    avatarUrl={profile.avatar_url}
                    className="w-full h-full rounded-full"
                    textClassName="text-base font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cursor-pointer text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }}
                    />
                    {uploadingPhoto ? 'Uploading…' : profile.avatar_url ? 'Change photo' : 'Upload photo'}
                  </label>
                  {profile.avatar_url && !uploadingPhoto && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors text-left"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Username</label>
                <input
                  value={draft.username}
                  onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))}
                  className={inputClass} placeholder="username"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">First Name</label>
                  <input
                    value={draft.firstName}
                    onChange={(e) => setDraft((p) => ({ ...p, firstName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Last Name</label>
                  <input
                    value={draft.lastName}
                    onChange={(e) => setDraft((p) => ({ ...p, lastName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="lg:w-1/3">
                <label className="text-xs text-gray-400 mb-1 block">Age</label>
                <input
                  type="number" min={18} max={100}
                  value={draft.age}
                  onChange={(e) => setDraft((p) => ({ ...p, age: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Looking for + Bio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Looking For</p>
                <div className="flex gap-3">
                  {(['Men', 'Women'] as LookingFor[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setDraft((p) => ({ ...p, lookingFor: opt }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        draft.lookingFor === opt
                          ? 'bg-linear-to-r from-rose-500 to-pink-400 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {opt === 'Men' ? '👨 Men' : '👩 Women'}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bio / About Me</p>
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                rows={4} placeholder="Tell others about yourself…"
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Hobbies */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hobbies</p>
              <div className="flex flex-wrap gap-2">
                {ALL_HOBBIES.map((hobby) => (
                  <button
                    key={hobby} onClick={() => toggleHobby(hobby)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      draft.hobbies.includes(hobby)
                        ? 'bg-linear-to-r from-rose-500 to-pink-400 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {hobby}
                  </button>
                ))}
              </div>
            </div>

            {saveError && <p className="text-xs text-rose-500 text-center">{saveError}</p>}

            {/* Danger zone */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-red-100">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Danger Zone</p>
              <p className="text-sm text-gray-500 mb-4">Permanently delete your account and all your data. This cannot be undone.</p>
              <button
                onClick={() => setShowDeleteAccount(true)}
                className="px-4 py-2.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                Delete My Account
              </button>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3 lg:justify-end">
              <button
                onClick={cancelEdit}
                className="flex-1 lg:flex-none lg:px-8 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile} disabled={saving}
                className="flex-1 lg:flex-none lg:px-8 py-3 rounded-xl bg-linear-to-r from-rose-500 to-pink-400 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-shadow disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>

        ) : (
          /* ══ View mode ══ */
          <div className="space-y-4">

            {/* Name / username */}
            <div className="text-center">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {profile.username} · <span className={`font-semibold ${profile.gender === 'Man' ? 'text-blue-500' : 'text-pink-500'}`}>{profile.age} years old</span>
              </p>
            </div>

            {/* Info cards — 2 cols on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-2xl shrink-0">
                  {profile.gender === 'Man' ? '👨' : '👩'}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Gender</p>
                  <p className="text-gray-900 font-semibold mt-0.5">{profile.gender}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-rose-50 flex items-center justify-center text-2xl shrink-0">
                  {profile.looking_for === 'Men' ? '👨' : '👩'}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Looking For</p>
                  <p className="text-gray-900 font-semibold mt-0.5">{profile.looking_for}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60 flex items-center gap-3 lg:col-span-2">
                <div className="w-11 h-11 rounded-full bg-pink-50 flex items-center justify-center text-2xl shrink-0">
                  🪪
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Full Name</p>
                  <p className="text-gray-900 font-semibold mt-0.5">{profile.first_name} {profile.last_name}</p>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About Me</p>
              <p className="text-gray-700 text-sm lg:text-base leading-relaxed whitespace-pre-line">
                {profile.bio || 'No bio yet. Tap Edit Profile to add one!'}
              </p>
            </div>

            {/* Hobbies */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-rose-100/60">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hobbies</p>
              {(profile.hobbies ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">No hobbies added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(profile.hobbies ?? []).map((hobby) => (
                    <span key={hobby} className="px-3 py-1.5 bg-rose-50 text-rose-500 rounded-full text-sm font-medium">
                      {hobby}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Connections */}
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="px-4 lg:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Connections</p>
                <span className="text-xs text-gray-400">{connections.length} connected</span>
              </div>
              {connections.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-3xl mb-2">🤝</p>
                  <p className="text-sm text-gray-400">No connections yet. Connect with people on the home feed!</p>
                </div>
              ) : (
                <div className="p-4 lg:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {connections.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => setViewingProfile(conn)}
                      className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 transition-colors text-center"
                    >
                      <Avatar
                        firstName={conn.first_name}
                        lastName={conn.last_name}
                        gender={conn.gender}
                        avatarUrl={conn.avatar_url}
                        className="w-12 h-12 rounded-full shrink-0"
                        textClassName="text-sm font-bold"
                      />
                      <div className="min-w-0 w-full">
                        <p className="text-sm font-semibold text-gray-900 truncate">{conn.first_name} {conn.last_name}</p>
                        <p className="text-xs text-gray-400 truncate">@{conn.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* My Posts */}
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="px-4 lg:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">My Posts</p>
                <span className="text-xs text-gray-400">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
              </div>

              {postsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-3xl mb-2">✍️</p>
                  <p className="text-sm text-gray-400">No posts yet. Share something on the home feed!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => editingPostId !== post.id && openPost(post)}
                      className="px-4 lg:px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    >

                      {/* Post header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{PRIVACY_ICON[post.privacy as Privacy ?? 'public']}</span>
                          <span>{timeAgo(post.created_at)}</span>
                        </div>
                        {/* Three-dot menu */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                            </svg>
                          </button>
                          {menuOpenId === post.id && (
                            <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                              <button
                                onClick={() => { setEditingPostId(post.id); setEditContent(post.content); setMenuOpenId(null) }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              >Edit</button>
                              <button
                                onClick={() => { setEditPrivacyId(post.id); setMenuOpenId(null) }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              >Change Privacy</button>
                              <button
                                onClick={() => { setDeleteConfirmId(post.id); setMenuOpenId(null) }}
                                className="w-full text-left px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50"
                              >Delete</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content / edit inline */}
                      {editingPostId === post.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setEditingPostId(null); setEditContent('') }}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            >Cancel</button>
                            <button
                              onClick={() => savePostEdit(post.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
                            >Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                          {post.content}
                        </p>
                      )}

                      {/* Privacy picker */}
                      {editPrivacyId === post.id && (
                        <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {(['public', 'friends', 'private'] as Privacy[]).map((p) => (
                            <button
                              key={p}
                              onClick={() => savePrivacy(post.id, p)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                post.privacy === p
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {PRIVACY_ICON[p]} {p}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Delete confirm */}
                      {deleteConfirmId === post.id && (
                        <div className="mt-2 flex gap-2 items-center bg-rose-50 rounded-xl px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs text-rose-600 flex-1">Delete this post?</p>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                          >Cancel</button>
                          <button
                            onClick={() => deletePost(post.id)}
                            className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1 rounded-lg transition-colors"
                          >Delete</button>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex gap-4 mt-3 text-xs text-gray-400">
                        <span>❤️ {post.like_count}</span>
                        <span>💬 {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>

    {viewingProfile && (
      <UserProfileModal
        profile={viewingProfile}
        connStatus="accepted"
        onConnect={() => {}}
        onClose={() => setViewingProfile(null)}
        onMessage={onStartChat ? () => { onStartChat(viewingProfile); setViewingProfile(null) } : undefined}
      />
    )}

    {/* ── Post detail modal ── */}
    {viewingPost && (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setViewingPost(null); setNewComment('') }} />
        <div className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{PRIVACY_ICON[viewingPost.privacy as Privacy ?? 'public']}</span>
              <span>{timeAgo(viewingPost.created_at)}</span>
            </div>
            <button
              onClick={() => { setViewingPost(null); setNewComment('') }}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Post content */}
          <div className="px-5 pb-4 shrink-0">
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{viewingPost.content}</p>
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span>❤️ {viewingPost.like_count}</span>
              <span>💬 {viewingPost.comment_count}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 mx-5 shrink-0" />

          {/* Comments */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {postCommentsLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
              </div>
            ) : postComments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No comments yet — be the first!</p>
            ) : (
              postComments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Avatar
                    firstName={c.profiles.first_name}
                    lastName={c.profiles.last_name}
                    gender={c.profiles.gender}
                    avatarUrl={c.profiles.avatar_url}
                    className="w-8 h-8 rounded-full shrink-0 mt-0.5"
                    textClassName="text-xs font-bold"
                  />
                  <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                    <p className="text-xs font-semibold text-gray-800">{c.profiles.first_name} {c.profiles.last_name}</p>
                    <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add comment */}
          <div className="border-t border-gray-100 px-4 py-3 shrink-0 flex items-center gap-2">
            <Avatar
              firstName={profile.first_name}
              lastName={profile.last_name}
              gender={profile.gender}
              avatarUrl={profile.avatar_url}
              className="w-8 h-8 rounded-full shrink-0"
              textClassName="text-xs font-bold"
            />
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addComment()}
              placeholder="Add a comment…"
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-rose-300 transition-shadow"
            />
            <button
              onClick={addComment}
              disabled={!newComment.trim() || addingComment}
              className="w-8 h-8 rounded-full bg-linear-to-r from-rose-500 to-pink-400 flex items-center justify-center text-white disabled:opacity-40 shrink-0 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )}

    {showDeleteAccount && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deletingAccount && setShowDeleteAccount(false)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Delete account?</h3>
          <p className="text-sm text-gray-500 text-center mb-6">
            This will permanently delete your profile, posts, connections, and messages. <span className="font-semibold text-gray-700">There is no going back.</span>
          </p>
          <div className="space-y-2.5">
            <button
              onClick={deleteAccount}
              disabled={deletingAccount}
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {deletingAccount ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button
              onClick={() => setShowDeleteAccount(false)}
              disabled={deletingAccount}
              className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {deletingAccount && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
              <div className="w-6 h-6 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}
