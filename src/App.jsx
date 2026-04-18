import { useState, useEffect, useCallback } from 'react';
import { fetchCars, fetchEmployees, createCar, createEmployee, setDefaultEmployee, deleteEmployee, deleteCar } from './api/api';
import { categories, tuningParts } from './data/mockCars';
import Header from './components/Header';
import CarCard from './components/CarCard';
import AddCarDialog from './components/AddCarDialog';
import StaffManagement from './components/StaffManagement';
import LoginGate from './components/LoginGate';
import './App.css';

function AppContent() {
  const [cars, setCars] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [defaultUserId, setDefaultUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState('marketplace');
  const [selectedCarForTicket, setSelectedCarForTicket] = useState(null);

  // Filters
  const [sellerFilter, setSellerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadCars = useCallback(async () => {
    try {
      const data = await fetchCars({
        seller: sellerFilter || undefined,
        category: categoryFilter || undefined,
        sort: sortOption,
      });
      // Map API fields to component-expected fields
      setCars(data.map(car => ({
        ...car,
        priceLabel: car.price_label,
        image: car.image_path || '/mockups/sport.png',
        tuning: car.tuning || [],
      })));
    } catch (err) {
      console.error('Failed to load cars:', err);
      setError('Fahrzeuge konnten nicht geladen werden.');
    }
  }, [sellerFilter, categoryFilter, sortOption]);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await fetchEmployees();
      setEmployees(data);
      const defaultEmp = data.find(e => e.is_default);
      if (defaultEmp) {
        setDefaultUserId(defaultEmp.id);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadCars(), loadEmployees()]);
      setIsLoading(false);
    };
    loadAll();
  }, [loadCars, loadEmployees]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddCar = async (formData) => {
    try {
      await createCar(formData);
      await loadCars(); // Refresh from DB
    } catch (err) {
      console.error('Failed to create car:', err);
      setError('Inserat konnte nicht erstellt werden.');
    }
  };

  const handleDeleteCar = async (carId) => {
    try {
      await deleteCar(carId);
      await loadCars();
    } catch (err) {
      console.error('Failed to delete car:', err);
    }
  };

  const handleTicketClick = (car) => {
    setSelectedCarForTicket(car);
    setCurrentView('ticket');
  };

  const handleAddEmployee = async (newEmp) => {
    try {
      await createEmployee(newEmp);
      await loadEmployees();
    } catch (err) {
      console.error('Failed to create employee:', err);
    }
  };

  const handleDeleteEmployee = async (empId) => {
    try {
      await deleteEmployee(empId);
      await loadEmployees();
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const handleSetDefaultUser = async (id) => {
    try {
      await setDefaultEmployee(id);
      setDefaultUserId(id);
      await loadEmployees();
    } catch (err) {
      console.error('Failed to set default user:', err);
    }
  };

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="app">
        <Header currentView={currentView} setCurrentView={setCurrentView} />
        <main className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ color: '#888', marginTop: '1rem' }}>Daten werden geladen...</p>
        </main>
      </div>
    );
  }

  // ─── Ticket View ───────────────────────────────────────────────────────────

  if (currentView === 'ticket') {
    return (
      <div className="app">
        <Header currentView={currentView} setCurrentView={setCurrentView} />
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

  // ─── Employee View ─────────────────────────────────────────────────────────

  if (currentView === 'employees') {
    return (
      <div className="app">
        <Header currentView={currentView} setCurrentView={setCurrentView} />
        <main className="container">
          <StaffManagement 
            employees={employees} 
            onAddEmployee={handleAddEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            defaultUserId={defaultUserId}
            onSetDefaultUser={handleSetDefaultUser}
          />
        </main>
      </div>
    );
  }

  // ─── Marketplace View ──────────────────────────────────────────────────────

  const uniqueSellers = Array.from(new Set(cars.map(c => c.seller))).filter(Boolean);

  return (
    <div className="app">
      <Header currentView={currentView} setCurrentView={setCurrentView} />
      
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
              {cars.length} Ergebnisse
            </span>
            <button className="btn-add" onClick={() => setIsDialogOpen(true)}>
              + Neues Inserat
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner glass">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        {cars.length > 0 ? (
          <div className="car-grid">
            {cars.map(car => (
              <CarCard key={car.id} car={car} onTicketClick={handleTicketClick} onDelete={handleDeleteCar} />
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
        defaultUser={employees.find(e => e.id === defaultUserId)}
      />
    </div>
  )
}

function App() {
  return (
    <LoginGate>
      <AppContent />
    </LoginGate>
  );
}

export default App;
