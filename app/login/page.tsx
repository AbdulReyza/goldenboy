'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const Logo3D = ({ src, alt, animation }: { src: string, alt: string, animation: string }) => {
  const depth = 5; // Dikurangi dari 12 menjadi 5 agar jauh lebih ringan (menghemat 60% pemrosesan GPU)
  return (
    <div style={{
      width: '25vw', height: '25vw',
      maxWidth: '450px', maxHeight: '450px',
      position: 'relative',
      transformStyle: 'preserve-3d',
      animation,
      willChange: 'transform'
    }}>
      {Array.from({ length: depth }).map((_, i) => (
        <img 
          key={i}
          src={src}
          alt={alt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translateZ(${-i * 3}px)`, // Jarak antar layer diperlebar (3px) agar ketebalan tetap terjaga meski layer dikurangi
            // Disederhanakan hanya menggunakan brightness tanpa contrast agar lebih ringan dirender
            filter: i !== 0 && i !== depth - 1 ? 'brightness(0.3)' : 'none',
          }}
        />
      ))}
    </div>
  )
}


const GOLD = '#C9A227'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

// Domain palsu untuk username -> email internal Supabase Auth
// User tidak pernah melihat ini.
const FAKE_DOMAIN = 'goldengang.local'

function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${FAKE_DOMAIN}`
}

type Mode = 'login' | 'register'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setRegistered(false)
  }

  function validUsername(u: string) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(u)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validUsername(username)) {
      setError('Username hanya boleh huruf, angka, underscore (3-20 karakter).')
      return
    }

    setLoading(true)
    const email = usernameToEmail(username)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Username atau password salah.')
        setLoading(false)
        return
      }
      router.push('/')
      router.refresh()
      return
    }

    // mode === 'register'
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || username, username } },
    })
    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setError('Username sudah dipakai, coba yang lain.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }
    setRegistered(true)
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: BG,
    border: `1px solid ${LINE}`,
    borderRadius: 6,
    padding: '10px 14px',
    color: TEXT,
    fontSize: 13,
    outline: 'none',
    marginBottom: 16,
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top left, rgba(201, 162, 39, 0.15) 0%, transparent 50%), radial-gradient(circle at bottom right, rgba(201, 162, 39, 0.15) 0%, transparent 50%), #080705',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Watermark */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url("/logo.png")',
          backgroundSize: '800px', // Increased size
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.05,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div style={{ zIndex: 10, width: '100%', maxWidth: 360, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: 32, margin: '20px' }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, marginBottom: 6 }}>GOLDEN GANG</p>

        <div style={{ display: 'flex', background: BG, border: `1px solid ${LINE}`, borderRadius: 6, marginBottom: 24, overflow: 'hidden' }}>
          <button
            onClick={() => switchMode('login')}
            style={{ flex: 1, padding: '10px 0', background: mode === 'login' ? GOLD : 'transparent', color: mode === 'login' ? BG : TEXT_MUTED, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Masuk
          </button>
          <button
            onClick={() => switchMode('register')}
            style={{ flex: 1, padding: '10px 0', background: mode === 'register' ? GOLD : 'transparent', color: mode === 'register' ? BG : TEXT_MUTED, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Daftar
          </button>
        </div>

        {registered ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 36, marginBottom: 12, color: GOLD }}>✓</p>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: TEXT, marginBottom: 8 }}>
              Pendaftaran berhasil
            </h2>
            <p style={{ fontSize: 13, color: TEXT_MUTED }}>
              Akunmu sedang menunggu persetujuan admin sebelum bisa digunakan.
            </p>
            <button
              onClick={() => switchMode('login')}
              style={{ marginTop: 16, background: 'transparent', border: `1px solid ${LINE}`, color: GOLD, borderRadius: 6, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}
            >
              Kembali ke halaman Masuk
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: TEXT, margin: '0 0 20px' }}>
              {mode === 'login' ? 'Masuk ke Vault' : 'Buat Akun Baru'}
            </h1>

            {mode === 'register' && (
              <>
                <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Nama Lengkap</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </>
            )}

            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="contoh: josh99"
              style={inputStyle}
            />

            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              style={{ ...inputStyle, marginBottom: 20 }}
            />

            {error && <p style={{ color: '#d97757', fontSize: 12, marginBottom: 16 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: loading ? TEXT_MUTED : GOLD, color: BG, border: 'none', borderRadius: 6, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}
            >
              {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          </form>
        )}
      </div>
      
      {/* Left Logo Area */}
      <div style={{ 
        position: 'absolute',
        left: '5%',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'none', 
        alignItems: 'center', 
        justifyContent: 'center',
        zIndex: 1,
        pointerEvents: 'none',
        background: `radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 60%)`,
        borderRadius: '50%',
        padding: '50px',
      }} className="login-logo-container">
        <Logo3D 
          src="/logo2.png" 
          alt="Rebels Street Gang Logo" 
          animation="slow-spin 12s linear infinite"
        />
      </div>

      {/* Right Logo Area */}
      <div style={{ 
        position: 'absolute',
        right: '5%',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'none', 
        alignItems: 'center', 
        justifyContent: 'center',
        zIndex: 1,
        pointerEvents: 'none',
        background: `radial-gradient(circle at center, rgba(201,162,39,0.08) 0%, transparent 60%)`,
        borderRadius: '50%',
        padding: '50px',
      }} className="login-logo-container">
        <style>{`
          @keyframes slow-spin {
            from { transform: rotateY(0deg); }
            to { transform: rotateY(360deg); }
          }
          @media (min-width: 1024px) {
            .login-logo-container {
              display: flex !important;
            }
          }
        `}</style>
        <Logo3D 
          src="/logo.png" 
          alt="Golden Gang Logo" 
          animation="slow-spin 12s linear infinite"
        />
      </div>
      
      {/* Copyright text */}
      <div style={{ position: 'absolute', bottom: 20, width: '100%', textAlign: 'center', color: TEXT_MUTED, fontSize: 11, letterSpacing: 1, zIndex: 10 }}>
        Hak Cipta Created By Violence And Sep
      </div>
    </div>
  )
}