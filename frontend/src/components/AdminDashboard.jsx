import React, { useEffect, useState } from 'react';
import axios from 'axios';

const AdminDashboard = () => {
    const [vendas, setVendas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVendas();
    }, []);

    const fetchVendas = async () => {
        try {
            // URL corrigida
            const res = await axios.get('http://localhost/reserva-forriasc/backend/listar_vendas.php');
            if (res.data.success) {
                setVendas(res.data.data);
            }
        } catch (error) {
            console.error("Erro ao buscar vendas", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Carregando dados...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Painel de Vendas</h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <thead>
                    <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                        <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Mesa</th>
                        <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Cliente</th>
                        <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Email</th>
                        <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>Valor</th>
                        <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>Data</th>
                    </tr>
                </thead>
                <tbody>
                    {vendas.length === 0 ? (
                        <tr>
                            <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>Nenhuma venda registrada ainda.</td>
                        </tr>
                    ) : (
                        vendas.map(venda => (
                            <tr key={venda.id} style={{ backgroundColor: '#fff' }}>
                                <td style={{ padding: '12px', border: '1px solid #ddd' }}><strong>{venda.numero_assento}</strong></td>
                                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{venda.cliente_nome}</td>
                                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{venda.cliente_email}</td>
                                <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>R$ {venda.preco}</td>
                                <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        backgroundColor: venda.status_pagamento === 'aprovado' ? '#d4edda' : '#fff3cd',
                                        color: venda.status_pagamento === 'aprovado' ? '#155724' : '#856404'
                                    }}>
                                        {venda.status_pagamento.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', fontSize: '14px' }}>
                                    {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default AdminDashboard;