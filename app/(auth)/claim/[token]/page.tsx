'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  type ClaimTokenInfo,
  claimRecord,
  getClaimTokenInfo,
} from '@/actions/auth/claim-record.action'
import { createClient } from '@/lib/supabase/client'

type TokenInfo = ClaimTokenInfo

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'info' | 'signup' | 'login' | 'claiming'>('info')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    async function loadToken() {
      const infoResult = await getClaimTokenInfo({ token })
      if (!infoResult.success || !infoResult.data) {
        setError('Invalid invite link')
        setLoading(false)
        return
      }

      setTokenInfo(infoResult.data)
      setLoading(false)

      // If user is already logged in, try to claim immediately
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setMode('claiming')
        const result = await claimRecord({ token })
        if (result.success && result.data) {
          if ('error' in result.data) {
            setError(result.data.error as string)
            setMode('info')
          } else {
            router.push('/')
          }
        } else if (!result.success) {
          setError(result.error ?? 'Failed to claim record')
          setMode('info')
        }
      }
    }
    loadToken()
  }, [token, supabase, router])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    const { error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError) {
      setFormError(signupError.message)
      setFormLoading(false)
      return
    }

    // Now claim the record
    const result = await claimRecord({ token })
    if (result.success && result.data) {
      if ('error' in result.data) {
        setFormError(result.data.error as string)
        setFormLoading(false)
        return
      }
      router.push('/')
    } else {
      setFormError(result.error ?? 'Failed to claim record')
      setFormLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) {
      setFormError(loginError.message)
      setFormLoading(false)
      return
    }

    const result = await claimRecord({ token })
    if (result.success && result.data) {
      if ('error' in result.data) {
        setFormError(result.data.error as string)
        setFormLoading(false)
        return
      }
      router.push('/')
    } else {
      setFormError(result.error ?? 'Failed to claim record')
      setFormLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading invite...</p>
      </div>
    )
  }

  if (error || tokenInfo?.expired || tokenInfo?.claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card px-8 py-10 rounded-xl shadow-sm ring-1 ring-foreground/10 w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {tokenInfo?.claimed
              ? 'Already Claimed'
              : tokenInfo?.expired
                ? 'Invite Expired'
                : 'Invalid Invite'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {error ||
              (tokenInfo?.claimed
                ? 'This invite has already been used.'
                : 'This invite link has expired. Ask your chapter admin for a new one.')}
          </p>
        </div>
      </div>
    )
  }

  if (mode === 'claiming') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Linking your account...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card px-8 py-10 rounded-xl shadow-sm ring-1 ring-foreground/10 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground mb-1">You&apos;ve been invited</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Join <span className="font-medium text-foreground">{tokenInfo?.groupName}</span> as{' '}
          <span className="font-medium text-foreground">{tokenInfo?.personName}</span>
        </p>

        {mode === 'info' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover text-brand-foreground rounded-lg text-sm font-medium transition-colors"
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-sm font-medium transition-colors"
            >
              I already have an account
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground rounded-lg text-sm font-medium transition-colors"
            >
              {formLoading ? 'Creating account…' : 'Create account & join'}
            </button>
            <button
              type="button"
              onClick={() => setMode('info')}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-brand-foreground rounded-lg text-sm font-medium transition-colors"
            >
              {formLoading ? 'Signing in…' : 'Sign in & join'}
            </button>
            <button
              type="button"
              onClick={() => setMode('info')}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
