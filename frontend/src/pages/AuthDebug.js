import { useEffect, useState } from 'react';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';

const AuthDebug = () => {
  const { user, session, loading } = useSupabaseAuth();
  const [logs, setLogs] = useState([]);
  const [rawSession, setRawSession] = useState(null);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addLog('Page loaded');
    addLog(`Loading: ${loading}`);
    addLog(`User: ${user ? user.email : 'null'}`);
    addLog(`Session: ${session ? 'exists' : 'null'}`);
    
    // Get raw session directly
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        addLog(`Session error: ${error.message}`);
      } else {
        setRawSession(data.session);
        addLog(`Raw session: ${data.session ? data.session.user.email : 'null'}`);
      }
    });

    // Check localStorage
    const storageKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('biqc'));
    addLog(`LocalStorage keys: ${storageKeys.join(', ') || 'none'}`);
  }, [user, session, loading]);

  const handleClearAndReload = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login-supabase';
  };

  const handleTestLogin = async () => {
    addLog('Testing login...');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'testing@biqc.demo',
        password: 'TestPass123!'
      });
      if (error) {
        addLog(`Login error: ${error.message}`);
      } else {
        addLog(`Login success: ${data.session?.user?.email}`);
        setTimeout(() => {
          window.location.href = '/advisor';
        }, 2000);
      }
    } catch (e) {
      addLog(`Login exception: ${e.message}`);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'var(--font-mono)',
      fontSize: '14px',
      background: '#1a1a2e',
      color: '#00ff00',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#00ff00', marginBottom: '20px' }}>🔍 Auth Debug Page</h1>
      
      <div style={{ 
        background: '#16213e', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#e94560', marginBottom: '10px' }}>Current State</h2>
        <p>Loading: <span style={{ color: loading ? '#ff0' : '#0f0' }}>{String(loading)}</span></p>
        <p>User: <span style={{ color: user ? '#0f0' : '#f00' }}>{user ? user.email : 'NULL'}</span></p>
        <p>Session: <span style={{ color: session ? '#0f0' : '#f00' }}>{session ? 'EXISTS' : 'NULL'}</span></p>
        <p>Session Email: <span style={{ color: '#0ff' }}>{session?.user?.email || 'N/A'}</span></p>
        <p>Raw Session: <span style={{ color: rawSession ? '#0f0' : '#f00' }}>{rawSession ? rawSession.user.email : 'NULL'}</span></p>
      </div>

      <div style={{ 
        background: '#16213e', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#e94560', marginBottom: '10px' }}>Actions</h2>
        <button 
          onClick={handleTestLogin}
          style={{ 
            background: '#0f0', 
            color: '#000', 
            padding: '10px 20px', 
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: 'pointer'
          }}
        >
          Test Login (testing@biqc.demo)
        </button>
        <button 
          onClick={handleClearAndReload}
          style={{ 
            background: '#f00', 
            color: '#fff', 
            padding: '10px 20px', 
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: 'pointer'
          }}
        >
          Clear Storage & Reload
        </button>
        <button 
          onClick={() => window.location.href = '/advisor'}
          style={{ 
            background: '#00f', 
            color: '#fff', 
            padding: '10px 20px', 
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Go to /advisor
        </button>
      </div>

      <div style={{ 
        background: '#16213e', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#e94560', marginBottom: '10px' }}>Logs</h2>
        <div style={{ 
          background: '#0d1117', 
          padding: '10px', 
          borderRadius: '4px',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '5px' }}>{log}</div>
          ))}
        </div>
      </div>

      <div style={{ 
        background: '#16213e', 
        padding: '15px', 
        borderRadius: '8px'
      }}>
        <h2 style={{ color: '#e94560', marginBottom: '10px' }}>User Object</h2>
        <pre style={{ 
          background: '#0d1117', 
          padding: '10px', 
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '12px'
        }}>
          {JSON.stringify(user, null, 2) || 'null'}
        </pre>
      </div>
    </div>
  );
};

export default AuthDebug;
