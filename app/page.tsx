'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from './components/Sidebar'

type Vault = { id: number; name: string; code: number; uang_merah: number; uang_putih: number }
type ItemRow = { id: number; name: string; category_name: string; total_quantity: number; image_path: string | null; vaultNames: string[] }
type Profile = { id: string; name: string; username: string; role: string; is_approved: boolean }

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const SURFACE_HOVER = 'rgba(201,162,39,0.08)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  useEffect(() => {
    let raf: number
    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Dial({ size = 56 }: { size?: number }) {
  const ticks = Array.from({ length: 24 })
  return (
    <div className="dial-spin" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke={LINE} strokeWidth="1.5" />
        <circle cx="50" cy="50" r="34" fill="none" stroke={GOLD} strokeWidth="1" opacity="0.5" />
        {ticks.map((_, i) => {
          const angle = (i / ticks.length) * 2 * Math.PI
          const x1 = 50 + 40 * Math.cos(angle), y1 = 50 + 40 * Math.sin(angle)
          const x2 = 50 + 46 * Math.cos(angle), y2 = 50 + 46 * Math.sin(angle)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth="1" opacity="0.6" />
        })}
        <circle cx="50" cy="50" r="6" fill={GOLD} />
        <line x1="50" y1="50" x2="50" y2="20" stroke={GOLD_BRIGHT} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function RekeningModal({
  vaultId,
  assetType,
  assetLabel,
  isAdmin,
  onClose,
  onChanged,
}: {
  vaultId: number
  assetType: 'uang_putih'
  assetLabel: string
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [holders, setHolders] = useState<{ id: number; holder_name: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('money_holders')
      .select('id, holder_name, amount')
      .eq('vault_id', vaultId)
      .eq('asset_type', assetType)
      .order('id')
    setHolders((data ?? []) as any)
    setLoading(false)
  }

  // Samakan saldo Uang Putih di vault dengan total rekening
  async function syncVaultBalance(currentHolders: { amount: number }[]) {
    const sum = currentHolders.reduce((s, h) => s + Number(h.amount), 0)
    await supabase.from('vaults').update({ [assetType]: sum }).eq('id', vaultId)
    onChanged()
  }

  useEffect(() => {
    load()
  }, [])

  async function addHolder() {
    if (!newName.trim() || !newAmount) return
    setSaving(true)
    await supabase.from('money_holders').insert({
      vault_id: vaultId,
      asset_type: assetType,
      holder_name: newName.trim(),
      amount: Number(newAmount),
    })
    setNewName('')
    setNewAmount('')

    const { data } = await supabase
      .from('money_holders')
      .select('id, holder_name, amount')
      .eq('vault_id', vaultId)
      .eq('asset_type', assetType)
      .order('id')
    const updated = (data ?? []) as any
    setHolders(updated)
    await syncVaultBalance(updated)
    setSaving(false)
  }

  async function updateAmount(id: number, amount: number) {
    await supabase.from('money_holders').update({ amount }).eq('id', id)

    const { data } = await supabase
      .from('money_holders')
      .select('id, holder_name, amount')
      .eq('vault_id', vaultId)
      .eq('asset_type', assetType)
      .order('id')
    const updated = (data ?? []) as any
    setHolders(updated)
    await syncVaultBalance(updated)
  }

  async function removeHolder(id: number) {
    await supabase.from('money_holders').delete().eq('id', id)

    const { data } = await supabase
      .from('money_holders')
      .select('id, holder_name, amount')
      .eq('vault_id', vaultId)
      .eq('asset_type', assetType)
      .order('id')
    const updated = (data ?? []) as any
    setHolders(updated)
    await syncVaultBalance(updated)
  }

  const total = holders.reduce((s, h) => s + Number(h.amount), 0)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxHeight: '80vh', overflowY: 'auto', background: '#0d0d0d', border: `1px solid ${LINE}`, borderRadius: 10, padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Rekening {assetLabel}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 18, cursor: 'pointer' }}>&times;</button>
        </div>

        {loading && <p style={{ color: TEXT_MUTED, fontSize: 13 }}>Memuat...</p>}

        {!loading && holders.length === 0 && (
          <p style={{ color: TEXT_MUTED, fontSize: 13, marginBottom: 16 }}>Belum ada rekening tercatat.</p>
        )}

        {!loading &&
          holders.map((h) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{h.holder_name}</span>
              {isAdmin ? (
                <input
                  type="number"
                  defaultValue={h.amount}
                  onBlur={(e) => updateAmount(h.id, Number(e.target.value))}
                  style={{ width: 100, background: '#000', border: `1px solid ${LINE}`, borderRadius: 4, padding: '4px 8px', color: TEXT, fontSize: 12, outline: 'none' }}
                />
              ) : (
                <span style={{ fontSize: 13, fontFamily: 'monospace', color: GOLD_BRIGHT }}>${Number(h.amount).toLocaleString('en-US')}</span>
              )}
              {isAdmin && (
                <button onClick={() => removeHolder(h.id)} style={{ background: 'none', border: 'none', color: '#d97757', fontSize: 12, cursor: 'pointer' }}>
                  Hapus
                </button>
              )}
            </div>
          ))}

        {!loading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
            <span>Total Rekening</span>
            <span style={{ color: GOLD_BRIGHT, fontFamily: 'monospace' }}>${total.toLocaleString('en-US')}</span>
          </div>
        )}

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              type="text"
              placeholder="Nama orang"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, background: '#000', border: `1px solid ${LINE}`, borderRadius: 6, padding: '8px 10px', color: TEXT, fontSize: 12, outline: 'none' }}
            />
            <input
              type="number"
              placeholder="Jumlah"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              style={{ width: 100, background: '#000', border: `1px solid ${LINE}`, borderRadius: 6, padding: '8px 10px', color: TEXT, fontSize: 12, outline: 'none' }}
            />
            <button
              onClick={addHolder}
              disabled={saving}
              style={{ background: GOLD, color: BG, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Tambah
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center', padding: 20 }}>
      {children}
    </div>
  )
}

