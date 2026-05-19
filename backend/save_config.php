<?php
require_once 'config/db.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') exit();

require_once 'auth_middleware.php';
if (!verifyAuth($pdo)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado."]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$allowed = [
    'lote1_inicio', 'lote1_fim', 'lote1_preco_mesa', 'lote1_preco_individual',
    'lote2_inicio', 'lote2_fim', 'lote2_preco_mesa', 'lote2_preco_individual',
    'lote3_inicio', 'lote3_fim', 'lote3_preco_mesa', 'lote3_preco_individual',
];

try {
    $stmt = $pdo->prepare(
        "INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_em = NOW()"
    );

    foreach ($allowed as $key) {
        if (array_key_exists($key, $data)) {
            $stmt->execute([$key, $data[$key]]);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Configurações salvas com sucesso.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
