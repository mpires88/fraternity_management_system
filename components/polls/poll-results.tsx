'use client'

import { useEffect, useState, useTransition } from 'react'
import { getPollDetail } from '@/actions/polls.action'
import { Button } from '@/components/ui/button'
import type { PollResult } from '@/lib/utils/voting/types'

type Props = {
  pollId: string
  onClose: () => void
}

type Option = { id: string; label: string }

export function PollResults({ pollId, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [method, setMethod] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [results, setResults] = useState<PollResult | null>(null)

  useEffect(() => {
    startTransition(async () => {
      const res = await getPollDetail({ pollId })
      if (res.success && res.data) {
        setTitle(res.data.poll.title)
        setMethod(res.data.poll.voting_method)
        setOptions(res.data.options)
        setResults(res.data.results)
      }
    })
  }, [pollId])

  const optionLabel = (id: string) => options.find((o) => o.id === id)?.label ?? id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-popover border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-foreground">{title} — Results</h2>

        {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}

        {results && (
          <div className="space-y-4">
            {!results.quorumMet && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-medium text-red-800 dark:text-red-400">
                  Quorum not met — no valid result
                </p>
              </div>
            )}

            {results.winner && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-muted-foreground">Winner</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-400">
                  {optionLabel(results.winner)}
                </p>
              </div>
            )}

            {results.passed !== undefined && (
              <p className="text-sm font-medium">Motion {results.passed ? 'passed' : 'failed'}</p>
            )}

            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                Ballots cast: {results.summary.totalBallots} / {results.summary.totalVoters}{' '}
                eligible
              </p>
              <p>Abstentions: {results.summary.abstentions}</p>
            </div>

            {results.tally &&
              (method === 'plurality' || method === 'approval' || method === 'supermajority') && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Tally</p>
                  {Object.entries(results.tally)
                    .sort(([, a], [, b]) => b - a)
                    .map(([optId, count]) => {
                      const total = results.summary.totalBallots - results.summary.abstentions
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0
                      return (
                        <div key={optId} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{optionLabel(optId)}</span>
                            <span className="text-muted-foreground">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

            {results.rounds && results.rounds.length > 0 && method === 'rcv' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Rounds</p>
                {results.rounds.map((round) => (
                  <div key={round.round} className="border border-border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Round {round.round}
                      {round.eliminated && (
                        <span className="text-red-500">
                          {' '}
                          — eliminated: {optionLabel(round.eliminated)}
                        </span>
                      )}
                    </p>
                    {Object.entries(round.counts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([optId, count]) => (
                        <div key={optId} className="flex justify-between text-sm py-0.5">
                          <span>{optionLabel(optId)}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
