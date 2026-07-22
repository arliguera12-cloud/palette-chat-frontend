import React, { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [palette, setPalette] = useState(['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8']);
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [harmonyMode, setHarmonyMode] = useState('complementary');
  const [searchValue, setSearchValue] = useState('');
  const [showLoginOverlay, setShowLoginOverlay] = useState(false);
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userSelectVal, setUserSelectVal] = useState('');
  const [codeVal, setCodeVal] = useState('');
  const messagesEndRef = useRef(null);
  const canvasRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    if (!userSelectVal || !codeVal) {
      setLoginError('Completa todos los campos');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userSelectVal, code: codeVal })
      });

      if (!response.ok) throw new Error('Invalid credentials');

      const data = await response.json();
      setToken(data.token);
      setCurrentUser(data.user);
      setShowLoginOverlay(false);
      await loadMessages(data.token);
      setShowChatOverlay(true);
    } catch (error) {
      setLoginError('❌ Usuario o código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      if (searchValue.trim() === '2314') {
        setSearchValue('');
        setShowLoginOverlay(true);
      }
    }
  };

  const loadMessages = async (authToken) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_URL}/api/chat/messages`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !token || !currentUser) return;

    try {
      const response = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: messageText.trim(), sender: currentUser })
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCloseChat = () => {
    setShowChatOverlay(false);
    setShowLoginOverlay(false);
    setCurrentUser(null);
    setToken(null);
    setMessages([]);
    setMessageText('');
    setLoginError('');
    setUserSelectVal('');
    setCodeVal('');
  };

  const generatePalette = () => {
    const baseHue = Math.random() * 360;
    const hslToHex = (h, s, l) => {
      l /= 100;
      const a = (s * Math.min(l, 1 - l)) / 100;
      const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
    };

    let newPalette;
    if (harmonyMode === 'complementary') {
      newPalette = [hslToHex(baseHue,100,50), hslToHex(baseHue,100,65), hslToHex((baseHue+180)%360,100,50), hslToHex((baseHue+180)%360,100,65), hslToHex(baseHue,50,85)];
    } else if (harmonyMode === 'triadic') {
      newPalette = [hslToHex(baseHue,100,50), hslToHex((baseHue+120)%360,100,50), hslToHex((baseHue+240)%360,100,50), hslToHex(baseHue,100,70), hslToHex(baseHue,50,85)];
    } else if (harmonyMode === 'analogous') {
      newPalette = [hslToHex((baseHue-30)%360,100,50), hslToHex(baseHue,100,50), hslToHex((baseHue+30)%360,100,50), hslToHex(baseHue,100,70), hslToHex(baseHue,50,85)];
    } else {
      newPalette = [hslToHex(baseHue,100,30), hslToHex(baseHue,100,45), hslToHex(baseHue,100,60), hslToHex(baseHue,100,75), hslToHex(baseHue,50,90)];
    }
    setPalette(newPalette);
  };

  const copyColor = (color) => {
    navigator.clipboard.writeText(color);
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const w = canvas.offsetWidth;
      const h = 160;
      canvas.width = w;
      canvas.height = h;
      const colorW = w / palette.length;
      palette.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(i * colorW, 0, colorW, h);
      });
    }
  }, [palette]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!showChatOverlay || !token) return;
    const interval = setInterval(() => {
      loadMessages(token);
    }, 3000);
    return () => clearInterval(interval);
  }, [showChatOverlay, token]);

  useEffect(() => {
    generatePalette();
  }, []);

  const styles = {
    app: { background: '#0F172A', color: '#E5E7EB', minHeight: '100vh' },
    header: { background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', borderBottom: '1px solid #1E40AF', padding: '28px' },
    headerContent: { maxWidth: '1200px', margin: '0 auto' },
    headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    h1: { fontSize: '32px', fontWeight: 700, color: '#F1F5F9', margin: 0 },
    version: { fontSize: '12px', color: '#64748B' },
    searchInput: { flex: 1, padding: '12px 16px', background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', color: '#E5E7EB', maxWidth: '300px', outline: 'none' },
    main: { maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' },
    section: { background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', padding: '32px', marginBottom: '32px' },
    sectionTitle: { fontSize: '18px', fontWeight: 600, color: '#64748B', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    harmonyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' },
    harmonyBtn: (active) => ({ padding: '16px', borderRadius: '8px', border: active ? '2px solid #2563EB' : '2px solid #334155', background: active ? 'rgba(37,99,235,0.15)' : '#0F172A', cursor: 'pointer', textAlign: 'left', color: '#E5E7EB' }),
    btnPrimary: { padding: '14px 28px', background: 'linear-gradient(to right, #2563EB, #9333EA)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' },
    canvasContainer: { background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', borderRadius: '12px', padding: '24px', border: '1px solid #334155' },
    colorsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' },
    colorCard: { background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '16px', textAlign: 'center' },
    colorSwatch: (color) => ({ width: '100%', height: '100px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #334155', backgroundColor: color, cursor: 'pointer' }),
    colorCode: { fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#93C5FD', marginBottom: '10px' },
    copyBtn: { width: '100%', padding: '8px', background: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#E5E7EB' },
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', background: 'rgba(15,23,42,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    loginCard: { background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '40px', maxWidth: '380px', width: '100%' },
    label: { display: 'block', fontSize: '12px', textTransform: 'uppercase', color: '#64748B', fontWeight: 600, marginBottom: '8px' },
    input: { width: '100%', padding: '10px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', color: '#E5E7EB', fontSize: '14px', outline: 'none' },
    chatOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', zIndex: 999 },
    chatHeader: { background: 'linear-gradient(to right, #2563EB, #9333EA)', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    closeBtn: { background: '#DC2626', color: 'white', width: '40px', height: '40px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' },
    chatMessages: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
    msgBubble: (mine) => ({ maxWidth: '70%', padding: '10px 14px', borderRadius: '12px', background: mine ? '#2563EB' : '#334155', color: mine ? 'white' : '#E5E7EB', alignSelf: mine ? 'flex-end' : 'flex-start' }),
    chatInputArea: { background: '#1E293B', borderTop: '1px solid #334155', padding: '16px 24px' },
  };

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerTop}>
            <h1 style={styles.h1}>Palette Creator</h1>
            <span style={styles.version}>v2.8 · Pro Dark</span>
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={handleSearch}
            placeholder="Buscar paleta o código..."
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Modo de armonía</h2>
          <div style={styles.harmonyGrid}>
            {['complementary', 'triadic', 'analogous', 'monochromatic'].map((mode) => (
              <div
                key={mode}
                onClick={() => { setHarmonyMode(mode); }}
                style={styles.harmonyBtn(harmonyMode === mode)}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9', marginBottom: '4px' }}>
                  {mode === 'complementary' && 'Complementario'}
                  {mode === 'triadic' && 'Triádico'}
                  {mode === 'analogous' && 'Análogo'}
                  {mode === 'monochromatic' && 'Monocromático'}
                </h3>
              </div>
            ))}
          </div>
          <button onClick={generatePalette} style={styles.btnPrimary}>🔄 Generar nueva paleta</button>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Visualización</h2>
          <div style={styles.canvasContainer}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '160px', borderRadius: '8px' }} />
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Colores</h2>
          <div style={styles.colorsGrid}>
            {palette.map((color) => (
              <div key={color} style={styles.colorCard}>
                <div style={styles.colorSwatch(color)} onClick={() => copyColor(color)} />
                <div style={styles.colorCode}>{color}</div>
                <button onClick={() => copyColor(color)} style={styles.copyBtn}>Copiar</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showLoginOverlay && (
        <div style={styles.overlay}>
          <div style={styles.loginCard}>
            <h2 style={{ textAlign: 'center', marginBottom: '28px', color: '#F1F5F9' }}>Acceso</h2>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={styles.label}>Usuario</label>
                <select value={userSelectVal} onChange={(e) => setUserSelectVal(e.target.value)} style={styles.input} required>
                  <option value="">Selecciona...</option>
                  <option value="n">N</option>
                  <option value="y">Y</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={styles.label}>Código</label>
                <input type="password" value={codeVal} onChange={(e) => setCodeVal(e.target.value)} maxLength="4" style={styles.input} required />
              </div>
              {loginError && <div style={{ color: '#EF4444', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{loginError}</div>}
              <button type="submit" disabled={loading} style={{ ...styles.btnPrimary, width: '100%' }}>
                {loading ? 'Accediendo...' : 'Acceder'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showChatOverlay && (
        <div style={styles.chatOverlay}>
          <div style={styles.chatHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Privado</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>Historial persistente</p>
            </div>
            <button onClick={handleCloseChat} style={styles.closeBtn}>✕</button>
          </div>

          <div style={styles.chatMessages}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748B', marginTop: '40px' }}>Inicio de conversación</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={styles.msgBubble(currentUser === msg.sender)}>
                  {msg.text}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.chatInputArea}>
            <div style={{ marginBottom: '10px', fontSize: '12px', color: '#64748B' }}>
              De: <span style={{ color: '#60A5FA', fontWeight: 700 }}>{currentUser?.toUpperCase()}</span>
            </div>
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Mensaje..."
                style={{ ...styles.input, flex: 1 }}
              />
              <button type="submit" style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
