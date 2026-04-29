import { Link } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { useState, useEffect, useRef } from 'react'

export default function Navbar({ session }: { session: any }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-slate-900">
          Second Ascent.
        </Link>

        <div className="flex items-center gap-6 font-medium text-sm">
          {!session ? (
            <>
              <Link to="/login" className="text-slate-500 hover:text-slate-900 transition-colors">
                Sign in 
              </Link>
              <Link to="/signup" className="bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 transition-colors shadow-sm">
                Get Started
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="text-slate-600 hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link to="/browse" className="text-slate-600 hover:text-blue-600 transition-colors">
                Browse
              </Link>
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 flex flex-col">
                    <Link 
                      to="/settings" 
                      onClick={() => setDropdownOpen(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left"
                    >
                      Settings
                    </Link>
                    <button 
                      onClick={async () => {
                        setDropdownOpen(false)
                        await supabase.auth.signOut()
                      }}
                      className="px-4 py-2 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-left"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
