import { useState } from 'react';
import './StaffManagement.css';

const StaffManagement = ({ employees, onAddEmployee, defaultUserId, onSetDefaultUser }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newName || !newRole) return;

    onAddEmployee({
      id: Date.now(),
      name: newName,
      role: newRole,
      phone: newPhone
    });

    setNewName('');
    setNewRole('');
    setNewPhone('');
    setShowAddForm(false);
  };

  return (
    <div className="staff-management glass">
      <div className="staff-header">
        <h2>👥 Mitarbeiter-Verwaltung</h2>
        <button className="btn-add" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Abbrechen' : '+ Mitarbeiter hinzufügen'}
        </button>
      </div>

      {showAddForm && (
        <form className="add-staff-form glass-sub" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Name</label>
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder="z.B. Larry Wheels"
              required 
            />
          </div>
          <div className="input-group">
            <label>Rolle</label>
            <input 
              type="text" 
              value={newRole} 
              onChange={(e) => setNewRole(e.target.value)} 
              placeholder="z.B. Verkäufer"
              required 
            />
          </div>
          <div className="input-group">
            <label>Telefon</label>
            <input 
              type="text" 
              value={newPhone} 
              onChange={(e) => setNewPhone(e.target.value)} 
              placeholder="555-0123"
            />
          </div>
          <button type="submit" className="btn-primary">Speichern</button>
        </form>
      )}

      <div className="staff-list">
        {employees.map(emp => (
          <div key={emp.id} className={`staff-card ${defaultUserId === emp.id ? 'is-default' : ''}`}>
            <div className="staff-info">
              <span className="staff-name">{emp.name}</span>
              <span className="staff-role">{emp.role}</span>
              {emp.phone && <span className="staff-phone">📞 {emp.phone}</span>}
            </div>
            <div className="staff-actions">
              {defaultUserId === emp.id ? (
                <span className="default-badge">✓ Standard-Nutzer</span>
              ) : (
                <button 
                  className="btn-outline" 
                  onClick={() => onSetDefaultUser(emp.id)}
                >
                  Als Standard setzen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffManagement;
