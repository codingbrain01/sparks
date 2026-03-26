import type { Gender } from '../lib/types'

interface Props {
  firstName: string
  lastName: string
  gender?: Gender
  avatarUrl?: string | null
  /** Applied to both the <img> and the fallback div — include size + rounded classes here */
  className?: string
  textClassName?: string
}

function gradient(gender?: Gender) {
  return gender === 'Man' ? 'from-blue-500 to-indigo-400' : 'from-rose-500 to-pink-400'
}

export default function Avatar({
  firstName,
  lastName,
  gender,
  avatarUrl,
  className = '',
  textClassName = 'text-sm font-bold',
}: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName} ${lastName}`}
        className={`object-cover ${className}`}
      />
    )
  }

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()

  return (
    <div className={`bg-linear-to-br ${gradient(gender)} flex items-center justify-center text-white ${className}`}>
      <span className={textClassName}>{initials}</span>
    </div>
  )
}
