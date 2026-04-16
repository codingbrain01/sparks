import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import type { Post, PostComment, Profile, ConnStatus, Privacy } from '../lib/types'
import UserProfileModal from './UserProfileModal'
import NotificationPanel from './NotificationPanel'
import Avatar from './Avatar'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function HomePage({ onStartChat }: { onStartChat?: (profile: Profile) => void }) {
  const { user } = useAuth()
  const { count: notifCount } = useNotifications()
  const [showNotifications, setShowNotifications] = useState(false)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editPrivacyId, setEditPrivacyId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const [openComments, setOpenComments] = useState<number | null>(null)
  const [commentsMap, setCommentsMap] = useState<Record<number, PostComment[]>>({})
  const [newComments, setNewComments] = useState<Record<number, string>>({})
  const [submittingComment, setSubmittingComment] = useState(false)

  const [connectionsMap, setConnectionsMap] = useState<Record<string, ConnStatus>>({})
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null)

  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  const fetchPosts = async () => {
    const [{ data: postsData }, { data: userLikes }, { data: conns }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles!user_id(*), like_count:post_likes(count), comment_count:post_comments(count)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('post_likes').select('post_id').eq('user_id', user!.id),
      supabase
        .from('connections')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`),
    ])

    const newConnsMap: Record<string, ConnStatus> = {}
    conns?.forEach((c) => {
      if (c.requester_id === user!.id) {
        newConnsMap[c.addressee_id] = c.status === 'accepted' ? 'accepted' : 'pending_sent'
      } else {
        newConnsMap[c.requester_id] = c.status === 'accepted' ? 'accepted' : 'pending_received'
      }
    })
    setConnectionsMap(newConnsMap)

    const likedSet = new Set(userLikes?.map((l) => l.post_id) ?? [])
    setPosts(
      (postsData ?? []).map((p) => ({
        ...p,
        profiles: p.profiles,
        like_count: (p.like_count as { count: number }[])?.[0]?.count ?? 0,
        comment_count: (p.comment_count as { count: number }[])?.[0]?.count ?? 0,
        user_liked: likedSet.has(p.id),
      })) as Post[]
    )
    setLoading(false)
  }

  useEffect(() => { fetchPosts() }, [user?.id])

  const toggleLike = async (postId: number) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 }
          : p
      )
    )
    if (post.user_liked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user!.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user!.id })
    }
  }

  const toggleComments = async (postId: number) => {
    if (openComments === postId) { setOpenComments(null); return }
    setOpenComments(postId)
    if (!commentsMap[postId]) {
      const { data } = await supabase
        .from('post_comments')
        .select('*, profiles!user_id(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      setCommentsMap((prev) => ({ ...prev, [postId]: (data as PostComment[]) ?? [] }))
    }
  }

  const submitComment = async (postId: number) => {
    const content = newComments[postId]?.trim()
    if (!content) return
    setSubmittingComment(true)
    const { data } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: user!.id, content })
      .select('*, profiles!user_id(*)')
      .single()
    if (data) {
      setCommentsMap((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data as PostComment] }))
      setNewComments((prev) => ({ ...prev, [postId]: '' }))
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)
      )
    }
    setSubmittingComment(false)
  }

  const handleConnect = async (targetUserId: string) => {
    const current = connectionsMap[targetUserId] ?? 'none'
    if (current === 'none') {
      await supabase.from('connections').insert({ requester_id: user!.id, addressee_id: targetUserId })
      setConnectionsMap((prev) => ({ ...prev, [targetUserId]: 'pending_sent' }))
      showToast('💌 Connection request sent!')
    } else if (current === 'pending_sent') {
      await supabase.from('connections').delete()
        .eq('requester_id', user!.id).eq('addressee_id', targetUserId)
      setConnectionsMap((prev) => ({ ...prev, [targetUserId]: 'none' }))
      showToast('Request cancelled')
    } else if (current === 'pending_received') {
      await supabase.from('connections').update({ status: 'accepted' })
        .eq('requester_id', targetUserId).eq('addressee_id', user!.id)
      setConnectionsMap((prev) => ({ ...prev, [targetUserId]: 'accepted' }))
      showToast('🎉 Connection accepted!')
    }
  }

  const submitPost = async () => {
    if (!newPost.trim()) return
    setPosting(true)
    const { error } = await supabase.from('posts').insert({ user_id: user!.id, content: newPost.trim() })
    if (!error) { setNewPost(''); fetchPosts() }
    setPosting(false)
  }

  const startEdit = (post: Post) => { setEditingId(post.id); setEditContent(post.content); setMenuOpenId(null) }
  const cancelEdit = () => { setEditingId(null); setEditContent('') }

  const saveEdit = async (postId: number) => {
    if (!editContent.trim()) return
    await supabase.from('posts').update({ content: editContent.trim() }).eq('id', postId)
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, content: editContent.trim() } : p))
    cancelEdit()
    showToast('Post updated')
  }

  const savePrivacy = async (postId: number, privacy: Privacy) => {
    await supabase.from('posts').update({ privacy }).eq('id', postId)
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, privacy } : p))
    setEditPrivacyId(null)
    setMenuOpenId(null)
    showToast(`Privacy set to ${privacy}`)
  }

  const deletePost = async (postId: number) => {
    await supabase.from('posts').delete().eq('id', postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setDeleteConfirmId(null)
    showToast('Post deleted')
  }

  const connectLabel: Record<ConnStatus, string> = {
    none: 'Connect',
    pending_sent: 'Pending',
    pending_received: 'Accept',
    accepted: '✓',
  }
  const connectStyle = (s: ConnStatus) => {
    if (s === 'accepted') return 'text-emerald-600 border-emerald-200 bg-emerald-50'
    if (s === 'pending_sent') return 'text-gray-400 border-gray-200 bg-gray-50'
    if (s === 'pending_received') return 'text-white border-transparent bg-linear-to-r from-emerald-400 to-teal-400'
    return 'text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100'
  }

  return (
    <div className="min-h-full">

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg sticky top-0 z-10 border-b border-rose-100/60 shadow-[0_2px_20px_rgba(244,63,94,0.08)]">
        <div className="max-w-2xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
              💕 Sparks
            </h1>
            <p className="text-xs lg:text-sm text-gray-400 mt-0.5">Discover people around you</p>
          </div>
          <button
            onClick={() => setShowNotifications(true)}
            className={`md:hidden relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              notifCount > 0
                ? 'bg-linear-to-br from-rose-500 to-pink-400 text-white shadow-md shadow-rose-200'
                : 'text-gray-500 hover:bg-rose-50 hover:text-rose-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white text-rose-500 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}

      <div className="max-w-2xl mx-auto lg:px-4 lg:py-4 lg:space-y-3">

        {/* Compose box */}
        <div className="bg-white/90 backdrop-blur-sm px-4 py-4 border-b border-rose-100/60 lg:border-b-0 lg:rounded-2xl lg:shadow-sm lg:border lg:border-rose-100/60">
          <div className="flex gap-3 items-start">
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-rose-400 to-pink-300 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
              ✍️
            </div>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitPost() }}
              placeholder="What's sparking your interest today? ✨"
              rows={2}
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 resize-none outline-none bg-transparent"
            />
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-rose-50">
            <span className="text-xs text-gray-400">{newPost.length > 0 ? `${newPost.length} chars` : 'Ctrl+Enter to post'}</span>
            <button
              onClick={submitPost}
              disabled={!newPost.trim() || posting}
              className="px-5 py-2 rounded-full bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white text-sm font-semibold shadow-md shadow-rose-200/50 hover:shadow-lg hover:shadow-rose-300/50 transition-all disabled:opacity-50"
            >
              {posting ? 'Posting…' : '✨ Post'}
            </button>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3 select-none">💫</div>
            <p className="font-semibold text-gray-500">No posts yet</p>
            <p className="text-sm mt-1">Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post) => {
            const connStatus = connectionsMap[post.user_id] ?? 'none'
            const isOwn = post.user_id === user?.id
            const commentsOpen = openComments === post.id
            const comments = commentsMap[post.id] ?? []
            const gender = post.profiles.gender

            return (
              <div
                key={post.id}
                className={`bg-white/90 backdrop-blur-sm px-4 py-4 border-b border-rose-100/40 lg:border-b-0 lg:rounded-2xl lg:shadow-sm lg:border lg:border-rose-100/60 relative ${menuOpenId === post.id || editPrivacyId === post.id || deleteConfirmId === post.id ? 'z-20' : 'z-0'}`}
              >
                {/* Gender accent strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b ${gender === 'Man' ? 'from-blue-400 to-indigo-300' : 'from-rose-400 to-pink-300'}`} />

                {/* Post header */}
                <div className="flex items-center gap-3 mb-3 pl-2">
                  <button
                    onClick={() => !isOwn && setViewingProfile(post.profiles)}
                    className={`shrink-0 ${!isOwn ? 'cursor-pointer hover:opacity-90 hover:scale-105 transition-all' : 'cursor-default'}`}
                  >
                    <Avatar
                      firstName={post.profiles.first_name}
                      lastName={post.profiles.last_name}
                      gender={post.profiles.gender}
                      avatarUrl={post.profiles.avatar_url}
                      className="w-11 h-11 lg:w-12 lg:h-12 rounded-full shadow-md"
                      textClassName="font-bold text-sm"
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => !isOwn && setViewingProfile(post.profiles)}
                        className={`font-semibold text-gray-900 text-sm lg:text-base ${!isOwn ? 'hover:text-rose-500 transition-colors cursor-pointer' : 'cursor-default'}`}
                      >
                        {post.profiles.first_name} {post.profiles.last_name}
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        gender === 'Man' ? 'bg-blue-50 text-blue-500' : 'bg-pink-50 text-pink-500'
                      }`}>
                        {post.profiles.age}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <button
                        onClick={() => !isOwn && setViewingProfile(post.profiles)}
                        className={`${!isOwn ? 'hover:text-rose-400 transition-colors cursor-pointer' : 'cursor-default'}`}
                      >
                        @{post.profiles.username}
                      </button>
                      <span>·</span>
                      <span>{timeAgo(post.created_at)}</span>
                      {isOwn && (
                        <>
                          <span>·</span>
                          <span title={post.privacy}>
                            {post.privacy === 'private' ? '🔒' : post.privacy === 'friends' ? '👥' : '🌐'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Connect button */}
                  {!isOwn && (
                    <button
                      onClick={() => handleConnect(post.user_id)}
                      disabled={connStatus === 'accepted'}
                      className={`px-3 py-1.5 text-xs font-semibold border rounded-full transition-all shrink-0 ${connectStyle(connStatus)}`}
                    >
                      {connectLabel[connStatus]}
                    </button>
                  )}

                  {/* Three-dot menu */}
                  {isOwn && (
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                      {menuOpenId === post.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                          <div className="absolute right-0 top-9 w-44 bg-white rounded-2xl shadow-xl border border-rose-100 z-20 overflow-hidden">
                            <button
                              onClick={() => startEdit(post)}
                              className="w-full px-4 py-3 text-sm text-left text-gray-700 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                            >
                              <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Post
                            </button>
                            <button
                              onClick={() => { setEditPrivacyId(post.id); setMenuOpenId(null) }}
                              className="w-full px-4 py-3 text-sm text-left text-gray-700 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                            >
                              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Edit Privacy
                              <span className="ml-auto text-xs text-gray-400 capitalize">{post.privacy}</span>
                            </button>
                            <div className="border-t border-gray-100" />
                            <button
                              onClick={() => { setDeleteConfirmId(post.id); setMenuOpenId(null) }}
                              className="w-full px-4 py-3 text-sm text-left text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete Post
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit post */}
                {editingId === post.id ? (
                  <div className="mb-3 pl-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full border-2 border-rose-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-none outline-none focus:border-rose-400 transition-colors"
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button onClick={cancelEdit} className="px-4 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(post.id)}
                        disabled={!editContent.trim()}
                        className="px-4 py-1.5 text-xs text-white bg-linear-to-r from-rose-500 to-pink-400 rounded-lg shadow-sm disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 text-sm lg:text-base leading-relaxed mb-3 pl-2">{post.content}</p>
                )}

                {/* Edit privacy */}
                {editPrivacyId === post.id && (
                  <>
                  <div className="fixed inset-0 z-10" onClick={() => setEditPrivacyId(null)} />
                  <div className="relative z-20 mb-3 p-3 bg-violet-50/60 rounded-2xl pl-2">
                    <p className="text-xs font-semibold text-violet-600 mb-2">Who can see this post?</p>
                    <div className="flex gap-2">
                      {(['public', 'friends', 'private'] as Privacy[]).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => savePrivacy(post.id, opt)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                            post.privacy === opt
                              ? 'bg-linear-to-r from-violet-500 to-purple-400 text-white shadow-sm'
                              : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300'
                          }`}
                        >
                          {opt === 'public' ? '🌐' : opt === 'friends' ? '👥' : '🔒'} {opt}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setEditPrivacyId(null)} className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors">
                      Cancel
                    </button>
                  </div>
                  </>
                )}

                {/* Delete confirm */}
                {deleteConfirmId === post.id && (
                  <>
                  <div className="fixed inset-0 z-10" onClick={() => setDeleteConfirmId(null)} />
                  <div className="relative z-20 mb-3 p-3 bg-red-50 rounded-2xl flex items-center justify-between gap-3">
                    <p className="text-sm text-red-600 font-medium">Delete this post?</p>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => deletePost(post.id)} className="px-3 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex items-center gap-5 pl-2">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-all ${
                      post.user_liked ? 'text-rose-500 scale-110' : 'text-gray-400 hover:text-rose-400'
                    }`}
                  >
                    <svg className="w-5 h-5" fill={post.user_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span>{post.like_count}</span>
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      commentsOpen ? 'text-violet-500' : 'text-gray-400 hover:text-violet-400'
                    }`}
                  >
                    <svg className="w-5 h-5" fill={commentsOpen ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{post.comment_count}</span>
                  </button>
                </div>

                {/* Comments */}
                {commentsOpen && (
                  <div className="mt-3 pt-3 border-t border-rose-50 pl-2">
                    {comments.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">No comments yet — be the first! 💬</p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {comments.map((c) => (
                          <div key={c.id} className="flex items-start gap-2">
                            <Avatar
                              firstName={c.profiles.first_name}
                              lastName={c.profiles.last_name}
                              gender={c.profiles.gender}
                              avatarUrl={c.profiles.avatar_url}
                              className="w-7 h-7 rounded-full shrink-0 mt-0.5 shadow-sm"
                              textClassName="text-xs font-bold"
                            />
                            <div className="flex-1 min-w-0 bg-rose-50/60 rounded-xl px-3 py-2">
                              <span className="text-xs font-semibold text-gray-700 mr-1">
                                {c.profiles.first_name} {c.profiles.last_name}
                              </span>
                              <span className="text-xs text-gray-600">{c.content}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newComments[post.id] ?? ''}
                        onChange={(e) => setNewComments((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                        placeholder="Write a comment…"
                        className="flex-1 bg-rose-50/60 border border-rose-100 rounded-full px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-rose-200 transition-shadow"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={!newComments[post.id]?.trim() || submittingComment}
                        className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-purple-400 flex items-center justify-center text-white shrink-0 disabled:opacity-50 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {viewingProfile && (
        <UserProfileModal
          profile={viewingProfile}
          connStatus={connectionsMap[viewingProfile.id] ?? 'none'}
          onConnect={() => handleConnect(viewingProfile.id)}
          onClose={() => setViewingProfile(null)}
          onMessage={onStartChat ? () => { onStartChat(viewingProfile); setViewingProfile(null) } : undefined}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-linear-to-r from-gray-900 to-gray-800 text-white text-sm px-5 py-2.5 rounded-full shadow-xl z-50 whitespace-nowrap border border-white/10">
          {toast}
        </div>
      )}
    </div>
  )
}
