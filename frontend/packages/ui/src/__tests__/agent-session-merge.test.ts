import {describe, expect, test} from 'vitest'
import type {SessionEvent} from '../agents/client'
import {mergeFetchedAgentSession} from '../agents/models'

function event(seq: number, content = `event ${seq}`): SessionEvent {
  return {
    id: `e${seq}`,
    sessionId: 's',
    seq,
    event: {type: 'message', role: 'assistant', content},
    createdAt: seq,
  }
}

function optimistic(text: string): SessionEvent {
  return {
    id: 'optimistic-1',
    sessionId: 's',
    seq: Number.MAX_SAFE_INTEGER,
    event: {type: 'message', role: 'user', actor: 'user', content: text, clientMessageId: '1'},
    createdAt: 0,
  } as SessionEvent
}

describe('mergeFetchedAgentSession', () => {
  test('a fetch that lands late keeps the events the socket delivered while it was in flight', () => {
    // The server read the log at seq 3; by the time its response arrived the socket had appended
    // the answer the agent was streaming and the tool call after it.
    const cached = {events: [event(1), event(2), event(3), event(4), event(5)]}
    const fetched = {title: 'fresh', events: [event(1), event(2), event(3)]}

    const merged = mergeFetchedAgentSession(cached, fetched)

    expect(merged.events.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5])
    expect(merged.title).toBe('fresh')
  })

  test('the fetched copy of an event wins over the cached one', () => {
    const cached = {events: [event(1, 'stale'), event(2, 'stale')]}
    const fetched = {events: [event(1, 'fresh'), event(2, 'fresh')]}

    const merged = mergeFetchedAgentSession(cached, fetched)

    expect(merged).toBe(fetched)
  })

  test('an optimistic row gives way to the fetched session', () => {
    const cached = {events: [event(1), optimistic('hello')]}
    const fetched = {events: [event(1), event(2, 'hello')]}

    expect(mergeFetchedAgentSession(cached, fetched).events.map((entry) => entry.id)).toEqual(['e1', 'e2'])
  })

  test('nothing cached leaves the fetched session as it is', () => {
    const fetched = {events: [event(1)]}

    expect(mergeFetchedAgentSession(undefined, fetched)).toBe(fetched)
    expect(mergeFetchedAgentSession(null, fetched)).toBe(fetched)
    expect(mergeFetchedAgentSession({}, fetched)).toBe(fetched)
  })
})
