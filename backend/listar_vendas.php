<?php
require_once 'config/db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit();
}

require_once 'auth_middleware.php';

if (!verifyAuth($pdo)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado. Token inválido ou ausente."]);
    exit;
}

try {
    // Tenta incluir numero_cadeira (pode não existir em DBs mais antigos)
    try {
        $stmt = $pdo->query("SELECT v.id, v.assento_id, v.cliente_nome, v.cliente_email, v.ra, v.status_pagamento, v.data_venda, v.order_nsu, v.tipo_ingresso, v.numero_cadeira, v.codigo_validacao, v.ja_entrou, v.data_entrada, v.is_acompanhante, v.lote,
                                COALESCE(a.numero_assento, 'Individual') as numero_assento, 
                                COALESCE(a.preco, e.preco_individual) as preco 
                         FROM vendas v 
                         LEFT JOIN assentos a ON v.assento_id = a.id 
                         CROSS JOIN (SELECT preco_individual FROM eventos LIMIT 1) e
                         ORDER BY v.lote, v.order_nsu, v.numero_cadeira, v.data_venda DESC");
    } catch (Exception $e2) {
        // Fallback sem numero_cadeira
        $stmt = $pdo->query("SELECT v.id, v.assento_id, v.cliente_nome, v.cliente_email, v.ra, v.status_pagamento, v.data_venda, v.order_nsu, v.tipo_ingresso, NULL as numero_cadeira, v.codigo_validacao, v.ja_entrou, v.data_entrada, v.is_acompanhante, v.lote,
                                COALESCE(a.numero_assento, 'Individual') as numero_assento, 
                                COALESCE(a.preco, e.preco_individual) as preco 
                         FROM vendas v 
                         LEFT JOIN assentos a ON v.assento_id = a.id 
                         CROSS JOIN (SELECT preco_individual FROM eventos LIMIT 1) e
                         ORDER BY v.lote, v.order_nsu, v.data_venda DESC");
    }

    $vendas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["success" => true, "data" => $vendas]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>