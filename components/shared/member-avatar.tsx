import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Renders a profile photo or initials fallback.
 * Initials are derived from first + last name, or first two letters of full name.
 */
export function MemberAvatar({
  src,
  fullName,
  firstName,
  lastName,
  size = 'md',
  className,
}: {
  src?: string | null
  fullName: string
  firstName?: string | null
  lastName?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const initials = getInitials(fullName, firstName, lastName)

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }

  const pixelSizes = { xs: 24, sm: 28, md: 36, lg: 48, xl: 64 }

  if (src) {
    return (
      <Image
        src={src}
        alt={fullName}
        width={pixelSizes[size]}
        height={pixelSizes[size]}
        className={cn('rounded-full object-cover shrink-0', sizeClasses[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-brand/10 flex items-center justify-center font-medium text-brand shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  )
}

function getInitials(
  fullName: string,
  firstName?: string | null,
  lastName?: string | null
): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return fullName.slice(0, 2).toUpperCase()
}
