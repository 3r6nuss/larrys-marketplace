import './Header.css';

const Header = ({ currentView, setCurrentView }) => {
  return (
    <header className="header glass">
      <div className="container header-content">
        <div className="logo-container" onClick={() => setCurrentView('marketplace')} style={{ cursor: 'pointer' }}>
          <div className="logo-badge">
            <span className="logo-text">Larry's</span>
            <div className="logo-stars">★ ★ ★</div>
          </div>
        </div>
        <nav className="nav-links">
          <button 
            className={`nav-link-btn ${currentView === 'marketplace' ? 'active' : ''}`}
            onClick={() => setCurrentView('marketplace')}
          >
            Marktplatz
          </button>
          <button 
            className={`nav-link-btn ${currentView === 'employees' ? 'active' : ''}`}
            onClick={() => setCurrentView('employees')}
          >
            Mitarbeiter
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
