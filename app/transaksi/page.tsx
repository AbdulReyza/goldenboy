'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import GoldSelect from '@/app/components/GoldSelect'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

type Vault = { id: number; name: string; code: number }
type Item = { id: number; name: string; category_name: string }
type Holder = { id: number; holder_name: string; amount: number }
type MyRequest = {
  id: number
  created_at: string
  asset_type: string
  action: string
  amount: number
  note: string | null
  status: string
  holder_name: string | null
  items: { name: string } | null
}

type AssetType = 'item' | 'uang_merah' | 'uang_putih'

const PAKET_NARKO = [
  { match: 'weed bag', label: 'Weed Bag', qty: 4 },
  { match: 'meth bag', label: 'Meth Bag', qty: 2 },
  { match: 'opium bag', label: 'Opium Bag', qty: 1 },
  { match: 'cocain', label: 'Cocaine Bag', qty: 1 },
]

function statusBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: '#e0a800', label: 'Menunggu' },
    approved: { color: GOLD_BRIGHT, label: 'Disetujui' },
    rejected: { color: '#d97757', label: 'Ditolak' },
  }
  const s = map[status] ?? map.pending
  return <span style={{ fontSize: 10, color: s.color, border: `1px solid ${s.color}55`, borderRadius: 10, padding: '2px 8px' }}>{s.label}</span>
}

