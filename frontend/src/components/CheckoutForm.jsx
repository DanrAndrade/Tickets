import React, { useState } from 'react';
import axios from 'axios';

const CheckoutForm = ({ selectedSeat }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSeat) {
      alert('Por favor, selecione um assento primeiro.');
      return;
    }

    try {
      // Mock API call simulation
      alert(`Redirecionando para pagamento de ${nome} (${email}) - Assento ${selectedSeat.numero_assento}`);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar link de pagamento.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
      <h3>Checkout</h3>
      {selectedSeat && <p>Assento selecionado: {selectedSeat.numero_assento} - R$ {selectedSeat.preco}</p>}
      
      <input 
        type="text" 
        placeholder="Seu Nome" 
        value={nome} 
        onChange={(e) => setNome(e.target.value)} 
        required 
        style={{ padding: '8px' }}
      />
      <input 
        type="email" 
        placeholder="Seu E-mail" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        required 
        style={{ padding: '8px' }}
      />
      
      <button type="submit" disabled={!selectedSeat} style={{ padding: '10px', backgroundColor: '#2196F3', color: '#fff', border: 'none', cursor: 'pointer' }}>
        Comprar
      </button>
    </form>
  );
};

export default CheckoutForm;
