import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import DatasetsPage from './pages/DatasetsPage'
import DashboardPage from './pages/DashboardPage'
import InvestigatePage from './pages/InvestigatePage'
import { checkHealth } from './api'
import './index.css'

function BackendStatus() {
  // 'checking' | 'online' | 'offline' — polled so the user always knows whether
  // the backend/Neo4j are actually reachable instead of finding out only when
  // an action silently fails.
  const [status, setStatus] = useState('checking')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        await checkHealth()
        if (!cancelled) { setStatus('online'); setDetail('') }
      } catch (e) {
        if (cancelled) return
        setStatus('offline')
        setDetail(e.response?.data?.detail || e.message || 'Unreachable')
      }
    }
    ping()
    const iv = setInterval(ping, 15000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  const cfg = {
    checking: { color: 'var(--dark-chrome-text2)', label: 'CHECKING…' },
    online: { color: 'var(--dark-chrome-green)', label: 'SYSTEM ONLINE' },
    offline: { color: 'var(--dark-chrome-accent)', label: 'BACKEND OFFLINE' },
  }[status]

  return (
    <div
      title={status === 'offline' ? detail : 'API + Neo4j reachable'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
        color: cfg.color, padding: '6px 10px', borderRadius: 4,
        border: `1px solid ${cfg.color}`, background: `${cfg.color}1a`,
        fontWeight: 700, whiteSpace: 'nowrap'
      }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: cfg.color,
        boxShadow: `0 0 6px ${cfg.color}`,
        animation: status === 'checking' ? 'pulse 1s infinite' : 'none'
      }} />
      {cfg.label}
    </div>
  )
}

function Nav() {
  const datasetId = sessionStorage.getItem('dataset_id') || ''
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false')

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.remove('light-mode')
    } else {
      document.documentElement.classList.add('light-mode')
    }
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  return (
    <nav className="navbar" style={{
      display: 'flex', alignItems: 'center', gap: 40,
      padding: '0 32px', height: 64,
      backdropFilter: 'blur(10px)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <a href="/intro.html" style={{ 
        fontFamily: 'var(--mono)',
        fontSize: 17,
        letterSpacing: 1.5,
        textDecoration: 'none',
        cursor: 'pointer',
        fontWeight: 700,
        background: 'linear-gradient(135deg, var(--dark-chrome-accent) 0%, var(--dark-chrome-accent2) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        ◈ ANTI<span style={{
          color: 'var(--dark-chrome-text2)',
          fontWeight: 400
        }}>FRAUD</span>
      </a>
      
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginLeft: 'auto', 
        alignItems: 'center',
        height: '100%'
      }}>
        <BackendStatus />
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            letterSpacing: 0.6,
            padding: '8px 14px',
            textDecoration: 'none',
            border: '1px solid rgba(42, 63, 95, 0.6)',
            color: 'var(--dark-chrome-text2)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: '4px',
            fontWeight: 600,
            height: '36px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)'
            e.currentTarget.style.borderColor = 'var(--dark-chrome-cyan)'
            e.currentTarget.style.color = 'var(--dark-chrome-cyan)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(42, 63, 95, 0.6)'
            e.currentTarget.style.color = 'var(--dark-chrome-text2)'
          }}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️ LIGHT' : '🌙 DARK'}
        </button>
        
        {[
          ['DATASETS', '/app'],
          ['DASHBOARD', datasetId ? `/app/dashboard?dataset_id=${datasetId}` : '/app/dashboard'],
          ['INVESTIGATE', '/app/investigate']
        ].map(([label, path]) => (
          <NavLink key={label} to={path} end={label === 'DATASETS'}
            style={({ isActive }) => ({
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: 0.7,
              padding: '8px 16px',
              textDecoration: 'none',
              border: `1.5px solid ${isActive ? 'var(--dark-chrome-green)' : 'transparent'}`,
              color: isActive ? 'var(--dark-chrome-green)' : 'var(--dark-chrome-text2)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              borderRadius: '4px',
              fontWeight: 600,
              background: isActive ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: isActive ? '0 0 15px rgba(0, 255, 136, 0.3)' : 'none',
              cursor: 'pointer'
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              if (el.classList.length === 0 || !el.style.borderColor.includes('var(--dark-chrome-green)')) {
                el.style.borderColor = 'rgba(0, 212, 255, 0.5)'
                el.style.color = 'var(--dark-chrome-cyan)'
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              if (!el.style.borderColor.includes('var(--dark-chrome-green)')) {
                el.style.borderColor = 'transparent'
                el.style.color = 'var(--dark-chrome-text2)'
              }
            }}>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  // Enhanced UI System
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/app" element={<DatasetsPage />} />
        <Route path="/app/dashboard" element={<DashboardPage />} />
        <Route path="/app/investigate" element={<InvestigatePage />} />
        <Route path="*" element={<DatasetsPage />} />
      </Routes>
    </BrowserRouter>
  )
}