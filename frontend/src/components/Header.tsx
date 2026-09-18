/**
 * TrueVoice Dashboard Header & SOC Navigation Bar.
 */

import React from 'react';
import type { TokenResponse } from '../types/api';

export interface HeaderProps {
  currentUser: TokenResponse | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  streamActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenLogin,
  onLogout,
  streamActive,
}) => {
  return (
    <header className="soc-header">
      <div className="header-left">
        <div className="brand-logo">
          <span className="logo-icon">🛡️</span>
          <div className="brand-titles">
            <h1 className="brand-name">TRUEVOICE</h1>
            <span className="brand-sub">Real-Time Voice Cloning Defense Console</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="stream-badge-pill">
          <span className={`live-indicator ${streamActive ? 'live-pulsing' : 'live-idle'}`} />
          <span className="live-text">
            {streamActive ? 'LIVE ANALYSIS ENGINE ACTIVE' : 'SYSTEM STANDBY'}
          </span>
        </div>
      </div>

      <div className="header-right">
        {currentUser ? (
          <div className="user-profile-widget">
            <div className="user-meta">
              <span className="user-role-badge">{currentUser.role}</span>
              <span className="user-org">Org: {currentUser.org_id.slice(0, 8)}...</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary-sm"
              onClick={onLogout}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenLogin}
          >
            Analyst Login
          </button>
        )}
      </div>
    </header>
  );
};
