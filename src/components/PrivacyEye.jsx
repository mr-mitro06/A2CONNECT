import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

export default function PrivacyEye({ toggleHide, isHidden }) {
  const [isHovered, setIsHovered] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const handleTap = () => {
    toggleHide(!isHidden);
  };

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e) => {
      // Secret Shortcut: Ctrl + Shift + H
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        toggleHide(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHide]);

  return (
    <motion.div
      drag
      dragConstraints={{ 
        left: -(windowSize.width - 80), 
        right: 0, 
        top: 0, 
        bottom: windowSize.height - 200 
      }}
      dragElastic={0.1}
      dragMomentum={false}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleTap}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      style={{
        position: 'fixed',
        top: 90,
        right: 20,
        zIndex: 9999,
        touchAction: 'none'
      }}
      className="w-12 h-12 rounded-full cursor-grab active:cursor-grabbing bg-black/50 backdrop-blur-md border border-white/10 shadow-2xl flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-black/80 hover:border-white/20 transition-colors"
      title="Double click or press Ctrl+Shift+H to hide chat"
    >
      {isHidden ? <EyeOff className="w-5 h-5 text-red-500" /> : <Eye className="w-5 h-5" />}
    </motion.div>
  );
}
