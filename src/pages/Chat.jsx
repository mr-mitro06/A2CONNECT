import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { encryptMessage, decryptMessage } from '../lib/encryption';
import PrivacyEye from '../components/PrivacyEye';
import FakeTerminal from '../components/FakeTerminal';
import PhotoViewer from '../components/PhotoViewer';
import AudioPlayer from '../components/AudioPlayer';
import EmojiPicker from 'emoji-picker-react';
import ChromeDino from '../components/ChromeDino';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';

// --- Integrated A2MessageContextMenu untuk Stabilitas Maksimum ---
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const A2MessageContextMenu = ({ position, msg, isMe, isStarred, onClose, onAction }) => {
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

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const isMobile = screenWidth < 480;
  const padding = isMobile ? 8 : 16;
  const isRightSide = position.x > screenWidth / 2;
  
  // Dynamic Height Strategy
  const availableBelow = screenHeight - position.y - padding - 20;
  const availableAbove = position.y - padding - 20;
  const menuWidth = isMobile ? (screenWidth - padding * 2) : 230;
  const idealHeight = isMe ? 480 : 420; // Rough estimate including reaction bar

  let shouldPivotY = false;
  let maxHeight = idealHeight;

  if (availableBelow < idealHeight && availableAbove > availableBelow) {
    shouldPivotY = true;
    maxHeight = Math.min(idealHeight, availableAbove);
  } else {
    maxHeight = Math.min(idealHeight, availableBelow);
  }

  // Horizontal Positioning
  let finalLeft = isMobile ? padding : position.x;
  if (!isMobile && isRightSide) finalLeft = position.x - menuWidth;
  // Clamp horizontal
  finalLeft = Math.max(padding, Math.min(finalLeft, screenWidth - menuWidth - padding));

  // Vertical Positioning - Strict Viewport Clamping
  let finalTop = position.y;
  let originY = "top";
  
  if (shouldPivotY) {
    // Grow upwards from cursor, but don't hit the top
    finalTop = Math.max(padding + maxHeight, position.y) - maxHeight;
    originY = "bottom";
  } else {
    // Grow downwards from cursor, but don't hit the bottom
    finalTop = Math.min(screenHeight - maxHeight - padding, position.y);
    originY = "top";
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-[4px]"
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: shouldPivotY ? 20 : -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={{
            top: finalTop, 
            left: finalLeft, 
            position: 'absolute',
            width: isMobile ? `${menuWidth}px` : 'fit-content',
            maxHeight: `${maxHeight}px`,
            transformOrigin: `${isRightSide ? 'right' : 'left'} ${originY}`
          }}
          className={`flex flex-col gap-2 shadow-2xl ${isMobile ? 'items-center' : (isRightSide ? 'items-end' : 'items-start')} pointer-events-auto`}
        >
          {showFullPicker ? (
            <div className="bg-[#1c2226] p-2 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
              <EmojiPicker
                theme="dark" previewConfig={{ showPreview: false }} skinTonesDisabled height={350} width={280}
                onEmojiClick={(e) => { onAction('react', e.emoji); setShowFullPicker(false); }}
              />
            </div>
          ) : (
            <>
              <div className="bg-[#202c33] border border-white/[0.12] rounded-[2rem] px-3 py-2 sm:px-4 flex items-center justify-center flex-wrap gap-2 sm:gap-3 shadow-[0_12px_48px_rgba(0,0,0,0.7)] backdrop-blur-3xl w-full">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => {
                  const isActive = currentReaction === emoji;
                  return (
                    <button key={emoji} onClick={() => onAction('react', isActive ? null : emoji)}
                      className={`text-[18px] sm:text-[24px] hover:scale-125 transition-all w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full group ${isActive ? 'bg-white/10 ring-2 ring-white/20' : 'hover:bg-white/5 opacity-90'}`}
                    >
                      <span>{emoji}</span>
                    </button>
                  );
                })}
                <button 
                  onClick={() => setShowFullPicker(true)}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all group"
                  title="More Emojis"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div 
                style={{ maxHeight: `${maxHeight - 60}px` }}
                className="bg-[#202c33] border border-white/[0.08] rounded-[1.8rem] w-[230px] py-2.5 shadow-[0_16px_60px_rgba(0,0,0,0.8)] flex flex-col backdrop-blur-3xl overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
              >
                {isMe && msg.type === 'text' && (
                  <button onClick={() => onAction('edit')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 transition-colors group">
                    <A2PenIcon className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                    <span>Edit message</span>
                  </button>
                )}
                <button onClick={() => onAction('star')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 group">
                  <Star className={`w-5 h-5 ${isStarred ? 'text-yellow-400 fill-current' : 'opacity-50'}`} />
                  <span>Star</span>
                </button>
                <button onClick={() => onAction('info')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 group">
                  <A2InfoIcon className="w-5 h-5 opacity-50" />
                  <span>Message info</span>
                </button>
                <button onClick={() => onAction('reply')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 group">
                  <Reply className="w-5 h-5 opacity-50" />
                  <span>Reply</span>
                </button>
                <button onClick={() => onAction('copy')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 group">
                  <Copy className="w-5 h-5 opacity-50" />
                  <span>Copy</span>
                </button>
                <button onClick={() => onAction(msg.content?.is_pinned ? 'unpin' : 'pin')} className="flex items-center gap-4 px-5 py-3 text-white text-[15px] hover:bg-white/5 group">
                  <Pin className={`w-5 h-5 ${msg.content?.is_pinned ? 'text-emerald-500 fill-current' : 'opacity-50'}`} />
                  <span>{msg.content?.is_pinned ? 'Unpin' : 'Pin'}</span>
                </button>
                <div className="h-[1px] bg-white/[0.08] my-1 mx-4" />
                {isMe && (
                  <button onClick={() => onAction('delete')} className="flex items-center gap-4 px-5 py-3 text-red-400 text-[15px] hover:bg-red-500/10 group">
                    <Trash2 className="w-5 h-5 opacity-60" />
                    <span>Delete for everyone</span>
                  </button>
                )}
                <button onClick={() => onAction('delete_for_me')} className="flex items-center gap-4 px-5 py-3 text-red-400 text-[15px] hover:bg-red-500/10 group">
                  <Trash2 className="w-5 h-5 opacity-60" />
                  <span>Delete for me</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
import {
  Send, Mic, Phone, X, Reply, Paperclip, Loader2,
  Trash2, Smile, Search, ArrowDownToLine, File, Settings, Upload, ChevronDown, Calendar, MoreVertical, Pin, Star, Copy, Plus
} from 'lucide-react';

const A2InfoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const A2CheckCheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12l5 5L20 4"/><path d="M7 12l5 5L25 4"/>
  </svg>
);

const A2ClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const A2LogOutIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const A2StarIcon = ({ className, filled }) => (
  <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const A2PenIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
);


// --- Helpers ---
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const decryptMsg = (msg) => {
  const newMsg = { ...msg };
  try {
    const rawDec = decryptMessage(newMsg.content);
    if (!rawDec) return newMsg;

    const dec = rawDec.trim();
    
    // Attempt to parse as JSON if it looks like an object/array
    if ((dec.startsWith('{') && dec.endsWith('}')) || (dec.startsWith('[') && dec.endsWith(']'))) {
      try {
        newMsg.content = JSON.parse(dec);
      } catch (parseErr) {
        // Not valid JSON, treat as text
        if (newMsg.type === 'text') newMsg.content = { text: dec };
        else newMsg.content = dec;
      }
    } else {
      // Plain text or legacy fallback
      if (newMsg.type === 'text') newMsg.content = { text: dec };
      else newMsg.content = dec;
    }
  } catch (e) {
    console.error("Decryption failed for message:", newMsg.id, e);
  }
  return newMsg;
};


export default function Chat() {
  const { user, logout, refreshUser } = useAuth();
  
  // State Definitions - Moved to Top
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pNickname, setPNickname] = useState(() => {
    if (!user) return '';
    const partnerId = user.id === 'user_abhi' ? 'user_arya' : 'user_abhi';
    return localStorage.getItem(`nickname_${user.id}_${partnerId}`) || '';
  });
  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: null, msg: null });
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [showStarredVault, setShowStarredVault] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [msgInfoData, setMsgInfoData] = useState(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('me'); // 'me' or 'everyone'
  const [showCallDisclaimer, setShowCallDisclaimer] = useState(false);

  // Helper to Highlight Search Matches
  const highlightMatch = (text, query) => {
    if (!query || !query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <span key={i} className="bg-emerald-500/20 text-emerald-400 font-bold px-1 rounded-sm ring-1 ring-emerald-500/30">{part}</span> 
        : part
    );
  };

  const handleJumpToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(id);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  // Handle mobile back button to close modals/drawers
  useEffect(() => {
    const handlePopState = (e) => {
      if (msgInfoData) {
        setMsgInfoData(null);
      } else if (showSettings) {
        setShowSettings(false);
      } else if (showStarredVault) {
        setShowStarredVault(false);
      }
    };

    if (msgInfoData || showSettings || showStarredVault) {
      window.history.pushState({ modalOpen: true }, '', window.location.pathname);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [msgInfoData, showSettings, showStarredVault]);

  const [isHideMode, setIsHideMode] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);
  const [hideModeType, setHideModeType] = useState('dino');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);
  const [viewedPhoto, setViewedPhoto] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const bottomRef = useRef(null);
  const roomChannelRef = useRef(null);
  const inputRef = useRef(null);

  // Guard for null user - MOVED AFTER HOOKS
  if (!user) return <div className="h-screen bg-black" />;

  const partnerId = user.id === 'user_abhi' ? 'user_arya' : 'user_abhi';
  const partnerName = pNickname || (user.id === 'user_abhi' ? 'Arya' : 'Abhi');

  // Reusable Avatar Component
  const Avatar = ({ src, name, size = "w-12 h-12", textSize = "text-lg", online = false }) => (
    <div className="relative flex-shrink-0">
      {src ? (
        <img src={src} alt={name} className={`${size} rounded-full object-cover shadow-lg border border-white/10`} />
      ) : (
        <div className={`${size} rounded-full bg-gradient-to-tr from-zinc-800 to-neutral-700 shadow-inner flex items-center justify-center ${textSize} font-bold text-white/80`}>
          {name?.[0]}
        </div>
      )}
      {online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111] shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>}
    </div>
  );

  // Draft saving
  useEffect(() => {
    const saved = localStorage.getItem(`draft_${user.id}`);
    if (saved) setNewMessage(saved);
  }, [user.id]);

  useEffect(() => {
    localStorage.setItem(`draft_${user.id}`, newMessage);
  }, [newMessage, user.id]);



  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // 1. Initial Data Fetching
    const initChat = async () => {
      // Fetch Messages
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!msgError && msgData) {
        setMessages(msgData.map(decryptMsg));
        scrollToBottom();
        const undelivered = msgData.filter(m => m.receiver_id === user.id && m.status === 'sent');
        if (undelivered.length > 0) {
          await supabase.from('messages').update({ status: 'delivered' }).in('id', undelivered.map(m => m.id));
        }
      }

      // Fetch Partner's Initial Status
      const { data: userData } = await supabase.from('users').select('*').eq('id', partnerId).single();
      if (userData) {
        setPartnerOnline(userData.online_status);
        setPartnerLastSeen(userData.last_seen);
        setPartnerAvatar(userData.avatar_url);
      }

      // Mark self as online in DB
      await supabase.from('users').update({ online_status: true, last_seen: new Date().toISOString() }).eq('id', user.id);

    };
    initChat();

    // Helper to sync latest messages and catch up on missed ones
    const syncMessages = async () => {
      const { data } = await supabase.from('messages')
        .select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false }).limit(30);
      
      if (data) {
        setMessages(prev => {
          let hasNew = false;
          let next = [...prev];
          data.reverse().forEach(msg => {
            const existing = prev.find(m => m.id === msg.id);
            if (!existing) {
              hasNew = true;
              next.push(decryptMsg({ ...msg }));
            } else if (existing.status !== msg.status) {
              hasNew = true;
              next = next.map(m => m.id === msg.id ? { ...m, status: msg.status } : m);
            }
          });
          if (hasNew) {
            setTimeout(scrollToBottom, 50);
            return next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          }
          return prev;
        });
      }
    };

    // 1. Initial Load & Visibility Sync
    syncMessages();
    window.addEventListener('focus', syncMessages);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncMessages();
    });

    // 2. Real-time Message Listener (Unique Name to avoid StrictMode collisions)
    const dbChannel = supabase
      .channel(`messages-sync-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, decryptMsg({ ...msg })]);
        setTimeout(scrollToBottom, 50);
        if (msg.receiver_id === user.id && msg.status === 'sent') {
          await supabase.from('messages').update({ status: 'delivered' }).eq('id', msg.id);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? decryptMsg({ ...payload.new }) : m));
      })
      .subscribe();

    // 3. Partner Status Listener
    const userChannel = supabase
      .channel(`partner-status-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${partnerId}` }, (payload) => {
        setPartnerOnline(payload.new.online_status);
        setPartnerLastSeen(payload.new.online_status ? null : payload.new.last_seen);
        setPartnerAvatar(payload.new.avatar_url);
      })
      .subscribe();
      
    // Fallback: Recover missed messages every 10s
    const fallbackInterval = setInterval(syncMessages, 10000);

    // 4. Ephemeral Presence (Typing Indicator Only)
    // Create a unique room name based on alphabetized user IDs
    const roomName = [user.id, partnerId].sort().join('-');
    roomChannelRef.current = supabase.channel(`presence:${roomName}`, {
      config: { presence: { key: user.id } },
    });
    roomChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannelRef.current.presenceState();
        const partnerPresence = state[partnerId];
        setPartnerTyping(!!(partnerPresence && partnerPresence[0]?.isTyping));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannelRef.current.track({ isTyping: false });
        }
      });

    // Cleanup
    return () => {
      window.removeEventListener('focus', syncMessages);
      document.removeEventListener('visibilitychange', syncMessages);
      clearInterval(fallbackInterval);
      // Synchronously remove channels to prevent StrictMode clashes
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(userChannel);

      if (roomChannelRef.current) supabase.removeChannel(roomChannelRef.current);

      // Asynchronously update offline status
      supabase.from('users').update({ 
        online_status: false, 
        last_seen: new Date().toISOString() 
      }).eq('id', user.id);
    };
  }, [user.id, partnerId, scrollToBottom]);

  // Mark seen when messages rendered - Optimistic Update
  useEffect(() => {
    const unreadInView = messages.filter(
      m => m.receiver_id === user.id && (m.status === 'delivered' || m.status === 'sent')
    );
    if (unreadInView.length > 0) {
      // 1. Instantly update local state so the "Unread" pill vanishes
      setMessages(prev => prev.map(m => {
        if (m.receiver_id === user.id && (m.status === 'delivered' || m.status === 'sent')) {
          return { ...m, status: 'seen' };
        }
        return m;
      }));

      // 2. Clear the DB in the background
      supabase.from('messages')
        .update({ status: 'seen' })
        .in('id', unreadInView.map(m => m.id))
        .then(({ error }) => {
          if (error) console.error('Error marking seen:', error);
        });
    }
  }, [messages.length, user.id]); // Optimized dependency

  const typingTimeoutRef = useRef(null);
  const isLocalTyping = useRef(false);

  const handleTyping = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    
    if (roomChannelRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Only track if state actually changed to avoid network spam
      if (val.length > 0 && !isLocalTyping.current) {
        isLocalTyping.current = true;
        roomChannelRef.current.track({ isTyping: true });
      } else if (val.length === 0 && isLocalTyping.current) {
        isLocalTyping.current = false;
        roomChannelRef.current.track({ isTyping: false });
      }
      
      // Auto-revert to non-typing after 2.5 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (roomChannelRef.current && isLocalTyping.current) {
          isLocalTyping.current = false;
          roomChannelRef.current.track({ isTyping: false });
        }
      }, 2500);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const messageText = newMessage.trim();
    setNewMessage('');
    localStorage.removeItem(`draft_${user.id}`);
    if (roomChannelRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isLocalTyping.current = false;
      roomChannelRef.current.track({ isTyping: false });
    }

    // Editing existing message
    if (editingMsg) {
      setEditingMsg(null);
      const updatedPayload = JSON.stringify({ ...editingMsg.content, text: messageText, edited: true });
      const encrypted = encryptMessage(updatedPayload);
      const optimistic = { ...editingMsg, content: { ...editingMsg.content, text: messageText, edited: true } };
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? optimistic : m));
      await supabase.from('messages').update({ content: encrypted }).eq('id', editingMsg.id);
      return;
    }

    const msgId = generateUUID();
    const getReplyPreview = (r) => {
      if (!r) return null;
      if (['audio', 'image', 'video', 'file'].includes(r.type)) return '📎 Media';
      return typeof r.content === 'object' ? r.content.text : r.content;
    };
    const plaintextPayload = JSON.stringify({
      text: messageText,
      reply_text: getReplyPreview(replyingTo),
      reply_sender: replyingTo ? (replyingTo.sender_id === user.id ? 'You' : partnerName) : null
    });
    setReplyingTo(null);
    const optimisticMsg = {
      id: msgId, sender_id: user.id, receiver_id: partnerId,
      content: JSON.parse(plaintextPayload), type: 'text',
      status: 'sending', created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);
    const { error } = await supabase.from('messages').insert([{
      id: msgId, sender_id: user.id, receiver_id: partnerId,
      content: encryptMessage(plaintextPayload), type: 'text', status: 'sent'
    }]);
    if (error) console.error(error);
    else setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
  };

  // Only image/video accepted from picker
  const handleFileUpload = async (file) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return; // safety guard

    setIsUploadingMedia(true);
    const msgId = generateUUID();
    const msgType = isVideo ? 'video' : 'image';
    const localUrl = URL.createObjectURL(file);

    setMessages(prev => [...prev, {
      id: msgId, sender_id: user.id, receiver_id: partnerId,
      content: localUrl, type: msgType, status: 'sending', created_at: new Date().toISOString()
    }]);
    setTimeout(scrollToBottom, 50);

    const fileName = `${Date.now()}_${user.id}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supabase.storage.from('media').upload(fileName, file, { upsert: true, contentType: file.type });
    if (!error && data) {
      const publicUrl = supabase.storage.from('media').getPublicUrl(fileName).data.publicUrl;
      const encryptedUrl = encryptMessage(publicUrl);
      const { error: ie } = await supabase.from('messages').insert([{
        id: msgId, sender_id: user.id, receiver_id: partnerId,
        content: encryptedUrl, type: msgType, status: 'sent'
      }]);
      if (ie) {
        console.error('Database Insert Error:', ie);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error' } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent', content: publicUrl } : m));
      }
    } else {
      console.error('Supabase Storage Error:', error);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error' } : m));
    }
    setIsUploadingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  // Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e) => {
    e.preventDefault(); setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `${Date.now()}_${user.id}.webm`;
        const { data, error } = await supabase.storage.from('media').upload(fileName, audioBlob, { contentType: 'audio/webm' });
        if (!error && data) {
          const publicUrl = supabase.storage.from('media').getPublicUrl(fileName).data.publicUrl;
          await supabase.from('messages').insert([{
            id: generateUUID(), sender_id: user.id, receiver_id: partnerId,
            content: encryptMessage(publicUrl), type: 'audio', status: 'sent'
          }]);
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleClearChat = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`);

      if (error) {
        alert(`Failed to clear chat: ${error.message}`);
        return;
      }
      setMessages([]);
      setReplyingTo(null);
      setEditingMsg(null);
      localStorage.removeItem(`draft_${user.id}`);
      console.log('Chat history cleared permanently.');
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const handleProfileUpdate = async ({ name, avatarFile, nickname }) => {
    try {
      if (nickname !== undefined) {
        localStorage.setItem(`nickname_${user.id}_${partnerId}`, nickname);
        setPNickname(nickname);
      }

      let finalAvatarUrl = user.avatar_url;
      if (avatarFile) {
        const fileName = `avatars/${user.id}_${Date.now()}_${avatarFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        console.log('Attempting upload to storage:', fileName);
        
        const { data, error: uploadError } = await supabase.storage.from('media').upload(fileName, avatarFile, { upsert: true });
        
        if (uploadError) {
          console.error('Storage Upload Error Detail:', uploadError);
          alert(`Storage Upload Failed: ${uploadError.message}. Please ensure you've run the SQL fix for storage policies.`);
          return;
        }

        if (data) {
          const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
          finalAvatarUrl = urlData.publicUrl;
          console.log('Upload successful. Public URL:', finalAvatarUrl);
        }
      }

      const updates = {};
      if (name && name !== user.name) updates.name = name;
      if (avatarFile) updates.avatar_url = finalAvatarUrl;

      if (Object.keys(updates).length > 0) {
        console.log('Applying DB updates:', updates);
        const { error: dbError } = await supabase.from('users').update(updates).eq('id', user.id);
        
        if (dbError) {
          console.error('Database Update Error:', dbError);
          alert(`Profile Update Failed: ${dbError.message}`);
        } else {
          console.log('Database updated successfully. Refreshing user...');
          await refreshUser();
        }
      }
    } catch (err) {
      console.error('Unexpected Profile Update Error:', err);
      alert(`An unexpected error occurred: ${err.message}`);
    }
  };

  const formatRecTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const handleContextMenuAction = async (action, emoji = null) => {
    const m = contextMenu.msg;
    setContextMenu({ isOpen: false, position: null, msg: null });
    if (!m) return;
    if (action === 'info') { 
      console.log("Triggering Message Info for:", m.id);
      setMsgInfoData(m); 
    }
    else if (action === 'reply') { setReplyingTo(m); }
    else if (action === 'copy') {
      const t = m.type === 'text' ? (typeof m.content === 'object' ? m.content.text : m.content) : (m.content?.url || m.content);
      navigator.clipboard.writeText(t || '');
    }
    else if (action === 'delete') {
      setDeleteTarget(m);
      setDeleteType('everyone');
      setShowDeleteConfirm(true);
    }
    else if (action === 'delete_for_me') {
      setDeleteTarget(m);
      setDeleteType('me');
      setShowDeleteConfirm(true);
    }
    else if (action === 'edit') {
      if (m.type !== 'text') return;
      const text = typeof m.content === 'object' ? m.content.text : m.content;
      setEditingMsg(m);
      setNewMessage(text);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    else if (action === 'star') {
      let sPayload = (typeof m.content === 'object' && m.content !== null) ? { ...m.content } : { text: m.content };
      const isStarred = sPayload.is_starred;
      
      if (isStarred) delete sPayload.is_starred;
      else sPayload.is_starred = true;

      const enc = encryptMessage(JSON.stringify(sPayload));

      // Optimistic Update
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, content: sPayload } : x));
      
      await supabase.from('messages').update({ content: enc }).eq('id', m.id);
    }
    else if (action === 'pin' || action === 'unpin') {
      // 1. Unpin existing messages locally and in DB (if any)
      const curPinned = messages.find(m => (typeof m.content === 'object' && m.content?.is_pinned));
      
      if (curPinned) {
        let pLoad = { ...curPinned.content };
        delete pLoad.is_pinned;
        const enc = encryptMessage(JSON.stringify(pLoad));
        await supabase.from('messages').update({ content: enc }).eq('id', curPinned.id);
      }

      // 2. Set new pin if action was 'pin'
      if (action === 'pin') {
        let newPLoad = (typeof m.content === 'object' && m.content !== null) ? { ...m.content } : { text: m.content };
        newPLoad.is_pinned = true;
        const newEnc = encryptMessage(JSON.stringify(newPLoad));
        
        // Optimistic update
        setMessages(prev => prev.map(x => {
          if (x.id === m.id) return { ...x, content: newPLoad };
          if (curPinned && x.id === curPinned.id) {
            let p = { ...x.content };
            delete p.is_pinned;
            return { ...x, content: p };
          }
          return x;
        }));

        await supabase.from('messages').update({ content: newEnc }).eq('id', m.id);
      } else {
        // Just unpinning
        setMessages(prev => prev.map(x => {
          if (curPinned && x.id === curPinned.id) {
            let p = { ...x.content };
            delete p.is_pinned;
            return { ...x, content: p };
          }
          return x;
        }));
      }
    }
    else if (action === 'react') {
      let pPayload = typeof m.content === 'object' ? { ...m.content } : { text: m.content };
      if (!emoji) {
        delete pPayload.reaction;
      } else {
        pPayload.reaction = emoji;
      }
      const encrypted = encryptMessage(JSON.stringify(pPayload));
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, content: pPayload } : x));
      await supabase.from('messages').update({ content: encrypted }).eq('id', m.id);
    }
  };

  const filteredMessages = searchMode && searchQuery.trim()
    ? messages.filter(m => {
        const text = m.type === 'text' ? (typeof m.content === 'object' ? m.content.text : m.content) : '';
        return text.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : messages;

  // Tick icons for status
  const StatusTick = ({ status }) => {
    if (status === 'sending') return <span className="text-white/20">○</span>;
    if (status === 'sent') return <svg viewBox="0 0 16 15" width="14" height="13" className="fill-current opacity-50"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"/></svg>;
    if (status === 'delivered') return <svg viewBox="0 0 16 15" width="14" height="13" className="fill-current opacity-60"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.136.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>;
    if (status === 'seen') return <svg viewBox="0 0 16 15" width="14" height="13" className="fill-blue-400"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.136.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>;
    return null;
  };

  if (isHideMode) return (
    <>
      {hideModeType === 'terminal' ? <FakeTerminal /> : <ChromeDino />}
      <div 
        onClick={() => setHideModeType(prev => prev === 'terminal' ? 'dino' : 'terminal')}
        className="fixed bottom-4 left-4 z-[10000] text-[10px] text-white/10 uppercase tracking-widest cursor-pointer hover:text-white/40 transition-colors select-none"
      >
        Swap Decoy Mode
      </div>
      <PrivacyEye toggleHide={setIsHideMode} isHidden={isHideMode} />
    </>
  );

  return (
    <div
      className="h-[100dvh] w-full flex bg-transparent text-white overflow-hidden selection:bg-white/20 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <PrivacyEye toggleHide={setIsHideMode} isHidden={isHideMode} />
      <PhotoViewer src={viewedPhoto} isOpen={!!viewedPhoto} onClose={() => setViewedPhoto(null)} />

      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/80 border-4 border-dashed border-emerald-500/60 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <Paperclip className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <p className="text-2xl font-bold text-white">Drop to send file</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu.isOpen && (
        <A2MessageContextMenu
          position={contextMenu.position}
          msg={contextMenu.msg}
          isMe={contextMenu.msg.sender_id === user.id}
          isStarred={typeof contextMenu.msg.content === 'object' && contextMenu.msg.content?.is_starred}
          onClose={() => setContextMenu({ isOpen: false, position: null, msg: null })}
          onAction={handleContextMenuAction}
        />
      )}

      {/* Sidebar */}
      <div className="hidden md:flex w-[350px] border-r border-white-[0.03] flex-col glass-panel rounded-none border-t-0 border-l-0 border-b-0">
        <div className="h-20 border-b border-white/[0.03] flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Avatar src={user.avatar_url} name={user.name} size="w-8 h-8" textSize="text-xs" />
            <div className="font-semibold text-xl tracking-tight text-white/90">A2Connect</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(true)} className="icon-btn hover:text-white"><Settings className="w-5 h-5" /></button>
            <button onClick={logout} className="icon-btn hover:text-red-400"><A2LogOutIcon className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4">
          <div className="p-4 rounded-[1.5rem] bg-white/[0.04] border border-white/[0.03] flex items-center gap-4 cursor-pointer hover:bg-white/[0.08] transition-all duration-300">
            <Avatar src={partnerAvatar} name={partnerName} online={partnerOnline} />
            <div className="flex-1">
              <h3 className="font-medium text-white/90">{partnerName}</h3>
              <p className="text-white/40 text-sm truncate">{partnerTyping ? 'typing...' : 'Tap to secure chat'}</p>
            </div>
          </div>
        </div>
        <div className="mt-auto p-8 border-t border-white/[0.03] text-center">
          <div className="space-y-1">
            <p className="text-[10px] text-white/20 uppercase tracking-[0.4em] font-medium font-['Outfit']">
              Made with <span className="text-red-500/50 text-[10px] mx-0.5">❤️</span> by <span className="text-white/40 font-bold ml-1 tracking-widest font-['Outfit']">Abhinav Das</span>
            </p>
            <p className="text-white/10 text-[9px] uppercase tracking-[0.5em] font-bold font-['Outfit']">
              FryLabs Studios
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative w-full h-[100dvh]">
        {/* Header */}
        <div className="h-20 border-b border-white/[0.03] glass-panel flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0 rounded-none border-t-0 border-l-0 border-r-0">
          {searchMode ? (
            <div className="flex-1 flex items-center gap-3">
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white/90 placeholder:text-white/30 outline-none text-sm"
              />
              <button onClick={() => { setSearchMode(false); setSearchQuery(''); }} className="icon-btn text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar src={partnerAvatar} name={partnerName} size="w-10 h-10" textSize="text-sm" online={partnerOnline} />
                <div>
                  <h2 className="font-semibold text-white/90 leading-tight">{partnerName}</h2>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] ${partnerOnline ? 'text-emerald-400' : 'text-white/40'}`}>
                      {partnerTyping
                        ? <span className="animate-pulse">typing...</span>
                        : partnerOnline ? 'online'
                        : partnerLastSeen ? `last seen ${formatDistanceToNow(new Date(partnerLastSeen), { addSuffix: true })}`
                        : 'offline'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-2">
                {/* Actions - Desktop/Tablet Only */}
                <div className="hidden md:flex items-center gap-1 sm:gap-2">
                  <button onClick={() => setSearchMode(true)} className="icon-btn text-white/40 hover:text-white"><Search className="w-5 h-5" /></button>
                  <button 
                    onClick={() => setShowStarredVault(true)}
                    className="p-2.5 hover:bg-white/5 rounded-full text-white/40 hover:text-emerald-500 transition-all"
                  >
                    <A2StarIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowCallDisclaimer(true)}
                    className="icon-btn text-white/40 hover:text-white"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                </div>


                {/* Mobile 3-dot Menu */}
                <div className="sm:hidden flex items-center gap-1">
                  <Avatar src={user.avatar_url} name={user.name} size="w-8 h-8" online />
                  <button 
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className={`p-2 rounded-full transition-all ${showMobileMenu ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                  >
                    <MoreVertical className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Global Mobile Menu Overlay */}
        <AnimatePresence>
          {showMobileMenu && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[998]" 
                onClick={() => setShowMobileMenu(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="fixed right-4 top-16 w-52 bg-[#1a1c1e] border border-white/10 rounded-2xl shadow-2xl z-[999] overflow-hidden py-2 backdrop-blur-3xl"
              >
                <button 
                  key="starred-toggle"
                  onClick={() => { setShowStarredVault(true); setShowMobileMenu(false); }} 
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Star className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                  <span>Starred Messages</span>
                </button>
                
                <button 
                  key="search-toggle"
                  onClick={() => { setSearchMode(true); setShowMobileMenu(false); }} 
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Search Chat</span>
                </button>

                <button 
                  key="settings-toggle"
                  onClick={() => { setShowSettings(true); setShowMobileMenu(false); }} 
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>

                <div className="h-[1px] bg-white/5 my-1 mx-3" />
                
                <button 
                  key="logout-btn"
                  onClick={logout} 
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/5 transition-colors"
                >
                  <A2LogOutIcon className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Message Area with Doodle Wallpaper */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          
          {/* Subtle Dark Doodle Overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ 
              backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
              backgroundRepeat: 'repeat'
            }}
          ></div>

          {/* --- Pinned Message Banner --- */}
          {(() => {
            const pinnedMsg = messages.find(m => (typeof m.content === 'object' && m.content?.is_pinned));
            if (!pinnedMsg) return null;
            
            const pinnedText = pinnedMsg.type === 'text' 
              ? (pinnedMsg.content?.text || pinnedMsg.content) 
              : `📎 ${pinnedMsg.type.toUpperCase()}`;

            return (
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-0 left-0 right-0 z-[100] bg-black/95 backdrop-blur-2xl border-b border-white/[0.05] shadow-2xl flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleJumpToMessage(pinnedMsg.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1 h-8 bg-emerald-500 rounded-full" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">Pinned Message</span>
                    <span className="text-sm text-white/70 truncate max-w-[400px]">{pinnedText}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenuAction('unpin', null);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                >
                  <Pin className="w-4 h-4 rotate-45" />
                </button>
              </motion.div>
            );
          })()}

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col scrollbar-hide relative pt-14">
            <div className="text-center text-[11px] text-white/30 my-4 uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-4 relative z-10">
              <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
              E2E Encrypted Room
              <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
            </div>

            {filteredMessages.map((msg, idx) => {
              const prevMsg = filteredMessages[idx - 1];
              const nextMsg = filteredMessages[idx + 1];
              
              const isMe = msg.sender_id === user.id;
              const isLastInGroup = nextMsg?.sender_id !== msg.sender_id;
              const isFirstInGroup = prevMsg?.sender_id !== msg.sender_id;

            // Date Divider Logic
            const showDateDivider = !prevMsg || format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(prevMsg.created_at), 'yyyy-MM-dd');
            const dateStr = format(new Date(msg.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'Today' 
                        : format(new Date(msg.created_at), 'yyyy-MM-dd') === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') ? 'Yesterday'
                        : format(new Date(msg.created_at), 'MMMM d, yyyy');

            // Unread Logic: if this is the first unread message from partner
            const unreadMessages = filteredMessages.filter(m => m.sender_id !== user.id && (m.status === 'sent' || m.status === 'delivered'));
            const showUnreadMarker = unreadMessages.length > 0 && msg.id === unreadMessages[0].id;
            
            let messageText = '', replyText = null, replySender = null, reaction = null, isEdited = false;

            if (msg.type === 'text') {
              if (typeof msg.content === 'object' && msg.content !== null) {
                messageText = msg.content.text ?? '';
                replyText = msg.content.reply_text ?? null;
                replySender = msg.content.reply_sender ?? null;
                reaction = msg.content.reaction ?? null;
                isEdited = msg.content.edited ?? false;
              } else {
                messageText = msg.content || '';
              }
            } else if (typeof msg.content === 'object' && msg.content !== null) {
              reaction = msg.content.reaction ?? null;
            }

            // Resolve media url from possibly JSON-parsed content
            const mediaUrl = typeof msg.content === 'string' ? msg.content
              : (msg.content?.url || msg.content);

            const isStarred = typeof msg.content === 'object' && msg.content?.is_starred;

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-6 relative z-10">
                    <div className="px-4 py-1.5 bg-[#ffffff]/5 backdrop-blur-md rounded-xl text-[11px] text-white/40 font-bold uppercase tracking-widest border border-white/5">
                      {dateStr}
                    </div>
                  </div>
                )}

                {showUnreadMarker && (
                   <div className="flex justify-center my-6 relative z-10">
                     <div className="px-5 py-2 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-full text-[11px] text-emerald-400 font-bold shadow-lg shadow-emerald-500/5">
                       {unreadMessages.length} Unread Messages
                     </div>
                   </div>
                )}

                <div
                  id={`msg-${msg.id}`}
                  className={`flex items-end gap-2 max-w-[90%] sm:max-w-[75%] relative z-10 ${isMe ? 'self-end flex-row-reverse' : 'self-start'} ${
                    isLastInGroup 
                      ? (reaction ? 'mb-12' : 'mb-4') 
                      : (reaction ? 'mb-9' : 'mb-1')
                  }`}
                >
                <div className="hidden sm:block w-8 h-8 flex-shrink-0">
                  {isLastInGroup && (
                    <Avatar 
                      src={isMe ? user.avatar_url : partnerAvatar} 
                      name={isMe ? user.name : partnerName} 
                      size="w-8 h-8" 
                      textSize="text-[10px]" 
                    />
                  )}
                </div>

                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.1}
                  onDragEnd={(e, info) => { 
                    if (info.offset.x > 50) {
                      setReplyingTo(msg);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    } 
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, msg });
                  }}
                  animate={{
                    x: 0,
                    scale: highlightedMsgId === msg.id ? 1.03 : 1,
                    boxShadow: highlightedMsgId === msg.id 
                      ? (isMe ? "0 0 30px rgba(255,255,255,0.3)" : "0 0 30px rgba(16,185,129,0.3)")
                      : (isMe ? "0 10px 15px -3px rgba(255,255,255,0.05)" : "0 25px 50px -12px rgba(0,0,0,0.5)")
                  }}
                  transition={{ duration: 0.8, repeat: 2 }}
                  className={`relative px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-2xl ${isMe
                    ? 'rounded-br-[6px] bg-white text-black shadow-lg shadow-white/5'
                    : 'rounded-bl-[6px] bg-[#1a1a1a] border border-white/[0.04] text-white/90 shadow-2xl'
                  } text-[15px] leading-snug font-medium z-10 cursor-grab active:cursor-grabbing select-none w-fit max-w-full`}
                >
                  {isStarred && (
                    <div className={`absolute -top-2 ${isMe ? 'left-2' : 'right-2'} text-yellow-400 text-xs`}>⭐</div>
                  )}

                  {replyText && (
                    <div className={`mb-2 pl-3 py-1 pr-3 rounded-lg border-l-2 text-[13px] overflow-hidden ${
                      isMe 
                        ? 'bg-black/[0.04] border-black/20' 
                        : 'bg-white/[0.04] border-emerald-500/50'
                    }`}>
                      <div className={`font-bold text-[10px] uppercase tracking-wide mb-0.5 ${isMe ? 'text-black/60' : 'text-emerald-400'}`}>
                        {replySender}
                      </div>
                      <div className={`line-clamp-1 leading-tight ${isMe ? 'text-black/70' : 'text-white/60'}`}>
                        {replyText}
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    {msg.type === 'audio' && <AudioPlayer src={typeof msg.content === 'string' ? msg.content : msg.content?.url} isMe={isMe} />}

                    {msg.type === 'image' && (
                      msg.status === 'error' ? (
                        <div className="flex items-center gap-2 text-red-400 text-sm px-1"><span>⚠️ Upload failed</span></div>
                      ) : (
                        <div className={`cursor-pointer overflow-hidden rounded-xl border border-white/10 relative select-none touch-none ${msg.status === 'sending' ? 'opacity-70' : ''}`}
                            onClick={(e) => {
                              if (mediaUrl && !mediaUrl.startsWith('blob:') && !msg.isDragging) {
                                setViewedPhoto(mediaUrl);
                              }
                            }}>
                          <img src={mediaUrl} alt="media" className="max-w-[240px] max-h-[300px] object-cover hover:scale-105 transition-transform duration-500" />
                          {msg.status === 'sending' && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                        </div>
                      )
                    )}

                    {msg.type === 'video' && (
                       msg.status === 'error' ? (
                         <div className="flex items-center gap-2 text-red-400 text-sm"><span>⚠️ Video upload failed</span></div>
                       ) : (
                         <div className={`overflow-hidden rounded-xl border border-white/10 bg-black/50 relative ${msg.status === 'sending' ? 'opacity-70' : ''}`}>
                           <video src={mediaUrl} controls className="max-w-[240px] max-h-[300px] outline-none" preload="metadata" />
                           {msg.status === 'sending' && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                         </div>
                       )
                    )}

                    {msg.type === 'file' && (
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={msg.fileName}
                        className={`flex items-center gap-3 py-1 pr-[45px] no-underline ${isMe ? 'text-black' : 'text-white'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-black/10' : 'bg-white/10'}`}>
                          <File className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold truncate max-w-[120px]">{msg.fileName || 'File'}</span>
                          <span className={`text-xs opacity-50`}>
                            {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(0)} KB` : ''}
                          </span>
                        </div>
                        <ArrowDownToLine className="w-4 h-4 opacity-40 flex-shrink-0" />
                      </a>
                    )}

                    {/* Integrated Metadata Flow - No more absolute gapping */}
                    <div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-0.5 mt-0.5">
                      {msg.type === 'text' && (
                        <p className="flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed min-w-0">
                          {searchMode ? highlightMatch(messageText, searchQuery) : messageText}
                        </p>
                      )}

                      <div className={`flex items-center gap-1.5 text-[10px] leading-none mb-[1px] ${
                        msg.type === 'image' || msg.type === 'video' 
                          ? 'absolute bottom-1.5 right-1.5 bg-black/40 backdrop-blur-md text-white px-1.5 py-1 rounded-lg z-20' 
                          : isMe ? 'text-black/50 ml-auto' : 'text-white/30 ml-auto'
                      }`}>
                        {isEdited && <span className="italic opacity-70">edited</span>}
                        <span>{msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}</span>
                        {isMe && <StatusTick status={msg.status} />}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, msg });
                          }}
                          className="opacity-0 group-hover/bubble:opacity-100 transition-opacity ml-0.5 hover:text-emerald-500"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {reaction && (
                    <div className={`absolute -bottom-[18px] left-[-2px] bg-[#202c33] border border-white/[0.1] rounded-full px-2 py-1 text-sm shadow-2xl hover:scale-110 transition-all cursor-pointer z-[60]`}>
                      {reaction}
                    </div>
                  )}
                </motion.div>
            </React.Fragment>
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

        {/* --- Starred Message Vault Drawer --- */}
        <AnimatePresence>
          {showStarredVault && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
                onClick={() => setShowStarredVault(false)}
              />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[#111] border-l border-white/10 z-[201] shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-white/5 bg-[#1a1c1e] flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Star className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                      Starred Messages
                    </h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">Your Personal Vault</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {messages.some(m => typeof m.content === 'object' && m.content?.is_starred) && (
                      <button 
                        onClick={async () => {
                          if (confirm("Unstar all messages in this vault?")) {
                            const starred = messages.filter(m => typeof m.content === 'object' && m.content?.is_starred);
                            for (const m of starred) {
                              let sPayload = { ...m.content };
                              delete sPayload.is_starred;
                              const enc = encryptMessage(JSON.stringify(sPayload));
                              await supabase.from('messages').update({ content: enc }).eq('id', m.id);
                            }
                            setMessages(prev => prev.map(x => {
                              if (typeof x.content === 'object' && x.content?.is_starred) {
                                let p = { ...x.content };
                                delete p.is_starred;
                                return { ...x, content: p };
                              }
                              return x;
                            }));
                          }
                        }}
                        className="text-[10px] text-red-500/60 hover:text-red-500 font-bold uppercase tracking-tighter mr-2 transition-colors"
                      >
                        Unstar All
                      </button>
                    )}
                    <button onClick={() => setShowStarredVault(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {(() => {
                    const starred = messages.filter(m => typeof m.content === 'object' && m.content?.is_starred);
                    if (starred.length === 0) return (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-10">
                        <A2StarIcon className="w-16 h-16 mb-4" />
                        <p className="font-bold text-sm uppercase tracking-widest">No starred messages yet</p>
                        <p className="text-xs mt-2 italic font-light">Long press or right-click any message to star it.</p>
                      </div>
                    );

                    return starred.reverse().map(m => {
                      const text = m.type === 'text' ? (m.content?.text || m.content) : `📎 ${m.type.toUpperCase()}`;
                      return (
                        <div 
                          key={m.id}
                          onClick={() => {
                            handleJumpToMessage(m.id);
                            setShowStarredVault(false);
                          }}
                          className="group p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl cursor-pointer hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                             <span className={`text-[10px] font-bold uppercase tracking-widest ${m.sender_id === user.id ? 'text-blue-400' : 'text-emerald-400'}`}>
                               {m.sender_id === user.id ? 'You' : partnerName}
                             </span>
                             <span className="text-[10px] text-white/30">{format(new Date(m.created_at), 'MMM d, HH:mm')}</span>
                          </div>
                          <p className="text-sm text-white/80 line-clamp-3 leading-relaxed">{text}</p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {showSettings && (
          <SettingsModal 
            user={user} 
            partnerName={partnerName}
            pNickname={pNickname}
            onClose={() => setShowSettings(false)} 
            onUpdate={handleProfileUpdate} 
            onClearChat={handleClearChat}
          />
        )}

        {/* Input Area */}
        <div className="p-4 sm:p-5 bg-transparent backdrop-blur-xl border-t border-white/[0.03] relative z-50">
          {replyingTo && !isRecording && !editingMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 mx-2 px-4 py-3 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.05] rounded-2xl flex items-center justify-between shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 overflow-hidden border-l-2 border-emerald-500 pl-3">
                <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                  Replying to {replyingTo.sender_id === user.id ? 'Yourself' : partnerName}
                </span>
                <span className="text-white/70 text-sm truncate leading-tight">
                  {replyingTo.type !== 'text' ? '📎 Attachment' : (typeof replyingTo.content === 'object' ? replyingTo.content.text : replyingTo.content)}
                </span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {editingMsg && (
            <div className="mb-3 mx-2 px-4 py-3 bg-[#111] border border-blue-500/30 rounded-2xl flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-3 border-l-[3px] border-blue-400 pl-3">
                <A2PenIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-blue-400 text-[11px] font-bold uppercase tracking-wider">Editing message</span>
              </div>
              <button onClick={() => { setEditingMsg(null); setNewMessage(''); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isRecording ? (
            <div className="glass-panel p-3 rounded-[2rem] flex items-center justify-between border-red-500/30 bg-red-500/10">
              <div className="flex items-center gap-3 px-4">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-red-400 font-mono tracking-widest">{formatRecTime(recordingTime)}</span>
              </div>
              <div className="flex gap-2 mr-1">
                <button onClick={cancelRecording} className="w-10 h-10 rounded-full bg-black/20 text-red-400 flex items-center justify-center hover:bg-black/40 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                  <Send className="w-4 h-4 ml-0.5 fill-current" />
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-2 pl-4 rounded-[2rem] flex items-end gap-2 shadow-2xl transition-all duration-300 focus-within:border-white/20 focus-within:bg-white/[0.05] relative">



              {/* Emoji Picker — opens upward, fixed bottom so it never overlaps bubbles */}
              {showInputEmoji && (
                <div className="fixed bottom-24 left-2 right-2 sm:left-auto sm:right-auto sm:bottom-24 z-[9000] shadow-2xl">
                  <EmojiPicker
                    theme="dark"
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled
                    height={360}
                    width={Math.min(320, window.innerWidth - 16)}
                    onEmojiClick={(e) => { setNewMessage(m => m + e.emoji); }}
                  />
                </div>
              )}

              <button
                onClick={() => setShowInputEmoji(v => !v)}
                className={`w-10 h-10 mb-1 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${showInputEmoji ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
              >
                <Smile className="w-5 h-5" />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingMedia}
                className="w-10 h-10 mb-1 rounded-full text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 flex-shrink-0"
              >
                {isUploadingMedia ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <Paperclip className="w-5 h-5" />}
              </button>

              <input
                ref={inputRef}
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                  if (e.key === 'Escape') { setEditingMsg(null); setReplyingTo(null); setNewMessage(''); }
                }}
                onFocus={() => setShowInputEmoji(false)}
                placeholder={editingMsg ? 'Edit message...' : 'Encrypted Message...'}
                className="flex-1 bg-transparent border-none outline-none text-white/90 placeholder:text-white/30 h-[44px] px-2 text-[15px]"
              />

              <div className="flex items-center gap-1 mb-1 mr-1">
                {newMessage.trim().length > 0 ? (
                  <button
                    onClick={handleSendMessage}
                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg ${editingMsg ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-white text-black shadow-white/10'}`}
                  >
                    {editingMsg ? <A2PenIcon className="w-5 h-5" /> : <Send className="w-5 h-5 ml-0.5" />}
                  </button>
                ) : (
                  <button
                    onPointerDown={startRecording}
                    className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* --- Message Info Modal --- */}
      <AnimatePresence>
        {msgInfoData && (
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setMsgInfoData(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[360px] bg-[#1a2126] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#1a2126] z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-400">
                    <A2InfoIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-white font-semibold text-lg">Message Info</h3>
                </div>
                <button onClick={() => setMsgInfoData(null)} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto scrollbar-hide flex-1">
                {/* Message Preview */}
                <div className="flex flex-col items-center justify-center p-3 mb-2">
                  <div className={`relative px-4 py-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-white/90 text-sm max-w-full shadow-inner`}>
                    {msgInfoData.type === 'image' && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                         <img src={typeof msgInfoData.content === 'string' ? msgInfoData.content : msgInfoData.content?.url} className="max-w-full max-h-[150px] object-cover" alt="Preview" />
                      </div>
                    )}
                    {msgInfoData.type === 'video' && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-white/10 bg-black/40 px-3 py-4 flex items-center justify-center">
                         <File className="w-8 h-8 text-white/40" />
                      </div>
                    )}
                    {msgInfoData.type === 'audio' && (
                      <div className="mb-2 flex items-center gap-3 text-emerald-400">
                         <Mic className="w-5 h-5" />
                         <span>Voice Message</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed select-none">
                      {msgInfoData.type === 'text' 
                        ? (typeof msgInfoData.content === 'object' ? msgInfoData.content.text : msgInfoData.content) 
                        : (msgInfoData.fileName || 'Resource')}
                    </p>
                    <div className="mt-1 flex justify-end">
                       <span className="text-[10px] text-white/30">{format(new Date(msgInfoData.created_at), 'HH:mm')}</span>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                      {msgInfoData.type === 'image' ? <Upload className="w-5 h-5" /> : 
                       msgInfoData.type === 'video' ? <File className="w-5 h-5" /> :
                       msgInfoData.type === 'audio' ? <Mic className="w-5 h-5" /> :
                       <File className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-0.5">Type</p>
                      <p className="text-white font-medium capitalize">{msgInfoData.type || 'text'}</p>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05] flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${msgInfoData.status === 'seen' ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/40'}`}>
                      {msgInfoData.status === 'seen' ? <A2CheckCheckIcon className="w-5 h-5" /> : <div className="text-sm font-bold">✓</div>}
                    </div>
                    <div>
                      <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-0.5">Status</p>
                      <p className={`text-white font-medium capitalize ${msgInfoData.status === 'seen' ? 'text-blue-400' : ''}`}>{msgInfoData.status || 'Sent'}</p>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <A2ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-0.5">Sent At</p>
                      <p className="text-white font-medium">
                        {(() => {
                          try {
                            return format(new Date(msgInfoData.created_at), 'PPP p');
                          } catch (e) {
                            return 'Unknown Date';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-center">
                <button 
                  onClick={() => setMsgInfoData(null)}
                  className="w-full py-3.5 bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium rounded-2xl transition-all border border-white/5"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <DeleteConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const { id, type, content } = deleteTarget;
          
          if (deleteType === 'everyone') {
            // Delete for everyone
            setMessages(prev => prev.filter(x => x.id !== id));
            await supabase.from('messages').delete().eq('id', id);

            if (type === 'image' || type === 'video') {
              const mediaUrl = typeof content === 'string' ? content : content?.url;
              if (mediaUrl) {
                const fileName = mediaUrl.split('/').pop();
                if (fileName) await supabase.storage.from('media').remove([fileName]);
              }
            }
          } else {
            // Delete for me
            setMessages(prev => prev.filter(x => x.id !== id));
          }
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        type={deleteType}
      />

      {/* --- Call Disclaimer Modal --- */}
      <AnimatePresence>
        {showCallDisclaimer && (
          <div 
            className="fixed inset-0 z-[2000000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" 
            onClick={() => setShowCallDisclaimer(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[320px] bg-[#1a1c1e] rounded-[2.5rem] border border-white/10 p-8 shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0" />
              
              <div className="w-16 h-16 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-emerald-400">
                <Phone className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-white mb-4 leading-tight">
                "Athin nammakk neritt phone vilikam ithilude enthu?"
              </h3>
              
              <p className="text-white/40 text-xs mb-8 italic">
                A2Connect is for secure text & media sharing only. Stay safe!
              </p>

              <button 
                onClick={() => setShowCallDisclaimer(false)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
              >
                Okay, Noted!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function SettingsModal({ user, partnerName, pNickname, onClose, onUpdate, onClearChat }) {
  const [name, setName] = useState(user.name || '');
  const [nickname, setNickname] = useState(pNickname || '');
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileRef = useRef(null);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({ 
      name: name !== user.name ? name : undefined, 
      avatarFile, 
      nickname 
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-[340px] glass-panel p-5 rounded-[2rem] relative border border-white/10"
        >
          <button onClick={onClose} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-xl font-bold text-white mb-1">Settings</h2>
          <p className="text-white/40 mb-6 text-xs italic">Customize your A2Connect identity</p>

          <div className="flex flex-col items-center mb-8">
            <div 
              onClick={() => fileRef.current?.click()}
              className="group relative w-24 h-24 rounded-full cursor-pointer overflow-hidden border-2 border-emerald-500/30 hover:border-emerald-500 transition-all shadow-2xl"
            >
              {avatarPreview ? (
                <img src={avatarPreview} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-3xl font-bold">
                  {user.name?.[0]}
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-6 h-6 text-white" />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileRef} 
              className="hidden" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }
              }}
            />
            <p className="mt-3 text-emerald-400 text-xs font-semibold uppercase tracking-widest">Change Profile Photo</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Your Display Name</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500/50 transition-all font-medium text-sm"
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Nickname for {partnerName.split(' ')[0]}</label>
              <input 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500/50 transition-all font-medium text-sm"
                placeholder="Enter a private alias"
              />
              <p className="text-[10px] text-white/20 ml-1">Only you can see this nickname locally.</p>
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Profile Changes'}
              </button>
              
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2.5 text-red-500/80 font-bold text-xs tracking-wide hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
              >
                Clear Message History
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* --- Confirmation Modal --- */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-center">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[340px] bg-[#1a2126] p-6 rounded-[2rem] border border-white/5 shadow-2xl"
            >
              <h3 className="text-white text-lg font-medium leading-tight mb-3">
                Are you sure you want to delete all message history with {partnerName}?
              </h3>
              <p className="text-white/60 text-sm mb-8 leading-relaxed">
                This action cannot be undone.
              </p>
              
              <div className="flex justify-end gap-6 items-center px-4">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="text-emerald-400 font-bold text-[15px] hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await onClearChat();
                    setShowClearConfirm(false);
                    onClose();
                  }}
                  className="text-red-400 font-bold text-[15px] hover:opacity-80 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Message Info Modal --- */}
    </>
  );
}
function DeleteConfirmModal({ isOpen, onClose, onConfirm, type }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 text-center" onClick={onClose}>
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-[320px] bg-[#1a1c1e] rounded-[2rem] border border-white/10 p-6 shadow-2xl"
        >
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Delete Message?
          </h3>
          <p className="text-white/40 text-xs mb-8 leading-relaxed">
            {type === 'everyone' 
              ? "This message will be permanently removed for both participants. This action cannot be undone." 
              : "This message will be removed from your view only."}
          </p>

          <div className="flex flex-col gap-2">
            <button 
              onClick={onConfirm}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-red-500/20"
            >
              Delete
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 font-medium rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
