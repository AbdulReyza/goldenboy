'use client'

import { useEffect, useMemo, useState } from 'react'
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

const ITEMS_PER_PAGE = 20

type LogEntry = {
  id: number
  created_at: string
  type: string
  before_value: number
  after_value: number
  note: string | null
  source: string | null
  items: { name: string } | null
  profiles: { name: string, username: string } | null
}

type SourceTab = 'semua' | 'shop' | 'transaksi'

export default function RiwayatPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'semua' | 'saya'>('semua')
  const [sourceTab, setSourceTab] = useState<SourceTab>('semua')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // State untuk Pagination
  const [page, setPage] = useState(1)
  const [inputPage, setInputPage] = useState('1')
  const [totalCount, setTotalCount] = useState(0)

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

  // Synchronize input page saat state page utama berubah
  useEffect(() => {
    setInputPage(String(page))
  }, [page])

  // Reset halaman ke 1 setiap kali filter berubah
  useEffect(() => {
    setPage(1)
  }, [filter, sourceTab, dateFrom, dateTo])

  useEffect(() => {
    if (checking) return

    async function fetchLogs() {
      setLoading(true)
      
      const from = (page - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      let query = supabase
        .from('vault_logs')
        .select('id, created_at, type, before_value, after_value, note, source, items(name), profiles(name, username)', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filter === 'saya' && userId) {
        query = query.eq('user_id', userId)
      }
      if (sourceTab !== 'semua') {
        query = query.eq('source', sourceTab)
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`)
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`)
      }

      query = query.range(from, to)

      const { data, count } = await query
      setLogs((data as any) ?? [])
      setTotalCount(count ?? 0)
      setLoading(false)
    }

    fetchLogs()
  }, [checking, filter, sourceTab, dateFrom, dateTo, userId, page])

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter((log) => {
      const label =
        log.type === 'uang_merah_update' ? 'uang merah' :
        log.type === 'uang_putih_update' ? 'uang putih' :
        (log.items?.name ?? 'item')
      const username = (log.profiles?.name || log.profiles?.username || 'system').toLowerCase()
      const note = (log.note ?? '').toLowerCase()

      return (
        label.toLowerCase().includes(q) ||
        username.includes(q) ||
        note.includes(q) ||
        String(log.id).includes(q)
      )
    })
  }, [logs, search])

  const summary = useMemo(() => {
    let masuk = 0
    let keluar = 0
    for (const log of filteredLogs) {
      if (log.type === 'item_update') continue
      const delta = log.after_value - log.before_value
      if (delta >= 0) masuk += delta
      else keluar += Math.abs(delta)
    }
    return { masuk, keluar }
  }, [filteredLogs])

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))

  // Fungsi lompat ke halaman tertentu
  const handleJumpPage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const targetPage = parseInt(inputPage, 10)
    if (!isNaN(targetPage)) {
      const validPage = Math.min(Math.max(1, targetPage), totalPages)
      setPage(validPage)
      setInputPage(String(validPage))
    } else {
      setInputPage(String(page))
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Memeriksa sesi...
      </div>
    )
  }

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: 24,
    border: active ? '1px solid transparent' : `1px solid ${LINE}`,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 700 : 600,
    background: active ? `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)` : 'transparent',
    color: active ? '#000' : TEXT_MUTED,
    transition: 'all 0.2s',
  })

  return (
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div className="main-content" style={{ color: TEXT }}>
        <a href="/" style={{ fontSize: 12, color: TEXT_MUTED, textDecoration: 'none' }}>&larr; Kembali ke Ledger</a>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, margin: '12px 0 20px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: 0 }}>Riwayat Transaksi</h1>
        </div>

        {/* Tab sumber */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setSourceTab('semua')} style={tabBtnStyle(sourceTab === 'semua')}>SEMUA</button>
          <button onClick={() => setSourceTab('shop')} style={tabBtnStyle(sourceTab === 'shop')}>SHOP</button>
          <button onClick={() => setSourceTab('transaksi')} style={tabBtnStyle(sourceTab === 'transaksi')}>TRANSAKSI</button>
        </div>

        {/* Ringkasan cepat */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 6px', letterSpacing: 1 }}>UANG MASUK (HALAMAN INI)</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: GOLD_BRIGHT, fontFamily: 'monospace', margin: 0 }}>
              +${summary.masuk.toLocaleString('en-US')}
            </p>
          </div>
          <div style={{ flex: '1 1 200px', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 6px', letterSpacing: 1 }}>UANG KELUAR (HALAMAN INI)</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#d97757', fontFamily: 'monospace', margin: 0 }}>
              -${summary.keluar.toLocaleString('en-US')}
            </p>
          </div>
          <div style={{ flex: '1 1 200px', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 6px', letterSpacing: 1 }}>TOTAL TRANSAKSI</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: TEXT, fontFamily: 'monospace', margin: 0 }}>
              {totalCount}
            </p>
          </div>
        </div>

        {/* Filter Anggota & Tanggal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <button
              onClick={() => setFilter('semua')}
              style={{ background: 'none', border: 'none', color: filter === 'semua' ? GOLD_BRIGHT : TEXT_MUTED, cursor: 'pointer', fontSize: 14, fontWeight: filter === 'semua' ? 600 : 400, paddingBottom: 6, borderBottom: filter === 'semua' ? `2px solid ${GOLD_BRIGHT}` : '2px solid transparent' }}
            >
              Semua Anggota
            </button>
            <button
              onClick={() => setFilter('saya')}
              style={{ background: 'none', border: 'none', color: filter === 'saya' ? GOLD_BRIGHT : TEXT_MUTED, cursor: 'pointer', fontSize: 14, fontWeight: filter === 'saya' ? 600 : 400, paddingBottom: 6, borderBottom: filter === 'saya' ? `2px solid ${GOLD_BRIGHT}` : '2px solid transparent' }}
            >
              Transaksi Saya
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>📅</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: TEXT, fontSize: 12, outline: 'none' }}
              />
            </div>
            <span style={{ fontSize: 12, color: TEXT_MUTED }}>To</span>
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>📅</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: TEXT, fontSize: 12, outline: 'none' }}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                style={{ background: 'transparent', border: `1px solid ${LINE}`, color: GOLD_BRIGHT, borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                Reset tanggal
              </button>
            )}
          </div>
        </div>

        {/* Pencarian */}
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Cari nama barang, username, catatan, atau ID transaksi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 420,
              background: SURFACE,
              border: `1px solid ${LINE}`,
              borderRadius: 20,
              padding: '10px 16px',
              color: TEXT,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Tabel Data */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 200px 80px 150px 120px 150px 1fr', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.01)', borderRadius: 8, marginBottom: 12, border: `1px solid ${LINE}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>ID</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Penginput</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Asal</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Barang / Tipe</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Perubahan</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Waktu</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Catatan</span>
            </div>

            {loading && (
              <p style={{ padding: 20, fontSize: 13, color: TEXT_MUTED, textAlign: 'center' }}>Memuat...</p>
            )}

            {!loading && filteredLogs.length === 0 && (
              <p style={{ padding: 20, fontSize: 13, color: TEXT_MUTED, textAlign: 'center' }}>
                {search ? 'Tidak ada transaksi yang cocok dengan pencarian.' : 'Belum ada transaksi.'}
              </p>
            )}

            {!loading && filteredLogs.map((log) => {
              const delta = log.after_value - log.before_value
              const label =
                log.type === 'uang_merah_update' ? 'Uang Merah' :
                log.type === 'uang_putih_update' ? 'Uang Putih' :
                log.items?.name ?? 'Item'
              const isMoney = log.type !== 'item_update'

              const username = log.profiles?.name || log.profiles?.username || 'System'
              const initial = username.charAt(0).toUpperCase()

              return (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '60px 200px 80px 150px 120px 150px 1fr', gap: 16, padding: '16px 20px', background: SURFACE, borderRadius: 8, marginBottom: 8, border: `1px solid rgba(255,255,255,0.02)`, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: TEXT_MUTED }}>#{log.id}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: GOLD, color: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', flexShrink: 0 }}>
                      {initial}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{username}</span>
                  </div>

                  <span>
                    {log.source ? (
                      <span
                        style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                          color: log.source === 'shop' ? GOLD_BRIGHT : TEXT_MUTED,
                          border: `1px solid ${log.source === 'shop' ? 'rgba(201,162,39,0.4)' : LINE}`,
                          borderRadius: 8, padding: '2px 6px',
                        }}
                      >
                        {log.source === 'shop' ? 'SHOP' : 'TRANSAKSI'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: TEXT_MUTED }}>-</span>
                    )}
                  </span>

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

        {/* Kontrol Navigasi Pagination dengan Input Angka */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24, paddingBottom: 40, flexWrap: 'wrap' }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${LINE}`,
                background: page === 1 ? 'transparent' : SURFACE,
                color: page === 1 ? TEXT_MUTED : TEXT,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
              }}
            >
              &larr; Sebelumnya
            </button>

            {/* Input untuk Lompat ke Page tertentu */}
            <form onSubmit={handleJumpPage} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>Halaman</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                style={{
                  width: 50,
                  textAlign: 'center',
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  borderRadius: 6,
                  color: GOLD_BRIGHT,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 4px',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>dari <strong>{totalPages}</strong></span>
              <button
                type="submit"
                style={{
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  color: TEXT,
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Go
              </button>
            </form>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${LINE}`,
                background: page >= totalPages ? 'transparent' : SURFACE,
                color: page >= totalPages ? TEXT_MUTED : TEXT,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: 12,
              }}
            >
              Selanjutnya &rarr;
            </button>
          </div>
        )}

      </div>
    </div>
  )
}