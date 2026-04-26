import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../services/supabaseClient'
import { usePageTitle } from '../hooks/usePageTitle'

const MAX_TOTAL_ITEMS = 100
const ITEMS_PER_PAGE = 20

const EU_SIZES = Array.from({ length: 29 }, (_, i) => (34 + i * 0.5).toString())
const US_SIZES = Array.from({ length: 23 }, (_, i) => (4 + i * 0.5).toString())

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
  if (!rawStr) return '';
  const cleanStr = rawStr.trim();
  const lowerStr = cleanStr.toLowerCase();
  return ALIAS_MAP[lowerStr] || cleanStr;
}

export default function Browse() {
  usePageTitle('Browse Gear')
  
  const [allItems, setAllItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  
  const [filters, setFilters] = useState({ brand: '', model: '', size: '', gender: '' })
  const [sizeUnit, setSizeUnit] = useState('EU')
  const [dynamicBrandModels, setDynamicBrandModels] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const fetchAllItems = async () => {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          listings!inner (url),
          item_attributes (key, value)
        `)
        .eq('category_id', 1)
        .order('id', { ascending: false })
        .limit(MAX_TOTAL_ITEMS)

      if (!error && data) {
        const brandModelMap: Record<string, Set<string>> = {}
        
        const formatted = data.map((item: any) => {
          const attrs = item.item_attributes.reduce((acc: any, attr: any) => {
            acc[attr.key] = attr.value
            return acc
          }, {})
          
          const brand = normalizeString(attrs.brand || 'Unknown')
          const model = normalizeString(attrs.model || 'Gear')
          
          if (brand !== 'Unknown' && model !== 'Gear') {
            if (!brandModelMap[brand]) brandModelMap[brand] = new Set()
            brandModelMap[brand].add(model)
          }

          const rawPrice = attrs.price;
          const formattedPrice = rawPrice && !isNaN(parseFloat(rawPrice)) 
            ? `$${parseFloat(rawPrice).toFixed(2)}` 
            : 'Check post';
          
          return {
            id: item.id,
            url: item.listings?.url || '#',
            brand: brand,
            model: model,
            size: attrs.eu_size ? `EU ${attrs.eu_size}` : attrs.us_size ? `US ${attrs.us_size}` : 'Any Size',
            gender: attrs.gender || 'U',
            price: formattedPrice
          }
        })
        
        const formattedMap: Record<string, string[]> = {}
        Object.keys(brandModelMap).sort().forEach(brand => {
          formattedMap[brand] = Array.from(brandModelMap[brand]).sort()
        })

        setDynamicBrandModels(formattedMap)
        setAllItems(formatted)
      }
      
      setLoading(false)
    }

    fetchAllItems()
  }, [])

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (filters.brand && item.brand !== filters.brand) return false
      
      if (filters.model && item.model !== filters.model) return false
      
      if (filters.gender && item.gender !== filters.gender) return false
      
      if (filters.size) {
        const expectedSizeStr = `${sizeUnit} ${filters.size}`
        if (item.size !== expectedSizeStr) return false
      }
      
      return true
    })
  }, [allItems, filters, sizeUnit])

  const displayedItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleCount < filteredItems.length

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, brand: e.target.value, model: '' })
  }

  const clearFilters = () => {
    setFilters({ brand: '', model: '', size: '', gender: '' })
    setSizeUnit('EU')
    setVisibleCount(ITEMS_PER_PAGE) // Reset pagination
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Our Finds</h1>
        <p className="text-slate-500 mt-1">The {MAX_TOTAL_ITEMS} most recently posted climbing shoes.</p>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Brand</label>
            <select 
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none transition-all text-sm font-medium"
              value={filters.brand}
              onChange={handleBrandChange} 
            >
              <option value="">All Brands</option>
              {Object.keys(dynamicBrandModels).map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Model</label>
            <select 
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-sm font-medium"
              value={filters.model}
              onChange={(e) => setFilters({...filters, model: e.target.value})}
              disabled={!filters.brand}
            >
              <option value="">All Models</option>
              {filters.brand && dynamicBrandModels[filters.brand]?.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Unit</label>
              <select 
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none text-sm font-medium"
                value={sizeUnit}
                onChange={(e) => {
                  setSizeUnit(e.target.value)
                  setFilters({...filters, size: ''}) // Reset size when unit changes
                }}
              >
                <option value="EU">EU</option>
                <option value="US">US</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Size</label>
              <select 
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none text-sm font-medium"
                value={filters.size}
                onChange={(e) => setFilters({...filters, size: e.target.value})}
              >
                <option value="">Any</option>
                {(sizeUnit === 'EU' ? EU_SIZES : US_SIZES).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Gender</label>
            <select 
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none text-sm font-medium"
              value={filters.gender}
              onChange={(e) => setFilters({...filters, gender: e.target.value})}
            >
              <option value="">Any</option>
              <option value="M">Men's</option>
              <option value="W">Women's</option>
              <option value="U">Unisex</option>
            </select>
          </div>

          <div>
             <button 
                onClick={clearFilters}
                className="w-full bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-200 transition-colors text-sm"
              >
                Clear Filters
              </button>
          </div>
          
        </div>
      </div>

      {/* FEED GRID */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium">Loading recent finds...</div>
      ) : (
        <>
          {displayedItems.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-slate-500 font-medium">No shoes match these exact filters right now.</p>
              <button onClick={clearFilters} className="text-blue-600 font-semibold mt-2 hover:underline">Clear filters and view all</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {displayedItems.map((item) => (
                <a 
                  key={item.id} 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 hover:border-blue-200 hover:shadow-[0_4px_25px_rgb(59,130,246,0.1)] transition-all flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{item.brand}</span>
                      <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{item.price}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                      {item.model}
                    </h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-sm font-medium text-slate-500">
                    <div className="flex gap-2">
                      <span>{item.size}</span>
                      <span className="text-slate-300">|</span>
                      <span>{item.gender === 'M' ? "Men's" : item.gender === 'W' ? "Women's" : "Unisex"}</span>
                    </div>
                    <span className="text-blue-600 group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* LOAD MORE BUTTON */}
          {hasMore && (
            <div className="mt-12 text-center">
              <button
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                className="bg-white border-2 border-slate-200 text-slate-700 font-semibold px-8 py-3 rounded-full hover:border-blue-500 hover:text-blue-600 transition-all"
              >
                Load More Matches
              </button>
            </div>
          )}
          
          {!hasMore && displayedItems.length > 0 && (
            <div className="mt-12 text-center text-slate-400 text-sm font-medium">
              You've reached the end of the filtered results.
            </div>
          )}
        </>
      )}
    </div>
  )
}
