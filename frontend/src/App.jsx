import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, MapPin, Ticket, X } from 'lucide-react';
import { EVENT_INFO, BRAND_COLOR, API_BASE_URL } from './constants';
import HomePage from './components/HomePage';
import IndividualTicketView from './components/IndividualTicketView';
import SeatMapView from './components/SeatMapView';
import AdminPanel from './components/AdminPanel';

// --- COMPONENTES COMPARTILHADOS ---

const ToastNotification = ({ message, type = 'error', onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-500' : `bg-[${BRAND_COLOR}]`;
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center justify-between min-w-[300px] p-4 text-white rounded-lg shadow-lg ${bgColor} animate-[slideIn_0.3s_ease-out]`}>
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-md transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const Header = ({ onGoHome }) => (
  <header className="bg-white border-b border-gray-200 shadow-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
      <button onClick={onGoHome} className="flex items-center gap-2 font-bold text-2xl tracking-tighter hover:opacity-80 transition-opacity" style={{ color: BRAND_COLOR }}>
        <Ticket className="w-8 h-8" />
        <span>TICKET IASC</span>
      </button>
      <img src="/img/logo.png" alt="Logo IASC" className="h-8 sm:h-10 w-auto object-contain cursor-pointer" onClick={onGoHome} />
    </div>
  </header>
);

const fmtLoteDate = (iso) => {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};



const Hero = () => (
  <section className="w-full h-auto min-h-[250px] sm:min-h-[350px] bg-[#050505] flex justify-center">
    <div className="w-full max-w-7xl relative bg-cover bg-center" style={{ backgroundImage: "url('/img/fundo.png')" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent z-10"></div>
      <div className="relative z-20 px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col justify-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-1 md:w-2/3 leading-tight drop-shadow-md">
          {EVENT_INFO.title}
        </h1>
        <p className="text-xl sm:text-2xl lg:text-3xl font-light text-gray-300 mb-4 md:w-2/3 drop-shadow-md">
          {EVENT_INFO.theme}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 text-sm sm:text-base text-gray-300 font-medium mb-4">
          <div className="flex items-center gap-2"><Calendar className="w-5 h-5" style={{ color: BRAND_COLOR }} />{EVENT_INFO.date}</div>
          <div className="flex items-center gap-2"><MapPin className="w-5 h-5" style={{ color: BRAND_COLOR }} />{EVENT_INFO.location}</div>
        </div>
        <div className="flex flex-col gap-2 mt-4 text-sm text-gray-300">
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#f16137] bg-[#f16137]/20 text-white w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f16137]" />
            <span>1º Lote · 20/05–29/05</span>
            <span className="opacity-60">|</span>
            <span>Individual R$ 65,00</span>
            <span className="opacity-60">·</span>
            <span>Mesa R$ 250,00</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-gray-300 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            <span>2º Lote · 30/05–08/06</span>
            <span className="opacity-60">|</span>
            <span>Individual R$ 75,00</span>
            <span className="opacity-60">·</span>
            <span>Mesa R$ 280,00</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-gray-300 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            <span>3º Lote · 09/06–12/06</span>
            <span className="opacity-60">|</span>
            <span>Individual R$ 85,00</span>
            <span className="opacity-60">·</span>
            <span>Mesa R$ 300,00</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// --- COMPONENTE PRINCIPAL (Roteador e Estado Global) ---
export default function App() {
  const [view, setView] = useState('home');
  const [precos, setPrecos] = useState({ individual: 0, mesa: 0 });
  const [lotes, setLotes] = useState([]);
  const [loteAtual, setLoteAtual] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [salesClosed, setSalesClosed] = useState(false);

  useEffect(() => {
    // Roteamento simples via URL
    if (window.location.pathname === '/admin') {
      setView('admin');
    }

    const eventDate = new Date(EVENT_INFO.dateISO);
    const now = new Date();
    const diffTime = eventDate - now;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 0) {
      setSalesClosed(true);
    }
  }, []);

  const showNotification = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 4000);
  };

  useEffect(() => {
    const fetchPrecos = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/detalhes_evento.php`);
        if (res.data.success) {
          setPrecos({
            individual: parseFloat(res.data.data.preco_individual),
            mesa: parseFloat(res.data.data.preco_mesa)
          });
          setLotes(res.data.data.lotes || []);
          setLoteAtual(res.data.data.lote_atual || 0);
        }
      } catch (error) {
        console.error("Erro ao buscar preços do evento", error);
      }
    };
    fetchPrecos();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col relative overflow-hidden">
      {toastMessage && <ToastNotification message={toastMessage} onClose={() => setToastMessage('')} />}

      <Header onGoHome={() => {
        if (view === 'admin') window.history.pushState({}, '', '/');
        setView('home');
      }} />
      {view !== 'admin' && <Hero />}

      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 relative z-30 flex flex-col items-center ${view !== 'admin' ? '-mt-6 sm:-mt-10' : ''}`}>
        {view === 'home' && (
          <HomePage
            precos={precos}
            lotes={lotes}
            loteAtual={loteAtual}
            onSelectMesa={() => salesClosed ? showNotification("As vendas estão encerradas.") : setView('mesas')}
            onSelectIndividual={() => salesClosed ? showNotification("As vendas estão encerradas.") : setView('individual')}
            salesClosed={salesClosed}
          />
        )}
        {view === 'mesas' && <SeatMapView onBack={() => setView('home')} showNotification={showNotification} />}
        {view === 'individual' && <IndividualTicketView onBack={() => setView('home')} showNotification={showNotification} precoUnitario={precos.individual} />}
        {view === 'admin' && <AdminPanel onBack={() => setView('home')} />}
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}