import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HARMONY_MODES = ['complementary', 'triadic', 'analogous', 'monochromatic'];
const HARMONY_LABELS = { complementary: 'Complementario', triadic: 'Triádico', analogous: 'Análogo', monochromatic: 'Monocromático' };

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isImage(type) { return type && type.startsWith('image/'); }
function isVideo(type) { return type && type.startsWith('video/'); }
function isPDF(type) { return type === 'application/pdf'; }

export default function App() {
  // ── Palette state ──
  const [palette, setPalette] = useState(['#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#98D8C8']);
  const [harmonyMode, setHarmonyMode] = useState('complementary');
  const canvasRef = useRef(null);

  // ── Auth state ──
  const [searchValue, setSearchValue] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [userVal, setUserVal] = useState('');
  const [codeVal, setCodeVal] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // ── Chat state ──
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);

  // ── Realtime subscription ──
  const realtimeRef = useRef(null);

  // ──────────────────────────────────────────
  // Palette
  // ──────────────────────────────────────────
  const generatePalette = useCallback(() => {
    const base = Math.random() * 360;
    let p;
    if (harmonyMode === 'complementary') {
      p = [hslToHex(base,100,50), hslToHex(base,100,65), hslToHex((base+180)%360,100,50), hslToHex((base+180)%360,100,65), hslToHex(base,50,85)];
    } else if (harmonyMode === 'triadic') {
      p = [hslToHex(base,100,50), hslToHex((base+120)%360,100,50), hslToHex((base+240)%360,100,50), hslToHex(base,100,70), hslToHex(base,50,85)];
    } else if (harmonyMode === 'analogous') {
      p = [hslToHex((base-30+360)%360,100,50), hslToHex(base,100,50), hslToHex((base+30)%360,100,50), hslToHex(base,100,70), hslToHex(base,50,85)];
    } else {
      p = [hslToHex(base,100,30), hslToHex(base,100,45), hslToHex(base,100,60), hslToHex(base,100,75), hslToHex(base,50,90)];
    }
    setPalette(p);
  }, [harmonyMode]);

  useEffect(() => { generatePalette(); }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth;
    c.height = 160;
    const w = c.width / palette.length;
    palette.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(i * w, 0, w, 160); });
  }, [palette]);

  // ──────────────────────────────────────────
  // Viewport (teclado móvil)
  // ──────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewportHeight(vh);
    };
    update();
    window.addEventListener('resize', update);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', update);
    };
  }, []);

  // ──────────────────────────────────────────
  // Keep-alive (Render no se duerme)
  // ──────────────────────────────────────────
  // markRead al volver al foco
  useEffect(() => {
    if (!showChat || !token) return;
    const onFocus = () => markRead(token);
    const onVis = () => { if (document.visibilityState === 'visible') markRead(token); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [showChat, token]);

  useEffect(() => {
    const ping = () => fetch(`${API_URL}/health`).catch(() => {});
    const iv = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  // ──────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────
  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchValue.trim() === '2314') {
      setSearchValue('');
      setShowLogin(true);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userVal, code: codeVal })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token);
      setCurrentUser(data.user);
      setShowLogin(false);
      await loadMessages(data.token);
      setShowChat(true);
      markRead(data.token);
      subscribeRealtime(data.token);
    } catch {
      setLoginError('❌ Usuario o código incorrecto');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCloseChat = () => {
    if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    setShowChat(false);
    setShowLogin(false);
    setToken(null);
    setCurrentUser(null);
    setMessages([]);
    setMsgText('');
    setReplyTo(null);
    setEditingMsg(null);
    setUserVal('');
    setCodeVal('');
  };

  // ──────────────────────────────────────────
  // Realtime
  // ──────────────────────────────────────────
  const subscribeRealtime = useCallback((authToken) => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    const channel = supabase
      .channel('private-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_chat_messages' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Fetch completo del mensaje para asegurar todos los campos
          try {
            const res = await fetch(`${API_URL}/api/chat/messages?_=${Date.now()}`, {
              headers: { 'Authorization': `Bearer ${authToken}` },
              cache: 'no-store'
            });
            if (res.ok) {
              const allMsgs = await res.json();
              setMessages(allMsgs);
            }
          } catch {}
          // Marcar como leidos los mensajes del otro usuario
          setTimeout(() => markRead(authToken), 500);
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.map(m => m.id === payload.old.id ? { ...m, deleted_at: new Date().toISOString() } : m));
        }
      })
      .subscribe();
    realtimeRef.current = channel;
  }, []);

  // ──────────────────────────────────────────
  // Messages
  // ──────────────────────────────────────────
  const loadMessages = async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/messages?_=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        cache: 'no-store'
      });
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  const markRead = async (authToken) => {
    try {
      await fetch(`${API_URL}/api/chat/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken || token}` }
      });
    } catch {}
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ──────────────────────────────────────────
  // Send message
  // ──────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim() && !editingMsg) return;
    if (!token || !currentUser) return;

    if (editingMsg) {
      try {
        await fetch(`${API_URL}/api/chat/edit/${editingMsg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ text: msgText })
        });
        setEditingMsg(null);
        setMsgText('');
      } catch {}
      return;
    }

    try {
      const body = { text: msgText, sender: currentUser };
      if (replyTo) body.reply_to_id = replyTo.id;
      await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      setMsgText('');
      setReplyTo(null);
    } catch {}
  };

  // ──────────────────────────────────────────
  // Upload file
  // ──────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error();
      const { media_url, media_type, media_name } = await res.json();
      await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sender: currentUser, media_url, media_type, media_name, reply_to_id: replyTo?.id })
      });
      setReplyTo(null);
    } catch {
      alert('Error subiendo archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ──────────────────────────────────────────
  // Delete message
  // ──────────────────────────────────────────
  const deleteMessage = async (id) => {
    try {
      await fetch(`${API_URL}/api/chat/message/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setLongPressMsg(null);
    } catch {}
  };

  // ──────────────────────────────────────────
  // Long press
  // ──────────────────────────────────────────
  const startLongPress = (msg) => {
    longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500);
  };
  const cancelLongPress = () => { clearTimeout(longPressTimer.current); };

  // ──────────────────────────────────────────
  // Group messages by date
  // ──────────────────────────────────────────
  const grouped = [];
  let lastDate = null;
  messages.forEach(msg => {
    const d = formatDate(msg.created_at);
    if (d !== lastDate) { grouped.push({ type: 'date', label: d }); lastDate = d; }
    grouped.push({ type: 'msg', msg });
  });

  // ──────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────
  const replyPreview = (msg) => {
    if (!msg.reply_to_id) return null;
    const original = messages.find(m => m.id === msg.reply_to_id);
    if (!original) return null;
    return (
      <div style={{ borderLeft: '3px solid #60A5FA', paddingLeft: 8, marginBottom: 6, fontSize: 12, opacity: 0.8 }}>
        <div style={{ color: '#60A5FA', fontWeight: 600 }}>{original.sender === 'n' ? 'N' : 'Y'}</div>
        <div style={{ color: '#CBD5E1' }}>{original.deleted_at ? '🚫 Mensaje eliminado' : (original.text || (original.media_name ? `📎 ${original.media_name}` : ''))}</div>
      </div>
    );
  };

  const mediaPreview = (msg) => {
    if (!msg.signed_url) return null;
    if (isImage(msg.media_type)) {
      return <img src={msg.signed_url} alt={msg.media_name} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, marginTop: 4, display: 'block' }} />;
    }
    if (isVideo(msg.media_type)) {
      return <video src={msg.signed_url} controls style={{ maxWidth: 220, borderRadius: 8, marginTop: 4, display: 'block' }} />;
    }
    if (isPDF(msg.media_type) || msg.media_name) {
      return (
        <a href={msg.signed_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#93C5FD', fontSize: 13 }}>
          📎 {msg.media_name}
        </a>
      );
    }
    return null;
  };

  const readTick = (msg) => {
    if (msg.sender !== currentUser) return null;
    if (msg.read_at) return <span style={{ color: '#60A5FA', fontSize: 11 }}> ✓✓</span>;
    return <span style={{ color: '#64748B', fontSize: 11 }}> ✓</span>;
  };

  // ──────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────
  return (
    <div style={{ background: '#0F172A', color: '#E5E7EB', minHeight: '100vh' }}>

      {/* ─── HEADER ─── */}
      <div style={{ background: 'linear-gradient(135deg,#1E293B,#0F172A)', borderBottom: '1px solid #1E40AF', padding: 28 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Palette Creator</h1>
            <span style={{ fontSize: 12, color: '#64748B' }}>v4.0 · Pro Dark</span>
          </div>
          <input
            type="text" value={searchValue} onChange={e => setSearchValue(e.target.value)} onKeyPress={handleSearch}
            placeholder="Buscar paleta o código..."
            style={{ padding: '12px 16px', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, fontSize: 14, color: '#E5E7EB', width: 280, outline: 'none' }}
          />
        </div>
      </div>

      {/* ─── MAIN ─── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Harmony */}
        <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', padding: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Modo de armonía</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
            {HARMONY_MODES.map(m => (
              <button key={m} onClick={() => setHarmonyMode(m)}
                style={{ padding: '14px 16px', border: `2px solid ${harmonyMode===m?'#2563EB':'#334155'}`, borderRadius: 8, background: harmonyMode===m?'rgba(37,99,235,0.15)':'#0F172A', color: '#E5E7EB', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {HARMONY_LABELS[m]}
              </button>
            ))}
          </div>
          <button onClick={generatePalette}
            style={{ padding: '12px 24px', background: 'linear-gradient(to right,#2563EB,#9333EA)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            🔄 Generar nueva paleta
          </button>
        </div>

        {/* Canvas */}
        <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', padding: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Visualización</h2>
          <canvas ref={canvasRef} style={{ width: '100%', height: 160, borderRadius: 8 }} />
        </div>

        {/* Colors */}
        <div style={{ background: '#1E293B', borderRadius: 12, border: '1px solid #334155', padding: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Colores</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 16 }}>
            {palette.map(col => (
              <div key={col} style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ width: '100%', height: 90, borderRadius: 8, background: col, marginBottom: 10 }} />
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#93C5FD', marginBottom: 8 }}>{col}</div>
                <button onClick={() => navigator.clipboard.writeText(col)}
                  style={{ width: '100%', padding: '6px 0', background: '#334155', border: 'none', borderRadius: 6, color: '#E5E7EB', cursor: 'pointer', fontSize: 12 }}>
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── LOGIN OVERLAY ─── */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 14, padding: 40, width: 360 }}>
            <h2 style={{ color: '#F1F5F9', textAlign: 'center', marginBottom: 28, fontSize: 22 }}>Acceso</h2>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Usuario</label>
                <select value={userVal} onChange={e => setUserVal(e.target.value)} required
                  style={{ width: '100%', padding: '10px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, color: '#E5E7EB', fontSize: 14 }}>
                  <option value="">Selecciona...</option>
                  <option value="n">N</option>
                  <option value="y">Y</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Código</label>
                <input type="password" value={codeVal} onChange={e => setCodeVal(e.target.value)} maxLength={4} required
                  style={{ width: '100%', padding: '10px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, color: '#E5E7EB', fontSize: 14 }} />
              </div>
              {loginError && <div style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{loginError}</div>}
              <button type="submit" disabled={loginLoading}
                style={{ width: '100%', padding: 13, background: 'linear-gradient(to right,#2563EB,#9333EA)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>
                {loginLoading ? 'Accediendo...' : 'Acceder'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── CHAT OVERLAY ─── */}
      {showChat && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: viewportHeight + 'px', background: '#0F172A', display: 'flex', flexDirection: 'column', zIndex: 999 }}>

          {/* Chat header */}
          <div style={{ background: 'linear-gradient(to right,#2563EB,#9333EA)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>Privado</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Historial persistente · v4</div>
            </div>
            <button onClick={handleCloseChat}
              style={{ background: '#DC2626', border: 'none', color: '#fff', width: 38, height: 38, borderRadius: 8, fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {grouped.map((item, i) => {
              if (item.type === 'date') {
                return (
                  <div key={i} style={{ textAlign: 'center', margin: '12px 0 6px' }}>
                    <span style={{ background: '#1E293B', color: '#64748B', fontSize: 11, padding: '3px 12px', borderRadius: 20 }}>{item.label}</span>
                  </div>
                );
              }
              const msg = item.msg;
              const mine = msg.sender === currentUser;
              const deleted = !!msg.deleted_at;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 4 }}
                  onContextMenu={(e) => { e.preventDefault(); if (!deleted) setLongPressMsg(msg); }}
                  onTouchStart={() => !deleted && startLongPress(msg)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}>
                  <div style={{
                    maxWidth: '75%', padding: '8px 12px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: deleted ? '#1E293B' : mine ? '#2563EB' : '#1E293B',
                    border: deleted ? '1px solid #334155' : 'none',
                    minWidth: deleted ? 140 : undefined,
                    color: deleted ? '#64748B' : '#fff', fontSize: 14, lineHeight: 1.45
                  }}>
                    {!deleted && replyPreview(msg)}
                    {deleted
                      ? <span style={{ fontStyle: 'italic' }}>🚫 Mensaje eliminado</span>
                      : <>
                          {mediaPreview(msg)}
                          {msg.text && !msg.media_url && <div>{msg.text}</div>}
                        </>
                    }
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      {msg.edited_at && !deleted && <span style={{ fontSize: 10, opacity: 0.6 }}>editado</span>}
                      <span style={{ fontSize: 10, opacity: 0.65 }}>{formatTime(msg.created_at)}</span>
                      {readTick(msg)}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#475569', marginTop: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <div>Inicio de conversación</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply banner */}
          {replyTo && (
            <div style={{ background: '#1E3A5F', borderTop: '1px solid #2563EB', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: '#60A5FA', fontWeight: 600 }}>Respondiendo a {replyTo.sender === 'n' ? 'N' : 'Y'}: </span>
                <span style={{ color: '#CBD5E1' }}>{replyTo.text || replyTo.media_name || '📎 archivo'}</span>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
          )}

          {/* Edit banner */}
          {editingMsg && (
            <div style={{ background: '#1E3A5F', borderTop: '1px solid #2563EB', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: '#60A5FA', fontWeight: 600 }}>✏️ Editando mensaje</div>
              <button onClick={() => { setEditingMsg(null); setMsgText(''); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
          )}

          {/* Input area */}
          <div style={{ background: '#1E293B', borderTop: '1px solid #334155', padding: '12px 12px', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>De: <span style={{ color: '#60A5FA', fontWeight: 700 }}>{currentUser?.toUpperCase()}</span></div>
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ background: '#334155', border: 'none', borderRadius: 8, color: '#E5E7EB', width: 40, height: 40, cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>
                {uploading ? '⏳' : '📎'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime,application/pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleFileChange} />
              <input ref={inputRef} type="text" value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder={editingMsg ? 'Editar mensaje...' : 'Mensaje...'}
                style={{ flex: 1, padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: 20, color: '#E5E7EB', fontSize: 14, outline: 'none' }} />
              <button type="submit" disabled={!msgText.trim() && !editingMsg}
                style={{ background: msgText.trim() || editingMsg ? '#2563EB' : '#334155', border: 'none', borderRadius: 20, color: '#fff', padding: '10px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                {editingMsg ? '✓' : '➤'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── LONG PRESS MENU ─── */}
      {longPressMsg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLongPressMsg(null)}>
          <div style={{ background: '#1E293B', borderRadius: 14, padding: 8, minWidth: 200, border: '1px solid #334155' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setReplyTo(longPressMsg); setLongPressMsg(null); inputRef.current?.focus(); }}
              style={{ display: 'block', width: '100%', padding: '12px 20px', background: 'none', border: 'none', color: '#E5E7EB', cursor: 'pointer', textAlign: 'left', fontSize: 15, borderRadius: 8 }}>
              ↩️ Responder
            </button>
            {longPressMsg.sender === currentUser && (
              <>
                <button onClick={() => { setEditingMsg(longPressMsg); setMsgText(longPressMsg.text || ''); setLongPressMsg(null); inputRef.current?.focus(); }}
                  style={{ display: 'block', width: '100%', padding: '12px 20px', background: 'none', border: 'none', color: '#E5E7EB', cursor: 'pointer', textAlign: 'left', fontSize: 15, borderRadius: 8 }}>
                  ✏️ Editar
                </button>
                <button onClick={() => deleteMessage(longPressMsg.id)}
                  style={{ display: 'block', width: '100%', padding: '12px 20px', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', textAlign: 'left', fontSize: 15, borderRadius: 8 }}>
                  🗑️ Eliminar
                </button>
              </>
            )}
            <button onClick={() => setLongPressMsg(null)}
              style={{ display: 'block', width: '100%', padding: '12px 20px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', textAlign: 'left', fontSize: 15, borderRadius: 8 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
