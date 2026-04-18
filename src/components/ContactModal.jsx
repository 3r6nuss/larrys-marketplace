import './ContactModal.css';

const ContactModal = ({ isOpen, onClose, car, onTicketClick }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Kontakt aufnehmen</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="contact-options">
          <button className="contact-option-btn ticket-btn" onClick={() => {
            onTicketClick();
            onClose();
          }}>
            <div className="option-icon">🎫</div>
            <div className="option-text">
              <span className="option-title">Ticket erstellen</span>
              <span className="option-desc">Eröffne ein Support-Ticket für dieses Fahrzeug.</span>
            </div>
          </button>

          <div className="contact-option-btn phone-display">
            <div className="option-icon">📞</div>
            <div className="option-text">
              <span className="option-title">Telefonisch kontaktieren</span>
              <span className="option-desc">Rufe den Verkäufer direkt an: {car.phone}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