export default function VaultLedgerPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [search, setSearch] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const [openRekening, setOpenRekening] = useState<'uang_putih' | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return router.push('/login')

      const userId = sessionData.session.user.id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, username, role, is_approved')
        .eq('id', userId)
        .single()

      if (profileError || !profileData) return router.push('/login')

      setProfile(profileData as Profile)
      setChecking(false)
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    if (!profile || !profile.is_approved) return
    fetchAll()
  }, [profile])

  async function fetchAll() {
    const [vaultRes, itemRes] = await Promise.all([
      supabase.from('vaults').select('*').order('code', { ascending: true }),
      supabase.from('items').select(`id, name, image_path, item_categories ( name ), vault_items ( quantity, vaults ( name ) )`),
    ])
    if (vaultRes.error) return setError(vaultRes.error.message), setLoadingData(false)
    if (itemRes.error) return setError(itemRes.error.message), setLoadingData(false)

    setVaults(vaultRes.data as Vault[])
    const mapped: ItemRow[] = (itemRes.data ?? []).map((row: any) => {
      const vaultItems = row.vault_items ?? []
      return {
        id: row.id,
        name: row.name,
        image_path: row.image_path,
        category_name: row.item_categories?.name ?? 'Item',
        total_quantity: vaultItems.reduce((s: number, vi: any) => s + Number(vi.quantity), 0),
        vaultNames: vaultItems.filter((vi: any) => Number(vi.quantity) > 0).map((vi: any) => vi.vaults?.name).filter(Boolean)
      }
    })
    setItems(mapped)
    setCategories(Array.from(new Set(mapped.map((i) => i.category_name))))
    setLoadingData(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, itemId: number) {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const ext = file.name.split('.').pop()
    const fileName = `${itemId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(fileName, file)

    if (uploadError) {
      alert('Gagal mengunggah gambar: ' + uploadError.message)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('item-images')
      .getPublicUrl(fileName)

    const { data: updateData, error: updateError } = await supabase
      .from('items')
      .update({ image_path: publicUrl })
      .eq('id', itemId)
      .select()

    if (updateError) {
      alert('Gagal memperbarui database: ' + updateError.message)
      return
    }

    if (!updateData || updateData.length === 0) {
      alert('Gambar terunggah, tapi gagal menyimpan ke database (0 baris terubah). Ini pasti karena sistem keamanan (RLS) di tabel "items" memblokir proses Update. Silakan jalankan SQL untuk memberi akses update ke tabel items.')
      return
    }

    setItems((prev) => prev.map(item => item.id === itemId ? { ...item, image_path: publicUrl } : item))
  }

  async function handleGlobalImageUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'merah' | 'putih') {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const fileName = `uang-${type}-icon`

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(fileName, file, { upsert: true, cacheControl: '0' })

    if (uploadError) {
      alert('Gagal mengunggah gambar: ' + uploadError.message)
      return
    }

    setImageTimestamp(Date.now())
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalUangMerah = vaults.reduce((s, v) => s + Number(v.uang_merah), 0)
  const totalUangPutih = vaults.reduce((s, v) => s + Number(v.uang_putih), 0)
  const merahAnim = useCountUp(totalUangMerah)
  const putihAnim = useCountUp(totalUangPutih)

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCategory = activeCategory === 'Semua' || item.category_name === activeCategory
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [items, activeCategory, search])

  if (checking) return <Screen><p style={{ color: TEXT_MUTED }}>Memeriksa sesi...</p></Screen>

  if (profile && !profile.is_approved) {
    return (
      <Screen>
        <div>
          <p style={{ fontSize: 40, marginBottom: 12 }}>⏳</p>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, marginBottom: 8 }}>Menunggu Persetujuan</h2>
          <p style={{ fontSize: 13, color: TEXT_MUTED, maxWidth: 320, margin: '0 auto 20px' }}>
            Akun @{profile.username} sudah terdaftar, tapi belum disetujui admin.
          </p>
          <button onClick={handleLogout} style={{ background: 'transparent', border: `1px solid ${LINE}`, color: GOLD, borderRadius: 6, padding: '8px 18px', fontSize: 12, cursor: 'pointer' }}>
            Keluar
          </button>
        </div>
      </Screen>
    )
  }

  if (loadingData) return <Screen><p style={{ color: TEXT_MUTED }}>Membuka kunci brankas...</p></Screen>
  if (error) return <Screen><p style={{ color: '#d97757' }}>Gagal memuat data: {error}</p></Screen>

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <div className="layout-container" style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar />

        <main className="main-content">
          <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, marginBottom: 6 }}>REKAPITULASI HARTA</p>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, margin: 0 }}>Vault Ledger</h1>
            </div>
            <Dial size={56} />
          </div>

          <div className="glass shimmer-border fade-in" style={{ marginBottom: 36 }}>
            <div className="uang-box-container">
              <div className="uang-box-item" style={{ padding: '26px 30px', borderRight: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ width: 80, height: 60, background: '#252525', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid #333`, position: 'relative', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${supabase.storage.from('item-images').getPublicUrl('uang-merah-icon').data.publicUrl}?t=${imageTimestamp}`} alt="Uang Merah" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.setAttribute('style', 'display:block; font-size:32px;') }} />
                  <span style={{ fontSize: 32, display: 'none', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>💵</span>
                  {profile?.role === 'admin' && (
                    <label style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>EDIT</span>
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleGlobalImageUpload(e, 'merah')} />
                    </label>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, marginBottom: 8, fontWeight: 600 }}>UANG MERAH</p>
                  <p style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 34, color: GOLD_BRIGHT, margin: 0, textShadow: '0 0 20px rgba(240,202,107,0.35)' }}>
                    ${merahAnim.toLocaleString('en-US')}
                  </p>
                  <p style={{ fontSize: 11, color: '#666', marginTop: 8, marginBottom: 0 }}>Total stok Dirty Money di semua brankas</p>
                </div>
              </div>
              <div className="uang-box-item" style={{ padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ width: 80, height: 60, background: '#252525', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid #333`, position: 'relative', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${supabase.storage.from('item-images').getPublicUrl('uang-putih-icon').data.publicUrl}?t=${imageTimestamp}`} alt="Uang Putih" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.setAttribute('style', 'display:block; font-size:32px;') }} />
                  <span style={{ fontSize: 32, display: 'none', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>💶</span>
                  {profile?.role === 'admin' && (
                    <label style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>EDIT</span>
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleGlobalImageUpload(e, 'putih')} />
                    </label>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, marginBottom: 8, fontWeight: 600 }}>UANG PUTIH</p>
                  <p style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 34, color: TEXT, margin: 0 }}>
                    ${putihAnim.toLocaleString('en-US')}
                  </p>
                  {vaults[0] && (
                    <button
                      onClick={() => setOpenRekening('uang_putih')}
                      style={{ marginTop: 8, background: 'transparent', border: `1px solid ${LINE}`, color: GOLD_BRIGHT, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Lihat Rekening
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="fade-in" style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, marginBottom: 12 }}>UNIT BRANKAS</p>
          <div style={{ marginBottom: 40 }}>
            {vaults.map((vault, i) => (
              <div key={vault.id} className="vault-row fade-in" style={{ animationDelay: `${i * 60 + 100}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: GOLD_BRIGHT, width: 28, textAlign: 'center' }}>
                    {String(vault.code).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 14 }}>{vault.name}</span>
                </div>
                <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: 1 }}>AKSES TERBATAS</span>
              </div>
            ))}
          </div>

          <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, margin: 0 }}>BUKU BARANG</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Telusuri barang..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-glow" />
            </div>
          </div>

          <div className="fade-in" style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
            {['Semua', ...categories].map((cat) => {
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 24,
                    border: isActive ? `1px solid transparent` : `1px solid ${LINE}`,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 600,
                    background: isActive ? `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)` : 'transparent',
                    color: isActive ? '#000' : TEXT_MUTED,
                    boxShadow: isActive ? `0 4px 14px rgba(201,162,39,0.25)` : 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = GOLD
                      e.currentTarget.style.color = TEXT
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = LINE
                      e.currentTarget.style.color = TEXT_MUTED
                    }
                  }}
                >
                  {cat.toUpperCase()}
                </button>
              )
            })}
          </div>

          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
            {filteredItems.map((card, i) => (
              <div
                key={card.id}
                className="item-card fade-in"
                style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
                  <span style={{ color: GOLD_BRIGHT }}>⬡</span>
                  {card.name.toUpperCase()}
                </div>

                <div className="item-card-image" style={{ position: 'relative' }}>
                  {card.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image_path} alt={card.name} style={{ width: '90%', height: '90%', objectFit: 'contain', filter: `drop-shadow(0 10px 20px rgba(201,162,39,0.15))` }} />
                  ) : (
                    <span style={{ fontSize: 40, color: TEXT_MUTED, opacity: 0.1 }}>📦</span>
                  )}
                  {profile?.role === 'admin' && (
                    <label
                      style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s', borderRadius: 8 }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>EDIT</span>
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleImageUpload(e, card.id)} />
                    </label>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#777', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: GOLD_BRIGHT }}>■</span>
                    Stok: <span style={{ color: '#fff', fontWeight: 600, fontFamily: "'Courier New', monospace", fontSize: 14 }}>{card.total_quantity.toLocaleString('en-US')}</span>
                  </div>
                  <div>
                    Brankas: <span style={{ color: '#bbb' }}>{(card.vaultNames?.length ?? 0) > 0 ? card.vaultNames.length : 0}</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>Tidak ada catatan barang yang cocok.</div>
            )}
          </div>
        </main>
      </div>

      {openRekening && vaults[0] && (
        <RekeningModal
          vaultId={vaults[0].id}
          assetType="uang_putih"
          assetLabel="Uang Putih"
          isAdmin={profile?.role === 'admin'}
          onClose={() => setOpenRekening(null)}
          onChanged={fetchAll}
        />
      )}

      <style jsx>{`
        .glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
        .glow-a { width: 420px; height: 420px; top: -120px; left: 10%; background: radial-gradient(circle, rgba(201,162,39,0.25), transparent 70%); animation: drift 14s ease-in-out infinite; }
        .glow-b { width: 500px; height: 500px; bottom: -160px; right: 5%; background: radial-gradient(circle, rgba(201,162,39,0.12), transparent 70%); animation: drift 18s ease-in-out infinite reverse; }
        @keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,20px); } }
        .sidebar { width: 220px; min-height: 100vh; border-right: 1px solid ${LINE}; padding: 28px 20px; flex-shrink: 0; backdrop-filter: blur(6px); background: rgba(255,255,255,0.015); box-sizing: border-box; }
        .pulse-dot { width: 8px; height: 8px; background: ${GOLD}; border-radius: 50%; animation: pulseDot 2.4s ease-out infinite; }
        @keyframes pulseDot { 0% { box-shadow: 0 0 0 0 rgba(201,162,39,0.5); } 70% { box-shadow: 0 0 0 8px rgba(201,162,39,0); } 100% { box-shadow: 0 0 0 0 rgba(201,162,39,0); } }
        .nav-item { padding: 10px 12px; border-radius: 6px; font-size: 13px; color: ${TEXT_MUTED}; cursor: pointer; transition: all 0.25s ease; border-left: 2px solid transparent; }
        .nav-item:hover { background: ${SURFACE_HOVER}; color: ${GOLD_BRIGHT}; border-left: 2px solid ${GOLD}; transform: translateX(2px); }
        .nav-item-active { background: ${GOLD}; color: ${BG}; font-weight: 600; }
        .dial-spin { animation: spin 40s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .glass { background: ${SURFACE}; border: 1px solid ${LINE}; border-radius: 8px; backdrop-filter: blur(10px); }
        .shimmer-border { position: relative; }
        .shimmer-border::before { content: ''; position: absolute; inset: 0; border-radius: 8px; padding: 1px; background: linear-gradient(120deg, transparent 30%, rgba(240,202,107,0.6) 50%, transparent 70%); background-size: 200% 100%; animation: shimmer 5s linear infinite; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .vault-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: ${SURFACE}; border-left: 3px solid ${GOLD}; border-radius: 6px; margin-bottom: 6px; transition: all 0.25s ease; }
        .vault-row:hover { background: ${SURFACE_HOVER}; transform: translateX(4px); box-shadow: -4px 0 16px rgba(201,162,39,0.15); }
        .item-card { background: linear-gradient(180deg, #181a1f 0%, #111214 100%); border: 1px solid #222; border-radius: 16px; padding: 18px 18px 20px; display: flex; flex-direction: column; transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; position: relative; }
        .item-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.8), 0 0 15px rgba(201,162,39,0.05); border-color: #333; }
        .item-card-image { width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; position: relative; margin: 10px 0 16px; overflow: hidden; }
        .input-glow { background: ${SURFACE}; border: 1px solid ${LINE}; border-radius: 6px; padding: 8px 14px; color: ${TEXT}; font-size: 13px; outline: none; transition: all 0.25s ease; }
        .input-glow:focus { border-color: ${GOLD}; box-shadow: 0 0 0 3px rgba(201,162,39,0.15); }
        .sort-btn { background: transparent; border: 1px solid ${LINE}; border-radius: 6px; padding: 4px 10px; color: ${GOLD_BRIGHT}; font-size: 11px; cursor: pointer; transition: all 0.25s ease; }
        .sort-btn:hover { background: ${SURFACE_HOVER}; border-color: ${GOLD}; }
        .fade-in { animation: fadeIn 0.6s ease both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}