export const EVENT_INFO = {
    title: 'FORRIASC 2026',
    theme: 'Nordeste, o nosso reino encantado',
    date: 'Sexta, 12 de Junho de 2026',
    dateISO: '2026-06-12',
    location: 'Colégio IASC',
    maxTickets: 10
};

export const BRAND_COLOR = '#f16137';
export const BRAND_COLOR_HOVER = '#d04921';

export const API_BASE_URL = 'http://localhost/reserva-forriasc/backend';

// Gera e armazena um ID único para o navegador do cliente
export const getSessionId = () => {
    let sid = localStorage.getItem('site_session_id');
    if (!sid) {
        sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('site_session_id', sid);
    }
    return sid;
};