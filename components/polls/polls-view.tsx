'use client'

import { Plus, Vote } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { addParticipants, closePoll, createPoll, publishPoll } from '@/actions/polls.action'
import { Button } from '@/components/ui/button'
import type { PollRow } from '@/dal/polls'
import { PollBallot } from './poll-ballot'
import { PollResults } from './poll-results'

type Props = {
  polls: PollRow[]
  isAdmin: boolean
  members: { id: string; full_name: string }[]
}

const METHOD_LABELS: Record<string, string> = {
  plurality: 'Plurality',
  approval: 'Approval',
  supermajority: 'Supermajority',
  rcv: 'Ranked Choice',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-muted text-muted-foreground',
}

export function PollsView({ polls, isAdmin, members }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [activePollId, setActivePollId] = useState<string | null>(null)
  const [showResults, setShowResults] = useState<string | null>(null)

  function handlePublish(pollId: string) {
    startTransition(async () => {
      await publishPoll({ pollId })
      router.refresh()
    })
  }

  function handleClose(pollId: string) {
    startTransition(async () => {
      await closePoll({ pollId })
      router.refresh()
    })
  }

  function handleAddAllMembers(pollId: string) {
    startTransition(async () => {
      await addParticipants({ pollId, personIds: members.map((m) => m.id) })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Polls & Voting</h1>
          <p className="text-muted-foreground mt-1">Motions, elections, and chapter votes</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={14} className="mr-1.5" />
            New Poll
          </Button>
        )}
      </div>

      {polls.length === 0 && (
        <p className="text-muted-foreground py-8 text-center">No polls yet.</p>
      )}

      <div className="space-y-3">
        {polls.map((poll) => (
          <div key={poll.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-foreground">{poll.title}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[poll.lifecycle] ?? ''}`}
                  >
                    {poll.lifecycle}
                  </span>
                  {poll.status === 'closed' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-medium">
                      closed
                    </span>
                  )}
                </div>
                {poll.description && (
                  <p className="text-sm text-muted-foreground">{poll.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {METHOD_LABELS[poll.voting_method] ?? poll.voting_method}
                  {poll.quorum && ` · Quorum: ${poll.quorum}`}
                  {poll.vote_privacy === 'private' && ' · Secret ballot'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {poll.lifecycle === 'published' && poll.status === 'open' && (
                  <Button size="xs" variant="outline" onClick={() => setActivePollId(poll.id)}>
                    <Vote size={12} className="mr-1" />
                    Vote
                  </Button>
                )}
                {poll.status === 'closed' && (
                  <Button size="xs" variant="outline" onClick={() => setShowResults(poll.id)}>
                    Results
                  </Button>
                )}
                {isAdmin && poll.lifecycle === 'draft' && (
                  <>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleAddAllMembers(poll.id)}
                    >
                      Add members
                    </Button>
                    <Button size="xs" disabled={isPending} onClick={() => handlePublish(poll.id)}>
                      Publish
                    </Button>
                  </>
                )}
                {isAdmin && poll.lifecycle === 'published' && poll.status === 'open' && (
                  <Button
                    size="xs"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleClose(poll.id)}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreatePollDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            router.refresh()
          }}
        />
      )}

      {activePollId && (
        <PollBallot
          pollId={activePollId}
          onClose={() => {
            setActivePollId(null)
            router.refresh()
          }}
        />
      )}

      {showResults && <PollResults pollId={showResults} onClose={() => setShowResults(null)} />}
    </div>
  )
}

function CreatePollDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState('plurality')
  const [privacy, setPrivacy] = useState('public')
  const [quorum, setQuorum] = useState('')
  const [threshold, setThreshold] = useState('0.667')
  const [options, setOptions] = useState([
    { key: 0, value: '' },
    { key: 1, value: '' },
  ])
  const [nextKey, setNextKey] = useState(2)

  function addOption() {
    setOptions([...options, { key: nextKey, value: '' }])
    setNextKey(nextKey + 1)
  }

  function handleSubmit() {
    const validOptions = options.filter((o) => o.value.trim())
    if (!title.trim() || validOptions.length < 2) return

    startTransition(async () => {
      await createPoll({
        title: title.trim(),
        description: description.trim() || undefined,
        voting_method: method,
        vote_privacy: privacy,
        quorum: quorum ? Number.parseInt(quorum, 10) : undefined,
        method_settings:
          method === 'supermajority' ? { threshold: Number.parseFloat(threshold) } : {},
        options: validOptions.map((o) => ({ label: o.value.trim() })),
      })
      onCreated()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-popover border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-foreground">New Poll</h2>

        <div>
          <label className="text-sm font-medium text-foreground">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
            placeholder="e.g. Commander Election"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
            >
              <option value="plurality">Plurality</option>
              <option value="approval">Approval</option>
              <option value="supermajority">Supermajority</option>
              <option value="rcv">Ranked Choice</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Privacy</label>
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
            >
              <option value="public">Public</option>
              <option value="private">Secret Ballot</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground">Quorum</label>
            <input
              type="number"
              value={quorum}
              onChange={(e) => setQuorum(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
              placeholder="optional"
            />
          </div>
          {method === 'supermajority' && (
            <div>
              <label className="text-sm font-medium text-foreground">Threshold</label>
              <select
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
              >
                <option value="0.5">Simple majority (50%)</option>
                <option value="0.667">Two-thirds (66.7%)</option>
                <option value="0.75">Three-quarters (75%)</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Options</label>
          <div className="space-y-2 mt-1">
            {options.map((opt, i) => (
              <input
                key={opt.key}
                value={opt.value}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = { ...opt, value: e.target.value }
                  setOptions(next)
                }}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground"
                placeholder={`Option ${i + 1}`}
              />
            ))}
          </div>
          <button onClick={addOption} className="text-xs text-brand hover:underline mt-1">
            + Add option
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              isPending || !title.trim() || options.filter((o) => o.value.trim()).length < 2
            }
            onClick={handleSubmit}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}
