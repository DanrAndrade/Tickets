import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    LogOut,
    User,
    Lock,
    Search,
    FileText,
    RefreshCw,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    Ticket,
    Calendar,
    Package,
    PackageCheck,
    Eye,
    EyeOff,
    Settings,
    Save
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { BRAND_COLOR, BRAND_COLOR_HOVER, API_BASE_URL, EVENT_INFO } from '../constants';

// Helper robusto para download de PDF
const savePdf = (doc, filename) => {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
};

const addImageWithRatio = (doc, imgData, x, y, maxWidth, maxHeight) => {
    if (!imgData) return;
    try {
        const props = doc.getImageProperties(imgData);
        const ratio = props.width / props.height;
        
        let width = maxWidth;
        let height = width / ratio;
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
        }
        
        // Centraliza horizontalmente e verticalmente no espaço dado
        const dx = x + (maxWidth - width) / 2;
        const dy = y + (maxHeight - height) / 2;
        
        doc.addImage(imgData, 'PNG', dx, dy, width, height, undefined, 'FAST');
    } catch (e) {
        console.error("Erro ao calcular proporção da imagem:", e);
        doc.addImage(imgData, 'PNG', x, y, maxWidth, maxHeight, undefined, 'FAST');
    }
};

const drawTicketText = (doc, text, x, y, size, isOrange, maxWidth, isBold) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    let str = String(text || '');
    if (maxWidth) {
        if (doc.getTextWidth(str) > maxWidth) {
            while (doc.getTextWidth(str + '...') > maxWidth && str.length > 0) {
                str = str.slice(0, -1);
            }
            str = str + '...';
        }
    }
    
    // Contorno branco fino
    doc.setTextColor(255, 255, 255);
    const offset = 0.12;
    doc.text(str, x - offset, y);
    doc.text(str, x + offset, y);
    doc.text(str, x, y - offset);
    doc.text(str, x, y + offset);
    
    // Texto principal
    if (isOrange) {
        doc.setTextColor(241, 97, 55);
    } else {
        doc.setTextColor(0, 0, 0);
    }
    doc.text(str, x, y);
};

