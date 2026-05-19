import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShoppingCart, Trash2, Ticket, CheckCircle2, User, Mail, ArrowLeft, IdCard, AlertCircle } from 'lucide-react';
import { EVENT_INFO, BRAND_COLOR, BRAND_COLOR_HOVER, getSessionId, API_BASE_URL } from '../constants';

const TOTAL_ROWS = 24;
const TOTAL_COLS = 20;

const getBlockForPosition = (row, col) => {
  // Block 1: 5 rows * 12 cols = 60 seats (Palco / Frente)
  if (row >= 1 && row <= 5 && col >= 9 && col <= 20) return 1;
  // Block 2: 5 rows * 10 cols = 50 seats (Quadra Coberta)
  if (row >= 6 && row <= 10 && col >= 11 && col <= 20) return 2;
  
  // Block 3: Area Externa Coberta - 30 seats
  // Retângulo alinhado ao lado da Quadra Coberta
  if (row >= 6 && row <= 10 && col >= 4 && col <= 9) return 3;
  
  // Block 4: 10 rows * 2 cols = 20 seats (Lateral Direita)
  if (row >= 11 && row <= 20 && col >= 19 && col <= 20) return 4;
  
  return null;
};

export default function SeatMapView({ onBack, showNotification }) {
  const [dbSeats, setDbSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteRA, setClienteRA] = useState('');
  const [aguardandoPagamento, setAguardandoPagamento] = useState(false);
  const sessionId = getSessionId();

  // Validação de RA via API
  const [raStatus, setRaStatus] = useState('idle'); // 'idle'|'checking'|'valid'|'invalid'|'api_error'
  const [raInfo, setRaInfo] = useState(null);
  const [raError, setRaError] = useState('');

  useEffect(() => {
    fetchSeats();
    const interval = setInterval(fetchSeats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchSeats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/listar_assentos.php`);
      if (res.data.success) {
        setDbSeats(res.data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar mesas", error);
    }
  };

  const handleRABlur = useCallback(async () => {
    const ra = clienteRA.trim();
    if (!ra || ra.length < 5) return;
    setRaStatus('checking');
    setRaInfo(null);
    setRaError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/validar_ra.php`, { ra });
      const d = res.data;
      if (d.success) {
        if (!d.no_ano_letivo) {
          setRaStatus('invalid');
          setRaError('Aluno sem matrícula ativa no ano letivo atual.');
        } else {
          setRaStatus('valid');
          setRaInfo(d);
        }
      } else if (d.api_status === 'api_error') {
        setRaStatus('api_error');
        setRaError(d.message);
      } else {
        setRaStatus('invalid');
        setRaError(d.message || 'RA não encontrado no sistema do IASC.');
      }
    } catch (err) {
      const d = err.response?.data;
      if (d?.api_status === 'api_error') {
        setRaStatus('api_error');
        setRaError(d.message);
      } else {
        setRaStatus('invalid');
        setRaError('Não foi possível validar o RA. Tente novamente.');
      }
    }
  }, [clienteRA]);

  const handleSeatClick = (seat) => {
    if ((seat.status === 'bloqueado' || seat.status === 'reservado') && seat.session_id !== sessionId) return;
    if (seat.status === 'vendido') return;

    const isSelected = selectedSeats.some(s => s.id === seat.id);

    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= EVENT_INFO.maxTickets) {
        showNotification(`Você só pode selecionar até ${EVENT_INFO.maxTickets} assento(s).`);
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

    if (!clienteRA.trim() || !clienteNome.trim() || !clienteEmail.trim()) {
      showNotification("Por favor, preencha seu RA, nome e e-mail no painel à direita antes de prosseguir.");
      return;
    }

    const nameRegex = /^[a-zA-ZÀ-ÿ0-9\s'\-\.]+$/;
    if (!nameRegex.test(clienteNome.trim())) {
      showNotification("O nome deve conter apenas letras, espaços e hífens.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clienteEmail.trim())) {
      showNotification("Por favor, insira um endereço de e-mail válido.");
      return;
    }

    setLoading(true);

    try {
      const assentosParaComprar = selectedSeats.map(seat => ({
        id: seat.dbId,
        numero_assento: seat.numero_assento_real,
        preco: seat.preco
      }));

      const res = await axios.post(`${API_BASE_URL}/gerar_link_pagamento.php`, {
        tipo: 'mesa',
        assentos: assentosParaComprar,
        valor_total: totalPrice,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        cliente_ra: clienteRA,
        session_id: sessionId
      });

      if (res.data.success) {
        window.open(res.data.payment_url, '_blank');
        setAguardandoPagamento(true);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || "Erro ao processar reserva.");
    } finally {
      setLoading(false);
    }
  };

  const concluirReserva = () => {
    setAguardandoPagamento(false);
    setSelectedSeats([]);
    setClienteNome('');
    setClienteEmail('');
    setClienteRA('');
    setRaStatus('idle');
    setRaInfo(null);
    setRaError('');
    fetchSeats();
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
          // Busca pelo índice posicional (banco já retorna ORDER BY id ASC)
          // Isso é mais confiável que parsear o número do texto "numero_assento"
          const dbSeatData = dbSeats[currentMesa - 1];

          const seat = {
            id: currentMesa.toString(),
            row: rowLabel,
            col: c,
            dbId: dbSeatData?.id,
            numero_assento_real: dbSeatData?.numero_assento || `Mesa ${currentMesa}`,
            status: dbSeatData?.status || 'livre',
            preco: dbSeatData?.preco || 10.00,
            session_id: dbSeatData?.session_id
          };

          const isSelected = selectedSeats.some(s => s.id === seat.id);
          const isVendido = seat.status === 'vendido';
          const isBloqueadoPorOutro = (seat.status === 'bloqueado' || seat.status === 'reservado') && seat.session_id !== sessionId;
          const isOccupied = isVendido || isBloqueadoPorOutro;

          let btnClass = "w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 relative group ";

          if (isVendido) {
            btnClass += "bg-red-500 border-2 border-red-600 text-white cursor-not-allowed shadow-inner";
          } else if (isBloqueadoPorOutro) {
            btnClass += "bg-yellow-400 border-2 border-yellow-500 text-yellow-900 cursor-not-allowed animate-pulse";
          } else if (isSelected) {
            btnClass += "bg-emerald-500 border-2 border-emerald-600 text-white shadow-md transform scale-110 z-10 focus:ring-emerald-500";
          } else {
            btnClass += "bg-white border-2 border-gray-300 text-gray-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-sm cursor-pointer";
          }

          cols.push(
            <div key={`cell-${r}-${c}`} className="flex items-center justify-center">
              <button className={btnClass} onClick={() => handleSeatClick(seat)} disabled={isOccupied}>
                {isSelected ? <CheckCircle2 className="w-5 h-5" /> : currentMesa}
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
          cols.push(<div key={`empty-${r}-${c}`} className="w-9 h-9"></div>);
        }
      }

      if (hasSeatsInRow) {
        gridRows.push(
          <React.Fragment key={`frag-${rowLabel}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 text-center font-bold text-gray-400 text-sm select-none"></div>
              <div className="flex gap-2">{cols}</div>
              <div className="w-6 text-center font-bold text-gray-400 text-sm select-none"></div>
            </div>
            {rowLabel === 'E' && (
              <div className="w-full h-12 flex items-center justify-center relative my-2">
                <div className="w-full absolute border-t border-dashed border-gray-300"></div>
                <span className="absolute left-[32%] -translate-x-1/2 bg-white px-4 text-xs text-gray-400 uppercase tracking-widest font-bold whitespace-nowrap z-10">
                  Area Externa Coberta
                </span>
                <span className="absolute left-[77%] -translate-x-1/2 bg-white px-4 text-xs text-gray-400 uppercase tracking-widest font-bold whitespace-nowrap z-10">
                  Quadra Coberta
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
    <>
      {/* NOVO BOTÃO VOLTAR - Fundo Branco e Sombra */}
      <div className="w-full flex mb-2 sm:mb-6">
        <button
          onClick={onBack}
          className="bg-white text-gray-800 px-5 py-2.5 rounded-xl shadow-md font-bold flex items-center gap-2 hover:bg-gray-50 transition-all border border-gray-100"
        >
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* PAINEL DE RESERVA - HORIZONTAL NO TOPO */}
        <div className="w-full bg-white sm:rounded-2xl shadow-lg border border-gray-100 flex flex-col xl:flex-row overflow-hidden">
          {aguardandoPagamento ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4">
              <CheckCircle2 className="w-16 h-16 mb-4 animate-pulse" style={{ color: BRAND_COLOR }} />
              <h3 className="text-lg font-bold text-gray-900">Pagamento em Andamento</h3>
              <p className="text-sm text-gray-500 mt-2 mb-6 max-w-md mx-auto">
                A tela de pagamento foi aberta em uma nova aba. Suas mesas estão reservadas por 10 minutos.
              </p>
              <button onClick={concluirReserva} className="font-bold hover:underline transition-colors" style={{ color: BRAND_COLOR }}>
                Verificar Atualização / Voltar
              </button>
            </div>
          ) : (
            <>
              {/* Coluna 1: Carrinho */}
              <div className="flex-[1.5] p-5 border-b xl:border-b-0 xl:border-r border-gray-100 flex flex-col xl:max-h-[260px]">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" style={{ color: BRAND_COLOR }} />
                    Resumo da Reserva
                  </h2>
                  <div className="text-xs text-gray-500 font-medium">
                    {selectedSeats.length} / {EVENT_INFO.maxTickets} assentos
                  </div>
                </div>
                
                {selectedSeats.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-4">
                    <Ticket className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Nenhum assento selecionado.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
                    {selectedSeats.map(seat => (
                      <div key={`cart-${seat.id}`} className="flex justify-between items-center p-2 rounded-xl bg-gray-50 border border-gray-100">
                        <div>
                          <div className="font-bold text-gray-900 text-sm">Assento {seat.id}</div>
                          <div className="text-xs text-gray-500">{seat.numero_assento_real}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900 text-sm">R$ {parseFloat(seat.preco).toFixed(2)}</span>
                          <button onClick={() => handleRemoveSeat(seat.id)} className="text-gray-400 hover:text-red-500 p-1 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna 2: Dados do Usuário */}
              <div className="flex-1 p-5 border-b xl:border-b-0 xl:border-r border-gray-100 flex flex-col justify-center">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Seus Dados</h3>
                <div className="flex flex-col gap-3">
                  {/* RA com validação */}
                  <div>
                    <div className="relative">
                      <IdCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Registro Acadêmico do Aluno"
                        value={clienteRA}
                        onChange={(e) => { setClienteRA(e.target.value.replace(/\D/g, '')); setRaStatus('idle'); setRaInfo(null); setRaError(''); }}
                        onBlur={handleRABlur}
                        className="w-full pl-9 pr-8 py-2 border rounded-xl focus:ring-2 focus:outline-none text-sm transition-all"
                        style={{
                          borderColor: raStatus === 'valid' ? '#22c55e' : raStatus === 'invalid' ? '#ef4444' : raStatus === 'api_error' ? '#f59e0b' : '#e5e7eb',
                          '--tw-ring-color': BRAND_COLOR
                        }}
                      />
                      {raStatus === 'checking' && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />}
                      {raStatus === 'valid' && <CheckCircle2 className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-green-500" />}
                      {raStatus === 'invalid' && <AlertCircle className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-red-500" />}
                      {raStatus === 'api_error' && <AlertCircle className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-amber-500" />}
                    </div>
                    {raStatus === 'valid' && raInfo && (
                      <p className="text-[10px] text-green-600 font-medium mt-0.5 px-1">✓ {raInfo.nome} — {raInfo.unidade_descricao}</p>
                    )}
                    {raStatus === 'invalid' && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5 px-1">⚠ {raError}</p>
                    )}
                    {raStatus === 'api_error' && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5 px-1">⚠ Serviço instável. Continue mesmo assim.</p>
                    )}
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nome do Comprador"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none text-sm transition-all"
                      style={{ '--tw-ring-color': BRAND_COLOR }}
                    />
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      placeholder="E-mail do Comprador"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none text-sm transition-all"
                      style={{ '--tw-ring-color': BRAND_COLOR }}
                    />
                  </div>
                </div>
              </div>

              {/* Coluna 3: Total e Checkout */}
              <div className="w-full xl:w-72 p-5 bg-gray-50 flex flex-col justify-center">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-gray-600 font-medium text-sm">Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-gray-900">
                      <span className="text-base font-bold text-gray-500 mr-1">R$</span>
                      {totalPrice.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={selectedSeats.length === 0 || loading || !clienteNome.trim() || !clienteEmail.trim() || !clienteRA.trim()}
                  className="w-full text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: (selectedSeats.length === 0 || loading || !clienteNome.trim() || !clienteEmail.trim() || !clienteRA.trim()) ? '#cbd5e1' : BRAND_COLOR }}
                  onMouseEnter={(e) => { if (!(selectedSeats.length === 0 || loading || !clienteNome.trim() || !clienteEmail.trim() || !clienteRA.trim())) e.currentTarget.style.backgroundColor = BRAND_COLOR_HOVER; }}
                  onMouseLeave={(e) => { if (!(selectedSeats.length === 0 || loading || !clienteNome.trim() || !clienteEmail.trim() || !clienteRA.trim())) e.currentTarget.style.backgroundColor = BRAND_COLOR; }}
                >
                  {loading ? 'Processando...' : 'Pagar Agora'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* BARRA DE INFORMAÇÃO: ÁREAS + DICA DE ARRASTAR */}
        <div className="w-full bg-white sm:rounded-2xl shadow-sm border border-gray-100 px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          {/* Título */}
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap shrink-0">
            <svg className="w-4 h-4" style={{color: BRAND_COLOR}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Áreas do Evento
          </div>
          {/* Divisor */}
          <div className="hidden sm:block h-4 w-px bg-gray-200 shrink-0" />
          {/* Badges das áreas */}
          <div className="flex flex-wrap gap-2 flex-1">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
              Quadra Descoberta
            </span>
            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
              Quadra Coberta
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
              Area Externa Coberta
            </span>
          </div>
          {/* Dica de arrastar */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium whitespace-nowrap shrink-0">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Arraste o mapa para navegar entre as áreas
          </div>
        </div>

        {/* MAPA DE ASSENTOS */}
        <div className="w-full bg-white sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-6 items-center text-sm font-semibold text-gray-700">
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-white border-2 border-gray-300"></div> Livre</span>
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-emerald-500 shadow-sm border border-emerald-600"></div> Selecionado</span>
            <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-400 border border-yellow-500"></div> Reservado</span>
            <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500 border border-red-600 shadow-inner"></div> Vendido</span>
          </div>

          <div className="sm:hidden w-full bg-emerald-50 text-emerald-700 text-xs text-center py-2.5 px-4 border-b border-emerald-100 flex items-center justify-center gap-2 font-bold shadow-inner">
             <svg className="w-4 h-4 animate-pulse flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
             </svg>
             Arraste para os lados e para baixo para ver todas as áreas
          </div>

          <div className="p-6 overflow-x-auto relative flex-1 custom-scrollbar">
            <div className="min-w-fit mx-auto pb-8 flex flex-col items-center">
              <div className="w-[60%] ml-auto h-12 flex items-center justify-center relative mb-6 mt-2 pr-[32px]">
                <div className="w-full border-t border-dashed border-gray-300"></div>
                <span className="absolute right-1/2 translate-x-1/2 bg-white px-4 text-xs text-gray-400 uppercase tracking-widest font-bold whitespace-nowrap">
                  Quadra Descoberta
                </span>
              </div>
              <div className="flex flex-col gap-2">{renderGrid()}</div>
              <div className="w-full flex justify-end items-end gap-32 pr-8 mt-8">
                <div className="flex flex-col items-center gap-2 text-emerald-500 opacity-80 mb-2">
                  <span className="font-black tracking-[0.2em] uppercase text-xs">Entrada</span>
                  <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div className="w-[400px] h-16 relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-200 to-transparent rounded-t-[100px] border-t-4 border-gray-300"></div>
                  <span className="relative font-bold tracking-[0.2em] text-gray-500 uppercase text-sm">Palco Principal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}