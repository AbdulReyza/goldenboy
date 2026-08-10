'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

type Profile = {
  id: string
  name: string
  username: string
  role: string
  is_approved: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setProfiles(data as Profile[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  async function approveUser(id: string, role: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: true, role })
      .eq('id', id)

    if (error) {
      setNotice('Gagal menyetujui: ' + error.message)
      return
    }
    setNotice('User disetujui.')
    fetchProfiles()
  }

  async function revokeUser(id: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: false })
      .eq('id', id)

    if (error) {
      setNotice('Gagal menolak: ' + error.message)
      return
    }
    setNotice('Akses user dicabut.')
    fetchProfiles()
  }

  if (loading) return <div style={{ padding: 40, color: TEXT, background: BG, minHeight: '100vh' }}>Memuat...</div>
  if (error)
    return (
      <div style={{ padding: 40, color: '#d97757', background: BG, minHeight: '100vh' }}>
        Gagal memuat data: {error}
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>
          (Kalau errornya soal akses ditolak, pastikan akun kamu sendiri sudah role = 'admin' di tabel profiles)
        </p>
      </div>
    )

  const pending = profiles.filter((p) => !p.is_approved)
  const approved = profiles.filter((p) => p.is_approved)

  return (
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />
      <div className="main-content" style={{ padding: 40, color: TEXT }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, marginBottom: 24 }}>Persetujuan Member</h1>

        {notice && (
          <p style={{ fontSize: 13, color: GOLD_BRIGHT, marginBottom: 20 }}>{notice}</p>
        )}

        <p style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, marginBottom: 12 }}>
          MENUNGGU PERSETUJUAN ({pending.length})
        </p>
        <div style={{ marginBottom: 40 }}>
          {pending.length === 0 && (
            <p style={{ fontSize: 13, color: TEXT_MUTED }}>Tidak ada pendaftar baru.</p>
          )}
          {pending.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: '14px 18px',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <p style={{ fontSize: 14, margin: 0 }}>{p.name}</p>
                <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0 }}>@{p.username}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => approveUser(p.id, 'member')}
                  style={{ background: GOLD, color: BG, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Setujui sebagai Member
                </button>
                <button
                  onClick={() => approveUser(p.id, 'admin')}
                  style={{ background: 'transparent', color: GOLD_BRIGHT, border: `1px solid ${LINE}`, borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
                >
                  Setujui sebagai Admin
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, letterSpacing: 2, color: TEXT_MUTED, marginBottom: 12 }}>
          SUDAH DISETUJUI ({approved.length})
        </p>
        <div>
          {approved.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: `1px solid ${LINE}`,
              }}
            >
              <div>
                <p style={{ fontSize: 13, margin: 0 }}>{p.name} <span style={{ color: TEXT_MUTED, fontSize: 11 }}>({p.role})</span></p>
                <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0 }}>@{p.username}</p>
              </div>
              {p.role !== 'admin' && (
                <button
                  onClick={() => revokeUser(p.id)}
                  style={{ background: 'transparent', color: '#d97757', border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                >
                  Cabut Akses
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}