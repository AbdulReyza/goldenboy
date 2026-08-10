'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

type LogEntry = {
  id: number
  created_at: string
  type: string
  before_value: number
  after_value: number
  note: string | null
  items: { name: string } | null
  profiles: { name: string, username: string } | null
}

function navItemStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 6,
    fontSize: 13,
    color: active ? BG : TEXT_MUTED,
    background: active ? GOLD : 'transparent',
    fontWeight: active ? 600 : 400,
    textDecoration: 'none',
    display: 'block',
  }
}

export default function RiwayatPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<'semua' | 'saya'>('semua')

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return router.push('/login')

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', data.session.user.id)
        .single()

      if (!profile || !profile.is_approved) return router.push('/')

      setUserId(data.session.user.id)
      setChecking(false)
    }
    check()
  }, [router])

  useEffect(() => {
    if (checking) return

    async function fetchLogs() {
      let query = supabase
        .from('vault_logs')
        .select('id, created_at, type, before_value, after_value, note, items(name), profiles(name, username)')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (filter === 'saya' && userId) {
        query = query.eq('user_id', userId)
      }

      const { data } = await query
      if (data) setLogs(data as any)
    }

    fetchLogs()
  }, [checking, filter, userId])

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Memeriksa sesi...
      </div>
    )
  }

  return (
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div className="main-content" style={{ color: TEXT }}>
        <a href="/" style={{ fontSize: 12, color: TEXT_MUTED, textDecoration: 'none' }}>&larr; Kembali ke Ledger</a>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, margin: '12px 0 28px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: 0 }}>Riwayat Transaksi</h1>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <button 
              onClick={() => setFilter('semua')}
              style={{ background: 'none', border: 'none', color: filter === 'semua' ? GOLD_BRIGHT : TEXT_MUTED, cursor: 'pointer', fontSize: 14, fontWeight: filter === 'semua' ? 600 : 400, paddingBottom: 6, borderBottom: filter === 'semua' ? `2px solid ${GOLD_BRIGHT}` : '2px solid transparent' }}
            >
              Semua Transaksi
            </button>
            <button 
              onClick={() => setFilter('saya')}
              style={{ background: 'none', border: 'none', color: filter === 'saya' ? GOLD_BRIGHT : TEXT_MUTED, cursor: 'pointer', fontSize: 14, fontWeight: filter === 'saya' ? 600 : 400, paddingBottom: 6, borderBottom: filter === 'saya' ? `2px solid ${GOLD_BRIGHT}` : '2px solid transparent' }}
            >
              Transaksi Saya
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>📅</span>
              <input type="date" style={{ background: 'transparent', border: 'none', color: TEXT, fontSize: 12, outline: 'none' }} />
            </div>
            <span style={{ fontSize: 12, color: TEXT_MUTED }}>To</span>
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>📅</span>
              <input type="date" style={{ background: 'transparent', border: 'none', color: TEXT, fontSize: 12, outline: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{ minWidth: 800 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 200px 150px 120px 150px 1fr', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.01)', borderRadius: 8, marginBottom: 12, border: `1px solid ${LINE}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>ID</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Penginput</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Barang / Tipe</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Perubahan</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Waktu</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Catatan</span>
            </div>

            {logs.length === 0 && <p style={{ padding: 20, fontSize: 13, color: TEXT_MUTED, textAlign: 'center' }}>Belum ada transaksi.</p>}
            
            {logs.map((log) => {
              const delta = log.after_value - log.before_value
              const label =
                log.type === 'uang_merah_update' ? 'Uang Merah' :
                log.type === 'uang_putih_update' ? 'Uang Putih' :
                log.items?.name ?? 'Item'
              const isMoney = log.type !== 'item_update'
              
              const username = log.profiles?.name || log.profiles?.username || 'System'
              const initial = username.charAt(0).toUpperCase()

              return (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '60px 200px 150px 120px 150px 1fr', gap: 16, padding: '16px 20px', background: SURFACE, borderRadius: 8, marginBottom: 8, border: `1px solid rgba(255,255,255,0.02)`, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: TEXT_MUTED }}>#{log.id}</span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: GOLD, color: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                      {initial}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{username}</span>
                  </div>

                  <span style={{ fontSize: 13, color: TEXT }}>{label}</span>

                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: delta >= 0 ? GOLD_BRIGHT : '#d97757' }}>
                    {isMoney ? '$' : ''}{delta >= 0 ? '+' : ''}{delta.toLocaleString('en-US')}
                  </span>

                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>

                  <span style={{ fontSize: 12, color: TEXT_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.note || '-'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
