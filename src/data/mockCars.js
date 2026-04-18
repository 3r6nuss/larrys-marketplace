export const tuningParts = {
  awd: { label: 'Allradantrieb', logo_url: '/icons/tuning/awd.png' },
  slick: { label: 'Slick Reifen', logo_url: '/icons/tuning/slick.png' },
  semislick: { label: 'Semislick Reifen', logo_url: '/icons/tuning/semislick.png' },
  race_brakes: { label: 'Rennbremsen', logo_url: '/icons/tuning/race_brakes.png' }
};

export const categories = ['Sport', 'SUV', 'Muscle', 'Klassiker', 'Kompakt', 'Offroad'];

export const mockCars = [
  {
    id: 1,
    seller: 'Marco Steiner',
    brand: 'Pegassi',
    model: 'Toros CTX',
    plate: 'GEB 385',
    phone: '661944',
    price: 185000,
    priceLabel: '$ 185,000',
    category: 'SUV',
    status: 'available',
    tuning: ['awd', 'semislick'],
    image: '/mockups/sport.png'
  },
  {
    id: 2,
    seller: 'Anna Miller',
    brand: 'Obey',
    model: 'Sport GT',
    plate: 'JTS 349',
    phone: '445102',
    price: 320000,
    priceLabel: '$ 320,000',
    category: 'Sport',
    status: 'reserved',
    tuning: ['slick', 'race_brakes'],
    image: '/mockups/suv.png'
  },
  {
    id: 3,
    seller: 'Larry Dealership',
    brand: 'Vapid',
    model: 'Dominator ASP',
    plate: 'LRY 001',
    phone: '555123',
    price: 85000,
    priceLabel: '$ 85,000',
    category: 'Muscle',
    status: 'sold',
    tuning: ['awd'],
    image: '/mockups/classic.png'
  },
  {
    id: 4,
    seller: 'John Doe',
    brand: 'Grotti',
    model: 'Itali RSX',
    plate: 'RX 999',
    phone: '123456',
    price: 2500000,
    priceLabel: '$ 2,500,000',
    category: 'Sport',
    status: 'available',
    tuning: ['awd', 'slick', 'race_brakes'],
    image: '/mockups/sport.png'
  }
];
