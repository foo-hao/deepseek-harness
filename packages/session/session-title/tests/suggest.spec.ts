import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionTitleService, {
  SessionTitleProviderId,
  type SessionTitleProvider,
} from '@deepseek-ai/dsh-session-title'

const CONFIG = {
  fallbackMaxWords: 5,
  fallbackMaxBytes: 24,
  maxTitleBytes: 24,
} as const

function appendHumanPrompt(session: ReturnType<Context['sessions']['create']>, text: string) {
  return session.append('user/message', createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

describe('SessionTitleService suggest', () => {
  it('returns deduplicated provider suggestions without appending a title event', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionTitleService, CONFIG)
    const provider: SessionTitleProvider = {
      id: SessionTitleProviderId('suggestions'),
      automatic: 'all-prompts',
      generate: async request => ({ title: 'single', messageSeqs: request.messages.map(m => m.seq) }),
      suggest: async request => [
        { title: 'alpha', messageSeqs: request.messages.map(m => m.seq) },
        { title: '  alpha  ', messageSeqs: request.messages.map(m => m.seq) },
        { title: 'beta', messageSeqs: request.messages.map(m => m.seq) },
      ],
    }
    ctx.sessionTitle.register(provider)
    const session = ctx.sessions.create(SessionId('suggest'))
    session.append('turn/start', { turn: 1 })
    appendHumanPrompt(session, 'first prompt')
    appendHumanPrompt(session, 'second prompt')

    const titles = await ctx.sessionTitle.suggest(session)

    // '  alpha  ' normalizes to 'alpha' and is deduplicated away.
    expect(titles).toEqual(['alpha', 'beta'])
    // Read-only: suggest committed no title — the automatic fallback still stands.
    expect(ctx.sessionTitle.get(session)?.source.kind).toBe('fallback')
  })

  it('falls back to a single generate when the provider implements no suggest', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionTitleService, CONFIG)
    const provider: SessionTitleProvider = {
      id: SessionTitleProviderId('single'),
      automatic: 'all-prompts',
      generate: async request => ({ title: 'only title', messageSeqs: request.messages.map(m => m.seq) }),
    }
    ctx.sessionTitle.register(provider)
    const session = ctx.sessions.create(SessionId('suggest-single'))
    appendHumanPrompt(session, 'one prompt')

    await expect(ctx.sessionTitle.suggest(session)).resolves.toEqual(['only title'])
  })

  it('returns an empty list without a provider or without eligible text', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionTitleService, CONFIG)
    const session = ctx.sessions.create(SessionId('suggest-empty'))
    await expect(ctx.sessionTitle.suggest(session)).resolves.toEqual([])

    const provider: SessionTitleProvider = {
      id: SessionTitleProviderId('with-text'),
      automatic: 'all-prompts',
      generate: async request => ({ title: 'x', messageSeqs: request.messages.map(m => m.seq) }),
    }
    ctx.sessionTitle.register(provider)
    await expect(ctx.sessionTitle.suggest(session)).resolves.toEqual([])
  })
})
