import { useState } from 'react';
import { tuningParts } from '../data/mockCars';
import ContactModal from './ContactModal';
import './CarCard.css';

const CarCard = ({ car, onTicketClick }) => {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div className={`car-card glass ${car.status !== 'available' ? 'card-inactive' : ''}`}>
      <div className="car-image-container">
        <img 
          src={car.image} 
          alt={`${car.brand} ${car.model}`} 
          className={`car-image ${car.status !== 'available' ? 'dimmed' : ''}`} 
        />
        
        {car.status === 'sold' && <div className="status-overlay sold">VERKAUFT</div>}
        {car.status === 'reserved' && <div className="status-overlay reserved">RESERVIERT</div>}
        
        <div className="car-badge glass">
          <span className="car-brand">{car.brand}</span>
          <span className="car-model">{car.model}</span>
        </div>
      </div>
      
      <div className="car-details">
        <div className="price-tag">
          {car.priceLabel}
          <span className="category-tag">{car.category}</span>
        </div>
        
        {car.tuning && car.tuning.length > 0 && (
          <div className="tuning-section">
            <span className="tuning-label">AUSSTATTUNG:</span>
            <div className="tuning-icons">
              {car.tuning.map(partKey => {
                const part = tuningParts[partKey];
                if (!part) return null;
                return (
                  <div key={partKey} className="tuning-icon-wrapper" title={part.label}>
                    <img src={part.logo_url} alt={part.label} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Verkäufer</span>
            <span className="detail-value">{car.seller}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Kennzeichen</span>
            <span className="detail-value plate">{car.plate}</span>
          </div>
        </div>

        <div className="card-actions">
          <button className="btn-contact" onClick={() => setIsContactOpen(true)}>
            <span className="phone-icon">✉️</span>
            Verkäufer kontaktieren
          </button>
        </div>
      </div>

      <ContactModal 
        isOpen={isContactOpen} 
        onClose={() => setIsContactOpen(false)} 
        car={car}
        onTicketClick={() => onTicketClick(car)}
      />
    </div>
  );
};

export default CarCard;
