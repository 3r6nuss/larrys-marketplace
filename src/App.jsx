import { useState } from 'react';
import { mockCars as initialCars } from './data/mockCars';
import Header from './components/Header';
import CarCard from './components/CarCard';
import AddCarDialog from './components/AddCarDialog';
import { categories } from './data/mockCars';
import './App.css';

function App() {
  const [cars, setCars] = useState(initialCars);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState('marketplace');
  const [selectedCarForTicket, setSelectedCarForTicket] = useState(null);
  
  // Filters
  const [sellerFilter, setSellerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');

  const handleAddCar = (newCar) => {
    setCars([newCar, ...cars]);
  };

  const handleTicketClick = (car) => {
    setSelectedCarForTicket(car);
    setCurrentView('ticket');
  };

  if (currentView === 'ticket') {
    return (
      <div className="app">
        <Header />
        <main className="container ticket-page">
          <div className="ticket-content glass">
            <h2>🎫 Support-Ticket erstellen</h2>
            <p className="ticket-info">
              Fahrzeug: <strong>{selectedCarForTicket?.brand} {selectedCarForTicket?.model}</strong><br />
              Kennzeichen: <strong>{selectedCarForTicket?.plate}</strong>
            </p>
            <div className="ticket-placeholder">
              <p>Hier würde man ein neues Ticket bei euch erstellen.</p>
              <div className="placeholder-animation"></div>
            </div>
            <button className="btn-primary" onClick={() => setCurrentView('marketplace')}>
              Zurück zum Marketplace
            </button>
          </div>
        </main>
      </div>
    );
  }

  const uniqueSellers = Array.from(new Set(cars.map(c => c.seller))).filter(Boolean);

  // Apply filters and sort
  let displayedCars = [...cars];
  
  if (sellerFilter) {
    displayedCars = displayedCars.filter(car => car.seller === sellerFilter);
  }
  if (categoryFilter) {
    displayedCars = displayedCars.filter(car => car.category === categoryFilter);
  }
  
  if (sortOption === 'price_asc') {
    displayedCars.sort((a,b) => a.price - b.price);
  } else if (sortOption === 'price_desc') {
    displayedCars.sort((a,b) => b.price - a.price);
  } else if (sortOption === 'newest') {
    displayedCars.sort((a,b) => b.id - a.id);
  }

  return (
    <div className="app">
      <Header />
      
      <main className="container marketplace-container">
        
        <div className="controls-bar">
          <div className="filters-wrapper">
            <div className="filter-group">
              <label>Verkäufer</label>
              <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
                <option value="">Alle</option>
                {uniqueSellers.map(seller => (
                  <option key={seller} value={seller}>{seller}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Kategorie</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Alle Klassen</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Sortierung</label>
              <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                <option value="newest">Neueste zuerst</option>
                <option value="price_desc">Preis: Hoch zu Niedrig</option>
                <option value="price_asc">Preis: Niedrig zu Hoch</option>
              </select>
            </div>
          </div>
          
          <div className="action-group">
            <span className="car-count">
              {displayedCars.length} Ergebnisse
            </span>
            <button className="btn-add" onClick={() => setIsDialogOpen(true)}>
              + Neues Inserat
            </button>
          </div>
        </div>
        
        {displayedCars.length > 0 ? (
          <div className="car-grid">
            {displayedCars.map(car => (
              <CarCard key={car.id} car={car} onTicketClick={handleTicketClick} />
            ))}
          </div>
        ) : (
          <div className="no-results glass">
            <p>Keine Fahrzeuge für diese Kriterien gefunden.</p>
            <button className="btn-secondary" onClick={() => {
              setSellerFilter('');
              setCategoryFilter('');
            }}>Filter zurücksetzen</button>
          </div>
        )}
      </main>

      <AddCarDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        onAdd={handleAddCar} 
      />
    </div>
  )
}

export default App;
