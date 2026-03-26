export type Gender = 'Man' | 'Woman'
export type LookingFor = 'Men' | 'Women'

export type UserStatus = 'online' | 'away' | 'busy' | 'dnd' | 'invisible'

export interface Profile {
  id: string
  username: string
  first_name: string
  last_name: string
  age: number
  looking_for: LookingFor
  bio: string | null
  hobbies: string[] | null
  avatar_url: string | null
  gender: Gender
  online: boolean
  status: UserStatus
  created_at: string
}

export type Privacy = 'public' | 'friends' | 'private'

export interface Post {
  id: number
  user_id: string
  content: string
  privacy: Privacy
  created_at: string
  profiles: Profile
  like_count: number
  comment_count: number
  user_liked: boolean
}

export interface PostComment {
  id: number
  post_id: number
  user_id: string
  content: string
  created_at: string
  profiles: Profile
}

export type ConnStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

export interface Message {
  id: number
  conversation_id: number
  sender_id: string
  content: string
  created_at: string
}

export interface ConversationWithPartner {
  id: number
  updated_at: string
  partner: Profile
  last_message: string
  unread_count: number
}
