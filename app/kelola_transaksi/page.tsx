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
const RED = '#d97757'

type Req = {
  id: number
  batch_id: string
  created_at: string
  asset_type: string
  action: string
  amount: number
  note: string | null
  status: string
  source: string
  vault_id: number
  item_id: number | null
  user_id: string
  holder_id: number | null
  holder_name: string | null
  profiles: { username: string } | null
  items: { name: string, image_path: string | null } | null
  vaults: { name: string } | null
}

type Batch = {
  batchId: string
  createdAt: string
  username: string
  source: string
  rows: Req[]
}

function initials(name: string) {
  return (name || '?').slice(0, 1).toUpperCase()
}

function assetLabel(row: Req) {
  if (row.asset_type === 'uang_merah') return 'Uang Merah'
  if (row.asset_type === 'uang_putih') return 'Uang Putih'
  return row.items?.name ?? 'Barang (tidak diketahui)'
}

export default function KelolaTransaksiPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [processingBatch, setProcessingBatch] = useState<string | null>(null)
  const [leavingBatch, setLeavingBatch] = useState<string | null>(null)

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

      setAdminId(data.session.user.id)
      setChecking(false)
    }
    check()
  }, [router])

  async function loadRequests() {
    const { data, error } = await supabase
      .from('transaction_requests')
      .select(
        'id, batch_id, created_at, asset_type, action, amount, note, status, source, vault_id, item_id, user_id, holder_id, holder_name, profiles!user_id(username), items(name, image_path), vaults(name)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      setNotice({ type: 'error', text: 'Gagal memuat data: ' + error.message })
      setLoading(false)
      return
    }

    if (data) {
      const grouped: Record<string, Batch> = {}
      for (const row of data as any as Req[]) {
        if (!grouped[row.batch_id]) {
          grouped[row.batch_id] = {
            batchId: row.batch_id,
            createdAt: row.created_at,
            username: row.profiles?.username ?? '-',
            source: row.source,
            rows: [],
          }
        }
        grouped[row.batch_id].rows.push(row)
      }
      setBatches(Object.values(grouped))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!checking) loadRequests()
  }, [checking])

  async function applyRow(row: Req) {
    if (row.asset_type === 'item' && row.item_id) {
      const { data: existing } = await supabase
        .from('vault_items')
        .select('quantity')
        .eq('vault_id', row.vault_id)
        .eq('item_id', row.item_id)
        .maybeSingle()

      const currentQty = existing?.quantity ?? 0
      const newQty = row.action === 'deposit' ? currentQty + Number(row.amount) : currentQty - Number(row.amount)

      if (newQty < 0) {
        throw new Error(`Stok ${row.items?.name ?? 'item'} tidak cukup (sisa ${currentQty}).`)
      }

      await supabase.from('vault_items').upsert(
        { vault_id: row.vault_id, item_id: row.item_id, quantity: newQty },
        { onConflict: 'vault_id,item_id' }
      )

      await supabase.from('vault_logs').insert({
        vault_id: row.vault_id,
        user_id: row.user_id,
        item_id: row.item_id,
        type: 'item_update',
        before_value: currentQty,
        after_value: newQty,
        note: row.note,
      })
    } else if (row.asset_type === 'uang_putih' && row.holder_id) {
      // --- Uang Putih dengan rekening spesifik ---
      const { data: holder } = await supabase
        .from('money_holders')
        .select('amount')
        .eq('id', row.holder_id)
        .maybeSingle()

      const currentAmount = Number(holder?.amount ?? 0)
      const newAmount = row.action === 'deposit' ? currentAmount + Number(row.amount) : currentAmount - Number(row.amount)

      if (newAmount < 0) {
        throw new Error(`Saldo rekening ${row.holder_name ?? ''} tidak cukup (sisa ${currentAmount}).`)
      }

      await supabase.from('money_holders').update({ amount: newAmount }).eq('id', row.holder_id)

      // Samakan total saldo Uang Putih vault dengan jumlah semua rekening
      const { data: allHolders } = await supabase
        .from('money_holders')
        .select('amount')
        .eq('vault_id', row.vault_id)
        .eq('asset_type', 'uang_putih')

      const totalPutih = (allHolders ?? []).reduce((s: number, h: any) => s + Number(h.amount), 0)
      await supabase.from('vaults').update({ uang_putih: totalPutih }).eq('id', row.vault_id)

      await supabase.from('vault_logs').insert({
        vault_id: row.vault_id,
        user_id: row.user_id,
        item_id: null,
        type: 'uang_putih_update',
        before_value: currentAmount,
        after_value: newAmount,
        note: row.note ? `${row.note} (Rekening: ${row.holder_name ?? '-'})` : `Rekening: ${row.holder_name ?? '-'}`,
      })
    } else {
      const { data: vault } = await supabase.from('vaults').select('uang_merah, uang_putih').eq('id', row.vault_id).single()
      if (!vault) return

      const currentBalance = row.asset_type === 'uang_merah' ? Number(vault.uang_merah) : Number(vault.uang_putih)
      const newBalance = row.action === 'deposit' ? currentBalance + Number(row.amount) : currentBalance - Number(row.amount)

      if (newBalance < 0) {
        throw new Error(`Saldo ${row.asset_type === 'uang_merah' ? 'Uang Merah' : 'Uang Putih'} tidak cukup.`)
      }

      const column = row.asset_type
      await supabase.from('vaults').update({ [column]: newBalance }).eq('id', row.vault_id)

      await supabase.from('vault_logs').insert({
        vault_id: row.vault_id,
        user_id: row.user_id,
        item_id: null,
        type: row.asset_type === 'uang_merah' ? 'uang_merah_update' : 'uang_putih_update',
        before_value: currentBalance,
        after_value: newBalance,
        note: row.note,
      })
    }
  }

  async function dismissBatch(batch: Batch) {
    setLeavingBatch(batch.batchId)
    await new Promise((r) => setTimeout(r, 260))
    setBatches((prev) => prev.filter((b) => b.batchId !== batch.batchId))
    setLeavingBatch(null)
  }

  async function handleApprove(batch: Batch) {
    setProcessingBatch(batch.batchId)
    setNotice(null)
    try {
      for (const row of batch.rows) {
        await applyRow(row)
      }
      await supabase
        .from('transaction_requests')
        .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq('batch_id', batch.batchId)

      setNotice({ type: 'success', text: `Permintaan dari @${batch.username} disetujui.` })
      await dismissBatch(batch)
    } catch (err: any) {
      setNotice({ type: 'error', text: 'Gagal memproses: ' + err.message })
    }
    setProcessingBatch(null)
  }

  async function handleReject(batch: Batch) {
    setProcessingBatch(batch.batchId)
    await supabase
      .from('transaction_requests')
      .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('batch_id', batch.batchId)
    setNotice({ type: 'error', text: `Permintaan dari @${batch.username} ditolak.` })
    await dismissBatch(batch)
    setProcessingBatch(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes ktFadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ktFadeOutCollapse {
          from { opacity: 1; transform: scale(1); max-height: 400px; margin-bottom: 14px; }
          to { opacity: 0; transform: scale(0.97); max-height: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
        }
        @keyframes ktShimmer {
          0% { background-position: -300px 0; }
          100% { background-position: 300px 0; }
        }
        @keyframes ktPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes ktSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes ktBannerIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kt-card {
          animation: ktFadeInUp 380ms ease both;
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }
        .kt-card:hover {
          transform: translateY(-3px);
          border-color: rgba(201,162,39,0.4) !important;
          box-shadow: 0 10px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,162,39,0.12);
        }
        .kt-card-leaving {
          animation: ktFadeOutCollapse 260ms ease forwards !important;
          pointer-events: none;
        }
        .kt-btn {
          transition: transform 140ms ease, filter 140ms ease, background 140ms ease, box-shadow 140ms ease;
        }
        .kt-btn:active:not(:disabled) { transform: scale(0.96); }
        .kt-btn-approve:hover:not(:disabled) {
          filter: brightness(1.12);
          box-shadow: 0 0 18px rgba(201,162,39,0.4);
        }
        .kt-btn-reject:hover:not(:disabled) {
          background: rgba(217,119,87,0.12) !important;
          border-color: ${RED} !important;
        }
        .kt-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 37%, rgba(255,255,255,0.03) 63%);
          background-size: 400px 100%;
          animation: ktShimmer 1.4s ease infinite;
          border-radius: 8px;
        }
        .kt-dot-pending {
          animation: ktPulse 1.6s ease-in-out infinite;
        }
        .kt-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(8,7,5,0.35);
          border-top-color: #080705;
          border-radius: 50%;
          animation: ktSpin 650ms linear infinite;
          margin-right: 6px;
          vertical-align: -2px;
        }
        .kt-banner {
          animation: ktBannerIn 220ms ease both;
        }
        .kt-row {
          transition: background 140ms ease;
          border-radius: 6px;
        }
        .kt-row:hover {
          background: rgba(255,255,255,0.025);
        }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: '36px 44px', color: TEXT }}>
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: 0 }}>Kelola Transaksi</h1>
          {!loading && batches.length > 0 && (
            <span
              className="kt-dot-pending"
              style={{ fontSize: 11, fontWeight: 700, color: BG, background: GOLD, borderRadius: 999, padding: '2px 10px' }}
            >
              {batches.length} menunggu
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 24 }}>
          Setujui atau tolak permintaan deposit, withdraw, dan pembelian shop dari member.
        </p>

        {notice && (
          <div
            key={notice.text}
            className="kt-banner"
            style={{
              fontSize: 13,
              marginBottom: 20,
              padding: '10px 16px',
              borderRadius: 8,
              color: notice.type === 'success' ? GOLD_BRIGHT : RED,
              background: notice.type === 'success' ? 'rgba(201,162,39,0.08)' : 'rgba(217,119,87,0.08)',
              border: `1px solid ${notice.type === 'success' ? 'rgba(201,162,39,0.25)' : 'rgba(217,119,87,0.25)'}`,
            }}
          >
            {notice.type === 'success' ? '✓ ' : '✕ '}
            {notice.text}
          </div>
        )}

        {(checking || loading) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="kt-skeleton" style={{ height: 92, opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {!checking && !loading && batches.length === 0 && (
          <div style={{ border: `1px dashed ${LINE}`, borderRadius: 10, padding: '48px 20px', textAlign: 'center', animation: 'ktFadeInUp 380ms ease both' }}>
            <p style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>✓</p>
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>Tidak ada permintaan yang menunggu.</p>
          </div>
        )}

        {!checking && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {batches.map((batch, idx) => (
              <div
                key={batch.batchId}
                className={`kt-card${leavingBatch === batch.batchId ? ' kt-card-leaving' : ''}`}
                style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, animationDelay: `${idx * 60}ms` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${GOLD}, #7a5f14)`,
                        color: BG, fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      {initials(batch.username)}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                        @{batch.username}
                        <span
                          style={{
                            fontSize: 10,
                            color: batch.source === 'shop' ? GOLD_BRIGHT : TEXT_MUTED,
                            marginLeft: 8,
                            border: `1px solid ${batch.source === 'shop' ? 'rgba(201,162,39,0.4)' : LINE}`,
                            borderRadius: 10,
                            padding: '2px 8px',
                            letterSpacing: 0.5,
                          }}
                        >
                          {batch.source === 'shop' ? 'SHOP' : 'TRANSAKSI'}
                        </span>
                      </p>
                      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
                        {new Date(batch.createdAt).toLocaleString('id-ID')} &middot; {batch.rows[0]?.vaults?.name ?? 'Brankas'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="kt-btn kt-btn-approve"
                      onClick={() => handleApprove(batch)}
                      disabled={processingBatch === batch.batchId}
                      style={{
                        background: GOLD, color: BG, border: 'none', borderRadius: 6, padding: '8px 16px',
                        fontSize: 12, fontWeight: 600,
                        cursor: processingBatch === batch.batchId ? 'default' : 'pointer',
                        opacity: processingBatch === batch.batchId ? 0.7 : 1,
                      }}
                    >
                      {processingBatch === batch.batchId ? (<><span className="kt-spinner" />Memproses...</>) : 'Setujui'}
                    </button>
                    <button
                      className="kt-btn kt-btn-reject"
                      onClick={() => handleReject(batch)}
                      disabled={processingBatch === batch.batchId}
                      style={{
                        background: 'transparent', color: RED, border: `1px solid ${LINE}`, borderRadius: 6, padding: '8px 16px',
                        fontSize: 12, cursor: processingBatch === batch.batchId ? 'default' : 'pointer',
                        opacity: processingBatch === batch.batchId ? 0.5 : 1,
                      }}
                    >
                      Tolak
                    </button>
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {batch.rows.map((row) => {
                    const label = assetLabel(row)
                    const isDeposit = row.action === 'deposit'
                    return (
                      <div key={row.id} className="kt-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px' }}>
                        <div
                          style={{
                            width: 32, height: 32, borderRadius: 6, background: BG,
                            border: `1px solid ${LINE}`, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                          }}
                        >
                          {row.asset_type === 'item' && row.items?.image_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.items.image_path} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 13, opacity: 0.5 }}>
                              {row.asset_type === 'uang_merah' ? '💵' : row.asset_type === 'uang_putih' ? '💶' : '📦'}
                            </span>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{label}</span>
                            <span
                              style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                                color: isDeposit ? GOLD_BRIGHT : RED,
                                border: `1px solid ${isDeposit ? 'rgba(201,162,39,0.4)' : 'rgba(217,119,87,0.4)'}`,
                                borderRadius: 8, padding: '1px 6px',
                              }}
                            >
                              {isDeposit ? 'DEPOSIT' : 'WITHDRAW'}
                            </span>
                          </div>
                          {row.note && <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '2px 0 0' }}>{row.note}</p>}
                          {row.holder_name && (
                            <p style={{ fontSize: 11, color: GOLD_BRIGHT, margin: '2px 0 0' }}>Rekening: {row.holder_name}</p>
                          )}
                        </div>

                        <span style={{ color: isDeposit ? GOLD_BRIGHT : RED, fontFamily: 'monospace', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                          {isDeposit ? '+' : '-'}{Number(row.amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}