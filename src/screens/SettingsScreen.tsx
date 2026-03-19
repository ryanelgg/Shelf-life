import { useState } from 'react';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';

export function SettingsScreen() {
  const { user, theme, setTheme, setShowSettings, updateUser, resetOnboarding } = useStore();
  const [name, setName] = useState(user?.name || '');
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setShowSettings(false);
      setClosing(false);
    }, 280);
  };

  const handleSaveName = () => {
    if (name.trim()) updateUser({ name: name.trim() });
  };

  return (
    <div
      className={closing ? '' : 'settings-enter'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        animation: closing ? 'slideOutRight 0.28s ease-in both' : undefined,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Settings</h2>
        <button onClick={close} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent)', fontSize: '14px', fontWeight: 600,
          fontFamily: 'Syne, sans-serif',
        }}>
          Done
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {/* Profile */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Profile
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Name</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleSaveName}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Household Size</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 500 }}>
                {user?.householdSize || 1} {(user?.householdSize || 1) === 1 ? 'person' : 'people'}
              </div>
            </div>
          </div>
        </Card>

        {/* Theme */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Dark Mode</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {theme === 'dark' ? 'Dark theme active' : 'Light theme active'}
              </div>
            </div>
            <button
              className={`theme-toggle ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />
          </div>
        </Card>

        {/* Dietary preferences */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Dietary Preferences
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {user?.dietaryPreferences?.map(pref => (
              <span key={pref} style={{
                padding: '6px 12px',
                borderRadius: '16px',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}>
                {pref}
              </span>
            )) || (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No dietary preferences set</span>
            )}
          </div>
        </Card>

        {/* App info */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            About
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Version</span>
              <span className="mono">1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Made with</span>
              <span>🥑 + ❤️</span>
            </div>
          </div>
        </Card>

        {/* Reset */}
        <button
          onClick={() => {
            if (confirm('Reset all data? This will clear your pantry, logs, and preferences.')) {
              resetOnboarding();
              setShowSettings(false);
            }
          }}
          style={{
            padding: '14px',
            background: 'transparent',
            border: '1px solid var(--expired)',
            borderRadius: '14px',
            color: 'var(--expired)',
            fontFamily: 'Syne, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          Reset All Data
        </button>
      </div>
    </div>
  );
}
