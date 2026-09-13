import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const directoryOrder = vi.hoisted(() => ({ root: '', entries: [] as string[] }))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readdirSync: (...args: Parameters<typeof actual.readdirSync>) =>
      args[0] === directoryOrder.root ? directoryOrder.entries : actual.readdirSync(...args),
  }
})

import { virtualManifest } from './gen-third-party-notices.ts'

describe('virtualManifest traversal order', () => {
  it.each([
    { incompleteVersion: '1.0.0', incompleteFirst: true },
    { incompleteVersion: '1.0.0', incompleteFirst: false },
    { incompleteVersion: '9.9.9', incompleteFirst: true },
    { incompleteVersion: '9.9.9', incompleteFirst: false },
  ].flatMap(order => ['2.0.0', '3.0.0'].map(requestedVersion => ({ ...order, requestedVersion }))))('looks up $requestedVersion with $incompleteVersion residue, incompleteFirst=$incompleteFirst', ({ incompleteVersion, incompleteFirst, requestedVersion }) => {
    const store = mkdtempSync(join(tmpdir(), 'dsh-notices-order-'))
    try {
      const name = '@scope/pkg'
      const incomplete = `@scope+pkg@${incompleteVersion}`
      const complete = '@scope+pkg@2.0.0'
      mkdirSync(join(store, incomplete, 'node_modules'), { recursive: true })
      const manifestDir = join(store, complete, 'node_modules', name)
      mkdirSync(manifestDir, { recursive: true })
      writeFileSync(join(manifestDir, 'package.json'), JSON.stringify({ name, version: '2.0.0', license: 'MIT' }))
      // Control only this store's enumeration; file reads and parsing remain real.
      directoryOrder.root = store
      directoryOrder.entries = incompleteFirst ? [incomplete, complete] : [complete, incomplete]
      if (requestedVersion === '2.0.0') {
        expect(virtualManifest(store, name, requestedVersion)).toMatchObject({ name, version: '2.0.0', license: 'MIT' })
      } else {
        expect(virtualManifest(store, name, requestedVersion)).toBeUndefined()
      }
    } finally {
      directoryOrder.root = ''
      directoryOrder.entries = []
      rmSync(store, { recursive: true, force: true })
    }
  })
})
