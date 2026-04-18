import './Hero.css';

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-overlay"></div>
      <div className="container hero-content">
        <h1 className="hero-title">
          Finde deinen <span className="text-primary">Traumwagen</span>
        </h1>
        <p className="hero-subtitle">
          Der offizielle Gebrauchtwagen-Marktplatz von Larry's in Los Santos. Exklusive Fahrzeuge, faire Preise.
        </p>
      </div>
    </section>
  );
};

export default Hero;
