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

$data = json_decode(file_get_contents("php://input"), true);

// Aceita: { order_nsu: "RES-xxx" } para marcar toda a compra de uma vez
//      ou { ingresso_id: 42 }       para marcar ingresso individual
$order_nsu   = $data['order_nsu']   ?? null;
$ingresso_id = $data['ingresso_id'] ?? null;

if (!$order_nsu && !$ingresso_id) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Informe order_nsu ou ingresso_id."]);
    exit;
}

try {
    $pdo->beginTransaction();

    if ($order_nsu) {
        // Marca todos os ingressos do pedido como entregue
        $stmt = $pdo->prepare("UPDATE ingressos_fisicos SET status = 'entregue' WHERE order_nsu = ? AND status = 'reservado'");
        $stmt->execute([$order_nsu]);
        $afetados = $stmt->rowCount();
    } else {
        // Marca ingresso individual
        $stmt = $pdo->prepare("UPDATE ingressos_fisicos SET status = 'entregue' WHERE id = ? AND status = 'reservado'");
        $stmt->execute([$ingresso_id]);
        $afetados = $stmt->rowCount();
    }

    $pdo->commit();

    echo json_encode([
        "success"  => true,
        "afetados" => $afetados,
        "message"  => "$afetados ingresso(s) marcado(s) como entregue."
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
