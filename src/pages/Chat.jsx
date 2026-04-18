import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { encryptMessage, decryptMessage } from '../lib/encryption';
import PrivacyEye from '../components/PrivacyEye';
import FakeTerminal from '../components/FakeTerminal';
import PhotoViewer from '../components/PhotoViewer';
import AudioPlayer from '../components/AudioPlayer';
import MessageContextMenu from '../components/MessageContextMenu';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import {
  LogOut, Send, Mic, Phone, X, Reply, Paperclip, Loader2,
  Trash2, Smile, Search, ArrowDownToLine, File, Settings, Upload
} from 'lucide-react';

// Inline icon replacements for icons not in this lucide version
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
  if (newMsg.type === 'text') {
    const rawText = decryptMessage(newMsg.content);
    try { newMsg.content = JSON.parse(rawText); }
    catch { newMsg.content = { text: rawText }; }
  } else if (['audio', 'image', 'video', 'file'].includes(newMsg.type)) {
    try {
      const dec = decryptMessage(newMsg.content);
      newMsg.content = dec || newMsg.content;
    } catch {}
  }
  return newMsg;
};


export default function Chat() {
  const { user, logout, refreshUser } = useAuth();
  
  // Guard for null user during loading
  if (!user) return <div className="h-screen bg-black" />;

  const partnerId = user.id === 'user_abhi' ? 'user_arya' : 'user_abhi';
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pNickname, setPNickname] = useState(() => localStorage.getItem(`nickname_${user?.id}_${partnerId}`) || '');
  const partnerName = pNickname || (user.id === 'user_abhi' ? 'Arya' : 'Abhi');



  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: null, msg: null });
  const [showInputEmoji, setShowInputEmoji] = useState(false);

  const [isHideMode, setIsHideMode] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);


  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);
  const [viewedPhoto, setViewedPhoto] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [starredIds, setStarredIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`stars_${user?.id}`) || '[]'); }
    catch { return []; }
  });


  const bottomRef = useRef(null);
  const roomChannelRef = useRef(null);
  const inputRef = useRef(null);

  // Draft saving
  useEffect(() => {
    const saved = localStorage.getItem(`draft_${user.id}`);
    if (saved) setNewMessage(saved);
  }, [user.id]);

  useEffect(() => {
    localStorage.setItem(`draft_${user.id}`, newMessage);
  }, [newMessage, user.id]);

  // Sync starred IDs
  useEffect(() => {
    localStorage.setItem(`stars_${user.id}`, JSON.stringify(starredIds));
  }, [starredIds, user.id]);

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
    roomChannelRef.current = supabase.channel('chat-presence', {
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

  // Mark seen when messages rendered
  useEffect(() => {
    const undeliveredInView = messages.filter(
      m => m.receiver_id === user.id && (m.status === 'delivered' || m.status === 'sent')
    );
    if (undeliveredInView.length > 0) {
      supabase.from('messages')
        .update({ status: 'seen' })
        .in('id', undeliveredInView.map(m => m.id));
    }
  }, [messages, user.id]);

  const typingTimeoutRef = useRef(null);
  const handleTyping = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    
    // Debounced Track for Typing
    if (roomChannelRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Track as typing
      roomChannelRef.current.track({ isTyping: val.length > 0 });
      
      // Auto-revert to non-typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (roomChannelRef.current) roomChannelRef.current.track({ isTyping: false });
      }, 2000);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const messageText = newMessage.trim();
    setNewMessage('');
    localStorage.removeItem(`draft_${user.id}`);
    if (roomChannelRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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

  const handleProfileUpdate = async ({ name, avatarFile, nickname }) => {
    if (nickname !== undefined) {
      localStorage.setItem(`nickname_${user.id}_${partnerId}`, nickname);
      setPNickname(nickname);
    }

    let finalAvatarUrl = user.avatar_url;
    if (avatarFile) {
      const fileName = `avatars/${user.id}_${Date.now()}`;
      const { data, error } = await supabase.storage.from('media').upload(fileName, avatarFile, { upsert: true });
      if (!error && data) {
        finalAvatarUrl = supabase.storage.from('media').getPublicUrl(fileName).data.publicUrl;
      }
    }

    if (name || avatarFile) {
      const updates = {};
      if (name) updates.name = name;
      if (avatarFile) updates.avatar_url = finalAvatarUrl;
      
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (!error) refreshUser();
    }
  };

  const formatRecTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const handleContextMenuAction = async (action, emoji = null) => {
    const m = contextMenu.msg;
    setContextMenu({ isOpen: false, position: null, msg: null });
    if (!m) return;
    if (action === 'reply') { setReplyingTo(m); }
    else if (action === 'copy') {
      const t = m.type === 'text' ? (typeof m.content === 'object' ? m.content.text : m.content) : (m.content?.url || m.content);
      navigator.clipboard.writeText(t || '');
    }
    else if (action === 'delete') {
      setMessages(prev => prev.filter(x => x.id !== m.id));
      await supabase.from('messages').delete().eq('id', m.id);

      // Clean up storage if it's a media message
      if (m.type === 'image' || m.type === 'video') {
        const mediaUrl = typeof m.content === 'string' ? m.content : m.content?.url;
        if (mediaUrl) {
          const fileName = mediaUrl.split('/').pop();
          if (fileName) await supabase.storage.from('media').remove([fileName]);
        }
      }
    }
    else if (action === 'delete_for_me') {
      setMessages(prev => prev.filter(x => x.id !== m.id));
    }
    else if (action === 'edit') {
      if (m.type !== 'text') return;
      const text = typeof m.content === 'object' ? m.content.text : m.content;
      setEditingMsg(m);
      setNewMessage(text);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    else if (action === 'star') {
      setStarredIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
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
    if (status === 'delivered') return <svg viewBox="0 0 16 15" width="14" height="13" className="fill-current opacity-60"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.136.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>;
    if (status === 'seen') return <svg viewBox="0 0 16 15" width="14" height="13" className="fill-blue-400"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.136.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>;
    return null;
  };

  if (isHideMode) return (
    <>
      <FakeTerminal />
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
        <MessageContextMenu
          position={contextMenu.position}
          msg={contextMenu.msg}
          isMe={contextMenu.msg.sender_id === user.id}
          isStarred={starredIds.includes(contextMenu.msg.id)}
          onClose={() => setContextMenu({ isOpen: false, position: null, msg: null })}
          onAction={handleContextMenuAction}
        />
      )}

      {/* Sidebar */}
      <div className="hidden md:flex w-[350px] border-r border-white-[0.03] flex-col glass-panel rounded-none border-t-0 border-l-0 border-b-0">
        <div className="h-20 border-b border-white/[0.03] flex items-center justify-between px-6">
          <div className="font-semibold text-xl tracking-tight text-white/90">A2Connect</div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(true)} className="icon-btn hover:text-white"><Settings className="w-5 h-5" /></button>
            <button onClick={logout} className="icon-btn hover:text-red-400"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4">
          <div className="p-4 rounded-[1.5rem] bg-white/[0.04] border border-white/[0.03] flex items-center gap-4 cursor-pointer hover:bg-white/[0.08] transition-all duration-300">
            <div className="relative">
              {partnerAvatar ? (
                <img src={partnerAvatar} alt={partnerName} className="w-12 h-12 rounded-full object-cover shadow-lg border border-white/10" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-stone-800 to-neutral-700 shadow-inner flex items-center justify-center text-lg font-bold">
                  {partnerName[0]}
                </div>
              )}
              {partnerOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111] shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>}
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white/90">{partnerName}</h3>
              <p className="text-white/40 text-sm truncate">{partnerTyping ? 'typing...' : 'Tap to secure chat'}</p>
            </div>
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
                <div className="relative">
                  {partnerAvatar ? (
                    <img src={partnerAvatar} alt={partnerName} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-700 flex items-center justify-center font-bold text-white/50 text-sm">
                      {partnerName[0]}
                    </div>
                  )}
                  {partnerOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]"></div>}
                </div>
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
              <div className="flex items-center gap-2">
                <button onClick={() => setSearchMode(true)} className="icon-btn text-white/60 hover:text-white"><Search className="w-5 h-5" /></button>
                <button className="icon-btn"><Phone className="w-5 h-5 text-white/70" /></button>
                <button className="icon-btn md:hidden" onClick={logout}><LogOut className="w-5 h-5 text-red-500/80" /></button>
              </div>
            </>
          )}
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col gap-5 scrollbar-hide">
          <div className="text-center text-[11px] text-white/30 my-4 uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-4">
            <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
            E2E Encrypted Room
            <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
          </div>

          {filteredMessages.map((msg) => {
            const isMe = msg.sender_id === user.id;
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

            const isStarred = starredIds.includes(msg.id);

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 max-w-[90%] sm:max-w-[75%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                <div className={`hidden sm:flex w-8 h-8 rounded-full flex-shrink-0 items-center justify-center text-[11px] font-bold shadow-inner ${isMe ? 'bg-white text-black' : 'bg-neutral-800 text-white/70'}`}>
                  {isMe ? user.name[0] : partnerName[0]}
                </div>

                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={{ left: 0, right: 0.15 }}
                  onDragEnd={(e, info) => { if (info.offset.x > 60) setReplyingTo(msg); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, msg });
                  }}
                  className={`relative px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl ${isMe
                    ? 'rounded-br-[6px] bg-white text-black shadow-lg shadow-white/5'
                    : 'rounded-bl-[6px] bg-[#1a1a1a] border border-white/[0.04] text-white/90 shadow-2xl'
                  } text-[15px] leading-snug font-medium z-10 cursor-grab active:cursor-grabbing select-none`}
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

                  {msg.type === 'audio' && <AudioPlayer src={typeof msg.content === 'string' ? msg.content : msg.content?.url} isMe={isMe} />}

                  {msg.type === 'image' && (
                    msg.status === 'error' ? (
                      <div className="flex items-center gap-2 text-red-400 text-sm px-1"><span>⚠️ Upload failed</span></div>
                    ) : (
                      <div className={`cursor-pointer overflow-hidden rounded-xl border border-white/10 relative ${msg.status === 'sending' ? 'opacity-70' : ''}`}
                        onClick={() => mediaUrl && !mediaUrl.startsWith('blob:') && setViewedPhoto(mediaUrl)}>
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
                      className={`flex items-center gap-3 py-1 pr-2 no-underline ${isMe ? 'text-black' : 'text-white'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-black/10' : 'bg-white/10'}`}>
                      <File className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate max-w-[160px]">{msg.fileName || 'File'}</span>
                        <span className={`text-xs ${isMe ? 'text-black/50' : 'text-white/40'}`}>
                          {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(0)} KB` : ''} · Tap to download
                        </span>
                      </div>
                      <ArrowDownToLine className="w-4 h-4 opacity-60 flex-shrink-0" />
                    </a>
                  )}

                  {msg.type === 'text' && (
                    <span className="whitespace-pre-wrap break-words">{messageText}</span>
                  )}

                  <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${isMe ? 'text-black/50' : 'text-white/30'}`}>
                    {isEdited && <span className="mr-1 italic">edited</span>}
                    <span>{msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}</span>
                    {isMe && <StatusTick status={msg.status} />}
                  </div>

                  {reaction && (
                    <div className={`absolute -bottom-3 ${isMe ? 'right-4' : 'left-4'} bg-[#1a1a1a] border border-white/10 rounded-full px-2 py-0.5 text-base shadow-xl hover:scale-110 transition-transform cursor-pointer`}>
                      {reaction}
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>

        {showSettings && (
          <SettingsModal 
            user={user} 
            partnerName={partnerName}
            pNickname={pNickname}
            onClose={() => setShowSettings(false)} 
            onUpdate={handleProfileUpdate} 
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
                <PenIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
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
                    {editingMsg ? <PenIcon className="w-5 h-5" /> : <Send className="w-5 h-5 ml-0.5" />}
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
    </div>
  );
}

// --- Sub-components ---

function SettingsModal({ user, partnerName, pNickname, onClose, onUpdate }) {
  const [name, setName] = useState(user.name || '');
  const [nickname, setNickname] = useState(pNickname || '');
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
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
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8 rounded-[2.5rem] relative border border-white/10"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
        <p className="text-white/40 mb-8 text-sm">Customize your A2Connect identity</p>

        <div className="flex flex-col items-center mb-8">
          <div 
            onClick={() => fileRef.current?.click()}
            className="group relative w-24 h-24 rounded-full cursor-pointer overflow-hidden border-2 border-emerald-500/30 hover:border-emerald-500 transition-all shadow-2xl"
          >
            {avatarPreview ? (
              <img src={avatarPreview} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-3xl font-bold">
                {user.name[0]}
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
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-emerald-500/50 transition-all font-medium"
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Nickname for {partnerName.split(' ')[0]}</label>
            <input 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-emerald-500/50 transition-all font-medium"
              placeholder="Enter a private alias"
            />
            <p className="text-[10px] text-white/20 ml-1">Only you can see this nickname locally.</p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full mt-10 bg-white text-black font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
        </button>
      </motion.div>
    </motion.div>
  );
}
