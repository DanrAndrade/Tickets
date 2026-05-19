import React from 'react';
import { User, Users, Tag } from 'lucide-react';
import { BRAND_COLOR, BRAND_COLOR_HOVER } from '../constants';

const fmt = (iso) => {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
};

const fmtR = (v) =>
    parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const LOTE_COLORS = [
    { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', active: 'ring-2 ring-emerald-400' },
    { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',       active: 'ring-2 ring-blue-400' },
    { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',       active: 'ring-2 ring-rose-400' },
];

export default function HomePage({ precos, lotes, loteAtual, onSelectMesa, onSelectIndividual, salesClosed }) {
    return (
        <div className="w-full flex flex-col mt-8 sm:mt-12">

            <div className="max-w-3xl mx-auto text-center mb-12">
                <img
                    src="/img/icon.png"
                    alt="Ícone Ticket IASC"
                    className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 object-contain drop-shadow-sm"
                />
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Bem-vindos ao Ticket IASC</h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                    Desenvolvemos uma plataforma especial para facilitar a sua vida e garantir a sua presença no evento mais aguardado do ano de forma rápida e segura. Escolha abaixo a sua modalidade de ingresso para o nosso reino encantado.
                </p>
            </div>

            {/* Cards de compra */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
                {/* Card Ingresso Individual */}
                <div
                    className="bg-white rounded-2xl p-8 flex flex-col items-center text-center border-2 border-transparent hover:border-[#f16137] transition-all group shadow-lg cursor-pointer"
                    onClick={onSelectIndividual}
                >
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <User className="w-10 h-10" style={{ color: BRAND_COLOR }} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Ingresso Individual</h3>
                    <p className="text-gray-500 mb-6 flex-1 text-sm">Acesso individual à pista e áreas comuns do evento. (Lote limitado)</p>
                    <div className="text-4xl font-black text-gray-900 mb-6">
                        <span className="text-xl text-gray-500 font-bold mr-1">R$</span>
                        {precos.individual.toFixed(2).replace('.', ',')}
                    </div>
                    <button
                        className={`w-[70%] py-2.5 px-4 rounded-xl font-bold text-white shadow-sm transition-colors text-base ${salesClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={{ backgroundColor: salesClosed ? '#94a3b8' : BRAND_COLOR }}
                        onMouseEnter={(e) => { if (!salesClosed) e.currentTarget.style.backgroundColor = BRAND_COLOR_HOVER; }}
                        onMouseLeave={(e) => { if (!salesClosed) e.currentTarget.style.backgroundColor = BRAND_COLOR; }}
                    >
                        {salesClosed ? 'Vendas Encerradas' : 'Comprar Individual'}
                    </button>
                </div>

                {/* Card Mesas */}
                <div
                    className="bg-white rounded-2xl p-8 flex flex-col items-center text-center border-2 border-transparent hover:border-[#f16137] transition-all group shadow-lg cursor-pointer"
                    onClick={onSelectMesa}
                >
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Users className="w-10 h-10" style={{ color: BRAND_COLOR }} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Mesa 04 Lugares</h3>
                    <p className="text-gray-500 mb-6 flex-1 text-sm">Reserve sua mesa exclusiva no mapa interativo e garanta o melhor lugar para seu grupo.</p>
                    <div className="text-4xl font-black text-gray-900 mb-6">
                        <span className="text-xl text-gray-500 font-bold mr-1">R$</span>
                        {precos.mesa.toFixed(2).replace('.', ',')}
                    </div>
                    <button
                        className={`w-[70%] py-2.5 px-4 rounded-xl font-bold text-white shadow-sm transition-colors text-base ${salesClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={{ backgroundColor: salesClosed ? '#94a3b8' : BRAND_COLOR }}
                        onMouseEnter={(e) => { if (!salesClosed) e.currentTarget.style.backgroundColor = BRAND_COLOR_HOVER; }}
                        onMouseLeave={(e) => { if (!salesClosed) e.currentTarget.style.backgroundColor = BRAND_COLOR; }}
                    >
                        {salesClosed ? 'Vendas Encerradas' : 'Escolher Mesa'}
                    </button>
                </div>
            </div>

            {/* Tabela de lotes */}
            {lotes.length > 0 && (
                <div className="max-w-4xl mx-auto w-full mt-10">
                    <div className="flex items-center gap-2 mb-4">
                        <Tag className="w-5 h-5" style={{ color: BRAND_COLOR }} />
                        <h3 className="text-lg font-bold text-gray-800">Preços por Lote</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {lotes.map((lote) => {
                            const idx = lote.numero - 1;
                            const c = LOTE_COLORS[idx] || LOTE_COLORS[0];
                            const isAtual = lote.numero === loteAtual;
                            return (
                                <div
                                    key={lote.numero}
                                    className={`rounded-2xl border p-5 ${c.bg} ${c.border} ${isAtual ? c.active : ''} relative`}
                                >
                                    {isAtual && (
                                        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${c.badge}`}>
                                            Lote atual
                                        </span>
                                    )}
                                    <p className="text-sm font-bold text-gray-500 mb-1">{lote.numero}º Lote</p>
                                    <p className="text-xs text-gray-500 mb-4">{fmt(lote.inicio)} a {fmt(lote.fim)}</p>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500 flex items-center gap-1"><User className="w-3 h-3" /> Individual</span>
                                            <span className="text-sm font-black text-gray-800">{fmtR(lote.preco_individual)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> Mesa</span>
                                            <span className="text-sm font-black text-gray-800">{fmtR(lote.preco_mesa)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
}
