import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { usePageTitle } from '../hooks/usePageTitle'

const ALIAS_MAP: Record<string, string> = {
  'fiveten': 'Five Ten',
  'FiveTen': 'Five Ten',
  'five ten': 'Five Ten',
  'unparallel': 'Unparallel',
  'un parallel': 'Unparallel',
  'acoba': 'Acopa',
  'lasportiva': 'La Sportiva',
  'la sportiva': 'La Sportiva',

  'tarantulace': 'Tarantulace',
  'tarantula lace': 'Tarantulace',
  'tc pro': 'TC Pro',
  'tc pros': 'TC Pro',
  'miuras': 'Miura',
  'muiras': 'Miura',
  'muiras lace': 'Miura',
  'miuras lace': 'Miura',
  'muira': 'Miura',
  'muira lace': 'Miura',
  'miura lace': 'Miura',
  'miuras vs': 'Miura VS',
  'muiras vs': 'Miura VS',
  'muira vs': 'Miura VS',
  'solutions': 'Solution',
}

const normalizeString = (rawStr: string) => {
  if (!rawStr) return ''
  const cleanStr = rawStr.trim()
  const lowerStr = cleanStr.toLowerCase()

  return ALIAS_MAP[lowerStr] || cleanStr
}

const EU_SIZES = Array.from({ length: 29 }, (_, i) => (34 + i * 0.5).toString())
const US_SIZES = Array.from({ length: 23 }, (_, i) => (4 + i * 0.5).toString())

