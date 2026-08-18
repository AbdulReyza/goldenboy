'use client'

import { useEffect, useRef, useState } from 'react'

const GOLD = '#C9A227'
const BG = '#080705'
const SURFACE = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(201,162,39,0.18)'
const TEXT = '#F1EBDC'
const TEXT_MUTED = '#8A8270'

export type GoldSelectOption = { value: string; label: string }

export default function GoldSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  disabled = false,
  style,
}: {
  value: string
  onChange: (value: string) => void
  options: GoldSelectOption[]
  placeholder?: string
  disabled?: boolean
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: BG,
          border: `1px solid ${open ? GOLD : LINE}`,
          borderRadius: 6,
          padding: '10px 14px',
          color: selected ? TEXT : TEXT_MUTED,
          fontSize: 13,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          transition: 'border-color 140ms ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          style={{
            marginLeft: 8,
            flexShrink: 0,
            fontSize: 10,
            color: GOLD,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 140ms ease',
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#0d0b08',
            border: `1px solid ${GOLD}`,
            borderRadius: 8,
            boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
            zIndex: 50,
            overflow: 'hidden',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: TEXT_MUTED }}>Tidak ada pilihan.</div>
          )}
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  color: isSelected ? GOLD : TEXT,
                  background: isSelected ? 'rgba(201,162,39,0.12)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = SURFACE
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                {opt.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}