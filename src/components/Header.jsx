import './Header.css';

const Header = () => {
  return (
    <header className="header glass">
      <div className="container header-content">
        <div className="logo-container">
          <div className="logo-badge">
            <span className="logo-text">Larry's</span>
            <div className="logo-stars">★ ★ ★</div>
          </div>
        </div>
        <nav className="nav-links">
          <a href="#" className="nav-link active">Marktplatz</a>
          <a href="#" className="nav-link">Kontakt</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
