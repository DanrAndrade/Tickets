<?php
require_once 'config/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit();
}

require_once 'auth_middleware.php';

$data = json_decode(file_get_contents("php://input"), true);
$codigos = $data['codigos'] ?? [];

if (!verifyAuth($pdo)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado. Token inválido ou ausente."]);
    exit;
}

if (empty($codigos)) {
    echo json_encode(["success" => false, "message" => "Nenhum código fornecido."]);
    exit;
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("INSERT INTO vendas (assento_id, cliente_nome, cliente_email, ra, status_pagamento, order_nsu, tipo_ingresso, codigo_validacao) VALUES (NULL, 'PULSEIRA AVULSA', 'admin@iasc.com', NULL, 'aprovado', 'LOTE-AVULSO', 'individual', ?)");

    foreach ($codigos as $codigo) {
        $stmt->execute([$codigo]);
    }

    $pdo->commit();
    echo json_encode(["success" => true, "message" => count($codigos) . " pulseiras registradas com sucesso."]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor: " . $e->getMessage()]);
}
?>