export default function Dashboard() {
  usePageTitle('Dashboard')
  const [alerts, setAlerts] = useState<any[]>([])
  const [recentMatches, setRecentMatches] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null)
  
  const [dynamicBrandModels, setDynamicBrandModels] = useState<Record<string, string[]>>({})
  const [formData, setFormData] = useState({ category: 'Shoe', brand: '', model: '', size: '', gender: 'U' })
  const [sizeUnit, setSizeUnit] = useState('EU')
  const [loading, setLoading] = useState(true)

  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchAlerts()
    fetchRecentMatches()
    fetchBrandModels()
  }, [])

  const fetchAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('alerts')
      .select(`*, alert_criteria (*)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching alerts:", error)
    } else {
      const formattedAlerts = (data || []).map(alert => {
        const criteriaObj = alert.alert_criteria.reduce((acc: any, row: any) => {
          acc[row.key] = row.value
          return acc
        }, {})

        return { ...alert, criteria: criteriaObj }
      })

      setAlerts(formattedAlerts)
    }

    setLoading(false)
  }

  const fetchBrandModels = async () => {
    const { data, error } = await supabase
      .from('items')
      .select(`
        id,
        item_attributes (key, value)
      `)
      .eq('category_id', 1)

    if (error) {
      console.error("Error fetching brand models:", error)
      return
    }

    const brandModelMap: Record<string, Set<string>> = {}

    data.forEach((item: any) => {
      const attrs = item.item_attributes

      const brandAttr = attrs.find((attr: any) => attr.key === 'brand')
      const modelAttr = attrs.find((attr: any) => attr.key === 'model')

      if (brandAttr && brandAttr.value && modelAttr && modelAttr.value) {
        const brand = normalizeString(brandAttr.value)
        const model = normalizeString(modelAttr.value)

        if (!brandModelMap[brand]) {
          brandModelMap[brand] = new Set()
        }
        brandModelMap[brand].add(model)
      }
    })

    const formattedMap: Record<string, string[]> = {}
    Object.keys(brandModelMap).sort().forEach(brand => {
      formattedMap[brand] = Array.from(brandModelMap[brand]).sort();
    })

    setDynamicBrandModels(formattedMap)
  }

  const fetchRecentMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('sent_notifications')
      .select(`
        id,
        sent_at,
        items (
          id,
          listings (url),
          item_attributes (key, value)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('sent_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error("Error fetching matches:", error)
      return
    }

    if (data) {
      const formatted = data.map((notification: any) => {
        const item = notification.items;
        const attributes = item?.item_attributes || [];
        const listingUrl = item?.listings?.url || '#';

        const attrs = attributes.reduce((acc: any, attr: any) => {
          acc[attr.key] = attr.value
          return acc
        }, {})

        const rawPrice = attrs.price;
        const formattedPrice = rawPrice && !isNaN(parseFloat(rawPrice))
          ? `$${parseFloat(rawPrice).toFixed(2)}`
          : 'Check post';

        return {
          id: notification.id,
          url: listingUrl,
          brand: attrs.brand || 'Unknown',
          model: attrs.model || 'Gear',
          size: attrs.eu_size ? `EU ${attrs.eu_size}` : attrs.us_size ? `US ${attrs.us_size}` : 'Any Size',
          price: formattedPrice,
          date: new Date(notification.sent_at).toLocaleDateString()
        }
      })
      setRecentMatches(formatted)
    }
  }

  const dismissMatch = async (notificationId: number) => {
    setRecentMatches(current => current.filter(match => match.id !== notificationId))

    const { error } = await supabase
      .from('sent_notifications')
      .update({ is_dismissed: true })
      .eq('id', notificationId)

    if (error) {
      console.error("Error dismissing match:", error)
      fetchRecentMatches()
    }
  }

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({
      ...formData,
      brand: e.target.value,
      model: ''
    })
  }

  const openNewAlertModal = () => {
    setEditingAlertId(null)
    setFormData({ category: 'Shoe', brand: '', model: '', size: '', gender: 'U' })
    setSizeUnit('EU')
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (alert: any) => {
    setEditingAlertId(alert.id)
    const isEU = !!alert.criteria?.eu_size;
    const isUS = !!alert.criteria?.us_size;

    setFormData({
      category: 'Shoe',
      brand: alert.criteria?.brand || '',
      model: alert.criteria?.model || '',
      size: isEU ? alert.criteria.eu_size : (isUS ? alert.criteria.us_size : ''),
      gender: alert.criteria?.gender || 'U'
    })

    setSizeUnit(isUS ? 'US' : 'EU')
    setFormError(null)
    setIsModalOpen(true)
  }

  const saveAlert = async () => {
    if (!formData.brand || !formData.model || !formData.size) {
      setFormError("Please select a Brand, Model, and Size!")
      return
    }

    const isDuplicate = alerts.some(a => {
      if (a.id === editingAlertId) return false;
      const sameBrand = a.criteria?.brand === formData.brand;
      const sameModel = a.criteria?.model === formData.model;
      const sameGender = a.criteria?.gender === formData.gender;

      const sameSize = sizeUnit === 'EU'
        ? a.criteria?.eu_size === formData.size
        : a.criteria?.us_size === formData.size;

      return sameBrand && sameModel && sameGender && sameSize;
    })

    if (isDuplicate) {
      setFormError("You already have an alert for this!")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const criteriaRows = [
      { key: 'brand', value: formData.brand },
      { key: 'model', value: formData.model },
      { key: 'gender', value: formData.gender }
    ]

    if (sizeUnit === 'EU') {
      criteriaRows.push({ key: 'eu_size', value: formData.size })
    } else if (sizeUnit === 'US') {
      criteriaRows.push({ key: 'us_size', value: formData.size })
    }

    if (editingAlertId) {
      await supabase.from('alert_criteria').delete().eq('alert_id', editingAlertId)

      const rowsToInsert = criteriaRows.map(c => ({ ...c, alert_id: editingAlertId }))
      const { error: criteriaError } = await supabase.from('alert_criteria').insert(rowsToInsert)

      if (criteriaError) return alert(`Update Error: ${criteriaError.message}`)

    } else {
      const { data: newAlert, error: alertError } = await supabase
        .from('alerts')
        .insert([{ user_id: user.id, category_id: 1, is_active: true }])
        .select()
        .single()

      if (alertError) return setFormError(`Alert Creation Error: ${alertError.message}`)

      const rowsToInsert = criteriaRows.map(c => ({ ...c, alert_id: newAlert.id }))
      const { error: criteriaError } = await supabase.from('alert_criteria').insert(rowsToInsert)

      if (criteriaError) return setFormError(`Criteria Creation Error: ${criteriaError.message}`)
    }

    setIsModalOpen(false)
    fetchAlerts()
  }

  const toggleAlertStatus = async (alertId: number, currentStatus: boolean) => {
    setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_active: !currentStatus } : a))

    const { error } = await supabase
      .from('alerts')
      .update({ is_active: !currentStatus })
      .eq('id', alertId)

    if (error) {
      console.error("Error toggling alert:", error)
      fetchAlerts()
    }
  }

  const deleteAlert = async (id: number) => {
    await supabase.from('alerts').delete().eq('id', id)
    fetchAlerts()
  }

  if (loading) return <div className="p-12 text-center text-slate-500">Loading your gear...</div>

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Alerts</h1>
          <p className="text-slate-500 mt-1">We'll email you the second these hit the forum.</p>
        </div>
        <button 
          onClick={openNewAlertModal}
          className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-blue-500/25 whitespace-nowrap"
        >
          + New Alert
        </button>
      </div>

      {/* Active Alerts Grid */}
      {alerts.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">No alerts yet</h3>
          <p className="text-slate-500 mt-1 max-w-sm mx-auto">Create an alert to start tracking Mountain Project for the gear you've been dying to have.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border transition-all flex flex-col justify-between ${
                alert.is_active ? 'border-slate-100 hover:shadow-[0_4px_25px_rgb(0,0,0,0.06)]' : 'border-slate-200 opacity-60 grayscale'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {alert.criteria?.brand}
                  </div>
                  
                  {/* Toggle Switch */}
                  <button
                    onClick={() => toggleAlertStatus(alert.id, alert.is_active)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      alert.is_active ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                    role="switch"
                    aria-checked={alert.is_active}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        alert.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {alert.criteria?.model}
                </h3>
                
                <div className="mt-4 flex gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    Size: {alert.criteria?.eu_size ? `EU ${alert.criteria.eu_size}` : alert.criteria?.us_size ? `US ${alert.criteria.us_size}` : 'Any'}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {alert.criteria?.gender === 'M' ? "Men's" : alert.criteria?.gender === 'W' ? "Women's" : "Unisex/Any"}
                  </span>
                </div>
              </div>
              
              {/* Edit / Delete Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                <button 
                  onClick={() => openEditModal(alert)}
                  className="text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={() => deleteAlert(alert.id)}
                  className="text-sm font-semibold text-slate-400 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Personalized Match Feed */}
      <div className="mt-20 pt-16 border-t border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-8">Your recent finds</h2>

        {recentMatches.length === 0 ? (
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-center text-slate-500">
            We haven't found any of your shoes yet. We'll email you when something pops up!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {recentMatches.map((match) => (
              <a
                key={match.id}
                href={match.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-[0_4px_20px_rgb(59,130,246,0.1)] transition-all flex flex-col justify-between"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    dismissMatch(match.id)
                  }}
                  className="absolute top-3 right-3 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-all"
                  title="Remove from dashboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>

                <div>
                  <div className="flex justify-between items-start mb-1 pr-6">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{match.brand}</span>
                    <span className="text-xs font-bold text-slate-400">{match.date}</span>
                  </div>
                  <h3 className="text-md font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors mb-2">
                    {match.model}
                  </h3>
                  <div className="text-xs font-medium text-slate-500">Size: {match.size}</div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">
                    {match.price}
                  </span>
                  <span className="text-blue-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                    Buy &rarr;
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Alert Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight">
              {editingAlertId ? 'Edit Alert' : 'Create Alert'}
            </h2>

            {formError && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100 text-center font-medium">
                {formError}
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Brand</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none"
                  value={formData.brand}
                  onChange={handleBrandChange} 
                >
                  <option value="" disabled>Select a Brand</option>
                  {Object.keys(dynamicBrandModels).map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Model</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none disabled:opacity-50"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  disabled={!formData.brand}
                >
                  <option value="" disabled>{formData.brand ? 'Select a Model' : 'Select a Brand first'}</option>
                  {formData.brand && dynamicBrandModels[formData.brand] && dynamicBrandModels[formData.brand].map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Size Type</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none appearance-none"
                    value={sizeUnit}
                    onChange={(e) => {
                      setSizeUnit(e.target.value)
                      setFormData({...formData, size: ''})
                    }}
                  >
                    <option value="EU">EU Size</option>
                    <option value="US">US Size</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Size</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none appearance-none"
                    value={formData.size}
                    onChange={(e) => setFormData({...formData, size: e.target.value})}
                  >
                    <option value="" disabled>Select</option>
                    {(sizeUnit === 'EU' ? EU_SIZES : US_SIZES).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Gender</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none appearance-none"
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="U">Unisex / Any</option>
                  <option value="M">Men's</option>
                  <option value="W">Women's</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveAlert}
                className="flex-1 bg-blue-600 text-white font-semibold py-3.5 rounded-full hover:bg-blue-700 transition-all shadow-md hover:shadow-blue-500/30"
              >
                {editingAlertId ? 'Update Alert' : 'Save Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
