import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  MapPin,
  ShoppingCart,
  Trash2,
  ChevronRight,
  Ticket,
  CheckCircle2
} from 'lucide-react';

const EVENT_INFO = {
  title: 'Forró do IASC 2026',
  date: 'Sexta, 15 de Maio de 2026 • 19:00',
  location: 'Eunápolis - BA',
  maxTickets: 10
};

const TOTAL_ROWS = 20;
const TOTAL_COLS = 12;

const getBlockForPosition = (row, col) => {
  if (row >= 1 && row <= 5 && col >= 1 && col <= 12) return 1;
  if (row >= 6 && row <= 10 && col >= 3 && col <= 12) return 2;
  if (row >= 11 && row <= 15 && col >= 3 && col <= 4) return 3;
  if (row >= 11 && row <= 20 && col >= 11 && col <= 12) return 4;
  return null;
};

export default function App() {
  const [dbSeats, setDbSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSeats();
  }, []);

  const fetchSeats = async () => {
    try {
      const res = await axios.get('http://localhost/reserva-forroiasc/backend/listar_assentos.php');
      if (res.data.success) {
        setDbSeats(res.data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar mesas do banco", error);
    }
  };

  const handleSeatClick = (seat) => {
    if (seat.status !== 'livre') return;

    const isSelected = selectedSeats.some(s => s.id === seat.id);

    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= EVENT_INFO.maxTickets) {
        alert(`Você só pode selecionar até ${EVENT_INFO.maxTickets} assento(s) por vez.`);
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const handleRemoveSeat = (seatId) => {
    setSelectedSeats(selectedSeats.filter(s => s.id !== seatId));
  };

  const totalPrice = selectedSeats.reduce((acc, seat) => acc + parseFloat(seat.preco), 0);

  const handleCheckout = async () => {
    if (selectedSeats.length === 0) return;

    const cliente_nome = prompt("Digite seu nome completo para a reserva:");
    const cliente_email = prompt("Digite seu e-mail:");

    if (!cliente_nome || !cliente_email) {
      alert("Nome e e-mail são obrigatórios para prosseguir.");
      return;
    }

    setLoading(true);

    try {
      const assentosParaComprar = selectedSeats.map(seat => ({
        id: seat.dbId,
        numero_assento: seat.numero_assento_real,
        preco: seat.preco
      }));

      const res = await axios.post('http://localhost/reserva-forroiasc/backend/gerar_link_pagamento.php', {
        assentos: assentosParaComprar,
        valor_total: totalPrice,
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

  const renderGrid = () => {
    const gridRows = [];
    let numeroMesaDB = 1;

    for (let r = 1; r <= TOTAL_ROWS; r++) {
      const rowLabel = String.fromCharCode(64 + r);
      const cols = [];
      let hasSeatsInRow = false;

      for (let c = 1; c <= TOTAL_COLS; c++) {
        const blockId = getBlockForPosition(r, c);

        if (blockId !== null) {
          hasSeatsInRow = true;

          const currentMesa = numeroMesaDB;
          const dbSeatData = dbSeats.find(s => {
            if (!s.numero_assento) return false;
            return parseInt(String(s.numero_assento).replace(/\D/g, ''), 10) === currentMesa;
          });

          const seat = {
            id: `${rowLabel}${c}`,
            row: rowLabel,
            col: c,
            dbId: dbSeatData?.id || `temp-${currentMesa}`,
            numero_assento_real: dbSeatData?.numero_assento || `Mesa ${currentMesa}`,
            status: dbSeatData?.status || 'livre',
            preco: dbSeatData?.preco || 10.00
          };

          const isSelected = selectedSeats.some(s => s.id === seat.id);
          const isVendido = seat.status === 'vendido';
          const isBloqueado = seat.status === 'bloqueado' || seat.status === 'reservado';
          const isOccupied = isVendido || isBloqueado;

          let btnClass = "w-8 h-8 sm:w-10 sm:h-10 rounded-t-lg rounded-b-sm transition-all duration-200 flex items-center justify-center text-[10px] sm:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 relative group ";

          if (isVendido) {
            btnClass += "bg-red-500 border-2 border-red-600 text-white cursor-not-allowed shadow-inner";
          } else if (isBloqueado) {
            btnClass += "bg-yellow-400 border-2 border-yellow-500 text-yellow-900 cursor-not-allowed animate-pulse";
          } else if (isSelected) {
            btnClass += "bg-emerald-500 border-2 border-emerald-600 text-white shadow-md transform scale-110 z-10 focus:ring-emerald-500";
          } else {
            // LIVRE: Ghost Cinza que ganha um tom verde sutil no hover
            btnClass += "bg-white border-2 border-gray-300 text-gray-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-sm cursor-pointer";
          }

          cols.push(
            <div key={`cell-${r}-${c}`} className="flex items-center justify-center">
              <button
                className={btnClass}
                onClick={() => handleSeatClick(seat)}
                disabled={isOccupied}
                aria-label={`Assento ${seat.id}`}
              >
                {isSelected ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : seat.col}

                {!isSelected && !isOccupied && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg whitespace-nowrap font-normal">
                    {seat.numero_assento_real}
                    <br />
                    <span className="font-semibold text-emerald-400">R$ {parseFloat(seat.preco).toFixed(2)}</span>
                  </div>
                )}
              </button>
            </div>
          );

          numeroMesaDB++;
        } else {
          cols.push(<div key={`empty-${r}-${c}`} className="w-8 h-8 sm:w-10 sm:h-10"></div>);
        }
      }

      if (hasSeatsInRow) {
        gridRows.push(
          <React.Fragment key={`frag-${rowLabel}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 text-center font-bold text-gray-400 text-sm select-none">{rowLabel}</div>
              <div className="flex gap-2">
                {cols}
              </div>
              <div className="w-6 text-center font-bold text-gray-400 text-sm select-none">{rowLabel}</div>
            </div>

            {rowLabel === 'E' && (
              <div className="w-full h-8 sm:h-12 flex items-center justify-center relative my-2">
                <div className="w-full border-t border-dashed border-gray-300"></div>
                <span className="absolute bg-white px-4 text-[10px] sm:text-xs text-gray-400 uppercase tracking-widest font-bold">
                  Corredor de Circulação
                </span>
              </div>
            )}
          </React.Fragment>
        );
      }
    }

    return gridRows;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-2xl tracking-tighter">
            <Ticket className="w-8 h-8" />
            <span>Reserva IASC</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-0 sm:px-6 lg:px-8 py-6 flex flex-col xl:flex-row gap-6">

        <div className="flex-1 bg-white sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">

          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{EVENT_INFO.title}</h1>
            <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" />{EVENT_INFO.date}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" />{EVENT_INFO.location}</div>
            </div>
          </div>

          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-6 items-center text-sm font-semibold text-gray-700">
            {/* LEGENDA: Ghost Cinza */}
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-white border-2 border-gray-300"></div> Livre</span>
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-500 shadow-sm border border-emerald-600"></div> Selecionado</span>
            <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-yellow-400 border border-yellow-500"></div> Reservado</span>
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500 border border-red-600 shadow-inner"></div> Vendido</span>
          </div>

          <div className="p-6 overflow-x-auto relative flex-1 custom-scrollbar">
            <div className="min-w-fit mx-auto pb-8 flex flex-col items-center">
              <div className="w-[400px] h-16 mb-8 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-200 to-transparent rounded-b-[100px] border-b-4 border-gray-300"></div>
                <span className="relative font-bold tracking-[0.2em] text-gray-500 uppercase text-sm">Palco Principal</span>
              </div>

              <div className="flex flex-col gap-2">
                {renderGrid()}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-96 flex flex-col gap-4">
          <div className="bg-white sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col sticky top-24">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Resumo da Reserva
              </h2>
            </div>

            <div className="p-5 flex-1 min-h-[200px] flex flex-col">
              {selectedSeats.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-8">
                  <Ticket className="w-12 h-12 mb-3 opacity-20" />
                  <p>Nenhum assento selecionado.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-center mb-2 text-sm text-gray-500 font-medium">
                    <span>{selectedSeats.length} assento(s)</span>
                    <span>Máx {EVENT_INFO.maxTickets}</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                    {selectedSeats.map(seat => (
                      <div key={`cart-${seat.id}`} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100 group">
                        <div>
                          <div className="font-bold text-gray-900 text-sm">Assento {seat.id}</div>
                          <div className="text-xs text-gray-500">{seat.numero_assento_real}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">R$ {parseFloat(seat.preco).toFixed(2)}</span>
                          <button onClick={() => handleRemoveSeat(seat.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-100 sm:rounded-b-2xl">
              <div className="flex justify-between items-end mb-4">
                <span className="text-gray-600 font-medium">Total</span>
                <div className="text-right">
                  <div className="text-3xl font-black text-gray-900">
                    <span className="text-lg font-bold text-gray-500 mr-1">R$</span>
                    {totalPrice.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={selectedSeats.length === 0 || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between group shadow-sm"
              >
                <span>{loading ? 'Processando...' : 'Ir para pagamento'}</span>
                {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}