const loadImageBase64 = async (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

export default function AdminPanel({ onBack }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [vendas, setVendas] = useState([]);
    const [activeTab, setActiveTab] = useState(sessionStorage.getItem('admin_active_tab') || 'dashboard');
    const [filtro, setFiltro] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroLote, setFiltroLote] = useState('todos'); // 'todos' | '1' | '2'
    const [refreshing, setRefreshing] = useState(false);

    // Configuração dos lotes — carregada do banco via get_config.php
    const [loteConfig, setLoteConfig] = useState({
        lote1_inicio: '2026-05-19', lote1_fim: '2026-05-29',
        lote1_preco_mesa: '1.00',   lote1_preco_individual: '1.00',
        lote2_inicio: '2026-05-30', lote2_fim: '2026-06-08',
        lote2_preco_mesa: '1.00',   lote2_preco_individual: '1.00',
        lote3_inicio: '2026-06-09', lote3_fim: '2026-06-12',
        lote3_preco_mesa: '1.00',   lote3_preco_individual: '1.00',
    });
    const [savingConfig, setSavingConfig] = useState(false);
    const [progressGeracao, setProgressGeracao] = useState({ ativo: false, atual: 0, total: 0 });

    const LOTE_1_INICIO = loteConfig.lote1_inicio;
    const LOTE_1_FIM    = loteConfig.lote1_fim;
    const LOTE_2_INICIO = loteConfig.lote2_inicio;
    const LOTE_2_FIM    = loteConfig.lote2_fim;
    const LOTE_3_INICIO = loteConfig.lote3_inicio;
    const DATA_EVENTO   = loteConfig.lote3_fim;
    const hoje = new Date().toISOString().slice(0, 10);
    const loteAtual = hoje > DATA_EVENTO ? 0
        : hoje >= LOTE_3_INICIO ? 3
        : hoje >= LOTE_2_INICIO ? 2
        : hoje >= LOTE_1_INICIO ? 1
        : 0;

    // Estados do Check-in
    const [codigoCheckin, setCodigoCheckin] = useState('');
    const [resultadoCheckin, setResultadoCheckin] = useState(null);
    const [checkinLoading, setCheckinLoading] = useState(false);

    // Estado do Modal do Sistema
    const [modalConfig, setModalConfig] = useState(null);

    const showModal = (type, title, message, defaultValue = '') => {
        return new Promise((resolve) => {
            setModalConfig({
                type, title, message, defaultValue,
                onConfirm: (val) => { setModalConfig(null); resolve(val); },
                onCancel: () => { setModalConfig(null); resolve(type === 'prompt' ? null : false); }
            });
        });
    };

    // Persistência simples de login (usando sessionStorage para maior segurança)
    useEffect(() => {
        const adminData = sessionStorage.getItem('admin_session');
        const token = sessionStorage.getItem('admin_token');
        if (adminData && token) setIsLoggedIn(true);
    }, []);

    // Persiste a aba atual para que não seja perdida no F5
    useEffect(() => {
        sessionStorage.setItem('admin_active_tab', activeTab);
    }, [activeTab]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${API_BASE_URL}/admin_login.php`, { usuario, senha });
            if (res.data.success) {
                sessionStorage.setItem('admin_session', JSON.stringify(res.data.admin));
                sessionStorage.setItem('admin_token', res.data.token);
                setIsLoggedIn(true);
            } else {
                setError(res.data.message);
            }
        } catch (err) {
            setError("Erro ao conectar com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_session');
        sessionStorage.removeItem('admin_token');
        setIsLoggedIn(false);
    };

    const fetchVendas = async () => {
        setRefreshing(true);
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.get(`${API_BASE_URL}/listar_vendas.php`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setVendas(res.data.data);
            }
        } catch (err) {
            console.error("Erro ao buscar vendas", err);
            if (err.response?.status === 401) handleLogout();
        } finally {
            setRefreshing(false);
        }
    };

    const limparFiltros = () => {
        setFiltro('');
        setFiltroStatus('todos');
        setFiltroTipo('todos');
    };

    const [checkinHistory, setCheckinHistory] = useState([]);
    const [buscaEntrada, setBuscaEntrada] = useState('');
    const [filtroCheckinStatus, setFiltroCheckinStatus] = useState('todas');
    const [ingressosFisicos, setIngressosFisicos] = useState([]);
    const [filtroIF, setFiltroIF] = useState('');
    const [filtroIFTipo, setFiltroIFTipo] = useState('todos');
    const [filtroIFStatus, setFiltroIFStatus] = useState('reservado');
    const lastScannedCodeRef = useRef('');

    const handleCheckinAction = async (codigo) => {
        if (!codigo || codigo.trim().length !== 8) return;
        if (checkinLoading) return;

        // Previne leitura dupla do mesmo código em um curto espaço de tempo (lote)
        if (lastScannedCodeRef.current === codigo) return;
        lastScannedCodeRef.current = codigo;
        setTimeout(() => {
            if (lastScannedCodeRef.current === codigo) lastScannedCodeRef.current = '';
        }, 3000);

        setCheckinLoading(true);
        setResultadoCheckin(null);
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.post(`${API_BASE_URL}/realizar_checkin.php`, { codigo: codigo }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResultadoCheckin(res.data);
            
            if (res.data.success) {
                setCheckinHistory(prev => [{
                    id: Date.now(),
                    codigo: codigo,
                    time: new Date().toLocaleTimeString(),
                    success: true,
                    message: "Entrada registrada",
                    cliente: res.data.cliente
                }, ...prev].slice(0, 200));
                
                setCodigoCheckin(''); 
            }
        } catch (err) {
            if (err.response?.status === 401) {
                handleLogout();
                return;
            }
            const errorResult = { success: false, message: err.response?.data?.message || "Erro ao conectar com o servidor." };
            setResultadoCheckin(errorResult);

            setCheckinHistory(prev => [{
                id: Date.now(),
                codigo: codigo,
                time: new Date().toLocaleTimeString(),
                success: false,
                message: errorResult.message
            }, ...prev].slice(0, 200));
        } finally {
            setCheckinLoading(false);
        }
    };

    const handleCheckin = (e) => {
        if (e) e.preventDefault();
        handleCheckinAction(codigoCheckin);
    };

    useEffect(() => {
        if (activeTab === 'checkin' && isLoggedIn) {
            const scanner = new Html5QrcodeScanner('reader', {
                qrbox: { width: 250, height: 250 },
                fps: 5,
            });
            scanner.render(
                (decodedText) => {
                    setCodigoCheckin(decodedText);
                    // Não dar scanner.clear() aqui! Mantém a câmera ligada para leitura em lote.
                    handleCheckinAction(decodedText);
                },
                (err) => { }
            );

            return () => {
                scanner.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner. ", error);
                });
            };
        }
    }, [activeTab, isLoggedIn]);

    const fetchCheckinLogs = async () => {
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.get(`${API_BASE_URL}/listar_checkin_logs.php`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const logs = res.data.data.map(log => ({
                    id: log.id,
                    codigo: log.codigo_ingresso,
                    time: new Date(log.data_leitura).toLocaleTimeString(),
                    success: log.status_leitura === 'autorizado',
                    message: log.mensagem,
                    cliente: log.cliente_nome ? {
                        nome: log.cliente_nome,
                        ra: log.ra,
                        tipo: log.tipo_ingresso,
                        assento: log.numero_assento,
                        cadeira: log.numero_cadeira
                    } : null
                }));
                setCheckinHistory(logs);
            }
        } catch (err) {
            console.error("Erro ao buscar logs de check-in", err);
        }
    };

    const fetchIngressosFisicos = async () => {
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.get(`${API_BASE_URL}/listar_ingressos_fisicos.php`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) setIngressosFisicos(res.data.data);
        } catch (err) {
            console.error('Erro ao buscar ingressos físicos', err);
            if (err.response?.status === 401) handleLogout();
        }
    };

    const marcarEntregue = async (order_nsu) => {
        if (!await showModal('confirm', 'Marcar Entregue', `Confirmar entrega dos ingressos do pedido ${order_nsu}?`)) return;
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.post(`${API_BASE_URL}/marcar_entregue.php`, { order_nsu }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                await showModal('alert', 'Sucesso', res.data.message);
                fetchIngressosFisicos();
            } else {
                await showModal('alert', 'Erro', res.data.message);
            }
        } catch (err) {
            await showModal('alert', 'Erro', 'Falha ao marcar entregue.');
        }
    };

    const fetchConfig = async () => {
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.get(`${API_BASE_URL}/get_config.php`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.data) {
                setLoteConfig(prev => ({ ...prev, ...res.data.data }));
            }
        } catch (err) {
            console.error('Erro ao buscar config', err);
        }
    };

    const saveConfig = async () => {
        setSavingConfig(true);
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.post(`${API_BASE_URL}/save_config.php`, loteConfig, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                await showModal('alert', 'Sucesso', 'Configurações salvas! Os preços e datas entrarão em vigor imediatamente.');
            } else {
                await showModal('alert', 'Erro', res.data.message);
            }
        } catch (err) {
            await showModal('alert', 'Erro', 'Falha ao salvar configurações.');
        } finally {
            setSavingConfig(false);
        }
    };

    useEffect(() => {
        if (isLoggedIn) {
            fetchConfig();
            if (activeTab === 'dashboard') {
                fetchVendas();
            } else if (activeTab === 'checkin') {
                fetchCheckinLogs();
            } else if (activeTab === 'ingressos') {
                fetchIngressosFisicos();
            }
        }
    }, [isLoggedIn, activeTab]);

    const filteredVendas = vendas.filter(v => {
        const matchesText = v.cliente_nome.toLowerCase().includes(filtro.toLowerCase()) ||
                          v.cliente_email.toLowerCase().includes(filtro.toLowerCase()) ||
                          (v.ra && v.ra.includes(filtro));
        const matchesStatus = filtroStatus === 'todos' || v.status_pagamento === filtroStatus;
        const matchesTipo = filtroTipo === 'todos' || v.tipo_ingresso === filtroTipo;
        const matchesLote = filtroLote === 'todos' || String(v.lote) === filtroLote;
        return matchesText && matchesStatus && matchesTipo && matchesLote;
    });

    // Mesa  → 1 linha por assento (4 cadeiras colapsam em 1)
    // Individual → 1 linha por pedido (order_nsu), acumula quantidade e total
    // Acompanhante → oculto (mas contabilizado no total do pedido individual)
    const grouparVendas = (source) => Array.from(
        source.reduce((map, v) => {
            if (parseInt(v.is_acompanhante) === 1) return map;
            const key = (v.tipo_ingresso === 'mesa' && v.assento_id)
                ? `mesa_${v.order_nsu}_${v.assento_id}`
                : `ind_${v.order_nsu}`;
            if (!map.has(key)) {
                map.set(key, { ...v, _qtd: 1, _total: parseFloat(v.preco || 0) });
            } else if (v.tipo_ingresso === 'individual') {
                const g = map.get(key);
                g._qtd++;
                g._total += parseFloat(v.preco || 0);
            }
            return map;
        }, new Map()).values()
    );
    const groupedAllVendas = grouparVendas(vendas);

    const drawTicketOnPage = async (doc, venda, startX, startY, logoForriasc, logoIasc, fundoIngresso) => {
        const codigoQR = venda.codigo_validacao || 'SEM-CODIGO';
        const qrCodeData = await QRCode.toDataURL(codigoQR, { 
            margin: 1, width: 300, color: { dark: '#000000', light: '#ffffff' }
        });

        const totalW = 108;
        const totalH = 60;
        const stubW = 20;
        const mainW = totalW - stubW;
        const mX = 2.5;
        const mY = 3;
        const isMesa = venda.tipo_ingresso === 'mesa';

        // FUNDO
        doc.setFillColor(245, 235, 220);
        doc.rect(startX, startY, totalW, totalH, 'F');

        // IMAGEM DE FUNDO
        try { doc.addImage(fundoIngresso, 'PNG', startX + stubW, startY, mainW, totalH, undefined, 'FAST'); } catch (e) {}

        // LINHA PERFURADA
        doc.setDrawColor(140, 120, 100);
        doc.setLineDashPattern([1.2, 1.2], 0);
        doc.setLineWidth(0.3);
        doc.line(startX + stubW, startY + 1, startX + stubW, startY + totalH - 1);
        doc.setLineDashPattern([], 0);
        doc.setLineWidth(0.1);

        // CANHOTO: QR code + textos verticais
        const qrSize = 14;
        const qrX = startX + (stubW - qrSize) / 2;
        doc.addImage(qrCodeData, 'PNG', qrX, startY + mY, qrSize, qrSize, undefined, 'FAST');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 80, 60);
        doc.text('CANHOTO DE ENTRADA', startX + stubW - 4.5, startY + totalH - mY, { angle: 90 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        const nomeAbrev = (venda.cliente_nome || '').substring(0, 22).toUpperCase();
        if (nomeAbrev) {
            doc.text(`NOME: ${nomeAbrev}`, startX + stubW - 8.5, startY + totalH - mY, { angle: 90 });
        }
        doc.text(`COD: ${codigoQR}`, startX + stubW - (nomeAbrev ? 13 : 9), startY + totalH - mY, { angle: 90 });

        // CORPO PRINCIPAL
        const bodyX = startX + stubW + mX;
        const bodyY = startY + mY;

        // Logos
        if (logoForriasc) addImageWithRatio(doc, logoForriasc, bodyX, bodyY, 36, 13);
        if (logoIasc) addImageWithRatio(doc, logoIasc, startX + totalW - mX - 15, bodyY, 15, 13);

        // Título
        const isAcomp = venda.is_acompanhante == 1;
        const titulo = isMesa ? 'INGRESSO MESA' : (isAcomp ? 'INGRESSO ACOMPANHANTE' : 'INGRESSO INDIVIDUAL');
        drawTicketText(doc, titulo, bodyX, bodyY + 19, 9, false, 76, true);

        // Layout de dados: 2 colunas
        const col1X = bodyX;
        const col2X = bodyX + 44;
        let ly = bodyY + 26;

        const temNome = !!(venda.cliente_nome || '').trim();

        if (temNome) {
            // Ingresso com comprador: mostra CLIENTE + RA
            const nomeExibicao = (venda.cliente_nome || '').replace(/ \(Pai\/Mãe \d+\)$/, '').toUpperCase();
            const labelCliente = isAcomp ? 'ACOMPANHANTE DE' : 'CLIENTE';

            drawTicketText(doc, labelCliente, col1X, ly, 8.5, true, null, true);
            if (venda.ra) drawTicketText(doc, `RA: ${venda.ra}`, col2X, ly, 8.5, true, null, true);
            ly += 5;
            drawTicketText(doc, nomeExibicao, col1X, ly, 8.5, false, 42, true);
            if (venda.ra) drawTicketText(doc, venda.ra, col2X, ly, 8.5, false, 28, true);
            ly += 7;
        }

        // CÓDIGO e MESA/CADEIRA
        drawTicketText(doc, 'CÓDIGO', col1X, ly, 8.5, true, null, true);
        if (isMesa) {
            drawTicketText(doc, 'MESA · CADEIRA', col2X, ly, 8.5, true, null, true);
        }
        ly += 5;
        drawTicketText(doc, codigoQR, col1X, ly, 8.5, false, 40, true);
        if (isMesa) {
            const mesaNum = venda.numero_assento || '-';
            const cadNum = venda.numero_cadeira ? `${venda.numero_cadeira}/4` : '-';
            drawTicketText(doc, `${mesaNum}  ·  ${cadNum}`, col2X, ly, 8.5, false, 28, true);
        }

        // DATA
        ly += 7;
        drawTicketText(doc, 'DATA: 12/06/2026', col1X, ly, 8.5, false, 42, false);
    };

    const generateSingleTicket = async (venda) => {
        setLoading(true);
        try {
            const logoForriasc = await loadImageBase64('/img/logo-forriasc-2026.svg');
            const logoIasc = await loadImageBase64('/img/logo.png');
            const fundoIngresso = await loadImageBase64('/img/fundo-ingresso.png');

            // Busca todos os ingressos da mesma compra (mesmo order_nsu)
            const grupoVendas = venda.order_nsu
                ? vendas.filter(v => v.order_nsu === venda.order_nsu && v.status_pagamento === 'aprovado')
                : [venda];

            // A4 Landscape: 297 x 210mm
            // Ticket: 108 x 60mm
            // Grupos de até 4 (mesa) ou 2 (individual) lado a lado
            const ticketW = 108;
            const ticketH = 60;
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });

            if (grupoVendas.length === 1) {
                // Centraliza na página
                await drawTicketOnPage(doc, grupoVendas[0], (297 - ticketW) / 2, (210 - ticketH) / 2, logoForriasc, logoIasc, fundoIngresso);
            } else if (grupoVendas.length === 2) {
                // Dois lado a lado, centralizados verticalmente
                const totalW = ticketW * 2 + 5;
                const startX = (297 - totalW) / 2;
                const startY = (210 - ticketH) / 2;
                await drawTicketOnPage(doc, grupoVendas[0], startX, startY, logoForriasc, logoIasc, fundoIngresso);
                await drawTicketOnPage(doc, grupoVendas[1], startX + ticketW + 5, startY, logoForriasc, logoIasc, fundoIngresso);
            } else {
                // 3 ou 4 (mesa): 2 colunas x 2 linhas
                const cols = 2;
                const gapX = 5;
                const gapY = 5;
                const totalW = ticketW * 2 + gapX;
                const totalH = ticketH * 2 + gapY;
                const startX = (297 - totalW) / 2;
                const startY = (210 - totalH) / 2;
                for (let i = 0; i < grupoVendas.length; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    await drawTicketOnPage(doc, grupoVendas[i], startX + col * (ticketW + gapX), startY + row * (ticketH + gapY), logoForriasc, logoIasc, fundoIngresso);
                }
            }

            savePdf(doc, `ingresso_${venda.cliente_nome.replace(/\s+/g, '_').toLowerCase()}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar ingresso:', err);
            await showModal('alert', 'Erro', 'Erro ao gerar o ingresso.');
        } finally {
            setLoading(false);
        }
    };

    // loteNum: 0=todos, 1=lote1, 2=lote2, null=perguntar
    const generateAllRealTickets = async (loteNum = null) => {
        const aprovadas = vendas.filter(v => v.status_pagamento === 'aprovado');

        if (aprovadas.length === 0) {
            await showModal('alert', 'Aviso', 'Não há vendas aprovadas para gerar ingressos.');
            return;
        }

        // Se loteNum não foi passado, pergunta
        let lote = loteNum;
        if (lote === null) {
            const loteEscolhido = await showModal('prompt', 'Gerar Ingressos por Lote',
                `Informe o lote a gerar:\n  1 = Lote 1 (até ${LOTE_1_FIM})\n  2 = Lote 2 (${LOTE_1_FIM} em diante)\n  0 = Todos os lotes\n\nLote atual ativo: ${loteAtual}`,
                String(loteAtual));
            if (loteEscolhido === null) return;
            lote = parseInt(loteEscolhido);
        }

        const validas = aprovadas.filter(v => {
            if (!v.codigo_validacao) return false;
            if (lote === 0) return true;
            return parseInt(v.lote) === lote;
        });

        if (validas.length === 0) {
            await showModal('alert', 'Aviso', `Nenhum ingresso válido encontrado para o ${lote === 0 ? 'todos os lotes' : 'Lote ' + lote}.`);
            return;
        }

        const label = lote === 0 ? 'Todos os Lotes' : `Lote ${lote}`;
        if (!await showModal('confirm', 'Confirmar Geração',
            `Gerar PDF — ${label}\n${validas.length} ingresso(s) aprovado(s) serão incluídos.`)) return;

        setLoading(true);
        try {
            const logoForriasc = await loadImageBase64('/img/logo-forriasc-2026.svg');
            const logoIasc = await loadImageBase64('/img/logo.png');
            const fundoIngresso = await loadImageBase64('/img/fundo-ingresso.png');

            // Agrupa por order_nsu (ou por id se não tiver order_nsu)
            const gruposMap = new Map();
            for (const v of validas) {
                const key = v.order_nsu || `solo_${v.id}`;
                if (!gruposMap.has(key)) gruposMap.set(key, []);
                gruposMap.get(key).push(v);
            }
            const grupos = Array.from(gruposMap.values());

            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });

            const ticketW = 108;
            const ticketH = 60;
            const pageW = 297;
            const pageH = 210;
            const gapX = 0;   // sem espaço — folha destacável
            const gapY = 0;   // sem espaço — folha destacável
            const marginX = (pageW - ticketW * 2 - gapX) / 2; // centraliza 2 colunas
            const marginTop = 5;

            // Each page row can hold 2 tickets side by side (left col, right col).
            // A mesa group (4 tickets) occupies 2 rows: left+right on row 0, left+right on row 1.
            // A pair group (2 tickets) occupies 1 row: left+right.
            // A solo group (1 ticket) occupies half a row (left OR right col).

            let pageRow = 0;   // current row index on current page (0,1,2)
            let colIdx  = 0;   // 0=left, 1=right (only for solo groups)
            const maxRows = 3; // 3 rows fit: 3*60 + 2*5 + 2*5 = 200 < 210 ✓
            let isFirstPage = true;

            const newPage = () => {
                doc.addPage('a4', 'l');
                pageRow = 0;
                colIdx = 0;
                isFirstPage = false;
            };

            const rowY = (r) => marginTop + r * (ticketH + gapY);

            for (const grupo of grupos) {
                if (grupo.length >= 3) {
                    // Mesa: needs 2 consecutive rows, both columns
                    if (!isFirstPage && pageRow + 2 > maxRows) newPage();
                    if (isFirstPage) isFirstPage = false;

                    const bX = marginX;
                    for (let i = 0; i < grupo.length && i < 4; i++) {
                        const c = i % 2;
                        const r = Math.floor(i / 2);
                        await drawTicketOnPage(doc, grupo[i],
                            bX + c * (ticketW + gapX),
                            rowY(pageRow + r),
                            logoForriasc, logoIasc, fundoIngresso);
                    }
                    pageRow += 2;
                    colIdx = 0;
                    if (pageRow >= maxRows) newPage();

                } else if (grupo.length === 2) {
                    // Pair: needs 1 row, both columns
                    if (!isFirstPage && colIdx === 1) { pageRow++; colIdx = 0; } // flush solo in progress
                    if (!isFirstPage && pageRow >= maxRows) newPage();
                    if (isFirstPage) isFirstPage = false;

                    const bX = marginX;
                    await drawTicketOnPage(doc, grupo[0], bX, rowY(pageRow), logoForriasc, logoIasc, fundoIngresso);
                    await drawTicketOnPage(doc, grupo[1], bX + ticketW + gapX, rowY(pageRow), logoForriasc, logoIasc, fundoIngresso);
                    pageRow++;
                    colIdx = 0;
                    if (pageRow >= maxRows) newPage();

                } else {
                    // Solo: fills left then right column of same row
                    if (!isFirstPage && colIdx === 0 && pageRow >= maxRows) newPage();
                    if (isFirstPage) isFirstPage = false;

                    const xPos = marginX + colIdx * (ticketW + gapX);
                    await drawTicketOnPage(doc, grupo[0], xPos, rowY(pageRow), logoForriasc, logoIasc, fundoIngresso);
                    colIdx++;
                    if (colIdx >= 2) { colIdx = 0; pageRow++; }
                    if (pageRow >= maxRows && colIdx === 0) newPage();
                }
            }

            const nomeArquivo = lote === 0 ? 'ingressos_todos_lotes' : `ingressos_lote_${lote}`;
            savePdf(doc, `${nomeArquivo}.pdf`);
        } catch (err) {
            console.error('Erro fatal ao gerar PDF:', err);
            await showModal('alert', 'Erro', 'Erro ao gerar o arquivo. Verifique o console do navegador.');
        } finally {
            setLoading(false);
        }
    };


    const generatePulseiraBatch = async () => {
        const qtyStr = await showModal('prompt', 'Gerar Pulseiras', 'Quantas pulseiras cortesia deseja gerar?', '50');
        if (!qtyStr) return;
        const quantidade = parseInt(qtyStr, 10);
        if (isNaN(quantidade) || quantidade <= 0) {
            await showModal('alert', 'Erro', 'Quantidade inválida.');
            return;
        }
        
        if (!await showModal('confirm', 'Confirmar', `Deseja gerar e REGISTRAR no banco de dados ${quantidade} pulseiras cortesia?`)) return;
        
        setLoading(true);
        try {
            const codigos = [];
            for (let i = 0; i < quantidade; i++) {
                codigos.push(Math.floor(10000000 + Math.random() * 90000000).toString());
            }

            // Registrar no Banco de Dados
            const token = sessionStorage.getItem('admin_token');
            const res = await axios.post(`${API_BASE_URL}/registrar_lote_pulseiras.php`, { codigos }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!res.data.success) {
                throw new Error(res.data.message);
            }

            const doc = new jsPDF({
                orientation: 'l',
                unit: 'mm',
                format: [245, 20],
                compress: true
            });

            const logoForriasc = await colorImageToBlack('/img/logo-forriasc-2026.svg');
            const logoIasc = await colorImageToBlack('/img/logo.png');

            for (let i = 0; i < codigos.length; i++) {
                if (i > 0) doc.addPage([245, 20], 'l');

                // Fundo Laranja
                doc.setFillColor(241, 97, 55);
                doc.rect(0, 0, 245, 20, 'F');

                const codigo = codigos[i];
                const qrCodeData = await QRCode.toDataURL(codigo, { 
                    margin: 1,
                    width: 200,
                    color: { dark: '#000000', light: '#ffffff' }
                });

                if (logoForriasc) addImageWithRatio(doc, logoForriasc, 15, 2.5, 40, 15);
                if (logoIasc) addImageWithRatio(doc, logoIasc, 114, 2, 17, 17);
                doc.addImage(qrCodeData, 'PNG', 180, 2, 16, 16, undefined, 'FAST');

                doc.setTextColor(0);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text(`TICKET: #${codigo}`, 200, 11.5);
            }

            savePdf(doc, `lote_pulseiras_${quantidade}_unidades.pdf`);
            await showModal('alert', 'Sucesso', `${quantidade} pulseiras geradas e registradas com sucesso!`);
        } catch (err) {
            console.error("Erro ao gerar lote:", err);
            if (err.response?.status === 401) {
                handleLogout();
                return;
            }
            await showModal('alert', 'Erro', "Erro ao gerar o lote de pulseiras: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const generatePreTicketsPDF = async (tipo) => {
        const lista = ingressosFisicos.filter(i => i.tipo === tipo);
        if (lista.length === 0) {
            await showModal('alert', 'Aviso', `Nenhum ingresso do tipo '${tipo}' encontrado.`);
            return;
        }
        const label = tipo === 'mesa' ? 'Mesas' : tipo === 'individual' ? 'Individuais' : 'Acompanhantes';
        if (!await showModal('confirm', 'Gerar PDF Pré-Impressão', `Gerar PDF com ${lista.length} ingressos (${label})?`)) return;

        setLoading(true);
        setProgressGeracao({ ativo: true, atual: 0, total: lista.length });
        try {
            const logoForriasc = await loadImageBase64('/img/logo-forriasc-2026.svg');
            const logoIasc     = await loadImageBase64('/img/logo.png');
            const fundoIngresso = await loadImageBase64('/img/fundo-ingresso.png');

            const ticketW = 108, ticketH = 60, pageW = 297, pageH = 210;
            const gapX = 0, gapY = 0;
            const marginX  = (pageW - ticketW * 2 - gapX) / 2;
            const marginTop = 5;
            const maxRows   = 3;

            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
            let pageRow = 0, colIdx = 0, isFirstPage = true;
            const rowY = (r) => marginTop + r * (ticketH + gapY);
            const newPage = () => { doc.addPage('a4', 'l'); pageRow = 0; colIdx = 0; isFirstPage = false; };

            // Agrupa mesas por assento (grupos de 4), individuais são solos
            const grupos = tipo === 'mesa'
                ? Array.from(lista.reduce((m, i) => {
                    const k = i.assento_id || i.id;
                    if (!m.has(k)) m.set(k, []);
                    m.get(k).push(i);
                    return m;
                  }, new Map()).values())
                : lista.map(i => [i]);

            let processados = 0;
            for (const grupo of grupos) {
                // Converte ingresso físico no formato esperado por drawTicketOnPage
                const vendas = grupo.map(i => ({
                    codigo_validacao: i.codigo_validacao,
                    tipo_ingresso:    i.tipo === 'acompanhante' ? 'individual' : i.tipo,
                    is_acompanhante:  i.tipo === 'acompanhante' ? 1 : 0,
                    numero_cadeira:   i.numero_cadeira,
                    numero_assento:   i.numero_assento || '',
                    cliente_nome:     '',
                    ra:               null,
                }));

                if (vendas.length >= 3) {
                    if (!isFirstPage && pageRow + 2 > maxRows) newPage();
                    if (isFirstPage) isFirstPage = false;
                    for (let i = 0; i < vendas.length && i < 4; i++) {
                        await drawTicketOnPage(doc, vendas[i], marginX + (i%2)*(ticketW+gapX), rowY(pageRow + Math.floor(i/2)), logoForriasc, logoIasc, fundoIngresso);
                    }
                    pageRow += 2; colIdx = 0;
                    if (pageRow >= maxRows) newPage();
                } else {
                    if (!isFirstPage && colIdx === 0 && pageRow >= maxRows) newPage();
                    if (isFirstPage) isFirstPage = false;
                    await drawTicketOnPage(doc, vendas[0], marginX + colIdx*(ticketW+gapX), rowY(pageRow), logoForriasc, logoIasc, fundoIngresso);
                    colIdx++;
                    if (colIdx >= 2) { colIdx = 0; pageRow++; }
                    if (pageRow >= maxRows && colIdx === 0) newPage();
                }

                processados += grupo.length;
                if (processados % 10 === 0 || processados === lista.length) {
                    setProgressGeracao(p => ({ ...p, atual: processados }));
                    // Yield to allow React to re-render the progress bar
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            savePdf(doc, `ingressos_pre_${tipo}.pdf`);
        } catch (err) {
            console.error('Erro PDF pré-geração:', err);
            await showModal('alert', 'Erro', 'Erro ao gerar PDF. Verifique o console.');
        } finally {
            setLoading(false);
            setProgressGeracao({ ativo: false, atual: 0, total: 0 });
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
                <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                            <Lock className="w-8 h-8" style={{ color: BRAND_COLOR }} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900">Admin Ticket</h2>
                        <p className="text-gray-500 text-sm">Acesse o painel de controle</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Usuário"
                                value={usuario}
                                onChange={e => setUsuario(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition-all"
                                style={{ '--tw-ring-color': BRAND_COLOR }}
                                required
                            />
                        </div>
                        <div className="relative">
                            <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Senha"
                                value={senha}
                                onChange={e => setSenha(e.target.value)}
                                className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition-all"
                                style={{ '--tw-ring-color': BRAND_COLOR }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        
                        {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-gray-200 disabled:opacity-50"
                        >
                            {loading ? 'Entrando...' : 'Entrar no Painel'}
                        </button>
                    </form>
                    
                    <button onClick={() => {
                        window.history.pushState({}, '', '/');
                        onBack();
                    }} className="w-full mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                        Voltar para o site
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-6 relative">
            {/* Overlay de progresso de geração de PDF */}
            {progressGeracao.ativo && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND_COLOR}20` }}>
                            <FileText className="w-7 h-7" style={{ color: BRAND_COLOR }} />
                        </div>
                        <h3 className="text-lg font-black text-gray-900 mb-1">Gerando PDF...</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            {progressGeracao.atual} de {progressGeracao.total} ingressos processados
                        </p>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-3 rounded-full transition-all duration-300"
                                style={{
                                    width: progressGeracao.total > 0
                                        ? `${Math.round((progressGeracao.atual / progressGeracao.total) * 100)}%`
                                        : '0%',
                                    backgroundColor: BRAND_COLOR
                                }}
                            />
                        </div>
                        <p className="text-gray-400 text-xs mt-2">
                            {progressGeracao.total > 0
                                ? `${Math.round((progressGeracao.atual / progressGeracao.total) * 100)}%`
                                : '0%'}
                        </p>
                    </div>
                </div>
            )}
            {/* Modal do Sistema */}
            {modalConfig && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-gray-900 mb-2">{modalConfig.title}</h3>
                        <p className="text-gray-600 text-sm mb-6">{modalConfig.message}</p>
                        
                        {modalConfig.type === 'prompt' && (
                            <input 
                                type="text" 
                                id="modalPromptInput"
                                defaultValue={modalConfig.defaultValue} 
                                className="w-full border border-gray-300 p-3 rounded-xl mb-6 focus:ring-2 focus:outline-none transition-all"
                                style={{ '--tw-ring-color': BRAND_COLOR }}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        modalConfig.onConfirm(e.target.value);
                                    }
                                }}
                            />
                        )}
                        
                        <div className="flex justify-end gap-3">
                            {modalConfig.type !== 'alert' && (
                                <button 
                                    onClick={modalConfig.onCancel} 
                                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    if (modalConfig.type === 'prompt') {
                                        const val = document.getElementById('modalPromptInput').value;
                                        modalConfig.onConfirm(val);
                                    } else {
                                        modalConfig.onConfirm(true);
                                    }
                                }}
                                className="px-5 py-2 text-sm font-bold text-white rounded-xl shadow-md transition-all hover:opacity-90"
                                style={{ backgroundColor: BRAND_COLOR }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TABS DE NAVEGAÇÃO */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl self-center sm:self-start">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Monitoramento
                </button>
                <button 
                    onClick={() => setActiveTab('ingressos')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ingressos' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Ingressos Físicos
                </button>
                <button
                    onClick={() => setActiveTab('checkin')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'checkin' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Entrada (Check-in)
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Settings className="w-4 h-4" /> Configurações
                </button>
            </div>

            <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white">
                        {activeTab === 'dashboard' ? <LayoutDashboard className="w-6 h-6" /> : activeTab === 'ingressos' ? <Package className="w-6 h-6" /> : activeTab === 'config' ? <Settings className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{activeTab === 'dashboard' ? 'Dashboard de Vendas' : activeTab === 'ingressos' ? 'Ingressos Físicos' : activeTab === 'config' ? 'Configurações de Lotes' : 'Controle de Portaria'}</h2>
                        <p className="text-xs text-gray-500">{activeTab === 'dashboard' ? 'Monitoramento em tempo real' : activeTab === 'ingressos' ? 'Controle de entrega dos ingressos pré-impressos' : activeTab === 'config' ? 'Datas e preços dos lotes de ingressos' : 'Validação de ingressos e entrada'}</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {activeTab === 'dashboard' && (
                        <>
                            <button 
                                onClick={generatePulseiraBatch}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                            >
                                <Ticket className="w-4 h-4" /> Gerar Pulseiras Cortesia
                            </button>
                            <div className="flex gap-1 flex-wrap">
                                <button 
                                    onClick={() => generateAllRealTickets(loteAtual)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-sm font-bold transition-colors"
                                    style={{ backgroundColor: BRAND_COLOR }}
                                    title={`Gerar ingressos do Lote ${loteAtual} (lote ativo agora)`}
                                >
                                    <Download className="w-4 h-4" />
                                    Lote Atual ({loteAtual})
                                    <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">ATIVO</span>
                                </button>
                                {[1, 2, 3].filter(l => l !== loteAtual).map(l => (
                                    <button key={l}
                                        onClick={() => generateAllRealTickets(l)}
                                        className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Lote {l}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => generateAllRealTickets(0)}
                                    className="flex items-center gap-1 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-200 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Todos
                                </button>
                            </div>
                        </>
                    )}
                    {activeTab === 'ingressos' && (
                        <>
                            <button onClick={() => generatePreTicketsPDF('mesa')} disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors disabled:opacity-50">
                                <Download className="w-4 h-4" /> PDF Mesas
                            </button>
                            <button onClick={() => generatePreTicketsPDF('individual')} disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                                <Download className="w-4 h-4" /> PDF Individuais
                            </button>
                            <button onClick={() => generatePreTicketsPDF('acompanhante')} disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700 transition-colors disabled:opacity-50">
                                <Download className="w-4 h-4" /> PDF Acompanhantes
                            </button>
                            <button onClick={fetchIngressosFisicos}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">
                                <RefreshCw className="w-4 h-4" /> Atualizar
                            </button>
                        </>
                    )}
                    <button 
                        onClick={handleLogout}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>
            </div>

            {activeTab === 'dashboard' ? (
                <>
                {/* Estatísticas Rápidas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total de Vendas</div>
                        <div className="text-2xl font-black text-gray-900">{groupedAllVendas.length}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="text-emerald-500 text-xs font-bold uppercase tracking-wider mb-1">Pagos</div>
                        <div className="text-2xl font-black text-gray-900">
                            {groupedAllVendas.filter(v => v.status_pagamento === 'aprovado').length}
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1">Pendentes</div>
                        <div className="text-2xl font-black text-gray-900">
                            {groupedAllVendas.filter(v => v.status_pagamento === 'pendente').length}
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Arrecadação</div>
                        <div className="text-2xl font-black text-gray-900">
                            R$ {groupedAllVendas.filter(v => v.status_pagamento === 'aprovado').reduce((acc, v) => acc + (v._total ?? parseFloat(v.preco || 0)), 0).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Tabela de Vendas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar cliente ou RA..."
                                    value={filtro}
                                    onChange={e => setFiltro(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 transition-all"
                                    style={{ '--tw-ring-color': BRAND_COLOR }}
                                />
                            </div>
                            
                            <select 
                                value={filtroStatus} 
                                onChange={e => setFiltroStatus(e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none"
                            >
                                <option value="todos">Todos os Status</option>
                                <option value="aprovado">Aprovados</option>
                                <option value="pendente">Pendentes</option>
                                <option value="recusado">Recusados</option>
                            </select>

                            <select 
                                value={filtroTipo} 
                                onChange={e => setFiltroTipo(e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none"
                            >
                                <option value="todos">Todos os Tipos</option>
                                <option value="mesa">Mesas</option>
                                <option value="individual">Individuais</option>
                            </select>

                            {(filtro || filtroStatus !== 'todos' || filtroTipo !== 'todos') && (
                                <button 
                                    onClick={limparFiltros}
                                    className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2"
                                >
                                    <XCircle className="w-4 h-4" /> Limpar Filtros
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <button 
                                onClick={fetchVendas} 
                                disabled={refreshing}
                                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Atualizar Lista
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-emerald-600 text-white text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4">Cliente / RA</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Assento</th>
                                    <th className="px-6 py-4">Lote</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Valor</th>
                                    <th className="px-6 py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {grouparVendas(filteredVendas).map((v) => (
                                    <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs font-bold text-gray-900">{new Date(v.data_venda).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-gray-400">{new Date(v.data_venda).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900">{v.cliente_nome}</div>
                                            <div className="text-xs text-gray-500">{v.cliente_email}</div>
                                            {v.ra && <div className="mt-1 text-[10px] bg-gray-100 inline-block px-1.5 py-0.5 rounded font-bold text-gray-600">RA: {v.ra}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${v.tipo_ingresso === 'mesa' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {v.tipo_ingresso === 'mesa' ? 'Mesa' : v._qtd > 1 ? `${v._qtd}× Individual` : 'Individual'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-gray-700">{v.numero_assento}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                parseInt(v.lote) === 3 ? 'bg-rose-100 text-rose-700' :
                                                parseInt(v.lote) === 2 ? 'bg-violet-100 text-violet-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                Lote {v.lote || 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                {v.status_pagamento === 'aprovado' ? (
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                ) : v.status_pagamento === 'recusado' ? (
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                ) : (
                                                    <Clock className="w-4 h-4 text-yellow-500" />
                                                )}
                                                <span className={`text-xs font-bold ${
                                                    v.status_pagamento === 'aprovado' ? 'text-emerald-600' : 
                                                    v.status_pagamento === 'recusado' ? 'text-red-600' : 'text-yellow-600'
                                                }`}>
                                                    {v.status_pagamento.toUpperCase()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-black text-gray-900">R$ {(v._total ?? parseFloat(v.preco || 0)).toFixed(2)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => generateSingleTicket(v)}
                                                disabled={loading || v.status_pagamento !== 'aprovado'}
                                                title="Baixar Ingresso"
                                                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-20"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredVendas.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                            <FileText className="w-12 h-12 mb-4 opacity-10" />
                            <p className="text-sm">Nenhuma venda encontrada.</p>
                        </div>
                    )}
                </div>
                </>
            ) : activeTab === 'ingressos' ? (
                /* ABA INGRESSOS FÍSICOS */
                <>
                {/* Resumo de status */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {['disponivel','reservado','entregue'].map(s => {
                        const count = ingressosFisicos.filter(i => i.status === s).length;
                        const colors = { disponivel: 'text-blue-600', reservado: 'text-yellow-600', entregue: 'text-emerald-600' };
                        const labels = { disponivel: 'Disponíveis', reservado: 'Reservados', entregue: 'Entregues' };
                        return (
                            <div key={s} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <div className={`${colors[s]} text-xs font-bold uppercase tracking-wider mb-1`}>{labels[s]}</div>
                                <div className="text-2xl font-black text-gray-900">{count}</div>
                            </div>
                        );
                    })}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Ingressos</div>
                        <div className="text-2xl font-black text-gray-900">{ingressosFisicos.length}</div>
                    </div>
                </div>

                {/* Tabela de ingressos físicos */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Buscar código, nome, RA, mesa..."
                                value={filtroIF} onChange={e => setFiltroIF(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none" />
                        </div>
                        <select value={filtroIFTipo} onChange={e => setFiltroIFTipo(e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none">
                            <option value="todos">Todos os Tipos</option>
                            <option value="mesa">Mesa</option>
                            <option value="individual">Individual</option>
                            <option value="acompanhante">Acompanhante</option>
                        </select>
                        <select value={filtroIFStatus} onChange={e => setFiltroIFStatus(e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none">
                            <option value="todos">Todos os Status</option>
                            <option value="disponivel">Disponível</option>
                            <option value="reservado">Reservado</option>
                            <option value="entregue">Entregue</option>
                        </select>
                        <button onClick={fetchIngressosFisicos}
                            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors ml-auto">
                            <RefreshCw className="w-4 h-4" /> Atualizar Lista
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-purple-700 text-white text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-4 py-3">Código / Tipo</th>
                                    <th className="px-4 py-3">Mesa / Cadeira</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Comprador</th>
                                    <th className="px-4 py-3">RA</th>
                                    <th className="px-4 py-3">Pagamento</th>
                                    <th className="px-4 py-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {ingressosFisicos.filter(i => {
                                    const matchTipo = filtroIFTipo === 'todos' || i.tipo === filtroIFTipo;
                                    const matchStatus = filtroIFStatus === 'todos' || i.status === filtroIFStatus;
                                    const q = filtroIF.toLowerCase();
                                    const matchText = !q ||
                                        (i.codigo_validacao || '').includes(q) ||
                                        (i.cliente_nome || '').toLowerCase().includes(q) ||
                                        (i.ra || '').includes(q) ||
                                        (i.numero_assento || '').toLowerCase().includes(q);
                                    return matchTipo && matchStatus && matchText;
                                }).map(i => (
                                    <tr key={i.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-sm font-bold text-gray-900">{i.codigo_validacao}</div>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                i.tipo === 'mesa' ? 'bg-purple-100 text-purple-600' :
                                                i.tipo === 'individual' ? 'bg-blue-100 text-blue-600' :
                                                'bg-cyan-100 text-cyan-600'
                                            }`}>{i.tipo}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {i.numero_assento ? (
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900">{i.numero_assento}</div>
                                                    {i.numero_cadeira && <div className="text-xs text-gray-500">Cadeira {i.numero_cadeira}/4</div>}
                                                </div>
                                            ) : <span className="text-gray-400 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                i.status === 'entregue' ? 'bg-emerald-100 text-emerald-700' :
                                                i.status === 'reservado' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>{i.status}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {i.cliente_nome ? (
                                                <div className="text-sm text-gray-900 font-medium">{i.cliente_nome}</div>
                                            ) : <span className="text-gray-400 text-xs italic">Não vendido</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {i.ra ? <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-600">{i.ra}</span>
                                                   : <span className="text-gray-400 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {i.status_pagamento ? (
                                                <span className={`text-[10px] font-bold uppercase ${
                                                    i.status_pagamento === 'aprovado' ? 'text-emerald-600' :
                                                    i.status_pagamento === 'recusado' ? 'text-red-600' : 'text-yellow-600'
                                                }`}>{i.status_pagamento}</span>
                                            ) : <span className="text-gray-400 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {i.status === 'reservado' && i.order_nsu && (
                                                <button onClick={() => marcarEntregue(i.order_nsu)}
                                                    title="Marcar todos os ingressos deste pedido como entregues"
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors mx-auto">
                                                    <PackageCheck className="w-3.5 h-3.5" /> Entregue
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {ingressosFisicos.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                                <Package className="w-12 h-12 mb-4 opacity-10" />
                                <p className="text-sm">Nenhum ingresso físico encontrado. Execute o setup primeiro.</p>
                            </div>
                        )}
                    </div>
                </div>
                </>
            ) : activeTab === 'config' ? (
                /* ABA CONFIGURAÇÕES DE LOTES */
                <div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
                    {[1, 2, 3].map(n => {
                        const ini = `lote${n}_inicio`;
                        const fim = `lote${n}_fim`;
                        const pm  = `lote${n}_preco_mesa`;
                        const pi  = `lote${n}_preco_individual`;
                        const isAtual = loteAtual === n;
                        return (
                            <div key={n} className={`bg-white rounded-2xl shadow-sm border ${isAtual ? 'border-orange-300' : 'border-gray-100'} p-6`}>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black ${isAtual ? 'bg-orange-500' : 'bg-gray-400'}`}>{n}</div>
                                    <div>
                                        <h3 className="font-black text-gray-900">Lote {n}</h3>
                                        {isAtual && <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">● Ativo agora</span>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Data de Início</label>
                                        <input type="date" value={loteConfig[ini]} onChange={e => setLoteConfig(p => ({ ...p, [ini]: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': '#f16137' }} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Data de Fim</label>
                                        <input type="date" value={loteConfig[fim]} onChange={e => setLoteConfig(p => ({ ...p, [fim]: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': '#f16137' }} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Preço Mesa (R$)</label>
                                        <input type="number" step="0.01" min="0" value={loteConfig[pm]} onChange={e => setLoteConfig(p => ({ ...p, [pm]: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': '#f16137' }} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Preço Individual (R$)</label>
                                        <input type="number" step="0.01" min="0" value={loteConfig[pi]} onChange={e => setLoteConfig(p => ({ ...p, [pi]: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': '#f16137' }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <button onClick={saveConfig} disabled={savingConfig}
                        className="flex items-center justify-center gap-2 w-full py-4 text-white font-bold rounded-2xl shadow-lg transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: BRAND_COLOR }}>
                        <Save className="w-5 h-5" />
                        {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
                    </button>

                    <p className="text-xs text-gray-400 text-center">As alterações entram em vigor imediatamente após salvar. O sistema usará o lote correto com base na data de hoje.</p>
                </div>
            ) : (
                /* TELA DE CHECK-IN */
                <div className="w-full flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto items-start">
                    {/* Lado Esquerdo: Scanner e Resultado */}
                    <div className="flex-1 w-full flex flex-col gap-6 lg:sticky lg:top-24">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                            <Ticket className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Validar Ingresso</h3>
                        <p className="text-gray-500 text-sm mb-8 text-center">Posicione o scanner no código de barras ou digite o código do ingresso.</p>

                        <form onSubmit={handleCheckin} className="w-full">
                            <div className="w-full flex justify-center mb-6">
                                <div id="reader" className="w-full max-w-md overflow-hidden rounded-xl border-2 border-gray-100"></div>
                            </div>
                            <input 
                                type="text"
                                placeholder="Aguardando leitura do código..."
                                value={codigoCheckin}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, ''); // Apenas números
                                    setCodigoCheckin(val);
                                    if (val.length === 8) {
                                        handleCheckinAction(val);
                                    }
                                }}
                                autoFocus
                                className="w-full py-5 px-6 bg-gray-50 border-2 border-gray-100 rounded-2xl text-center text-2xl font-black tracking-widest focus:border-emerald-500 focus:bg-white outline-none transition-all uppercase"
                            />
                            <button 
                                type="submit" 
                                disabled={checkinLoading}
                                className="hidden" // Botão escondido para o scanner (Enter) funcionar
                            >
                                Validar
                            </button>
                        </form>
                    </div>

                    {resultadoCheckin && (
                        <div className={`p-8 rounded-3xl shadow-lg animate-[slideIn_0.3s_ease-out] border-l-8 ${resultadoCheckin.success ? 'bg-white border-emerald-500' : 'bg-white border-red-500'}`}>
                            {resultadoCheckin.success ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 text-emerald-600 mb-2">
                                        <CheckCircle className="w-8 h-8" />
                                        <span className="text-xl font-black uppercase tracking-tight">Entrada Autorizada</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                        <div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">Cliente</div>
                                            <div className="text-lg font-bold text-gray-900">{resultadoCheckin.cliente.nome}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">RA Aluno</div>
                                            <div className="text-lg font-bold text-gray-900">{resultadoCheckin.cliente.ra || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">Tipo de Ingresso</div>
                                            <div className="text-sm font-bold text-gray-700 uppercase">{resultadoCheckin.cliente.tipo}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">Assento/Mesa</div>
                                            <div className="text-sm font-bold text-gray-700 uppercase">{resultadoCheckin.cliente.assento}</div>
                                        </div>
                                    </div>
                                    
                                    {resultadoCheckin.stats_mesa && (
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <div className="text-[10px] text-gray-400 font-bold uppercase mb-2">Status da Mesa</div>
                                            <div className="flex gap-2">
                                                {[...Array(parseInt(resultadoCheckin.stats_mesa.total))].map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`w-10 h-3 rounded-full ${i < parseInt(resultadoCheckin.stats_mesa.entraram) ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                                    ></div>
                                                ))}
                                                <span className="text-xs font-bold text-gray-500 ml-2">
                                                    {resultadoCheckin.stats_mesa.entraram} / {resultadoCheckin.stats_mesa.total} presentes
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 text-red-600 mb-2">
                                        <XCircle className="w-8 h-8" />
                                        <span className="text-xl font-black uppercase tracking-tight">Acesso Negado</span>
                                    </div>
                                    <p className="text-gray-900 font-bold">{resultadoCheckin.message}</p>
                                    {resultadoCheckin.data_entrada && (
                                        <p className="text-xs text-gray-500">Este ingresso deu entrada em: {new Date(resultadoCheckin.data_entrada).toLocaleString()}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    </div>

                    {/* Lado Direito: Histórico */}
                    {checkinHistory.length > 0 && (
                        <div className="w-full lg:w-[400px] bg-white p-6 rounded-3xl shadow-sm border border-gray-100 lg:h-[calc(100vh-140px)] flex flex-col lg:sticky lg:top-24">
                            <h4 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2 shrink-0">
                                <Clock className="w-5 h-5 text-gray-400" /> Histórico de Leituras
                            </h4>
                            <div className="mb-4 relative shrink-0">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar nome, RA ou mesa..."
                                    value={buscaEntrada}
                                    onChange={e => setBuscaEntrada(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:border-emerald-500 transition-all"
                                />
                            </div>
                            <div className="flex gap-2 mb-4 shrink-0">
                                <button onClick={() => setFiltroCheckinStatus('todas')} className={`flex-1 py-1 text-xs font-bold rounded-lg transition-colors ${filtroCheckinStatus === 'todas' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Todas</button>
                                <button onClick={() => setFiltroCheckinStatus('permitidas')} className={`flex-1 py-1 text-xs font-bold rounded-lg transition-colors ${filtroCheckinStatus === 'permitidas' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Permitidas</button>
                                <button onClick={() => setFiltroCheckinStatus('negadas')} className={`flex-1 py-1 text-xs font-bold rounded-lg transition-colors ${filtroCheckinStatus === 'negadas' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Negadas</button>
                            </div>
                            <div className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[300px]">
                                {checkinHistory.filter(item => {
                                    if (filtroCheckinStatus === 'permitidas' && !item.success) return false;
                                    if (filtroCheckinStatus === 'negadas' && item.success) return false;

                                    if (!buscaEntrada) return true;
                                    const searchLower = buscaEntrada.toLowerCase();
                                    const nomeMatch = item.cliente?.nome?.toLowerCase().includes(searchLower);
                                    const raMatch = item.cliente?.ra?.toLowerCase().includes(searchLower);
                                    const assentoMatch = item.cliente?.assento?.toLowerCase().includes(searchLower);
                                    return nomeMatch || raMatch || assentoMatch;
                                }).map(item => (
                                    <div key={item.id} className={`p-4 rounded-xl border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 ${item.success ? 'border-emerald-500' : 'border-red-500'}`}>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                {item.success ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                                <span className={`font-bold ${item.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {item.success ? 'Autorizado' : 'Negado'}
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">• {item.time}</span>
                                            </div>
                                            <div className="mt-1">
                                                {item.success ? (
                                                    <div className="text-sm text-gray-600">
                                                        <span className="font-bold text-gray-900">{item.cliente?.nome}</span> 
                                                        {item.cliente?.ra && ` (RA: ${item.cliente.ra})`} - {item.cliente?.tipo.toUpperCase()} 
                                                        {item.cliente?.assento && ` (${item.cliente.assento}${item.cliente.cadeira ? ` · CAD ${item.cliente.cadeira}/4` : ''})`}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-600 font-bold">{item.message}</div>
                                                )}
                                                <div className="text-[10px] text-gray-400 font-mono mt-1">CÓD: {item.codigo}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {checkinHistory.filter(item => {
                                    if (filtroCheckinStatus === 'permitidas' && !item.success) return false;
                                    if (filtroCheckinStatus === 'negadas' && item.success) return false;

                                    if (!buscaEntrada) return true;
                                    const searchLower = buscaEntrada.toLowerCase();
                                    return item.cliente?.nome?.toLowerCase().includes(searchLower) || 
                                           item.cliente?.ra?.toLowerCase().includes(searchLower) || 
                                           item.cliente?.assento?.toLowerCase().includes(searchLower);
                                }).length === 0 && (
                                    <div className="text-center text-gray-400 text-sm mt-4">Nenhum registro encontrado.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
