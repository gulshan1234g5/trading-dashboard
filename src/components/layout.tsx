import { useEffect, useState, type ComponentType } from 'react'
import {
  Activity,
  BookOpenText,
  ChevronRight,
  LayoutDashboard,
  Search,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react'
import type { PageId } from '../types'
import { useApp } from '../lib/store'
import { useLive } from '../lib/live'
import { MARKET_STATUS } from '../data/market'
import { StatusDot } from './ui'

export interface NavItem {
  id: PageId
  label: string
  icon: ComponentType<{ className?: string }>
  shortcut?: string
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: 'G O' },
      { id: 'systems', label: 'Systems', icon: Activity, shortcut: 'G S' },
      { id: 'playbook', label: 'Playbook', icon: BookOpenText, shortcut: 'G P' },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
const PAGE_LABELS: Record<PageId, string> = {
  overview: 'Overview',
  systems: 'Systems',
  playbook: 'Playbook',
}

export function useClock(): string {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  )
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      )
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  return time
}

export function Sidebar({ active, navigate }: { active: PageId; navigate: (page: PageId) => void }) {
  const { state } = useApp()
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark">GT</div>
        <div>
          <div className="brand-name">Gulshan Toppo</div>
          <div className="brand-sub">Trading Command Center</div>
        </div>
      </div>

      <div className="desk-card">
        <div className="desk-card-top">
          <div>
            <div className="desk-title">Swing Desk</div>
            <div className="desk-meta">NSE · INDIA · INR</div>
          </div>
          <span className="status-pill paper">Paper</span>
        </div>
      </div>

      <nav className="side-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav-section-label">{group.label}</div>
            <ul className="nav-list">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`nav-link ${active === item.id ? 'active' : ''}`.trim()}
                      onClick={() => navigate(item.id)}
                      aria-current={active === item.id ? 'page' : undefined}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {item.shortcut ? <span className="nav-kbd">{item.shortcut}</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="engine-mini">
          <div className="engine-mini-head">
            <span>Engine</span>
            <StatusDot tone={state.kiteConnected ? 'good' : 'warn'} />
          </div>
          <div className="engine-mini-row">{state.kiteConnected ? 'Kite live' : 'No local engine bridge'}</div>
          <div className="engine-mini-meta">Orders run from the terminal playbook, not this UI</div>
        </div>
        <div className="user-card">
          <div className="avatar">GT</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="user-name">Gulshan Toppo</div>
            <div className="user-role">Operator · Paper account</div>
          </div>
          <Zap size={12} color="#c7f36b" aria-hidden="true" />
        </div>
        <div className="mono" style={{ color: 'var(--muted-dim)', fontSize: 8, textAlign: 'center' }}>
          {state.kiteConnected ? 'Kite connected' : 'Kite not connected'}
        </div>
      </div>
    </aside>
  )
}

export function Topbar({
  active,
  onSearch,
}: {
  active: PageId
  onSearch: () => void
}) {
  const clock = useClock()
  const live = useLive()
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb" aria-label="Breadcrumb">
          <span>Command Center</span>
          <span className="breadcrumb-sep">/</span>
          <strong>{PAGE_LABELS[active]}</strong>
        </div>
        <div className="topbar-status">
          <span className="status-pill paper">
            <StatusDot tone={live.status === 'ok' ? 'good' : 'warn'} />{' '}
            {live.status === 'ok' ? 'Live account' : live.status === 'error' ? 'Demo (live.json unreachable)' : 'Loading…'}
          </span>
          <span className="status-pill hide-mobile">{MARKET_STATUS === 'CLOSED' ? 'NSE closed' : 'NSE open'}</span>
          <span className="status-pill hide-tablet">{clock} IST</span>
        </div>
      </div>
      <div className="topbar-right">
        <button type="button" className="icon-btn" onClick={onSearch} aria-label="Search pages" title="Search">
          <Search />
        </button>
        <div className="avatar" aria-hidden="true" style={{ width: 31, height: 31 }}>
          GT
        </div>
      </div>
    </header>
  )
}

export function MobileNav({ active, navigate }: { active: PageId; navigate: (page: PageId) => void }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            type="button"
            key={item.id}
            className={`mobile-nav-item ${active === item.id ? 'active' : ''}`.trim()}
            onClick={() => navigate(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
          >
            <Icon />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

export function DemoBanner({ onPlaybook }: { onPlaybook: () => void }) {
  return (
    <div className="demo-banner" role="status">
      <ShieldCheck />
      <span>
        <strong>Every number here is live.</strong> Account capital, regime gate, system curves and the month-end
        runbook come from live.json and the frozen RUNBOOK — no demo scanner, order book or journal exists in this build.
      </span>
      <button type="button" className="demo-banner-link" onClick={onPlaybook}>
        Open playbook
      </button>
    </div>
  )
}

export function LiveFooter() {
  const live = useLive()
  if (live.status === 'loading') return null
  if (live.status === 'error') {
    return (
      <div
        className="mono"
        role="status"
        style={{ margin: '13px 0 4px', color: 'var(--amber)', fontSize: 8, textAlign: 'center' }}
      >
        ⚠ live.json unreachable ({live.error}) — panels will fill in once the export loads
      </div>
    )
  }
  const { data } = live
  return (
    <div className="mono" style={{ margin: '13px 0 4px', color: 'var(--muted-dim)', fontSize: 8, textAlign: 'center' }}>
      Live data · as of {data.data_asof} · updated {data.generated_at}
    </div>
  )
}

export function CommandPalette({
  open,
  onClose,
  navigate,
}: {
  open: boolean
  onClose: () => void
  navigate: (page: PageId) => void
}) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) setQuery('')
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const pages = NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="modal-overlay" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div className="modal command-modal" role="dialog" aria-label="Command search">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 15px', borderBottom: '1px solid var(--line-soft)' }}>
          <Search size={15} color="var(--muted)" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages…"
            aria-label="Search"
            style={{
              width: '100%',
              border: 0,
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          <kbd className="mono" style={{ color: 'var(--muted-dim)', fontSize: 8 }}>ESC</kbd>
        </div>
        <div className="modal-body" style={{ padding: '10px 9px 13px' }}>
          <div className="nav-section-label" style={{ padding: '3px 8px 6px' }}>Go to</div>
          {pages.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className="nav-link"
                onClick={() => {
                  navigate(item.id)
                  onClose()
                }}
              >
                <Icon />
                <span>{item.label}</span>
                <ChevronRight style={{ marginLeft: 'auto', width: 12, height: 12 }} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ToastHost() {
  const { toasts, dismissToast } = useApp()
  const icons = {
    success: '✓',
    danger: '!',
    warning: '!',
    info: 'i',
  }
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <div className={`toast-icon ${toast.tone}`} aria-hidden="true">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>{icons[toast.tone]}</span>
          </div>
          <div className="toast-main">
            <div className="toast-title">{toast.title}</div>
            {toast.message ? <div className="toast-message">{toast.message}</div> : null}
          </div>
          <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
            <X />
          </button>
        </div>
      ))}
    </div>
  )
}

export { PAGE_LABELS }
