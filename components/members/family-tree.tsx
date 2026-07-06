'use client'

import Link from 'next/link'
import { MemberAvatar } from '@/components/shared/member-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PersonProfile } from '@/dal/person-profile'

type TreePerson = {
  id: string
  full_name: string
  nickname: string | null
  profile_photo: string | null
}

export function FamilyTree({
  profile,
  base,
  familyLineName,
}: {
  profile: PersonProfile
  base: string
  familyLineName: string | null
}) {
  const hasBig = !!profile.big
  const hasLittles = profile.littles.length > 0
  if (!hasBig && !hasLittles) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Family Tree
          {familyLineName && (
            <span className="text-xs font-normal text-muted-foreground">({familyLineName})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Grandbig */}
          {profile.big?.big && (
            <>
              <TreeNode person={profile.big.big} base={base} size="sm" muted />
              <Connector />
            </>
          )}

          {/* Big */}
          {profile.big && (
            <>
              <TreeNode person={profile.big} base={base} size="md" label="Big" />
              <Connector />
            </>
          )}

          {/* Current member (highlighted) */}
          <div className="ring-2 ring-brand rounded-xl">
            <TreeNode
              person={{
                id: profile.id,
                full_name: profile.full_name,
                nickname: profile.nickname,
                profile_photo: profile.profile_photo,
              }}
              base={base}
              size="lg"
              isSelf
            />
          </div>

          {/* Littles */}
          {hasLittles && (
            <>
              <Connector />
              {profile.littles.length === 1 ? (
                // Single little — straight line
                <div className="flex flex-col items-center">
                  <TreeNode person={profile.littles[0]} base={base} size="md" label="Little" />
                  {/* Grandlittles */}
                  {profile.littles[0].littles.length > 0 && (
                    <>
                      <Connector />
                      <div className="flex gap-3 flex-wrap justify-center">
                        {profile.littles[0].littles.map((gl) => (
                          <TreeNode key={gl.id} person={gl} base={base} size="sm" muted />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // Multiple littles — branch out
                <div className="flex gap-4 flex-wrap justify-center">
                  {profile.littles.map((l) => (
                    <div key={l.id} className="flex flex-col items-center">
                      <TreeNode person={l} base={base} size="md" label="Little" />
                      {l.littles.length > 0 && (
                        <>
                          <Connector short />
                          <div className="flex gap-2 flex-wrap justify-center">
                            {l.littles.map((gl) => (
                              <TreeNode key={gl.id} person={gl} base={base} size="xs" muted />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TreeNode({
  person,
  base,
  size = 'md',
  label,
  muted = false,
  isSelf = false,
}: {
  person: TreePerson
  base: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  label?: string
  muted?: boolean
  isSelf?: boolean
}) {
  const content = (
    <div
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${isSelf ? 'bg-brand/5' : 'hover:bg-accent'}`}
    >
      <MemberAvatar
        src={person.profile_photo}
        fullName={person.full_name}
        size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
        className={muted ? 'opacity-60' : ''}
      />
      <div className="text-center">
        <p
          className={`font-medium leading-tight ${
            size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-xs' : 'text-sm'
          } ${muted ? 'text-muted-foreground' : 'text-foreground'}`}
        >
          {person.full_name.split(' ')[0]}
        </p>
        {person.nickname && size !== 'xs' && (
          <p className="text-[10px] text-muted-foreground">&ldquo;{person.nickname}&rdquo;</p>
        )}
        {label && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
            {label}
          </p>
        )}
      </div>
    </div>
  )

  if (isSelf) return content

  return <Link href={`${base}/members/${person.id}`}>{content}</Link>
}

function Connector({ short = false }: { short?: boolean }) {
  return <div className={`w-px bg-border ${short ? 'h-3' : 'h-5'}`} />
}
