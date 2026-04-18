import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    // Add brief artificial delay for animation smoothness
    setTimeout(() => {
      const result = login(code);
      if (!result.success) {
        setError(result.error);
        setCode('');
      }
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-sm mx-4 p-8 rounded-3xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-xl">
            <Lock className="w-8 h-8 text-white/80" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">A2Connect</h1>
          <p className="text-white/40 text-sm mt-2">Enter access code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="glass-input w-full px-5 py-4 text-white placeholder:text-white/30 text-center tracking-[0.2em] font-medium"
              autoComplete="off"
              autoFocus
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-sm text-center font-medium"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={!code.trim()}
            className="primary-btn w-full py-4 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            Authenticate
            <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </motion.div>

      <div className="absolute bottom-10 left-0 right-0 text-center z-10 font-['Outfit']">
        <div className="space-y-1.5 opacity-40 hover:opacity-100 transition-opacity duration-700 cursor-default">
          <p className="text-white/40 text-[11px] uppercase tracking-[0.4em] font-medium">
            Made with <span className="text-red-500/60 text-[11px] mx-1">❤️</span> by <span className="text-white/60 tracking-widest font-bold ml-0.5">Abhinav Das</span>
          </p>
          <p className="text-white/20 text-[10px] uppercase tracking-[0.6em] font-bold">
            FryLabs Studios
          </p>
        </div>
      </div>
    </div>
  );
}
