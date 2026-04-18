import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Trash2, Smile, X, Star } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const PenIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
);

export default function MessageContextMenu({ position, msg, isMe, isStarred, onClose, onAction }) {
  const menuRef = useRef(null);
  const [showFullPicker, setShowFullPicker] = useState(false);

  const currentReaction = (typeof msg.content === 'object' && msg.content !== null) ? msg.content.reaction : null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.EmojiPickerReact')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!position || !msg) return null;

  const menuWidth = 220;
  const screenHeight = window.innerHeight;
  const screenWidth = window.innerWidth;
  
  const isBottomPart = position.y > screenHeight * 0.6;
  const yCoord = isBottomPart ? position.y - 15 : position.y + 15;
  const xCoord = Math.max(15, Math.min(position.x, screenWidth - menuWidth - 15));
  const isRightSide = position.x > screenWidth / 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-[4px]"
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.2 }}
          style={{
            top: yCoord,
            left: xCoord,
            position: 'absolute',
            transform: isBottomPart ? 'translateY(-100%)' : 'none'
          }}
          className={`flex flex-col gap-1.5 shadow-2xl ${isRightSide ? 'items-end' : 'items-start'}`}
        >
          {showFullPicker ? (
            <div className="bg-[#1c2226] p-2 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
              <EmojiPicker
                theme="dark"
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                height={380}
                width={300}
                onEmojiClick={(e) => {
                  onAction('react', e.emoji);
                  setShowFullPicker(false);
                }}
              />
            </div>
          ) : (
            <>
              {/* --- High Fidelity Reaction Pill --- */}
              <div className="bg-[#202c33]/98 backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-2 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {EMOJIS.map(emoji => {
                  const isActive = currentReaction === emoji;
                  return (
                    <button 
                      key={emoji} 
                      onClick={() => onAction('react', isActive ? null : emoji)}
                      className={`text-[22px] hover:scale-125 transition-all w-9 h-9 flex items-center justify-center rounded-full ${isActive ? 'bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-110' : 'hover:bg-white/5 opacity-80 hover:opacity-100'}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
                <div className="w-[1px] h-6 bg-white/[0.1] mx-1"></div>
                <button onClick={() => setShowFullPicker(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all">
                  <Smile className="w-6 h-6" />
                </button>
              </div>

              {/* --- Action Menu List --- */}
              <div className="bg-[#1a1c1e] border border-white/[0.08] rounded-[1.8rem] w-[220px] py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
                <button onClick={() => onAction('reply')} className="flex items-center justify-between px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                  <span>Reply</span>
                  <Reply className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>

                {msg.type === 'text' && (
                  <button onClick={() => onAction('copy')} className="flex items-center justify-between px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                    <span>Copy</span>
                    <Copy className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}

                <button onClick={() => onAction('star')} className="flex items-center justify-between px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                  <span>{isStarred ? 'Unstar' : 'Star'}</span>
                  <Star className={`w-5 h-5 ${isStarred ? 'text-yellow-400' : 'opacity-40'} group-hover:opacity-100 transition-opacity`} fill={isStarred ? "currentColor" : "none"} />
                </button>

                {msg.type === 'text' && isMe && (
                  <button onClick={() => onAction('edit')} className="flex items-center justify-between px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                    <span>Edit</span>
                    <PenIcon className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}

                {currentReaction && (
                  <button onClick={() => onAction('react', null)} className="flex items-center justify-between px-5 py-3 text-white/50 text-[15px] hover:bg-white/5 transition-colors group">
                    <span>Undo Reaction</span>
                    <X className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}

                <div className="h-[1px] bg-white/[0.05] my-1 mx-4" />

                {isMe && (
                  <button onClick={() => onAction('delete')} className="flex items-center justify-between px-5 py-3 text-red-500 font-bold text-[15px] hover:bg-red-500/10 transition-colors group">
                    <span>Delete for everyone</span>
                    <Trash2 className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}

                <button onClick={() => onAction('delete_for_me')} className="flex items-center justify-between px-5 py-3 text-red-500/70 font-bold text-[15px] hover:bg-red-500/5 transition-colors group">
                   <span>Delete for me</span>
                   <Trash2 className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
