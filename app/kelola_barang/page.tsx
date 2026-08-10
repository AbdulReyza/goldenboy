'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'

const GOLD = '#C9A227'
const GOLD_BRIGHT = '#F0CA6B'
const BG = '#0a0a0a'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

type ItemCategory = { id: number; name: string }
type Item = { id: number; name: string; item_category_id: number; item_categories: { name: string } | null }

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
    whiteSpace: 'nowrap'
  }
}

export default function KelolaBarangPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingId, setEditingId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({ name: '', item_category_id: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return router.push('/login')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_approved')
        .eq('id', data.session.user.id)
        .single()

      if (!profile || !profile.is_approved || profile.role !== 'admin') {
        alert('Halaman ini khusus Admin.')
        return router.push('/')
      }

      setChecking(false)
      loadData()
    }
    checkAuth()
  }, [router])

  async function loadData() {
    const [catRes, itemRes] = await Promise.all([
      supabase.from('item_categories').select('*').order('name'),
      supabase.from('items').select('id, name, item_category_id, item_categories(name)').order('id', { ascending: false })
    ])

    if (catRes.data) setCategories(catRes.data as any)
    if (itemRes.data) setItems(itemRes.data as any)
  }

  function openAddModal() {
    setModalMode('add')
    setFormData({ name: '', item_category_id: categories.length > 0 ? String(categories[0].id) : '' })
    setEditingId(null)
    setIsModalOpen(true)
  }

  function openEditModal(item: Item) {
    setModalMode('edit')
    setFormData({ name: item.name, item_category_id: String(item.item_category_id) })
    setEditingId(item.id)
    setIsModalOpen(true)
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Hapus barang "${name}" secara permanen? Aksi ini tidak dapat dibatalkan.`)) return

    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
    } else {
      setItems(items.filter(i => i.id !== id))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name || !formData.item_category_id) return alert('Lengkapi data.')
    
    setSubmitting(true)
    
    const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    const payload = { 
      name: formData.name, 
      slug: slug,
      item_category_id: parseInt(formData.item_category_id) 
    }

    if (modalMode === 'add') {
      const { data, error } = await supabase.from('items').insert([payload]).select('id, name, item_category_id, item_categories(name)').single()
      if (error) alert('Gagal menambah: ' + error.message)
      else if (data) setItems([data as any, ...items])
    } else {
      const { data, error } = await supabase.from('items').update(payload).eq('id', editingId).select('id, name, item_category_id, item_categories(name)').single()
      if (error) alert('Gagal mengedit: ' + error.message)
      else if (data) setItems(items.map(i => i.id === editingId ? (data as any) : i))
    }

    setSubmitting(false)
    setIsModalOpen(false)
  }

  if (checking) return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Memeriksa sesi...</div>

  return (
    <div className="layout-container" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      <div className="main-content" style={{ color: TEXT }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, margin: '12px 0 28px' }}>Kelola Barang</h1>

        <div style={{ maxWidth: 800 }}>
          <button onClick={openAddModal} style={{ background: GOLD, color: BG, padding: '10px 20px', borderRadius: 6, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 20 }}>
            + Tambah Barang
          </button>

          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', background: SURFACE }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(201,162,39,0.1)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', borderBottom: `1px solid ${LINE}` }}>NAMA BARANG</th>
                  <th style={{ padding: '12px 16px', borderBottom: `1px solid ${LINE}` }}>KATEGORI</th>
                  <th style={{ padding: '12px 16px', borderBottom: `1px solid ${LINE}`, width: 140 }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: TEXT_MUTED }}>Belum ada barang.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '12px 16px', color: TEXT_MUTED }}>{item.item_categories?.name ?? '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => openEditModal(item)} style={{ background: 'transparent', border: `1px solid ${LINE}`, color: GOLD_BRIGHT, padding: '4px 10px', borderRadius: 4, marginRight: 8, cursor: 'pointer', fontSize: 11 }}>Edit</button>
                      <button onClick={() => handleDelete(item.id, item.name)} style={{ background: 'transparent', border: `1px solid #d97757`, color: '#d97757', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 20px', fontFamily: 'Georgia, serif', fontSize: 20 }}>{modalMode === 'add' ? 'Tambah Barang' : 'Edit Barang'}</h2>
            
            <form onSubmit={handleSubmit}>
              <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Nama Barang</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                required
                style={{ width: '100%', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 6, padding: '10px 14px', color: TEXT, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} 
              />

              <label style={{ fontSize: 12, color: TEXT_MUTED, display: 'block', marginBottom: 6 }}>Kategori</label>
              <select 
                value={formData.item_category_id} 
                onChange={(e) => setFormData({ ...formData, item_category_id: e.target.value })} 
                required
                style={{ width: '100%', background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 6, padding: '10px 14px', color: TEXT, outline: 'none', marginBottom: 24, boxSizing: 'border-box' }}
              >
                <option value="" disabled>Pilih Kategori</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: `1px solid ${LINE}`, color: TEXT, borderRadius: 6, cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', background: GOLD, border: 'none', color: BG, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
