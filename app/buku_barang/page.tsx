'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#0a0a0a' // Darker background to match screenshot
const CARD_BG = '#141414' // Card background
const PILL_BORDER = '#222'
const IMAGE_BG = '#1f1f1f'
const LINE = 'rgba(255,255,255,0.05)'
const TEXT = '#e0e0e0'
const TEXT_MUTED = '#777'

type Card = {
  id: number
  name: string
  category_name: string
  image_path: string | null
  total_quantity: number
  vaultNames: string[]
}

function navItemStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 6,
    fontSize: 13,
    color: active ? '#000' : TEXT_MUTED,
    background: active ? GOLD : 'transparent',
    fontWeight: active ? 600 : 400,
    textDecoration: 'none',
    display: 'block',
  }
}

export default function BukuBarangPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [cards, setCards] = useState<Card[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ id: string; role: string; is_approved: boolean } | null>(null)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return router.push('/login')

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, role, is_approved')
        .eq('id', data.session.user.id)
        .single()

      if (!profileData || !profileData.is_approved) return router.push('/')
      setProfile(profileData)
      setChecking(false)
    }
    check()
  }, [router])

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

    setCards((prev) => prev.map(item => item.id === itemId ? { ...item, image_path: publicUrl } : item))
  }

  useEffect(() => {
    if (checking) return
    async function fetchItems() {
      const { data, error } = await supabase.from('items').select(`
        id,
        name,
        image_path,
        item_categories ( name ),
        vault_items ( quantity, vaults ( name ) )
      `)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const mapped: Card[] = (data ?? []).map((row: any) => {
        const vaultItems = row.vault_items ?? []
        const total = vaultItems.reduce((sum: number, vi: any) => sum + Number(vi.quantity), 0)
        const vaultNames = vaultItems
          .filter((vi: any) => Number(vi.quantity) > 0)
          .map((vi: any) => vi.vaults?.name)
          .filter(Boolean)

        return {
          id: row.id,
          name: row.name,
          category_name: row.item_categories?.name ?? 'Item',
          image_path: row.image_path,
          total_quantity: total,
          vaultNames,
        }
      })

      setCards(mapped)
      setCategories(Array.from(new Set(mapped.map((c) => c.category_name))))
      setLoading(false)
    }
    fetchItems()
  }, [checking])

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      const matchCategory = activeCategory === 'Semua' || c.category_name === activeCategory
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [cards, activeCategory, search])

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

      <div className="main-content" style={{ color: TEXT, display: 'flex', flexDirection: 'column' }}>
        
        {/* Search Bar */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Cari nama item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', 
              maxWidth: 320, 
              background: '#1a1a1a', 
              border: `1px solid ${PILL_BORDER}`, 
              borderRadius: 24, 
              padding: '12px 20px', 
              color: TEXT, 
              fontSize: 14, 
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = GOLD}
            onBlur={(e) => e.target.style.borderColor = PILL_BORDER}
          />
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          {['Semua', ...categories].map((cat) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 18px', 
                  borderRadius: 24, 
                  border: isActive ? `1px solid transparent` : `1px solid ${PILL_BORDER}`, 
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
                    e.currentTarget.style.borderColor = PILL_BORDER
                    e.currentTarget.style.color = TEXT_MUTED
                  }
                }}
              >
                {cat.toUpperCase()}
              </button>
            )
          })}
        </div>

        {loading && <p style={{ color: TEXT_MUTED }}>Memuat...</p>}
        {error && <p style={{ color: '#d97757' }}>Gagal memuat data: {error}</p>}

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
          {filtered.map((card, i) => (
            <div
              key={card.id}
              className="item-card fade-in"
              style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
            >
              {/* Header (Top Left) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
                <span style={{ color: GOLD_BRIGHT }}>⬡</span>
                {card.name.toUpperCase()}
              </div>

              {/* Main Image Area */}
              <div className="item-card-image">
                {card.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image_path} alt={card.name} style={{ width: '90%', height: '90%', objectFit: 'contain', filter: `drop-shadow(0 10px 20px rgba(201,162,39,0.15))` }} />
                ) : (
                  <span style={{ fontSize: 40, color: TEXT_MUTED, opacity: 0.1 }}>📦</span>
                )}
              </div>

              {/* Info Row (Items / Remainder) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#777', marginBottom: 16, marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: GOLD_BRIGHT }}>■</span>
                  Stok: <span style={{ color: '#fff', fontWeight: 600, fontFamily: "'Courier New', monospace", fontSize: 14 }}>{card.total_quantity.toLocaleString('en-US')}</span>
                </div>
                <div>
                  Brankas: <span style={{ color: '#bbb' }}>{(card.vaultNames?.length ?? 0) > 0 ? card.vaultNames.length : 0}</span>
                </div>
              </div>

              {/* Edit Button (Bottom) */}
              {profile?.role === 'admin' ? (
                <label className="card-btn">
                  Edit Barang
                  <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleImageUpload(e, card.id)} />
                </label>
              ) : (
                <button className="card-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  Lihat Detail
                </button>
              )}
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <p style={{ color: TEXT_MUTED, gridColumn: '1 / -1', marginTop: 20 }}>Tidak ada item ditemukan.</p>
          )}
        </div>
      </div>

      <style jsx>{`
        .item-card { background: linear-gradient(180deg, #181a1f 0%, #111214 100%); border: 1px solid #222; border-radius: 16px; padding: 18px 18px 20px; display: flex; flex-direction: column; transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; position: relative; }
        .item-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.8), 0 0 15px rgba(201,162,39,0.05); border-color: #333; }
        .item-card-image { width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; position: relative; margin: 10px 0 20px; overflow: hidden; }
        .card-btn { width: 100%; display: block; text-align: center; background: linear-gradient(90deg, #C9A227 0%, #F0CA6B 100%); color: #000; border: none; border-radius: 20px; padding: 10px 0; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; box-shadow: 0 4px 14px rgba(201,162,39,0.25); text-transform: uppercase; letter-spacing: 0.5px; }
        .card-btn:active { transform: scale(0.97); }
        .fade-in { animation: fadeIn 0.6s ease both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}