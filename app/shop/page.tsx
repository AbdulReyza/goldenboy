'use client'

import { useEffect, useMemo, useState } from 'react'
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

type Vault = { id: number; name: string; code: number }
type ShopItem = {
  id: number
  name: string
  category_name: string
  image_path: string | null
  price: number
  stock: number
}
type CartLine = { itemId: number; name: string; price: number; qty: number; maxStock: number }

export default function ShopPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  const [vaults, setVaults] = useState<Vault[]>([])
  const [vaultId, setVaultId] = useState<number | null>(null)
  const [payWith, setPayWith] = useState<'uang_merah' | 'uang_putih'>('uang_putih')

  const [items, setItems] = useState<ShopItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [search, setSearch] = useState('')

  const [cart, setCart] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return router.push('/login')

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved, role')
        .eq('id', data.session.user.id)
        .single()

      if (!profile || !profile.is_approved) return router.push('/')

      setUserId(data.session.user.id)
      setRole(profile.role)
      setChecking(false)
    }
    check()
  }, [router])

  async function loadShop() {
    const [vaultRes, itemRes] = await Promise.all([
      supabase.from('vaults').select('id, name, code').order('code'),
      supabase.from('items').select(`
        id, name, price, image_path,
        item_categories ( name ),
        vault_items ( quantity, vault_id )
      `).eq('is_for_sale', true),
    ])

    if (vaultRes.data) {
      setVaults(vaultRes.data as Vault[])
      if (!vaultId && vaultRes.data.length > 0) setVaultId(vaultRes.data[0].id)
    }

    if (itemRes.data) {
      const mapped: ShopItem[] = itemRes.data.map((row: any) => {
        const vi = (row.vault_items ?? []).find((v: any) => v.vault_id === (vaultId ?? vaultRes.data?.[0]?.id))
        return {
          id: row.id,
          name: row.name,
          category_name: row.item_categories?.name ?? 'Item',
          image_path: row.image_path,
          price: Number(row.price ?? 0),
          stock: Number(vi?.quantity ?? 0),
        }
      })
      setItems(mapped)
      setCategories(Array.from(new Set(mapped.map((i) => i.category_name))))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!checking) loadShop()
  }, [checking, vaultId])

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const matchCategory = activeCategory === 'Semua' || i.category_name === activeCategory
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [items, activeCategory, search])

  function addToCart(item: ShopItem) {
    if (item.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id)
      if (existing) {
        if (existing.qty >= item.stock) return prev
        return prev.map((c) => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1, maxStock: item.stock }]
    })
  }

  function updateQty(itemId: number, qty: number) {
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, qty: Math.max(1, Math.min(qty, c.maxStock)) } : c))
    )
  }

  function removeFromCart(itemId: number) {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId))
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0)

  async function handleCheckout() {
    if (!vaultId || cart.length === 0) return
    setCheckingOut(true)
    setMessage(null)

    for (const line of cart) {
      const { data: existing } = await supabase
        .from('vault_items')
        .select('quantity')
        .eq('vault_id', vaultId)
        .eq('item_id', line.itemId)
        .maybeSingle()

      const currentQty = existing?.quantity ?? 0
      const newQty = currentQty - line.qty

      if (newQty < 0) {
        setMessage({ type: 'error', text: `Stok ${line.name} tidak cukup lagi. Muat ulang halaman.` })
        setCheckingOut(false)
        return
      }

      await supabase.from('vault_items').update({ quantity: newQty }).eq('vault_id', vaultId).eq('item_id', line.itemId)

      await supabase.from('vault_logs').insert({
        vault_id: vaultId,
        user_id: userId,
        item_id: line.itemId,
        type: 'item_update',
        before_value: currentQty,
        after_value: newQty,
        note: `Shop: dibeli ${line.qty}x ${line.name} seharga $${(line.price * line.qty).toLocaleString('en-US')}`,
      })
    }

    const { data: vault } = await supabase.from('vaults').select('uang_merah, uang_putih').eq('id', vaultId).single()
    if (vault) {
      const currentBalance = payWith === 'uang_merah' ? Number(vault.uang_merah) : Number(vault.uang_putih)
      const newBalance = currentBalance + total
      await supabase.from('vaults').update({ [payWith]: newBalance }).eq('id', vaultId)

      await supabase.from('vault_logs').insert({
        vault_id: vaultId,
        user_id: userId,
        item_id: null,
        type: payWith === 'uang_merah' ? 'uang_merah_update' : 'uang_putih_update',
        before_value: currentBalance,
        after_value: newBalance,
        note: `Pembayaran shop dari member`,
      })
    }

    setMessage({ type: 'success', text: 'Checkout berhasil! Barang sudah dikeluarkan dari brankas.' })
    setCart([])
    loadShop()
    setCheckingOut(false)
  }

  if (checking || loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Memuat toko...
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    background: SURFACE,
    border: `1px solid ${LINE}`,
    borderRadius: 6,
    padding: '8px 12px',
    color: TEXT,
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div className="main-content" style={{ color: TEXT }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, marginBottom: 6 }}>Shop</h1>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 28 }}>
          Pilih barang dari brankas, checkout, stok otomatis berkurang.
        </p>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Cari nama produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 180 }}
              />
              <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} style={inputStyle}>
                {['Semua', ...categories].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select value={vaultId ?? ''} onChange={(e) => setVaultId(Number(e.target.value))} style={inputStyle}>
                {vaults.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.itemId === item.id)
                return (
                  <div key={item.id} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderTop: `2px solid ${GOLD}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', background: BG, border: `1px solid ${LINE}`, borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_path} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 22, opacity: 0.3 }}>📦</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: TEXT_MUTED, textTransform: 'uppercase', marginBottom: 4 }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: item.stock > 0 ? TEXT_MUTED : '#d97757', marginBottom: 6 }}>
                      Stok: {item.stock.toLocaleString('id-ID')}
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: GOLD_BRIGHT, marginBottom: 10 }}>
                      ${item.price.toLocaleString('en-US')}
                    </p>
                    <button
                      onClick={() => addToCart(item)}
                      disabled={item.stock <= 0 || (!!inCart && inCart.qty >= item.stock)}
                      style={{
                        width: '100%', padding: '8px 0', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                        background: item.stock > 0 ? GOLD : '#333',
                        color: item.stock > 0 ? BG : TEXT_MUTED,
                        cursor: item.stock > 0 ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {item.stock <= 0 ? 'Stok Habis' : inCart ? `Di Keranjang (${inCart.qty})` : 'Tambah ke Keranjang'}
                    </button>
                  </div>
                )
              })}
              {filteredItems.length === 0 && <p style={{ color: TEXT_MUTED, gridColumn: '1 / -1' }}>Tidak ada barang ditemukan.</p>}
            </div>
          </div>

          <div style={{ flex: '1 1 280px', maxWidth: 320 }}>
            <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: 20, position: 'sticky', top: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Keranjang</p>

              {cart.length === 0 && <p style={{ fontSize: 12, color: TEXT_MUTED }}>Belum ada barang dipilih.</p>}

              {cart.map((line) => (
                <div key={line.itemId} style={{ marginBottom: 14, borderBottom: `1px solid ${LINE}`, paddingBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{line.name}</span>
                    <button onClick={() => removeFromCart(line.itemId)} style={{ background: 'none', border: 'none', color: '#d97757', fontSize: 11, cursor: 'pointer' }}>Hapus</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      max={line.maxStock}
                      value={line.qty}
                      onChange={(e) => updateQty(line.itemId, Number(e.target.value))}
                      style={{ ...inputStyle, width: 60, padding: '4px 8px' }}
                    />
                    <span style={{ fontSize: 12, color: TEXT_MUTED }}>x ${line.price.toLocaleString('en-US')}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: GOLD_BRIGHT, fontFamily: 'monospace' }}>
                      ${(line.price * line.qty).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              ))}

              {cart.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: GOLD_BRIGHT, fontFamily: 'monospace' }}>${total.toLocaleString('en-US')}</span>
                  </div>

                  <label style={{ fontSize: 11, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Bayar dengan</label>
                  <select value={payWith} onChange={(e) => setPayWith(e.target.value as any)} style={{ ...inputStyle, width: '100%', marginBottom: 14, boxSizing: 'border-box' }}>
                    <option value="uang_putih">Uang Putih</option>
                    <option value="uang_merah">Uang Merah</option>
                  </select>

                  {message && (
                    <p style={{ fontSize: 12, marginBottom: 12, color: message.type === 'success' ? GOLD_BRIGHT : '#d97757' }}>{message.text}</p>
                  )}

                  <button
                    onClick={handleCheckout}
                    disabled={checkingOut}
                    style={{ width: '100%', background: checkingOut ? TEXT_MUTED : GOLD, color: BG, border: 'none', borderRadius: 6, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: checkingOut ? 'default' : 'pointer' }}
                  >
                    {checkingOut ? 'Memproses...' : 'Checkout'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}