import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowDownToLine } from 'lucide-react';

export default function PhotoViewer({ src, isOpen, onClose }) {
  if (!src) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="absolute top-6 right-20 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            title="Download Original"
          >
            <ArrowDownToLine className="w-6 h-6" />
          </a>

          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.35 }}
            src={src}
            alt="Full screen media"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
