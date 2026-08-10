'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

type ManagedItem = {
  id: number
  name: string
  category_name: string
  price: number
  is_for_sale: boolean
  dirty: boolean
}

export default function KelolaShopPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [items, setItems] = useState<ManagedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return router.push('/login')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_approved')
        .eq('id', data.session.user.id)
        .single()

      if (!profile || !profile.is_approved || profile.role !== 'admin') return router.push('/')

      setChecking(false)
    }
    check()
  }, [router])

  async function loadItems() {
    const { data } = await supabase
      .from('items')
      .select('id, name, price, is_for_sale, item_categories(name)')
      .order('name')

    if (data) {
      setItems(
        data.map((row: any) => ({
          id: row.id,
          name: row.name,
          category_name: row.item_categories?.name ?? 'Item',
          price: Number(row.price ?? 0),
          is_for_sale: row.is_for_sale,
          dirty: false,
        }))
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!checking) loadItems()
  }, [checking])

  function toggleForSale(id: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_for_sale: !i.is_for_sale, dirty: true } : i)))
  }

  function updatePrice(id: number, price: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, price, dirty: true } : i)))
  }

  async function saveItem(item: ManagedItem) {
    const { error } = await supabase
      .from('items')
      .update({ price: item.price, is_for_sale: item.is_for_sale })
      .eq('id', item.id)

    if (error) {
      setNotice('Gagal menyimpan ' + item.name + ': ' + error.message)
      return
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, dirty: false } : i)))
    setNotice(`${item.name} disimpan.`)
  }

  async function saveAll() {
    const dirtyItems = items.filter((i) => i.dirty)
    for (const item of dirtyItems) {
      await supabase.from('items').update({ price: item.price, is_for_sale: item.is_for_sale }).eq('id', item.id)
    }
    setItems((prev) => prev.map((i) => ({ ...i, dirty: false })))
    setNotice(`${dirtyItems.length} barang disimpan.`)
  }

  if (checking || loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Memuat...
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    background: BG,
    border: `1px solid ${LINE}`,
    borderRadius: 6,
    padding: '6px 10px',
    color: TEXT,
    fontSize: 13,
    outline: 'none',
    width: 110,
  }

  return (
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div className="main-content" style={{ color: TEXT }}>
      <a href="/" style={{ fontSize: 12, color: TEXT_MUTED, textDecoration: 'none' }}>&larr; Kembali ke Inventory</a>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '12px 0 24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: 0 }}>Kelola Shop</h1>
          <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 6 }}>Pilih barang yang ditampilkan di halaman Shop, dan atur harganya.</p>
        </div>
        <button
          onClick={saveAll}
          style={{ background: GOLD, color: BG, border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Simpan Semua Perubahan
        </button>
      </div>

      {notice && <p style={{ fontSize: 13, color: GOLD_BRIGHT, marginBottom: 16 }}>{notice}</p>}

      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', padding: '10px 20px', fontSize: 10, letterSpacing: 1.5, color: TEXT_MUTED, borderBottom: `1px solid ${LINE}`, background: SURFACE }}>
          <span>NAMA BARANG</span>
          <span>KATEGORI</span>
          <span>JUAL DI SHOP</span>
          <span>HARGA ($)</span>
          <span></span>
        </div>

        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
              padding: '10px 20px',
              fontSize: 13,
              alignItems: 'center',
              background: i % 2 === 0 ? 'transparent' : SURFACE,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            <span>{item.name}</span>
            <span style={{ color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase' }}>{item.category_name}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={item.is_for_sale} onChange={() => toggleForSale(item.id)} />
              <span style={{ fontSize: 12, color: item.is_for_sale ? GOLD_BRIGHT : TEXT_MUTED }}>
                {item.is_for_sale ? 'Aktif' : 'Nonaktif'}
              </span>
            </label>
            <input
              type="number"
              min={0}
              value={item.price}
              onChange={(e) => updatePrice(item.id, Number(e.target.value))}
              style={inputStyle}
            />
            <button
              onClick={() => saveItem(item)}
              disabled={!item.dirty}
              style={{
                background: item.dirty ? GOLD : 'transparent',
                color: item.dirty ? BG : TEXT_MUTED,
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 11,
                cursor: item.dirty ? 'pointer' : 'default',
              }}
            >
              {item.dirty ? 'Simpan' : 'Tersimpan'}
            </button>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}