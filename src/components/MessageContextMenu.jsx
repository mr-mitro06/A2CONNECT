import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Trash2, Smile, X, Star, Plus, Info, Pin } from 'lucide-react';
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

  // --- SMART AUTO-ALIGN LOGIC (MOBILE-FRIENDLY) ---
  const menuWidth = 410; // Accurately reflects the reaction pill width
  const menuHeight = 400; 
  const screenHeight = window.innerHeight;
  const screenWidth = window.innerWidth;
  const padding = 16; // Consistent padding for all devices

  const isRightSide = position.x > screenWidth / 2;
  const isBottomPart = position.y > screenHeight / 2;

  // Calculate X: Anchor to the click but PIVOT if it's on the right
  let finalLeft = position.x;
  if (isRightSide) {
    finalLeft = position.x - menuWidth;
  }
  
  // Hard Clamp to screen edges
  finalLeft = Math.max(padding, Math.min(finalLeft, screenWidth - menuWidth - padding));

  // Calculate Y: Pivot if it's on the bottom
  let finalTop = position.y;
  let transform = 'none';

  if (isBottomPart) {
    // Open upwards
    finalTop = position.y - 10;
    transform = 'translateY(-100%)';
    // Top safety clamp
    if (finalTop - menuHeight < padding) {
       finalTop = menuHeight + padding;
    }
  } else {
    // Open downwards
    finalTop = position.y + 10;
    // Bottom safety clamp
    if (finalTop + menuHeight > screenHeight - padding) {
       finalTop = screenHeight - menuHeight - padding;
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-[4px]"
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: isBottomPart ? 20 : -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          style={{
            top: finalTop,
            left: finalLeft,
            position: 'absolute',
            transform: transform,
            maxWidth: `calc(100vw - ${padding * 2}px)`,
            width: 'fit-content'
          }}
          className={`flex flex-col gap-2 shadow-2xl ${isRightSide ? 'items-end' : 'items-start'} pointer-events-auto`}
        >
          {showFullPicker ? (
            <div className="bg-[#1c2226] p-2 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
              <EmojiPicker
                theme="dark"
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                height={350}
                width={280}
                onEmojiClick={(e) => {
                  onAction('react', e.emoji);
                  setShowFullPicker(false);
                }}
              />
            </div>
          ) : (
            <>
              {/* --- Floating Reaction Pill --- */}
              <div className="bg-[#202c33] border border-white/[0.12] rounded-[2rem] px-4 py-2 flex items-center gap-3 shadow-[0_12px_48px_rgba(0,0,0,0.7)] backdrop-blur-3xl transition-transform max-w-full overflow-x-auto no-scrollbar">
                {EMOJIS.map(emoji => {
                  const isActive = currentReaction === emoji;
                  return (
                    <button 
                      key={emoji} 
                      onClick={() => onAction('react', isActive ? null : emoji)}
                      className={`text-[24px] hover:scale-125 transition-all w-10 h-10 flex items-center justify-center rounded-full group ${isActive ? 'bg-white/10 ring-2 ring-white/20' : 'hover:bg-white/5 opacity-90 hover:opacity-100'}`}
                    >
                      <span>{emoji}</span>
                    </button>
                  );
                })}
                <div className="w-[1px] h-6 bg-white/[0.15] mx-1"></div>
                <button onClick={() => setShowFullPicker(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all font-light">
                  <Plus className="w-7 h-7" />
                </button>
              </div>

              {/* --- Action Menu List --- */}
              <div className="bg-[#202c33] border border-white/[0.08] rounded-[1.8rem] w-[230px] py-2.5 shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col backdrop-blur-3xl">
                <button onClick={() => onAction('info')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                  <Info className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span>Message info</span>
                </button>

                <button onClick={() => onAction('reply')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                  <Reply className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span>Reply</span>
                </button>

                <button onClick={() => onAction('copy')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                  <Copy className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span>Copy</span>
                </button>

                <button onClick={() => onAction('star')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                  <Star className={`w-5 h-5 ${isStarred ? 'text-yellow-400 fill-current' : 'opacity-50 group-hover:opacity-100'} transition-opacity`} />
                  <span>Star</span>
                </button>

                <button 
                  onClick={() => onAction(msg.content?.is_pinned ? 'unpin' : 'pin')} 
                  className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group"
                >
                  <Pin className={`w-5 h-5 ${msg.content?.is_pinned ? 'text-emerald-500 fill-current' : 'opacity-50 group-hover:opacity-100'} transition-opacity`} />
                  <span>{msg.content?.is_pinned ? 'Unpin' : 'Pin'}</span>
                </button>

                {currentReaction && (
                  <button onClick={() => onAction('react', null)} className="flex items-center gap-4 px-5 py-3 text-white/60 text-[15px] hover:bg-white/5 transition-colors group border-t border-white/[0.05] mt-1">
                    <X className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span>Undo Reaction</span>
                  </button>
                )}

                <div className="h-[1px] bg-white/[0.08] my-1 mx-4" />

                <button onClick={() => onAction('delete')} className="flex items-center gap-4 px-5 py-3 text-red-400 font-medium text-[15px] hover:bg-red-500/10 transition-colors group">
                  <Trash2 className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
