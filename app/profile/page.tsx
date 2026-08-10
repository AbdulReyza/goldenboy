'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'

type UserProfile = {
  id: string
  name: string
  username: string
  role: string
  jabatan?: string
  photo_url?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editPhoto, setEditPhoto] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return router.push('/login')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .single()

      if (data) {
        setProfile(data as UserProfile)
        setEditName(data.name || '')
        setEditPhoto(data.photo_url || '')
      } else {
        setProfile({
          id: sessionData.session.user.id,
          name: 'Unknown',
          username: 'unknown',
          role: 'member'
        })
      }
      setLoading(false)
    }
    loadProfile()
  }, [router])

  async function handleSave() {
    if (!profile) return
    const { error } = await supabase
      .from('profiles')
      .update({
        name: editName,
        photo_url: editPhoto,
      })
      .eq('id', profile.id)

    if (!error) {
      setProfile({ ...profile, name: editName, photo_url: editPhoto })
      setIsEditing(false)
    } else {
      alert('Gagal menyimpan profil: ' + error.message)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!profile) return
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true) // optional loading state

    const ext = file.name.split('.').pop()
    const fileName = `profile-${profile.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file)

    if (uploadError) {
      alert('Gagal mengunggah foto: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ photo_url: publicUrl })
      .eq('id', profile.id)
      
    if (!updateError) {
      setProfile({ ...profile, photo_url: publicUrl })
      setEditPhoto(publicUrl)
    } else {
      alert('Gagal update foto: ' + updateError.message)
    }
    setLoading(false)
  }

  function handlePhotoClick() {
    const input = document.getElementById('photo-upload') as HTMLInputElement
    if (input) input.click()
  }

  if (loading || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: '#080705', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8270' }}>
        Memuat profil...
      </div>
    )
  }

  return (
    <div className="layout-container" style={{ background: '#080705', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />

      {/* Override main-content padding for edge-to-edge layout */}
      <div className="main-content" style={{ padding: 0, position: 'relative', display: 'flex', overflow: 'hidden', background: '#080705' }}>
        
        {/* Left Blue Background (Angled) */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '60%', 
          height: '100%', 
          background: '#C9A227', 
          clipPath: 'polygon(0 0, 100% 0, 75% 100%, 0% 100%)',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: '10%'
        }}>
          
          <h1 style={{ 
            fontSize: '5vw', 
            fontWeight: 900, 
            lineHeight: 0.9, 
            color: '#080705', 
            textTransform: 'uppercase',
            margin: 0,
            letterSpacing: '-2px'
          }}>
            GOLDEN<br/>GANG
          </h1>

          <div style={{ marginTop: 40 }}>
            {isEditing ? (
              <div style={{ background: '#080705', padding: 20, borderRadius: 8, width: 300, border: '1px solid rgba(201,162,39,0.18)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#F1EBDC' }}>Edit Profile</h3>
                <label style={{ display: 'block', fontSize: 12, color: '#8A8270', marginBottom: 4 }}>Nama</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.18)', color: '#F1EBDC', borderRadius: 4, marginBottom: 12, boxSizing: 'border-box' }}
                />
                
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSave} style={{ flex: 1, background: '#C9A227', color: '#080705', border: 'none', padding: 10, fontWeight: 'bold', borderRadius: 4, cursor: 'pointer' }}>SIMPAN</button>
                  <button onClick={() => setIsEditing(false)} style={{ flex: 1, background: 'transparent', color: '#8A8270', border: '1px solid rgba(201,162,39,0.18)', borderRadius: 4, padding: 10, fontWeight: 'bold', cursor: 'pointer' }}>BATAL</button>
                </div>
                <p style={{ fontSize: 11, color: '#8A8270', marginTop: 12, textAlign: 'center' }}>*Untuk mengganti foto, klik langsung pada foto di tengah layar.</p>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                style={{ 
                  background: '#080705', 
                  color: '#F1EBDC', 
                  border: 'none', 
                  padding: '12px 24px', 
                  fontSize: 16,
                  fontWeight: 800, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textTransform: 'uppercase',
                  borderRadius: 6
                }}
              >
                <span style={{ transform: 'scaleY(1.5)', color: '#C9A227', display: 'inline-block' }}>▶</span> EDIT
              </button>
            )}
          </div>
        </div>

        {/* Center Character Image */}
        <div style={{ 
          position: 'absolute', 
          left: '50%', 
          top: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 10,
          height: '95%',
          display: 'flex',
          alignItems: 'flex-end'
        }}>
          <div 
            onClick={handlePhotoClick}
            title="Klik untuk mengubah foto"
            style={{ 
              cursor: 'pointer', 
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={profile.photo_url} 
                alt="Character" 
                style={{ 
                  height: '100%', 
                  objectFit: 'contain',
                  filter: 'drop-shadow(15px 15px 25px rgba(0,0,0,0.3))'
                }} 
              />
            ) : (
              <div style={{ 
                height: '70vh', 
                width: '40vh',
                background: 'rgba(255,255,255,0.03)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '4px dashed rgba(201,162,39,0.5)',
                color: '#8A8270',
                fontWeight: 'bold',
                textAlign: 'center',
                padding: 20
              }}>
                Klik disini untuk unggah Foto Karakter
              </div>
            )}
            <input 
              type="file" 
              id="photo-upload" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handlePhotoUpload} 
            />
          </div>
        </div>

        {/* Right White Area (Rank/Name) */}
        <div style={{ 
          position: 'absolute',
          right: '5%',
          top: '15%',
          zIndex: 2,
          textAlign: 'right'
        }}>
          <h2 style={{ 
            fontSize: '6vw', 
            fontWeight: 900, 
            lineHeight: 0.9, 
            color: 'rgba(8,7,5,0)', 
            WebkitTextStroke: '2px #F0CA6B',
            textTransform: 'uppercase',
            margin: '0 0 10px 0',
            textShadow: '0 0 20px rgba(240,202,107,0.3)'
          }}>
            {profile.role}
          </h2>
          <p style={{ 
            fontSize: '1.5vw', 
            fontWeight: 800, 
            color: '#F1EBDC', 
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '4px'
          }}>
            {profile.name}
          </p>
        </div>

      </div>
    </div>
  )
}
