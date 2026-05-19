<?php
require_once 'config/db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') exit();

require_once 'auth_middleware.php';
if (!verifyAuth($pdo)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado."]);
    exit;
}

try {
    $stmt = $pdo->query("
        SELECT
            i.id,
            i.codigo_validacao,
            i.tipo,
            i.assento_id,
            i.numero_cadeira,
            i.status,
            i.order_nsu,
            i.criado_em,
            a.numero_assento,
            v.id            AS venda_id,
            v.cliente_nome,
            v.cliente_email,
            v.ra,
            v.status_pagamento,
            v.data_venda,
            v.is_acompanhante,
            v.lote,
            v.ja_entrou,
            v.data_entrada
        FROM ingressos_fisicos i
        LEFT JOIN assentos a ON i.assento_id = a.id
        LEFT JOIN vendas   v ON v.ingresso_fisico_id = i.id
        ORDER BY
            CASE i.status WHEN 'reservado' THEN 0 WHEN 'entregue' THEN 1 ELSE 2 END,
            i.tipo,
            a.numero_assento,
            i.numero_cadeira,
            i.id
    ");

    echo json_encode(["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
