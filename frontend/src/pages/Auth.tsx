import { useState } from 'react'
import { supabase } from '../services/supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    // Call Supabase to create the user
    const { error } = await supabase.auth.signUp({ email, password })
    
    if (error) setMessage(error.message)
    else setMessage('Account created! You are now logged in.')
    
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    // Call Supabase to log the user in
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) setMessage(error.message)
    
    setLoading(false)
  }

  return (
    <div className="flex justify-center items-center h-screen bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl border border-base-300">
        <div className="card-body">
          <h2 className="card-title justify-center text-3xl font-bold text-primary mb-6">Gear Hunter</h2>
          
          <form className="flex flex-col gap-4">
            <input 
              type="email" 
              placeholder="Email" 
              className="input input-bordered w-full" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="input input-bordered w-full" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            
            {message && <p className="text-sm text-center text-accent font-semibold">{message}</p>}
            
            <div className="card-actions justify-between mt-4 gap-4">
              <button 
                onClick={handleSignUp} 
                disabled={loading} 
                className="btn btn-primary flex-1"
              >
                {loading ? <span className="loading loading-spinner"></span> : 'Sign Up'}
              </button>
              <button 
                onClick={handleLogin} 
                disabled={loading} 
                className="btn btn-primary flex-1"
              >
                {loading ? <span className="loading loading-spinner"></span> : 'Login'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
