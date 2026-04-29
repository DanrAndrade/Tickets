import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SeatMap = () => {
  const [seats, setSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSeats();
  }, []);

  const fetchSeats = async () => {
    try {
      // URL corrigida apontando para o seu diretório real no htdocs
      const res = await axios.get('http://localhost/reserva-forroiasc/backend/listar_assentos.php');
      if (res.data.success) {
        setSeats(res.data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar mesas", error);
    }
  };

  const handleBooking = async () => {
    if (!selectedSeat) {
      alert("Selecione uma mesa primeiro.");
      return;
    }

    const cliente_nome = prompt("Digite seu nome completo:");
    const cliente_email = prompt("Digite seu e-mail:");

    if (!cliente_nome || !cliente_email) {
      alert("Nome e e-mail são obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      // URL corrigida
      const res = await axios.post('http://localhost/reserva-forroiasc/backend/gerar_link_pagamento.php', {
        assento_id: selectedSeat.id,
        numero_assento: selectedSeat.numero_assento,
        preco: selectedSeat.preco,
        cliente_nome,
        cliente_email
      });

      if (res.data.success) {
        window.location.href = res.data.payment_url;
      }
    } catch (err) {
      alert(err.response?.data?.message || "Erro ao processar reserva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Reserva de Mesas</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        {seats.map(seat => {
          let bgColor = '#fff';
          if (seat.status === 'vendido') bgColor = '#ff4d4d';
          if (seat.status === 'bloqueado') bgColor = '#ffd633';
          if (selectedSeat?.id === seat.id) bgColor = '#4CAF50';

          return (
            <div
              key={seat.id}
              onClick={() => seat.status === 'livre' && setSelectedSeat(seat)}
              style={{
                width: '80px',
                height: '80px',
                backgroundColor: bgColor,
                border: '1px solid #333',
                borderRadius: '8px',
                cursor: seat.status === 'livre' ? 'pointer' : 'not-allowed',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <strong>{seat.numero_assento}</strong>
              <span style={{ fontSize: '12px' }}>R$ {seat.preco}</span>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button
          onClick={handleBooking}
          disabled={loading || !selectedSeat}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: selectedSeat ? '#000' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedSeat ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'Processando...' : 'Reservar e Pagar'}
        </button>
      </div>
    </div>
  );
};

export default SeatMap;