<?php
require_once 'config/db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $stmt = $pdo->query("SELECT v.id, v.cliente_nome, v.cliente_email, v.status_pagamento, v.data_venda, v.order_nsu, a.numero_assento, a.preco 
                         FROM vendas v 
                         JOIN assentos a ON v.assento_id = a.id 
                         ORDER BY v.data_venda DESC");

    $vendas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["success" => true, "data" => $vendas]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>