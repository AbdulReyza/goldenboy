'use client'

import { useEffect, useState, useMemo } from 'react'
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

type Vault = { id: number; name: string; code: number; uang_merah: number; uang_putih: number }
type Item = { id: number; name: string; category_name: string }
type LogEntry = {
  id: number
  created_at: string
  type: string
  before_value: number
  after_value: number
  note: string | null
  items: { name: string } | null
  profiles: { username: string } | null
}

type AssetType = 'item' | 'uang_merah' | 'uang_putih'

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

export default function TransaksiPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [vaults, setVaults] = useState<Vault[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])

  const [vaultId, setVaultId] = useState<number | null>(null)
  const [assetType, setAssetType] = useState<AssetType>('item')
  const [category, setCategory] = useState<string>('')
  const [itemId, setItemId] = useState<number | null>(null)
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  async function loadData() {
    const [vaultRes, itemRes, logRes] = await Promise.all([
      supabase.from('vaults').select('id, name, code, uang_merah, uang_putih').order('code'),
      supabase.from('items').select('id, name, item_categories(name)').order('name'),
      supabase
        .from('vault_logs')
        .select('id, created_at, type, before_value, after_value, note, items(name), profiles(username)')
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (vaultRes.data) {
      setVaults(vaultRes.data as Vault[])
      if (!vaultId && vaultRes.data.length > 0) setVaultId(vaultRes.data[0].id)
    }
    if (itemRes.data) {
      const mapped = itemRes.data.map((r: any) => ({
        id: r.id,
        name: r.name,
        category_name: r.item_categories?.name ?? 'Item',
      }))
      setItems(mapped)
      const cats = Array.from(new Set(mapped.map((i) => i.category_name)))
      setCategories(cats)
      if (!category && cats.length > 0) setCategory(cats[0])
    }
    if (logRes.data) setLogs(logRes.data as any)
  }

  useEffect(() => {
    if (!checking) loadData()
  }, [checking])

  // Set item default begitu kategori berubah
  const itemsInCategory = items.filter((i) => i.category_name === category)
  useEffect(() => {
    if (itemsInCategory.length > 0 && !itemsInCategory.find((i) => i.id === itemId)) {
      setItemId(itemsInCategory[0].id)
    }
  }, [category, items])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const qty = Number(amount)
    if (!vaultId || !qty || qty <= 0) {
      setMessage({ type: 'error', text: 'Isi jumlah dengan benar.' })
      return
    }
    if (assetType === 'item' && !itemId) {
      setMessage({ type: 'error', text: 'Pilih item dulu.' })
      return
    }

    setSubmitting(true)

    if (assetType === 'item') {
      // --- Transaksi barang ---
      const { data: existing } = await supabase
        .from('vault_items')
        .select('id, quantity')
        .eq('vault_id', vaultId)
        .eq('item_id', itemId)
        .maybeSingle()

      const currentQty = existing?.quantity ?? 0
      const newQty = action === 'deposit' ? currentQty + qty : currentQty - qty

      if (action === 'withdraw' && newQty < 0) {
        setMessage({ type: 'error', text: `Stok tidak cukup. Stok saat ini: ${currentQty.toLocaleString('en-US')}.` })
        setSubmitting(false)
        return
      }

      const { error: upsertError } = await supabase
        .from('vault_items')
        .upsert({ vault_id: vaultId, item_id: itemId, quantity: newQty }, { onConflict: 'vault_id,item_id' })

      if (upsertError) {
        setMessage({ type: 'error', text: 'Gagal menyimpan: ' + upsertError.message })
        setSubmitting(false)
        return
      }

      const itemName = items.find((i) => i.id === itemId)?.name ?? ''
      await supabase.from('vault_logs').insert({
        vault_id: vaultId,
        user_id: userId,
        item_id: itemId,
        type: 'item_update',
        before_value: currentQty,
        after_value: newQty,
        note: `${action === 'deposit' ? 'Deposit' : 'Withdraw'} ${itemName}: ${note || '-'}`,
      })
    } else {
      // --- Transaksi uang (merah / putih) ---
      const vault = vaults.find((v) => v.id === vaultId)
      if (!vault) {
        setSubmitting(false)
        return
      }
      const currentAmount = assetType === 'uang_merah' ? Number(vault.uang_merah) : Number(vault.uang_putih)
      const newAmount = action === 'deposit' ? currentAmount + qty : currentAmount - qty

      if (action === 'withdraw' && newAmount < 0) {
        setMessage({ type: 'error', text: `Saldo tidak cukup. Saldo saat ini: $${currentAmount.toLocaleString('en-US')}.` })
        setSubmitting(false)
        return
      }

      const column = assetType === 'uang_merah' ? 'uang_merah' : 'uang_putih'
      const { error: updateError } = await supabase
        .from('vaults')
        .update({ [column]: newAmount })
        .eq('id', vaultId)

      if (updateError) {
        setMessage({ type: 'error', text: 'Gagal menyimpan: ' + updateError.message })
        setSubmitting(false)
        return
      }

      await supabase.from('vault_logs').insert({
        vault_id: vaultId,
        user_id: userId,
        item_id: null,
        type: assetType === 'uang_merah' ? 'uang_merah_update' : 'uang_putih_update',
        before_value: currentAmount,
        after_value: newAmount,
        note: `${action === 'deposit' ? 'Deposit' : 'Withdraw'} ${assetType === 'uang_merah' ? 'Uang Merah' : 'Uang Putih'}: ${note || '-'}`,
      })
    }

    setMessage({ type: 'success', text: `${action === 'deposit' ? 'Deposit' : 'Withdraw'} berhasil.` })
    setAmount('')
    setNote('')
    loadData()
    setSubmitting(false)
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Memeriksa sesi...
      </div>
    )
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
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div className="main-content" style={{ color: TEXT }}>
        <a href="/" style={{ fontSize: 12, color: TEXT_MUTED, textDecoration: 'none' }}>&larr; Kembali ke Ledger</a>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: '12px 0 28px', textAlign: 'center' }}>Transaksi</h1>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <form onSubmit={handleSubmit} style={{ flex: '1 1 340px', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: 24, maxWidth: 420 }}>
            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Brankas</label>
            <select value={vaultId ?? ''} onChange={(e) => setVaultId(Number(e.target.value))} style={inputStyle}>
              {vaults.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>

            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Jenis Aset</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(['item', 'uang_merah', 'uang_putih'] as AssetType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAssetType(type)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6, border: `1px solid ${LINE}`, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    background: assetType === type ? GOLD : 'transparent',
                    color: assetType === type ? BG : TEXT_MUTED,
                  }}
                >
                  {type === 'item' ? 'Barang' : type === 'uang_merah' ? 'Uang Merah' : 'Uang Putih'}
                </button>
              ))}
            </div>

            {assetType === 'item' && (
              <>
                <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>

                <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Item</label>
                <select value={itemId ?? ''} onChange={(e) => setItemId(Number(e.target.value))} style={inputStyle}>
                  {itemsInCategory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </>
            )}

            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Jenis Transaksi</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setAction('deposit')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: `1px solid ${LINE}`, background: action === 'deposit' ? GOLD : 'transparent', color: action === 'deposit' ? BG : TEXT_MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Deposit (+)
              </button>
              <button
                type="button"
                onClick={() => setAction('withdraw')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: `1px solid ${LINE}`, background: action === 'withdraw' ? '#8a3b2f' : 'transparent', color: action === 'withdraw' ? TEXT : TEXT_MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Withdraw (-)
              </button>
            </div>

            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>
              Jumlah {assetType !== 'item' && '($)'}
            </label>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="contoh: 100" style={inputStyle} />

            <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Keterangan</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="contoh: hasil farming malam ini" style={{ ...inputStyle, marginBottom: 20 }} />

            {message && (
              <p style={{ fontSize: 12, marginBottom: 16, color: message.type === 'success' ? GOLD_BRIGHT : '#d97757' }}>{message.text}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', background: submitting ? TEXT_MUTED : GOLD, color: BG, border: 'none', borderRadius: 6, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: submitting ? 'default' : 'pointer' }}
            >
              {submitting ? 'Memproses...' : 'Konfirmasi Transaksi'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}