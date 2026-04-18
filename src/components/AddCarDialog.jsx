import { useState, useEffect } from 'react';
import { categories, tuningParts } from '../data/mockCars';
import './AddCarDialog.css';

const AddCarDialog = ({ isOpen, onClose, onAdd, defaultUser }) => {
  const [formData, setFormData] = useState({
    seller: '',
    brand: '',
    model: '',
    plate: '',
    phone: '',
    price: '',
    category: '',
    status: 'available',
    tuning: [],
    imageFile: null,
    imagePreview: null
  });
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ 
        seller: defaultUser?.name || '', 
        brand: '', 
        model: '', 
        plate: '', 
        phone: defaultUser?.phone || '', 
        price: '', 
        category: '', 
        status: 'available', 
        tuning: [], 
        imageFile: null,
        imagePreview: null
      });
      setIsDragActive(false);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultUser]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTuningChange = (key) => {
    const isSelected = formData.tuning.includes(key);
    const newTuning = isSelected
      ? formData.tuning.filter(k => k !== key)
      : [...formData.tuning, key];
    setFormData(prev => ({ ...prev, tuning: newTuning }));
  };

  const handleImageFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      // Store the actual File object for upload
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ 
          ...prev, 
          imageFile: file,
          imagePreview: event.target.result 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        handleImageFile(items[i].getAsFile());
        break;
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Build FormData for multipart upload
    const fd = new FormData();
    fd.append('seller', formData.seller);
    fd.append('brand', formData.brand);
    fd.append('model', formData.model);
    fd.append('plate', formData.plate);
    fd.append('phone', formData.phone);
    
    // Parse price
    const numericPrice = parseInt(formData.price.replace(/[^0-9]/g, ''), 10) || 0;
    fd.append('price', numericPrice.toString());
    
    const priceLabel = formData.price.includes('$') || formData.price.toLowerCase().includes('auf anfrage')
      ? formData.price
      : `$ ${formData.price}`;
    fd.append('price_label', priceLabel);
    
    fd.append('category', formData.category);
    fd.append('status', formData.status);
    fd.append('tuning', JSON.stringify(formData.tuning));
    
    if (formData.imageFile) {
      fd.append('image', formData.imageFile);
    }

    try {
      await onAdd(fd);
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dialog-overlay">
      <div 
        className="dialog-content glass" 
        onPaste={handlePaste}
      >
        <h2>Fahrzeug inserieren</h2>
        
        <form onSubmit={handleSubmit}>
          
          <div 
            className={`image-paste-area ${isDragActive ? 'active' : ''} ${formData.imagePreview ? 'has-image' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            tabIndex={0}
          >
            {formData.imagePreview ? (
              <img src={formData.imagePreview} alt="Preview" className="image-preview" />
            ) : (
              <p>📸 Bild hierher ziehen oder <strong>Strg+V / Cmd+V</strong> drücken, um es aus der Zwischenablage einzufügen</p>
            )}
          </div>

          <div className="form-group row">
            <div className="input-group">
              <label>Kategorie</label>
              <select name="category" value={formData.category} onChange={handleChange} required>
                <option value="">Wählen...</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="available">Verfügbar</option>
                <option value="reserved">Reserviert</option>
                <option value="sold">Verkauft</option>
              </select>
            </div>
          </div>

          <div className="form-group row">
            <div className="input-group">
              <label>Marke</label>
              <input name="brand" value={formData.brand} onChange={handleChange} placeholder="z.B. Pegassi" required />
            </div>
            <div className="input-group">
              <label>Modell</label>
              <input name="model" value={formData.model} onChange={handleChange} placeholder="z.B. Toros" required />
            </div>
          </div>
          
          <div className="form-group row">
            <div className="input-group">
              <label>Preis</label>
              <input name="price" value={formData.price} onChange={handleChange} placeholder="z.B. 150,000" required />
            </div>
            <div className="input-group">
              <label>Kennzeichen</label>
              <input name="plate" value={formData.plate} onChange={handleChange} placeholder="z.B. GEB 385" required />
            </div>
          </div>

          <div className="form-group row">
            <div className="input-group">
              <label>Verkäufer Name</label>
              <input name="seller" value={formData.seller} onChange={handleChange} placeholder="Dein Name" required />
            </div>
            <div className="input-group">
              <label>Telefonnummer</label>
              <input name="phone" value={formData.phone} onChange={handleChange} placeholder="z.B. 661944" required />
            </div>
          </div>

          <div className="form-group">
            <label>Tuning Bauteile</label>
            <div className="tuning-checkboxes">
              {Object.entries(tuningParts).map(([key, part]) => (
                <label key={key} className={`tuning-checkbox ${formData.tuning.includes(key) ? 'active' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={formData.tuning.includes(key)} 
                    onChange={() => handleTuningChange(key)}
                  />
                  <div className="tuning-icon-wrapper-small">
                    <img src={part.logo_url} alt={part.label} />
                  </div>
                  <span>{part.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert...' : 'Inserat speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCarDialog;
