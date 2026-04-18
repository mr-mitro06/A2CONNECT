import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Trash2, Smile, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const StarIcon = ({ className, filled }) => (
  <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const PenIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
);

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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

  // Improved positioning logic:
  // If we are in the bottom part of the screen, flip the menu upwards
  const menuWidth = 240;
  const screenHeight = window.innerHeight;
  const screenWidth = window.innerWidth;
  
  // Flip if the click is in the bottom 40% of the screen
  const isBottomPart = position.y > screenHeight * 0.6;
  const yCoord = isBottomPart ? position.y - 15 : position.y + 15;
  
  // horizontal: clamp to screen edges with padding
  const xCoord = Math.max(15, Math.min(position.x, screenWidth - menuWidth - 15));
  const isRightSide = position.x > screenWidth / 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
            left: xCoord,
            position: 'absolute',
            transform: isBottomPart ? 'translateY(-100%)' : 'none'
          }}
          className={`flex flex-col gap-2 shadow-2xl ${isRightSide ? 'items-end' : 'items-start'}`}
        >
          {showFullPicker ? (
            <EmojiPicker
              theme="dark"
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              height={380}
              width={320}
              onEmojiClick={(e) => onAction('react', e.emoji)}
            />
          ) : (
            <>
              {/* Reaction Bar */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-full px-3 py-2 flex items-center gap-2 shadow-2xl">
                {EMOJIS.map(emoji => {
                  const isActive = currentReaction === emoji;
                  return (
                    <button 
                      key={emoji} 
                      onClick={() => onAction('react', isActive ? null : emoji)}
                      className={`text-xl hover:scale-125 transition-all rounded-full w-8 h-8 flex items-center justify-center ${isActive ? 'bg-white/20 scale-110 shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button onClick={() => setShowFullPicker(true)}
                  className="text-white/50 hover:text-white transition-colors w-8 h-8 flex items-center justify-center">
                  <Smile className="w-5 h-5" />
                </button>
              </div>

              {/* Action Menu */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-[210px] py-2 shadow-2xl overflow-hidden flex flex-col">
                <button onClick={() => onAction('reply')} className="menu-item">
                  Reply <Reply className="w-4 h-4 text-white/50" />
                </button>

                {msg.type === 'text' && isMe && (
                  <button onClick={() => onAction('edit')} className="menu-item">
                    Edit <PenIcon className="w-4 h-4 text-white/50" />
                  </button>
                )}

                {msg.type === 'text' && (
                  <button onClick={() => onAction('copy')} className="menu-item">
                    Copy <Copy className="w-4 h-4 text-white/50" />
                  </button>
                )}

                 <button onClick={() => onAction('star')} className="menu-item">
                   {isStarred ? 'Unstar' : 'Star'} <StarIcon className={`w-4 h-4 ${isStarred ? 'text-yellow-400' : 'text-white/50'}`} filled={isStarred} />
                 </button>
 
                 {currentReaction && (
                   <button onClick={() => onAction('react', null)} className="menu-item text-white/70">
                     Undo Reaction <X className="w-4 h-4" />
                   </button>
                 )}
 
                 <div className="h-[1px] bg-white/5 my-1" />


                {isMe && (
                  <button onClick={() => onAction('delete')} className="menu-item text-red-500 hover:bg-red-500/10">
                    Delete for everyone <Trash2 className="w-4 h-4 opacity-80" />
                  </button>
                )}

                <button onClick={() => onAction('delete_for_me')} className="menu-item text-red-400/70 hover:bg-red-500/5">
                  Delete for me <Trash2 className="w-4 h-4 opacity-60" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
