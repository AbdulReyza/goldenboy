'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ItemRow = {
  id: number
  name: string
  category_name: string
  total_quantity: number
}

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('SEMUA')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          item_categories ( name ),
          vault_items ( quantity )
        `)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const mapped: ItemRow[] = (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        category_name: row.item_categories?.name ?? 'Item',
        total_quantity: (row.vault_items ?? []).reduce(
          (sum: number, vi: any) => sum + Number(vi.quantity),
          0
        ),
      }))

      setItems(mapped)
      setCategories(Array.from(new Set(mapped.map((i) => i.category_name))))
      setLoading(false)
    }

    fetchItems()
  }, [])

  const filtered = items.filter((item) => {
    const matchCategory = activeCategory === 'SEMUA' || item.category_name === activeCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  if (loading) return <div style={{ padding: 40, color: '#fff' }}>Memuat data...</div>
  if (error) return <div style={{ padding: 40, color: '#ff6b6b' }}>Gagal memuat data: {error}</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: 32, color: '#fff', fontFamily: 'sans-serif' }}>
      <input
        type="text"
        placeholder="Cari nama item..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '10px 16px',
          borderRadius: 20,
          border: '1px solid #2a2a2a',
          background: '#151515',
          color: '#fff',
          marginBottom: 20,
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['SEMUA', ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: activeCategory === cat ? '#f5c518' : '#151515',
              color: activeCategory === cat ? '#1a1a1a' : '#ccc',
            }}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}
      >
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#151515',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                width: '100%',
                height: 60,
                background: '#1f1f1f',
                borderRadius: 8,
                marginBottom: 10,
              }}
            />
            <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>
              {item.name}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#f5c518' }}>
              {item.total_quantity.toLocaleString('en-US')}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <p style={{ color: '#666', gridColumn: '1 / -1' }}>Tidak ada item ditemukan.</p>
        )}
      </div>
    </div>
  )
}