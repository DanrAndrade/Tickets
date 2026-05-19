import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { User, ShoppingCart, CheckCircle2, Mail, ArrowLeft, Plus, Minus, IdCard, AlertCircle, Gift } from 'lucide-react';
import { BRAND_COLOR, getSessionId, API_BASE_URL } from '../constants';

export default function IndividualTicketView({ onBack, showNotification, precoUnitario }) {
    const [quantidade, setQuantidade] = useState(1);
    const [clienteNome, setClienteNome] = useState('');
    const [clienteEmail, setClienteEmail] = useState('');
    const [clienteRA, setClienteRA] = useState('');
    const [loading, setLoading] = useState(false);
    const [aguardandoPagamento, setAguardandoPagamento] = useState(false);

    // Estados de validação do RA
    const [raStatus, setRaStatus] = useState('idle'); // 'idle' | 'checking' | 'valid' | 'invalid' | 'api_error' | 'limit_reached'
    const [raInfo, setRaInfo] = useState(null); // { nome, unidade_descricao, is_irmas_vieira, no_ano_letivo, ingressos_restantes }
    const [raError, setRaError] = useState('');

    const sessionId = getSessionId();
    const valorTotal = quantidade * precoUnitario;

    // Validação do RA ao sair do campo (onBlur)
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
                    setRaError('Aluno sem matrícula ativa no ano letivo atual. Compra não permitida.');
                } else if (d.ingressos_restantes === 0) {
                    // Limite atingido: já comprou o máximo
                    setRaStatus('limit_reached');
                    setRaError(`Este RA já atingiu o limite máximo de ${d.limite} ingresso(s) individual(is). Não é possível realizar nova compra.`);
                    setRaInfo(d);
                } else {
                    setRaStatus('valid');
                    setRaInfo(d);
                    // Se a quantidade selecionada excede o restante, ajusta automaticamente
                    if (d.ingressos_restantes < quantidade) {
                        setQuantidade(d.ingressos_restantes);
                    }
                }
            } else if (d.api_status === 'api_error') {
                // API do IASC com instabilidade — permite continuar com aviso
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

    const handleRAChange = (e) => {
        setClienteRA(e.target.value.replace(/\D/g, ''));
        setRaStatus('idle');
        setRaInfo(null);
        setRaError('');
    };

    const handleCheckout = async () => {
        if (!clienteRA.trim() || !clienteNome.trim() || !clienteEmail.trim()) {
            showNotification("Por favor, preencha seu RA, nome e e-mail antes de prosseguir.");
            return;
        }
        if (raStatus !== 'valid' && raStatus !== 'api_error') {
            showNotification("Valide seu RA antes de prosseguir. Clique fora do campo RA.");
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
            const res = await axios.post(`${API_BASE_URL}/gerar_link_pagamento.php`, {
                tipo: 'individual',
                quantidade: quantidade,
                valor_total: valorTotal,
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
        setQuantidade(1);
        setClienteNome('');
        setClienteEmail('');
        setClienteRA('');
        setRaStatus('idle');
        setRaInfo(null);
        setRaError('');
        onBack();
    };

    const isVieira = raStatus === 'valid' && raInfo?.is_irmas_vieira;
    // Limite dinâmico: usa o restante retornado pela API, ou 2 (padrão) se ainda não validado
    const limiteDisponivel = (raStatus === 'valid' && raInfo?.ingressos_restantes != null)
        ? raInfo.ingressos_restantes
        : 2;
    // api_error: API instável — permite compra com aviso (verificação feita no backend)
    // limit_reached: limite atingido — bloqueia completamente
    const canSubmit = !loading && clienteNome.trim() && clienteEmail.trim() && (raStatus === 'valid' || raStatus === 'api_error');

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">

            <div className="w-full flex mb-2 sm:mb-6">
                <button
                    onClick={onBack}
                    className="bg-white text-gray-800 px-5 py-2.5 rounded-xl shadow-md font-bold flex items-center gap-2 hover:bg-gray-50 transition-all border border-gray-100"
                >
                    <ArrowLeft className="w-5 h-5" /> Voltar
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 w-full items-start">
                {/* Lado Esquerdo: Detalhes do Ingresso */}
                <div className="w-full md:w-1/2 bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <User className="w-10 h-10" style={{ color: BRAND_COLOR }} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Ingresso Individual Pista</h2>
                    <p className="text-gray-500 mb-8">Selecione a quantidade desejada de ingressos.</p>

                    <div className="flex items-center justify-center gap-6 mb-4 bg-gray-50 py-4 px-6 rounded-xl border border-gray-100">
                        <button
                            onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                            disabled={raStatus === 'limit_reached'}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="text-3xl font-black text-gray-900 w-12">{quantidade}</span>
                        <button
                            onClick={() => setQuantidade(Math.min(limiteDisponivel, quantidade + 1))}
                            disabled={raStatus === 'limit_reached' || quantidade >= limiteDisponivel}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mb-4 uppercase tracking-wider">
                        {raStatus === 'valid' && raInfo?.ingressos_restantes != null
                            ? `Você pode comprar mais ${raInfo.ingressos_restantes} ingresso(s) neste RA`
                            : 'Limite de 2 ingressos por RA'
                        }
                    </p>

                    {/* Banner de acompanhantes grátis – apenas Irmãs Vieira */}
                    {isVieira && (
                        <div className="w-full rounded-xl p-3 mb-4 flex items-start gap-2 text-left" style={{ backgroundColor: '#fff7ed', border: '1.5px solid #f97316' }}>
                            <Gift className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#f97316' }} />
                            <div>
                                <p className="text-xs font-bold" style={{ color: '#c2410c' }}>Bônus Irmãs Vieira 🎉</p>
                                <p className="text-xs text-orange-700 mt-0.5">
                                    Cada ingresso inclui <strong>+2 ingressos de acompanhante grátis</strong> — 1 para cada pai!
                                    {quantidade > 1 && ` (${quantidade} aluno${quantidade > 1 ? 's' : ''} + ${quantidade * 2} acompanhantes)`}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="w-full flex justify-between items-center pt-6 border-t border-gray-100">
                        <span className="text-gray-500 font-medium text-lg">Total</span>
                        <div className="text-3xl font-black text-gray-900">
                            <span className="text-lg text-gray-500 font-bold mr-1">R$</span>
                            {valorTotal.toFixed(2).replace('.', ',')}
                        </div>
                    </div>
                    {isVieira && (
                        <p className="text-xs text-orange-600 font-medium mt-1 w-full text-right">
                            Acompanhantes: grátis ✓
                        </p>
                    )}
                </div>

                {/* Lado Direito: Checkout */}
                <div className="w-full md:w-1/2 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" style={{ color: BRAND_COLOR }} /> Finalizar Compra
                        </h3>
                    </div>

                    <div className="p-6 flex-1">
                        {aguardandoPagamento ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                <CheckCircle2 className="w-16 h-16 mb-4 animate-pulse" style={{ color: BRAND_COLOR }} />
                                <h3 className="text-lg font-bold text-gray-900">Pagamento Aberto!</h3>
                                <p className="text-sm text-gray-500 mt-2 mb-6">A tela de pagamento foi aberta em uma nova aba.</p>
                                <button onClick={concluirReserva} className="font-bold hover:underline transition-colors" style={{ color: BRAND_COLOR }}>
                                    Verificar Atualização / Voltar
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">Seus Dados</h3>

                                {/* Campo RA com validação em tempo real */}
                                <div>
                                    <div className="relative">
                                        <IdCard className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Registro Acadêmico do Aluno"
                                            value={clienteRA}
                                            onChange={handleRAChange}
                                            onBlur={handleRABlur}
                                            className="w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:outline-none text-sm transition-all"
                                            style={{
                                                borderColor: raStatus === 'valid' ? '#22c55e' : (raStatus === 'invalid' || raStatus === 'limit_reached') ? '#ef4444' : raStatus === 'api_error' ? '#f59e0b' : '#e5e7eb',
                                                '--tw-ring-color': BRAND_COLOR
                                            }}
                                        />
                                    {/* Ícone de status no campo RA */}
                                        {raStatus === 'checking' && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                                        )}
                                        {raStatus === 'valid' && (
                                            <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                                        )}
                                        {(raStatus === 'invalid' || raStatus === 'limit_reached') && (
                                            <AlertCircle className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                                        )}
                                        {raStatus === 'api_error' && (
                                            <AlertCircle className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-amber-500" />
                                        )}
                                    </div>
                                    {raStatus === 'valid' && raInfo && (
                                        <p className="text-xs text-green-600 font-medium mt-1 px-1">
                                            ✓ {raInfo.nome} — {raInfo.unidade_descricao}
                                        </p>
                                    )}
                                    {raStatus === 'invalid' && (
                                        <p className="text-xs text-red-500 font-medium mt-1 px-1">⚠ {raError}</p>
                                    )}
                                    {/* Banner de limite atingido */}
                                    {raStatus === 'limit_reached' && (
                                        <div className="mt-1 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                                            <p className="text-xs text-red-700 font-bold">🚫 Limite de ingressos atingido</p>
                                            <p className="text-[10px] text-red-600 mt-0.5">{raError}</p>
                                        </div>
                                    )}
                                    {raStatus === 'api_error' && (
                                        <div className="mt-1 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                                            <p className="text-xs text-amber-700 font-semibold">⚠ Serviço do IASC instável</p>
                                            <p className="text-[10px] text-amber-600 mt-0.5">Não foi possível confirmar o RA agora. Você pode continuar, mas a verificação final será feita no pagamento.</p>
                                        </div>
                                    )}
                                    {raStatus === 'idle' && (
                                        <p className="text-[10px] text-gray-400 font-medium px-1 italic mt-1">
                                            * Máximo de 2 ingressos individuais por RA. Clique fora do campo para validar.
                                        </p>
                                    )}
                                </div>

                                <div className="relative">
                                    <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Nome do Comprador"
                                        value={clienteNome}
                                        onChange={(e) => setClienteNome(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none text-sm transition-all"
                                        style={{ '--tw-ring-color': BRAND_COLOR }}
                                    />
                                </div>
                                <div className="relative mb-6">
                                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        placeholder="E-mail do Comprador"
                                        value={clienteEmail}
                                        onChange={(e) => setClienteEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none text-sm transition-all"
                                        style={{ '--tw-ring-color': BRAND_COLOR }}
                                    />
                                </div>
                                <button
                                    onClick={handleCheckout}
                                    disabled={!canSubmit}
                                    className="w-full text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                    style={{ backgroundColor: canSubmit ? BRAND_COLOR : '#cbd5e1' }}
                                >
                                    {loading ? 'Processando...' : 'Pagar Agora'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}