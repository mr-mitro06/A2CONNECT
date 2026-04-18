import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { encryptMessage, decryptMessage } from '../lib/encryption';
import PrivacyEye from '../components/PrivacyEye';
import FakeTerminal from '../components/FakeTerminal';
import PhotoViewer from '../components/PhotoViewer';
import AudioPlayer from '../components/AudioPlayer';
import MessageContextMenu from '../components/MessageContextMenu';
import EmojiPicker from 'emoji-picker-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { LogOut, Send, Mic, Square, Play, Pause, MoreVertical, Phone, X, Reply, Paperclip, Loader2, Trash2, Smile } from 'lucide-react';

export default function Chat() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: null, msg: null });
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  
  const [isHideMode, setIsHideMode] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);
  const [viewedPhoto, setViewedPhoto] = useState(null);

  const partnerId = user.id === 'user_abhi' ? 'user_arya' : 'user_abhi';
  const partnerName = user.id === 'user_abhi' ? 'Arya' : 'Abhi';
  
  const bottomRef = useRef(null);
  const roomChannelRef = useRef(null);

  useEffect(() => {
    // 1. Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        // Decrypt messages
        const decryptedData = data.map(msg => {
          const newMsg = { ...msg };
          if (newMsg.type === 'text') {
            const rawText = decryptMessage(newMsg.content);
            try {
              newMsg.content = JSON.parse(rawText);
            } catch {
              newMsg.content = { text: rawText };
            }
          } else if (['audio', 'image', 'video'].includes(newMsg.type)) {
            newMsg.content = decryptMessage(newMsg.content);
          }
          return newMsg;
        });
        setMessages(decryptedData);
        scrollToBottom();
      }
    };
    fetchMessages();

    // 2. Real-time DB subscription
    const dbChannel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        let msg = { ...payload.new };
        
        setMessages((prev) => {
          // Prevent duplicates ONLY for optimistic messages we sent ourselves
          const existing = prev.find(m => m.id === msg.id);
          if (existing && existing.sender_id === user.id) return prev; 
          if (existing) return prev;
          
          const newMsg = { ...msg };
          if (newMsg.type === 'text') {
            const rawText = decryptMessage(newMsg.content);
            try {
              newMsg.content = JSON.parse(rawText);
            } catch {
              newMsg.content = { text: rawText };
            }
          } else if (['audio', 'image', 'video'].includes(newMsg.type)) {
            // For media - decrypt the URL if it's a cipher string, otherwise use as-is
            try {
              const decrypted = decryptMessage(newMsg.content);
              newMsg.content = decrypted || newMsg.content;
            } catch {
              // content may already be a plain URL (rare)
            }
          }
          return [...prev, newMsg];
        });
        setTimeout(scrollToBottom, 50);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        let msg = { ...payload.new };
        try {
          if (msg.type === 'text') {
            const rawText = decryptMessage(msg.content);
            msg.content = JSON.parse(rawText);
          } else if (['audio', 'image', 'video'].includes(msg.type)) {
            msg.content = decryptMessage(msg.content);
          }
        } catch {}
        setMessages((prev) => prev.map(m => m.id === msg.id ? msg : m));
      })
      .subscribe();

    // 2.5 Hardened Polling Fallback (10 seconds)
    // Ensures absolutely zero dropped messages if WebSocket sleeps
    const fallbackInterval = setInterval(async () => {
      const { data } = await supabase.from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (data) {
        setMessages(prev => {
          let hasNew = false;
          let newMessages = [...prev];
          data.reverse().forEach(msg => {
            if (!prev.find(m => m.id === msg.id)) {
              hasNew = true;
              const newMsg = { ...msg };
              if (newMsg.type === 'text') {
                const rawText = decryptMessage(newMsg.content);
                try {
                  newMsg.content = JSON.parse(rawText);
                } catch {
                  newMsg.content = { text: rawText };
                }
              } else if (['audio', 'image', 'video'].includes(newMsg.type)) {
                newMsg.content = decryptMessage(newMsg.content);
              }
              newMessages.push(newMsg);
            }
          });
          if (hasNew) {
            setTimeout(scrollToBottom, 50);
            return newMessages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
          }
          return prev;
        });
      }
    }, 10000);

    // 3. Presence and Typing Sync
    roomChannelRef.current = supabase.channel('room_presence', {
      config: { presence: { key: user.id } },
    });
    
    roomChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannelRef.current.presenceState();
        let pOnline = false;
        let pTyping = false;
        
        if (state[partnerId]) {
          pOnline = true;
          if (state[partnerId][0]?.isTyping) pTyping = true;
        }
        setPartnerOnline(pOnline);
        setPartnerTyping(pTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannelRef.current.track({ online: true, isTyping: false });
        }
      });

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(roomChannelRef.current);
    };
  }, [user.id, partnerId]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTyping = async (e) => {
    setNewMessage(e.target.value);
    if (roomChannelRef.current) {
      await roomChannelRef.current.track({ online: true, isTyping: e.target.value.length > 0 });
    }
  };

  // Utility for UUID fallback
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');

    // Stop typing indicator instantly
    if (roomChannelRef.current) roomChannelRef.current.track({ online: true, isTyping: false });

    const msgId = generateUUID();
    
    // Package text and reply into a JSON payload for encryption
    const getReplyPreview = (replyMsg) => {
      if (!replyMsg) return null;
      if (['audio', 'image', 'video'].includes(replyMsg.type)) return `📸 Media Payload`;
      return typeof replyMsg.content === 'object' ? replyMsg.content.text : replyMsg.content;
    };

    const plaintextPayload = JSON.stringify({
      text: messageText,
      reply_text: getReplyPreview(replyingTo),
      reply_sender: replyingTo ? (replyingTo.sender_id === user.id ? 'You' : partnerName) : null
    });

    const encryptedContent = encryptMessage(plaintextPayload);
    setReplyingTo(null);

    // Optimistic UI Update (Instant display!)
    const optimisticMsg = {
      id: msgId,
      sender_id: user.id,
      receiver_id: partnerId,
      content: JSON.parse(plaintextPayload),
      type: 'text',
      status: 'sending', // Local temporary state
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    // Network DB Payload
    const dbPayload = {
      id: msgId,
      sender_id: user.id,
      receiver_id: partnerId,
      content: encryptedContent,
      type: 'text',
      status: 'sent'
    };

    const { error } = await supabase.from('messages').insert([dbPayload]);
    if (error) {
      console.error('Error sending message:', error);
      // Could revert optimistic update here
    } else {
      // Update local status to sent immediately upon network success
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    const msgId = generateUUID();
    const isVideo = file.type.startsWith('video/');
    const msgType = isVideo ? 'video' : 'image';
    const localUrl = URL.createObjectURL(file);

    // Optimistic UI Update
    const optimisticMsg = {
      id: msgId,
      sender_id: user.id,
      receiver_id: partnerId,
      content: localUrl,
      type: msgType,
      status: 'sending',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    const fileName = `${Date.now()}_${user.id}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supabase.storage.from('media').upload(fileName, file, { upsert: true, contentType: file.type });
    
    if (!error && data) {
      const publicUrl = supabase.storage.from('media').getPublicUrl(fileName).data.publicUrl;
      if (!publicUrl) {
        console.error('Could not get public URL. Ensure the media bucket is set to PUBLIC in Supabase dashboard.');
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error', content: 'Upload failed: bucket not public' } : m));
        setIsUploadingMedia(false);
        return;
      }
      const encryptedUrl = encryptMessage(publicUrl);
      
      const dbPayload = {
        id: msgId,
        sender_id: user.id,
        receiver_id: partnerId,
        content: encryptedUrl,
        type: msgType,
        status: 'sent'
      };
      
      const { error: insertError } = await supabase.from('messages').insert([dbPayload]);
      if (insertError) {
        console.error('DB insert failed', insertError);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error' } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent', content: publicUrl } : m));
      }
    } else {
      console.error('Upload failed', error);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error', content: `Upload failed: ${error?.message}` } : m));
    }
    
    setIsUploadingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Upload to Supabase Storage
        const fileName = `${Date.now()}_${user.id}.webm`;
        const { data, error } = await supabase.storage.from('media').upload(fileName, audioBlob, { contentType: 'audio/webm' });
        
        if (!error && data) {
          const publicUrl = supabase.storage.from('media').getPublicUrl(fileName).data.publicUrl;
          
          const msgUrl = decryptMessage(publicUrl); // Legacy logic if needed, but going forward we decrypt inline
          const encryptedUrl = encryptMessage(publicUrl);
          const dbPayload = {
            id: generateUUID(),
            sender_id: user.id,
            receiver_id: partnerId,
            content: encryptedUrl,
            type: 'audio',
            status: 'sent'
          };
          await supabase.from('messages').insert([dbPayload]);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Prevent the onstop handler from uploading
      mediaRecorderRef.current.onstop = null; 
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const formatRecTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isHideMode) return (
    <>
      <FakeTerminal />
      <PrivacyEye toggleHide={setIsHideMode} isHidden={isHideMode} />
    </>
  );

  const handleContextMenuAction = async (action, emoji = null) => {
    const contextMsg = contextMenu.msg;
    setContextMenu({ isOpen: false, position: null, msg: null });
    if (!contextMsg) return;

    if (action === 'reply') {
      setReplyingTo(contextMsg);
    } 
    else if (action === 'copy') {
      let t = '';
      if (contextMsg.type === 'text') {
        t = typeof contextMsg.content === 'object' ? contextMsg.content.text : contextMsg.content;
      } else {
        t = contextMsg.content;
      }
      navigator.clipboard.writeText(t);
    } 
    else if (action === 'delete') {
      // Optimistic delete
      setMessages(prev => prev.filter(m => m.id !== contextMsg.id));
      await supabase.from('messages').delete().eq('id', contextMsg.id);
    } 
    else if (action === 'react') {
      // Create reaction payload directly
      let pPayload = typeof contextMsg.content === 'object' ? { ...contextMsg.content } : { text: contextMsg.content };
      pPayload.reaction = emoji;
      
      const updatedDBPayload = encryptMessage(JSON.stringify(pPayload));
      const optimisticMsg = { ...contextMsg, content: pPayload };
      setMessages(prev => prev.map(m => m.id === contextMsg.id ? optimisticMsg : m));
      await supabase.from('messages').update({ content: updatedDBPayload }).eq('id', contextMsg.id);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex bg-transparent text-white overflow-hidden selection:bg-white/20 relative">
      <PrivacyEye toggleHide={setIsHideMode} isHidden={isHideMode} />
      <PhotoViewer src={viewedPhoto} isOpen={!!viewedPhoto} onClose={() => setViewedPhoto(null)} />
      
      {contextMenu.isOpen && (
        <MessageContextMenu 
          position={contextMenu.position} 
          msg={contextMenu.msg} 
          isMe={contextMenu.msg.sender_id === user.id}
          onClose={() => setContextMenu({ isOpen: false, position: null, msg: null })}
          onAction={handleContextMenuAction}
        />
      )}
      
      {/* Sidebar - Desktop Only */}
      <div className="hidden md:flex w-[350px] border-r border-white-[0.03] flex-col glass-panel rounded-none border-t-0 border-l-0 border-b-0">
        <div className="h-20 border-b border-white/[0.03] flex items-center justify-between px-6">
          <div className="font-semibold text-xl tracking-tight text-white/90">ShadowTalk</div>
          <button onClick={logout} className="icon-btn hover:text-red-400 group relative">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="p-4 rounded-[1.5rem] bg-white/[0.04] border border-white/[0.03] flex items-center gap-4 cursor-pointer hover:bg-white/[0.08] hover:scale-[1.02] transition-all duration-300">
             <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-stone-800 to-neutral-700 shadow-inner flex items-center justify-center text-lg font-bold">
                  {partnerName[0]}
                </div>
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
        {/* Chat Header */}
        <div className="h-20 border-b border-white/[0.03] glass-panel flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0 rounded-none border-t-0 border-l-0 border-r-0">
          <div className="flex items-center gap-3">
             <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-stone-800 to-neutral-700 shadow-inner flex items-center justify-center text-[15px] font-bold">
                  {partnerName[0]}
                </div>
                {partnerOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#111] shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
             </div>
             <div>
               <h2 className="font-semibold text-white/90 leading-tight text-lg">{partnerName}</h2>
               <p className="text-[13px] text-emerald-400 font-medium">
                  {partnerTyping ? <span className="animate-pulse">typing...</span> : partnerOnline ? 'online' : 'offline'}
               </p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="icon-btn"><Phone className="w-5 h-5 text-white/70" /></button>
            <button className="icon-btn md:hidden" onClick={logout}><LogOut className="w-5 h-5 text-red-500/80" /></button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col gap-5 scrollbar-hide">
          <div className="text-center text-[11px] text-white/30 my-4 uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-4">
            <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
            E2E Encrypted Room
            <div className="h-[1px] flex-1 bg-white/[0.03]"></div>
          </div>
          
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            
            // Safe extraction to prevent FATAL "Object as React child" crashes
            let messageText = '';
            let replyText = null;
            let replySender = null;
            let reaction = null;

            if (msg.type === 'text') {
              if (typeof msg.content === 'object' && msg.content !== null) {
                messageText = msg.content.text ?? '';
                replyText = msg.content.reply_text ?? null;
                replySender = msg.content.reply_sender ?? null;
                reaction = msg.content.reaction ?? null;
              } else {
                messageText = msg.content || '';
              }
            } else if (['audio', 'image', 'video'].includes(msg.type) && typeof msg.content === 'object') {
                reaction = msg.content.reaction ?? null;
            }

            return (
              <div 
                key={msg.id} 
                className={`flex items-end gap-2 max-w-[90%] sm:max-w-[75%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                {/* Visual Avatar Spacer or Avatar */}
                <div className={`hidden sm:flex w-8 h-8 rounded-full flex-shrink-0 items-center justify-center text-[11px] font-bold shadow-inner ${isMe ? 'bg-white text-black' : 'bg-neutral-800 text-white/70'}`}>
                  {isMe ? user.name[0] : partnerName[0]}
                </div>
                
                <motion.div 
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={{ left: 0, right: 0.15 }}
                  onDragEnd={(e, info) => {
                    if (info.offset.x > 60) {
                      setReplyingTo(msg);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, msg });
                  }}
                  className={`relative px-4 py-3 sm:px-5 sm:py-3.5 rounded-3xl ${isMe ? 'rounded-br-[8px] bg-white text-black shadow-lg shadow-white/5' : 'rounded-bl-[8px] bg-[#1a1a1a] border border-white/[0.04] text-white/90 shadow-2xl'} text-[15px] leading-relaxed font-medium z-10 cursor-grab active:cursor-grabbing select-none`}
                >
                  
                  {replyText && (
                    <div className={`mb-2 pl-3 py-1.5 pr-4 rounded-xl border-l-[3px] text-[13px] opacity-80 ${isMe ? 'bg-black/5 border-black/30' : 'bg-white/5 border-emerald-500'}`}>
                      <div className={`font-bold text-[11px] mb-0.5 ${isMe ? 'text-black/70' : 'text-emerald-400'}`}>{replySender}</div>
                      <div className="line-clamp-2 leading-snug">{replyText}</div>
                    </div>
                  )}

                  {msg.type === 'audio' && (
                     <AudioPlayer src={msg.content} isMe={isMe} />
                  )}

                  {msg.type === 'image' && (
                    msg.status === 'error' ? (
                      <div className="flex items-center gap-2 text-red-400 text-sm px-1">
                        <span>⚠️</span>
                        <span className="text-xs">{typeof msg.content === 'string' && msg.content.startsWith('Upload') ? msg.content : 'Upload failed. Check bucket permissions.'}</span>
                      </div>
                    ) : (
                      <div className={`cursor-pointer overflow-hidden rounded-xl border border-white/10 relative ${msg.status === 'sending' ? 'opacity-70' : ''}`} onClick={() => typeof msg.content === 'string' && msg.content.startsWith('blob:') ? null : setViewedPhoto(msg.content)}>
                        <img src={msg.content} alt="Upload" className="max-w-[240px] max-h-[300px] object-cover hover:scale-105 transition-transform duration-500" />
                        {msg.status === 'sending' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {msg.type === 'video' && (
                    msg.status === 'error' ? (
                      <div className="flex items-center gap-2 text-red-400 text-sm px-1">
                        <span>⚠️ Video upload failed</span>
                      </div>
                    ) : (
                      <div className={`overflow-hidden rounded-xl border border-white/10 bg-black/50 relative ${msg.status === 'sending' ? 'opacity-70' : ''}`}>
                        <video src={msg.content} controls className="max-w-[240px] max-h-[300px] outline-none" preload="metadata" />
                        {msg.status === 'sending' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {msg.type === 'text' && (
                     <span className="whitespace-pre-wrap word-break">{messageText}</span>
                  )}

                  <div className={`text-[10px] mt-1 flex items-center gap-1.5 justify-end ${isMe ? 'text-black/50' : 'text-white/30'}`}>
                    <span>{msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}</span>
                    {isMe && (
                      <svg viewBox="0 0 16 15" width="14" height="13" className="fill-current"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.136.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>
                    )}
                  </div>

                  {reaction && (
                    <div className={`absolute -bottom-3 ${isMe ? 'right-4' : 'left-4'} bg-[#1a1a1a] border border-white/10 rounded-full px-2 py-0.5 text-base shadow-xl transform hover:scale-110 transition-transform cursor-pointer`}>
                      {reaction}
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-5 bg-transparent backdrop-blur-xl border-t border-white/[0.03]">
          {replyingTo && !isRecording && (
            <div className="mb-3 mx-2 px-4 py-3 bg-[#111] border border-white/5 rounded-2xl flex items-center justify-between shadow-2xl">
              <div className="flex flex-col gap-1 overflow-hidden border-l-[3px] border-emerald-500 pl-3">
                <span className="text-emerald-500 text-[11px] font-bold uppercase tracking-wider">
                  Replying to {replyingTo.sender_id === user.id ? 'Yourself' : partnerName}
                </span>
                <span className="text-white/60 text-sm truncate">
                  {replyingTo.type === 'audio' ? '🎤 Voice Message' : (replyingTo.content.text || replyingTo.content)}
                </span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
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
                 <button 
                    onClick={cancelRecording}
                    className="w-10 h-10 rounded-full bg-black/20 text-red-400 flex items-center justify-center hover:bg-black/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={stopRecording}
                    className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                  >
                    <Send className="w-4 h-4 ml-0.5 fill-current" />
                 </button>
               </div>
             </div>
          ) : (
              <div className="glass-panel p-2 pl-4 rounded-[2rem] flex items-end gap-2 shadow-2xl transition-all duration-300 focus-within:border-white/20 focus-within:bg-white/[0.05] relative">
                
                {showInputEmoji && (
                  <div className="absolute bottom-16 left-0 z-50 shadow-2xl">
                    <EmojiPicker
                      theme="dark"
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                      height={380}
                      width={320}
                      onEmojiClick={(e) => setNewMessage(m => m + e.emoji)}
                    />
                  </div>
                )}

                <button
                  onClick={() => setShowInputEmoji(v => !v)}
                  className={`w-10 h-10 mb-1 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    showInputEmoji ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Smile className="w-5 h-5" />
                </button>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*, video/*"  
                  className="hidden" 
                  onChange={handleFileUpload}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  className="w-10 h-10 mb-1 rounded-full text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                >
                  {isUploadingMedia ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <Paperclip className="w-5 h-5" />}
                </button>

                <input 
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Encrypted Message..." 
                  className="flex-1 bg-transparent border-none outline-none text-white/90 placeholder:text-white/30 h-[44px] px-2 text-[15px]"
                />
                
                <div className="flex items-center gap-1 mb-1 mr-1">
                  {newMessage.trim().length > 0 ? (
                    <button 
                      onClick={handleSendMessage}
                      className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                    >
                      <Send className="w-5 h-5 ml-1" />
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
