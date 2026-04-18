import { useState, useEffect } from 'react';
import { verifyToken, setToken } from '../api/api';
import './LoginGate.css';

/**
 * LoginGate wraps the app and handles token-based authentication.
 * 
 * Auth flow:
 * 1. Check URL for ?token= parameter (from shared link)
 * 2. Check localStorage for saved token
 * 3. Verify token against backend
 * 4. Show login form if no valid token
 * 
 * This will later be replaced by Discord OAuth.
 */
const LoginGate = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsChecking(true);

    // 1. Check URL for token parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (urlToken) {
      // Remove token from URL for security (don't leave it visible)
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);

      const result = await tryToken(urlToken);
      if (result) {
        setIsChecking(false);
        return;
      }
    }

    // 2. Check localStorage
    const savedToken = localStorage.getItem('larrys_token');
    if (savedToken) {
      const result = await tryToken(savedToken);
      if (result) {
        setIsChecking(false);
        return;
      }
    }

    // No valid token found
    setIsChecking(false);
  };

  const tryToken = async (token) => {
    try {
      const result = await verifyToken(token);
      if (result.valid) {
        setToken(token);
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      // Token invalid or server error
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!tokenInput.trim()) {
      setError('Bitte gib einen Zugriffstoken ein.');
      return;
    }

    const result = await tryToken(tokenInput.trim());
    if (!result) {
      setError('Ungültiger Token. Bitte überprüfe deinen Zugangslink.');
    }
  };

  // Show loading while checking token
  if (isChecking) {
    return (
      <div className="login-gate">
        <div className="login-card">
          <div className="login-logo">
            <span className="logo-text">Larry's</span>
            <div className="logo-stars">★ ★ ★</div>
          </div>
          <div className="login-checking">
            <div className="login-spinner"></div>
            <span>Zugang wird überprüft...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="login-gate">
        <div className="login-card">
          <div className="login-logo">
            <span className="logo-text">Larry's</span>
            <div className="logo-stars">★ ★ ★</div>
          </div>
          <h2>Zugang zum Marketplace</h2>
          <p>
            Verwende deinen persönlichen Zugangslink oder gib den Token manuell ein.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="token-input-wrapper">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Zugriffstoken eingeben..."
                autoFocus
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-btn">
              Zugang bestätigen
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated — render the app
  return children;
};

export default LoginGate;
