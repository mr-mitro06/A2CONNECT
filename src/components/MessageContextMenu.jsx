import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Trash2, SmilePlus } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageContextMenu({ position, msg, isMe, onClose, onAction }) {
  const menuRef = useRef(null);
  const [showFullPicker, setShowFullPicker] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if clicking inside the emoji picker overlay itself (picker mounts externally sometimes or inside)
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.EmojiPickerReact')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    // Prevent scrolling behind context menu
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!position || !msg) return null;

  const yCoord = position.y > window.innerHeight - 450 ? position.y - 450 : position.y;
  const xCoord = isMe ? Math.min(position.x, window.innerWidth - 300) : Math.max(position.x, 20);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[2px]"
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
          style={{ 
            top: yCoord, 
            [isMe ? 'right' : 'left']: isMe ? window.innerWidth - xCoord : xCoord,
            position: 'absolute'
          }}
          className="flex flex-col gap-2 shadow-2xl"
        >
          {showFullPicker ? (
            <EmojiPicker theme="dark" onEmojiClick={(e) => onAction('react', e.emoji)} />
          ) : (
            <>
              {/* Reaction Bar */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-full px-3 py-2 flex items-center gap-2 shadow-2xl">
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => onAction('react', emoji)}
                    className="text-xl hover:scale-125 transition-transform hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button 
                  onClick={() => setShowFullPicker(true)}
                  className="text-white/50 hover:text-white transition-colors w-8 h-8 flex items-center justify-center"
                >
                  <SmilePlus className="w-5 h-5" />
                </button>
              </div>

              {/* Action Menu */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-[200px] py-2 shadow-2xl overflow-hidden flex flex-col">
                <button onClick={() => onAction('reply')} className="w-full text-left px-5 py-3 hover:bg-white/5 text-white/90 text-[15px] font-medium transition-colors flex items-center justify-between">
                  Reply
                  <Reply className="w-4 h-4 text-white/50" />
                </button>
                <button onClick={() => onAction('copy')} className="w-full text-left px-5 py-3 hover:bg-white/5 text-white/90 text-[15px] font-medium transition-colors flex items-center justify-between">
                  Copy
                  <Copy className="w-4 h-4 text-white/50" />
                </button>
                <div className="h-[1px] bg-white/5 my-1" />
                <button onClick={() => onAction('delete')} className="w-full text-left px-5 py-3 hover:bg-red-500/10 text-red-500 text-[15px] font-medium transition-colors flex items-center justify-between Group">
                  Delete
                  <Trash2 className="w-4 h-4 opacity-80" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
