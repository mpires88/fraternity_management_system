'use client'

import { useEffect, useState, useTransition } from 'react'
import { castVote, getPollDetail } from '@/actions/polls.action'
import { Button } from '@/components/ui/button'

type Props = {
  pollId: string
  onClose: () => void
}

type Option = { id: string; label: string; description: string | null; sort_order: number }

export function PollBallot({ pollId, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [options, setOptions] = useState<Option[]>([])
  const [method, setMethod] = useState('')
  const [title, setTitle] = useState('')
  const [allowAbstain, setAllowAbstain] = useState(true)
  const [voted, setVoted] = useState(false)

  // Plurality / supermajority state
  const [selected, setSelected] = useState<string | null>(null)
  // Approval state
  const [approved, setApproved] = useState<Set<string>>(new Set())
  // RCV state
  const [ranking, setRanking] = useState<string[]>([])
  // Abstain
  const [abstain, setAbstain] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const result = await getPollDetail({ pollId })
      if (result.success && result.data) {
        setOptions(result.data.options)
        setMethod(result.data.poll.voting_method)
        setTitle(result.data.poll.title)
        setAllowAbstain(result.data.poll.allow_abstain)
        setVoted(result.data.voted)
      }
    })
  }, [pollId])

  function handleSubmit() {
    let voteData: Record<string, unknown> = {}
    if (abstain) {
      voteData = { abstain: true }
    } else if (method === 'plurality' || method === 'supermajority') {
      if (!selected) return
      voteData = { optionId: selected }
    } else if (method === 'approval') {
      if (approved.size === 0) return
      voteData = { optionIds: [...approved] }
    } else if (method === 'rcv') {
      if (ranking.length === 0) return
      voteData = { ranking }
    }

    startTransition(async () => {
      await castVote({ pollId, voteData })
      onClose()
    })
  }

  function moveRank(optId: string, direction: 'up' | 'down') {
    const idx = ranking.indexOf(optId)
    if (idx === -1) return
    const next = [...ranking]
    const swap = direction === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setRanking(next)
  }

  if (voted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-popover border border-border rounded-xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
          <p className="text-foreground font-medium">You have already voted in this poll.</p>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-popover border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>

        {method === 'plurality' || method === 'supermajority' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Select one option:</p>
            {options.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selected === opt.id ? 'border-brand bg-brand/5' : 'border-border hover:bg-accent'
                } ${abstain ? 'opacity-50' : ''}`}
              >
                <input
                  type="radio"
                  name="vote"
                  checked={selected === opt.id}
                  disabled={abstain}
                  onChange={() => setSelected(opt.id)}
                  className="accent-[var(--brand)]"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  {opt.description && (
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        ) : method === 'approval' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Select all options you approve:</p>
            {options.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  approved.has(opt.id) ? 'border-brand bg-brand/5' : 'border-border hover:bg-accent'
                } ${abstain ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={approved.has(opt.id)}
                  disabled={abstain}
                  onChange={() => {
                    const next = new Set(approved)
                    if (next.has(opt.id)) next.delete(opt.id)
                    else next.add(opt.id)
                    setApproved(next)
                  }}
                  className="accent-[var(--brand)]"
                />
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
              </label>
            ))}
          </div>
        ) : method === 'rcv' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Rank your choices (click to add, drag to reorder):
            </p>
            {ranking.length > 0 && (
              <div className="space-y-1 mb-2">
                {ranking.map((optId, i) => {
                  const opt = options.find((o) => o.id === optId)
                  return (
                    <div
                      key={optId}
                      className="flex items-center gap-2 p-2 border border-brand bg-brand/5 rounded-lg"
                    >
                      <span className="text-xs font-bold text-brand w-5">{i + 1}</span>
                      <span className="text-sm flex-1">{opt?.label}</span>
                      <button
                        onClick={() => moveRank(optId, 'up')}
                        disabled={i === 0}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveRank(optId, 'down')}
                        disabled={i === ranking.length - 1}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setRanking(ranking.filter((id) => id !== optId))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {options
              .filter((o) => !ranking.includes(o.id))
              .map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRanking([...ranking, opt.id])}
                  disabled={abstain}
                  className={`w-full text-left p-3 border border-border rounded-lg hover:bg-accent transition-colors ${abstain ? 'opacity-50' : ''}`}
                >
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                </button>
              ))}
          </div>
        ) : null}

        {allowAbstain && (
          <label className="flex items-center gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={abstain}
              onChange={() => {
                setAbstain(!abstain)
                setSelected(null)
                setApproved(new Set())
                setRanking([])
              }}
              className="accent-[var(--brand)]"
            />
            <span className="text-sm text-muted-foreground">Abstain</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              isPending ||
              (!abstain && (method === 'plurality' || method === 'supermajority') && !selected) ||
              (method === 'approval' && approved.size === 0) ||
              (method === 'rcv' && ranking.length === 0)
            }
            onClick={handleSubmit}
          >
            Submit Vote
          </Button>
        </div>
      </div>
    </div>
  )
}
