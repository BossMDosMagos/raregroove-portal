import React from 'react';

export default function Maintenance() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      backgroundColor: '#050505', 
      color: '#fff',
      textAlign: 'center',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <img 
        src="/img/LogoRareGroove.png" 
        alt="Rare Groove" 
        style={{ height: '80px', marginBottom: '20px' }} 
      />
      <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#D4AF37', textTransform: 'uppercase', fontWeight: 'bold' }}>
        Sintonizando Frequências...
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#ccc', maxWidth: '500px' }}>
        O Portal Rare Groove está passando por ajustes finos. Voltamos em breve!
      </p>
      <div style={{ marginTop: '30px', fontSize: '0.8rem', color: '#666', letterSpacing: '2px' }}>
        SYSTEM MAINTENANCE
      </div>
    </div>
  );
}
