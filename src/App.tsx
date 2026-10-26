import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import type { PageId } from './types'
import { useApp } from './lib/store'
import { Button } from './components/ui'
import {
  CommandPalette,
  LiveFooter,
  MobileNav,
  Sidebar,
  ToastHost,
  Topbar,
} from './components/layout'
import { Overview } from './pages/Overview'
import { Systems } from './pages/Systems'
import { Playbook } from './pages/Playbook'

const PAGES: PageId[] = ['overview', 'systems', 'playbook']

function pageFromHash(): PageId {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return PAGES.includes(raw as PageId) ? (raw as PageId) : 'overview'
}

export default function App() {
  const { state, unlockSession } = useApp()
  const [page, setPage] = useState<PageId>(pageFromHash)
  const [searchOpen, setSearchOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [unlockError, setUnlockError] = useState(false)

  const navigate = useCallback((next: PageId) => {
    window.location.hash = next === 'overview' ? '/' : `/${next}`
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.history.replaceState(null, '', '#/')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (!typing && event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const content = useMemo(() => {
    switch (page) {
      case 'overview':
        return <Overview navigate={navigate} />
      case 'systems':
        return <Systems />
      case 'playbook':
        return <Playbook />
      default:
        return null
    }
  }, [navigate, page])

  if (state.sessionLocked) {
    return (
      <div className="lock-screen">
        <div className="lock-grid" aria-hidden="true" />
        <div className="lock-card">
          <div className="brand" style={{ padding: '0 0 22px' }}>
            <div className="brand-mark">GT</div>
            <div>
              <div className="brand-name">Gulshan Toppo</div>
              <div className="brand-sub">Trading Command Center</div>
            </div>
          </div>
          <div className="lock-icon"><LockKeyhole /></div>
          <h1>Session locked</h1>
          <p>Enter the local demo passphrase to reopen the command center. This lock is a UX demonstration; production auth is server-verified.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!unlockSession(passphrase)) setUnlockError(true)
              else {
                setPassphrase('')
                setUnlockError(false)
              }
            }}
          >
            <label htmlFor="unlock-passphrase">Demo passphrase</label>
            <input
              id="unlock-passphrase"
              type="password"
              autoFocus
              value={passphrase}
              onChange={(event) => {
                setPassphrase(event.target.value)
                setUnlockError(false)
              }}
              placeholder="Enter demo passphrase"
              aria-invalid={unlockError}
            />
            {unlockError ? <div className="lock-error">Incorrect passphrase. The demo passphrase is “demo”.</div> : null}
            <Button variant="primary" type="submit" style={{ width: '100%', marginTop: 12 }}>
              <ShieldCheck /> Unlock workspace
            </Button>
          </form>
          <div className="lock-foot">
            <span><ShieldCheck size={11} /> Paper mode only</span>
            <span className="mono">NO BROKER SESSION</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar active={page} navigate={navigate} />
      <div className="main-area">
        <Topbar active={page} onSearch={() => setSearchOpen(true)} />
        <main className="page-wrap" id="main-content">
          {content}
        </main>
        <LiveFooter />
      </div>
      <MobileNav active={page} navigate={navigate} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} />
      <ToastHost />
      <div className="sr-only" aria-live="polite">
        <ArrowRight /> {page}
      </div>
    </div>
  )
}