export default function TransaksiPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [vaults, setVaults] = useState<Vault[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [myRequests, setMyRequests] = useState<MyRequest[]>([])

  const [vaultId, setVaultId] = useState<number | null>(null)
  const [assetType, setAssetType] = useState<AssetType>('item')
  const [category, setCategory] = useState<string>('')
  const [itemId, setItemId] = useState<number | null>(null)
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [putihHolders, setPutihHolders] = useState<Holder[]>([])
  const [holderId, setHolderId] = useState<number | null>(null)

  const [sendingPaket, setSendingPaket] = useState(false)
  const [paketMessage, setPaketMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    const [vaultRes, itemRes, reqRes] = await Promise.all([
      supabase.from('vaults').select('id, name, code').order('code'),
      supabase.from('items').select('id, name, item_categories(name)').order('name'),
      supabase
        .from('transaction_requests')
        .select('id, created_at, asset_type, action, amount, note, status, holder_name, items(name)')
        .eq('source', 'transaksi')
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
    if (reqRes.data) setMyRequests(reqRes.data as any)
  }

  async function loadHolders() {
    if (!vaultId) return
    const { data } = await supabase
      .from('money_holders')
      .select('id, holder_name, amount')
      .eq('vault_id', vaultId)
      .eq('asset_type', 'uang_putih')
      .order('id')

    const list = (data ?? []) as Holder[]
    setPutihHolders(list)
    setHolderId(list.length > 0 ? list[0].id : null)
  }

  useEffect(() => {
    if (!checking) loadData()
  }, [checking])

  useEffect(() => {
    if (!checking && vaultId) loadHolders()
  }, [checking, vaultId])

  const itemsInCategory = items.filter((i) => i.category_name === category)
  useEffect(() => {
    if (itemsInCategory.length > 0 && !itemsInCategory.find((i) => i.id === itemId)) {
      setItemId(itemsInCategory[0].id)
    }
  }, [category, items])

  const selectedHolder = putihHolders.find((h) => h.id === holderId) ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const qty = Number(amount)
    if (!vaultId || !qty || qty <= 0) {
      setMessage({ type: 'error', text: 'Isi jumlah dengan benar.' })
      return
    }
    if (qty > 999999999999) {
      setMessage({ type: 'error', text: 'Jumlah terlalu besar, cek lagi apakah kelebihan nol.' })
      return
    }
    if (assetType === 'item' && !itemId) {
      setMessage({ type: 'error', text: 'Pilih item dulu.' })
      return
    }
    if (assetType === 'uang_putih' && !holderId) {
      setMessage({ type: 'error', text: 'Pilih nama penerima Uang Putih dulu.' })
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('transaction_requests').insert({
      user_id: userId,
      vault_id: vaultId,
      asset_type: assetType,
      action,
      item_id: assetType === 'item' ? itemId : null,
      amount: qty,
      note: note || null,
      source: 'transaksi',
      holder_id: assetType === 'uang_putih' ? holderId : null,
      holder_name: assetType === 'uang_putih' ? selectedHolder?.holder_name ?? null : null,
    })

    if (error) {
      const friendlyError = error.message.toLowerCase().includes('numeric field overflow')
        ? 'Jumlah terlalu besar, cek lagi apakah kelebihan nol.'
        : 'Gagal mengajukan: ' + error.message
      setMessage({ type: 'error', text: friendlyError })
      setSubmitting(false)
      return
    }

    setMessage({ type: 'success', text: 'Permintaan dikirim, menunggu persetujuan admin.' })
    setAmount('')
    setNote('')
    loadData()
    setSubmitting(false)
  }

  async function handlePaketNarko() {
    if (!vaultId) return
    setPaketMessage(null)
    setSendingPaket(true)

    const batchId = crypto.randomUUID()
    const rows: any[] = []
    const notFound: string[] = []

    for (const p of PAKET_NARKO) {
      const found = items.find((i) => i.name.toLowerCase().includes(p.match))
      if (!found) {
        notFound.push(p.label)
        continue
      }
      rows.push({
        batch_id: batchId,
        user_id: userId,
        vault_id: vaultId,
        asset_type: 'item',
        action: 'withdraw',
        item_id: found.id,
        amount: p.qty,
        note: `Paket Narko: ${p.qty}x ${found.name}`,
        source: 'transaksi',
      })
    }

    if (notFound.length > 0) {
      setPaketMessage({ type: 'error', text: `Item tidak ditemukan di database: ${notFound.join(', ')}. Cek nama item di Buku Barang.` })
      setSendingPaket(false)
      return
    }

    const { error } = await supabase.from('transaction_requests').insert(rows)

    if (error) {
      setPaketMessage({ type: 'error', text: 'Gagal mengajukan paket: ' + error.message })
      setSendingPaket(false)
      return
    }

    setPaketMessage({ type: 'success', text: 'Paket Narko diajukan! Menunggu persetujuan admin.' })
    loadData()
    setSendingPaket(false)
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
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, padding: '36px 44px', color: TEXT }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: '0 0 6px' }}>Transaksi</h1>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 24 }}>
          Permintaan kamu akan diproses setelah disetujui admin.
        </p>

        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: '16px 20px', marginBottom: 28, maxWidth: 700 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: GOLD_BRIGHT, marginBottom: 4 }}>PAKET CEPAT</p>
          <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>
            Paket Narko: 4x Weed Bag, 2x Meth Bag, 1x Opium Bag, 1x Cocaine Bag (ambil sekaligus dari brankas terpilih di form kanan).
          </p>
          <button
            onClick={handlePaketNarko}
            disabled={sendingPaket || !vaultId}
            style={{
              background: sendingPaket ? TEXT_MUTED : GOLD, color: BG, border: 'none', borderRadius: 6,
              padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: sendingPaket ? 'default' : 'pointer',
            }}
          >
            {sendingPaket ? 'Mengirim...' : 'Ambil Paket Narko'}
          </button>
          {paketMessage && (
            <p style={{ fontSize: 12, marginTop: 10, color: paketMessage.type === 'success' ? GOLD_BRIGHT : '#d97757' }}>
              {paketMessage.text}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <form onSubmit={handleSubmit} style={{ flex: '1 1 340px', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: 24, maxWidth: 380 }}>
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

            {assetType === 'uang_putih' && (
              <>
                <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Nama Penerima</label>
                {putihHolders.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#d97757', marginBottom: 16 }}>
                    Belum ada rekening Uang Putih untuk brankas ini. Minta admin menambahkannya lewat "Lihat Rekening" di Vault Ledger.
                  </p>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    <GoldSelect
                      value={holderId ? String(holderId) : ''}
                      onChange={(v) => setHolderId(Number(v))}
                      options={putihHolders.map((h) => ({
                        value: String(h.id),
                        label: `${h.holder_name} (Rp${h.amount.toLocaleString('id-ID')})`,
                      }))}
                    />
                  </div>
                )}
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
              {submitting ? 'Mengirim...' : 'Ajukan Transaksi'}
            </button>
          </form>

          <div style={{ flex: '1 1 380px' }}>
            <p style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, marginBottom: 12 }}>PERMINTAAN SAYA</p>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden' }}>
              {myRequests.length === 0 && <p style={{ padding: 20, fontSize: 13, color: TEXT_MUTED }}>Belum ada permintaan.</p>}
              {myRequests.map((req) => {
                const label =
                  req.asset_type === 'uang_merah' ? 'Uang Merah' :
                  req.asset_type === 'uang_putih' ? 'Uang Putih' :
                  req.items?.name ?? 'Item'
                return (
                  <div key={req.id} style={{ padding: '12px 18px', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>
                        {req.action === 'deposit' ? '+' : '-'} {label}
                        {req.holder_name ? ` · ${req.holder_name}` : ''}
                      </span>
                      {statusBadge(req.status)}
                    </div>
                    <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
                      Jumlah: {Number(req.amount).toLocaleString('id-ID')} &middot; {new Date(req.created_at).toLocaleString('id-ID')}
                    </p>
                    {req.note && <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '2px 0 0' }}>{req.note}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}