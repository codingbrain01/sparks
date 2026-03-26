import type { UserStatus } from '../lib/types'

export const STATUS_META: Record<UserStatus, { label: string; color: string; ring: string }> = {
  online:    { label: 'Online',           color: 'bg-green-400',  ring: '' },
  away:      { label: 'Away',             color: 'bg-yellow-400', ring: '' },
  busy:      { label: 'Busy',             color: 'bg-red-500',    ring: '' },
  dnd:       { label: 'Do Not Disturb',   color: 'bg-red-500',    ring: 'ring-2 ring-white ring-offset-[-2px]' },
  invisible: { label: 'Invisible',        color: 'bg-gray-400',   ring: '' },
}

interface Props {
  status: UserStatus
  size?: 'sm' | 'md' | 'lg'
  border?: boolean
}

const sizes = { sm: 'w-2.5 h-2.5', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' }

export default function StatusDot({ status, size = 'sm', border = true }: Props) {
  const { color, ring } = STATUS_META[status]
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${sizes[size]} ${color} ${ring} ${border ? 'border-2 border-white' : ''}`}
    />
  )
}
