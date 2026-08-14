'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#0a0a0a'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT_MUTED = '#8A8270'

type Profile = { id: string; name: string; username: string; role: string; is_approved: boolean }

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, username, role, is_approved')
        .eq('id', sessionData.session.user.id)
        .single()
      
      if (profileData) {
        setProfile(profileData as Profile)
      }
    }
    fetchProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function getNavItemStyle(path: string, exact: boolean = false) {
    const isActive = exact ? pathname === path : pathname?.startsWith(path)
    return {
      padding: '10px 12px',
      borderRadius: 6,
      fontSize: 13,
      color: isActive ? BG : TEXT_MUTED,
      background: isActive ? GOLD : 'transparent',
      fontWeight: isActive ? 600 : 400,
      textDecoration: 'none',
      display: 'block',
      whiteSpace: 'nowrap' as const
    }
  }

  return (
    <aside className="sidebar sidebar-container" style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${LINE}`, padding: '28px 20px', background: 'rgba(255,255,255,0.015)' }}>
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
        <div style={{ width: 8, height: 8, background: GOLD, borderRadius: '50%' }} />
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, letterSpacing: 2, color: GOLD_BRIGHT }}>GOLDEN GANG</span>
      </div>
      
      <nav className="responsive-nav" style={{ gap: 4, flex: 1 }}>
        <a href="/" style={getNavItemStyle('/', true)}>Inventory</a>
        <a href="/shop" style={getNavItemStyle('/shop')}>Shop</a>
        <a href="/transaksi" style={getNavItemStyle('/transaksi')}>Transaksi</a>
        <a href="/riwayat" style={getNavItemStyle('/riwayat')}>Riwayat</a>
        {profile?.role === 'admin' && (
          <>
            <a href="/admin/users" style={getNavItemStyle('/admin/users')}>Kelola Member</a>
            <a href="/kelola_barang" style={getNavItemStyle('/kelola_barang')}>Kelola Barang</a>
            <a href="/kelola_shop" style={getNavItemStyle('/kelola_shop')}>Kelola Shop</a>
            <a href="/kelola_transaksi" style={getNavItemStyle('/kelola_transaksi')}>Kelola Transaksi</a>
          </>
        )}
      </nav>

      {profile && (
        <div className="sidebar-profile" style={{ marginTop: 'auto', paddingTop: 16, marginBottom: 24, borderTop: `1px solid ${LINE}` }}>
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, whiteSpace: 'nowrap' }}>
            @{profile.username} &middot; {profile.role}
          </p>
          <button onClick={handleLogout} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d97757', padding: '8px 0', fontSize: 13 }}>
            Keluar
          </button>
        </div>
      )}
    </aside>
  )
}