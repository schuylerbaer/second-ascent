import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

interface FlattenedAlert {
  id: number
  category_name: string
  brand: string
  model: string
  size: string
  size_unit: 'EU' | 'US'
  gender: string
  is_active: boolean
}

const BRAND_MODELS: Record<string, string[]> = {
  'La Sportiva': ['Miura VS', 'Solution'],
  'Scarpa': ['Instinct VSR', 'Boostic']
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<FlattenedAlert[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({ category: 'Shoe', brand: 'La Sportiva', model: 'Miura VS', size: '42', gender: 'U' })
  const [sizeUnit, setSizeUnit] = useState<'EU' | 'US'>('EU')
  
  useEffect(() => {
    fetchAlerts()
  }, [])

  async function fetchAlerts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        id,
        is_active,
        categories ( name ),
        alert_criteria ( key, value )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error fetching alerts:", error)
      setLoading(false)
      return
    }

    if (data) {
      const formatted = data.map((alert: any) => {
        const criteria: Record<string, string> = {}
        alert.alert_criteria.forEach((c: any) => {
          criteria[c.key] = c.value
        })

        let extractedSize = 'Any'
        let extractedUnit: 'EU' | 'US' = 'EU'
        
        if (criteria['eu_size']) {
          extractedSize = criteria['eu_size']
          extractedUnit = 'EU'
        } else if (criteria['us_size']) {
          extractedSize = criteria['us_size']
          extractedUnit = 'US'
        }

        return {
          id: alert.id,
          category_name: alert.categories?.name || 'Unknown',
          is_active: alert.is_active,
          brand: criteria['brand'] || 'Any',
          model: criteria['model'] || 'Any',
          size: extractedSize,
          size_unit: extractedUnit,
          gender: criteria['gender'] || 'U'
        }
      })
      setAlerts(formatted)
    }
    setLoading(false)
  }

  const openNewAlertModal = () => {
    setEditingAlertId(null)
    setFormData({ category: 'Shoe', brand: 'La Sportiva', model: 'Miura VS', size: '42', gender: 'U' }) 
    setSizeUnit('EU')
    setIsModalOpen(true)
  }

  const openEditModal = (alert: FlattenedAlert) => {
    setEditingAlertId(alert.id)
    setFormData({ category: alert.category_name, brand: alert.brand, model: alert.model, size: alert.size, gender: alert.gender })
    setSizeUnit(alert.size_unit)
    setIsModalOpen(true)
  }

  const saveAlert = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', formData.category)
      .maybeSingle()
    
    if (catError || !catData?.id) {
      alert("Category not found! Check your exact spelling in the Supabase 'categories' table.")
      return
    }

    const categoryId = catData.id
    let currentAlertId = editingAlertId

    if (editingAlertId) {
      await supabase.from('alerts').update({ category_id: categoryId }).eq('id', editingAlertId)
      await supabase.from('alert_criteria').delete().eq('alert_id', editingAlertId)
    } else {
      const { data: newAlert } = await supabase
        .from('alerts')
        .insert({ user_id: user.id, category_id: categoryId, is_active: true })
        .select()
        .single()
      currentAlertId = newAlert?.id
    }

    if (currentAlertId) {
      const dbSizeKey = sizeUnit === 'EU' ? 'eu_size' : 'us_size'
      
      await supabase.from('alert_criteria').insert([
        { alert_id: currentAlertId, key: 'brand', value: formData.brand },
        { alert_id: currentAlertId, key: 'model', value: formData.model },
        { alert_id: currentAlertId, key: dbSizeKey, value: formData.size },
        { alert_id: currentAlertId, key: 'gender', value: formData.gender }
      ])
    }
    
    setIsModalOpen(false)
    fetchAlerts() 
  }

  const toggleAlert = async (id: number, currentStatus: boolean) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a))
    await supabase.from('alerts').update({ is_active: !currentStatus }).eq('id', id)
  }

  const deleteAlert = async (id: number) => {
    await supabase.from('alert_criteria').delete().eq('alert_id', id)
    await supabase.from('alerts').delete().eq('id', id)
    setAlerts(alerts.filter(a => a.id !== id))
  }

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBrand = e.target.value
    setFormData({
      ...formData,
      brand: newBrand,
      model: BRAND_MODELS[newBrand][0] 
    })
  }

  const euSizes = Array.from({ length: 23 }, (_, i) => (35 + (i * 0.5)).toString())
  const usSizes = Array.from({ length: 19 }, (_, i) => (4 + (i * 0.5)).toString())
  const currentSizes = sizeUnit === 'EU' ? euSizes : usSizes

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-md px-8">
        <div className="flex-1">
          <a className="btn btn-ghost normal-case text-2xl font-bold text-primary">Gear Hunter</a>
        </div>
        <div className="flex-none gap-4">
          <a className="link link-hover font-medium">Profile</a>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-outline btn-sm">Logout</button>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-base-content">My Alerts</h1>
          <button onClick={openNewAlertModal} className="btn btn-primary">
            + New Alert
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center mt-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 bg-base-100 rounded-box shadow-sm border border-base-300">
            <h3 className="text-xl font-semibold opacity-70">No alerts yet.</h3>
            <p className="opacity-50 mt-2">Create an alert to start hunting gear.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alerts.map((alert) => (
              <div key={alert.id} className={`card bg-base-100 shadow-xl border border-base-300 transition-all ${!alert.is_active && 'opacity-50 grayscale-[50%]'}`}>
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <h2 className="card-title text-2xl">{alert.brand} {alert.model}</h2>
                    <input 
                      type="checkbox" 
                      className="toggle toggle-success" 
                      checked={alert.is_active}
                      onChange={() => toggleAlert(alert.id, alert.is_active)}
                    />
                  </div>
                  <div className="flex gap-2 my-2 flex-wrap">
                    <div className="badge badge-primary badge-outline">{alert.category_name}</div>
                    <div className="badge badge-secondary badge-outline">
                      {alert.gender === 'M' ? "Men's" : alert.gender === 'F' ? "Women's" : "Unisex"}
                    </div>
                    <div className="badge badge-outline">{alert.size_unit} {alert.size}</div>
                  </div>
                  <div className="card-actions justify-end mt-4 pt-4 border-t border-base-300">
                    <button onClick={() => openEditModal(alert)} className="btn btn-sm btn-ghost">Edit</button>
                    <button onClick={() => deleteAlert(alert.id)} className="btn btn-sm btn-error btn-outline">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box border border-base-300">
            <h3 className="font-bold text-2xl mb-6 text-primary">{editingAlertId ? 'Edit Alert' : 'Create New Alert'}</h3>
            
            <div className="flex flex-col gap-4">
              <div className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Gear Type</span></div>
                <select 
                  className="select select-bordered w-full" 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option value="Shoe">Shoe</option>
                  <option value="Cam" disabled>Cam (Coming Soon)</option>
                </select>
              </div>

              <div className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Brand</span></div>
                <select 
                  className="select select-bordered w-full"
                  value={formData.brand}
                  onChange={handleBrandChange} 
                >
                  {Object.keys(BRAND_MODELS).map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Model</span></div>
                <select 
                  className="select select-bordered w-full"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                >
                  {BRAND_MODELS[formData.brand].map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Gender</span></div>
                <select 
                  className="select select-bordered w-full"
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="U">Unisex / Any</option>
                  <option value="M">Men's</option>
                  <option value="F">Women's</option>
                </select>
              </div>

              <div className="form-control w-full">
                <div className="label flex justify-between">
                  <span className="label-text font-semibold">Size</span>
                  <div className="join">
                    <button 
                      type="button" 
                      className={`join-item btn btn-xs w-12 ${sizeUnit === 'EU' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => { setSizeUnit('EU'); setFormData({...formData, size: '42'}) }}
                    >
                      EU
                    </button>
                    <button 
                      type="button"
                      className={`join-item btn btn-xs w-12 ${sizeUnit === 'US' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => { setSizeUnit('US'); setFormData({...formData, size: '9'}) }}
                    >
                      US
                    </button>
                  </div>
                </div>
                <select 
                  className="select select-bordered w-full"
                  value={formData.size}
                  onChange={(e) => setFormData({...formData, size: e.target.value})}
                >
                  {currentSizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-action mt-8">
              <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={saveAlert} className="btn btn-primary px-8">Save Alert</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
        </div>
      )}
    </div>
  )
}
