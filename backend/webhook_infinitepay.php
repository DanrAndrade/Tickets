<?php
require_once 'config/db.php';

// Cria o arquivo de log para rastrearmos o erro
$log_file = 'webhook_log.txt';
$payload = file_get_contents('php://input');

file_put_contents($log_file, date('Y-m-d H:i:s') . " - Recebido: " . $payload . "\n", FILE_APPEND);

$data = json_decode($payload, true);

if (!$data || !isset($data['order_nsu'])) {
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Erro: Payload invalido ou sem order_nsu\n", FILE_APPEND);
    http_response_code(400);
    exit("Invalid Payload");
}

$order_nsu = $data['order_nsu'];
$transaction_id = $data['transaction_nsu'] ?? 'sem-id';

try {
    $pdo->beginTransaction();

    // 1. Atualiza a venda
    $stmt = $pdo->prepare("UPDATE vendas SET status_pagamento = 'aprovado', transaction_id = ? WHERE order_nsu = ?");
    $stmt->execute([$transaction_id, $order_nsu]);

    // 2. Atualiza o assento
    $stmtAssento = $pdo->prepare("UPDATE assentos SET status = 'vendido', tempo_bloqueio = NULL WHERE id = (SELECT assento_id FROM vendas WHERE order_nsu = ?)");
    $stmtAssento->execute([$order_nsu]);

    $pdo->commit();
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Sucesso: Venda do pedido $order_nsu processada no banco.\n\n", FILE_APPEND);

    http_response_code(200);
    echo json_encode(["success" => true]);

} catch (Exception $e) {
    $pdo->rollBack();
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Erro no Banco de Dados: " . $e->getMessage() . "\n", FILE_APPEND);
    http_response_code(500);
}
?>