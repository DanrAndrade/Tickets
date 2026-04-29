<?php
require_once 'config/db.php';

// Headers de segurança e CORS (Evita bloqueios de Preflight do React)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$evento_id = isset($_GET['evento_id']) ? intval($_GET['evento_id']) : 1;

try {
    // 1. FAXINA AUTOMÁTICA: Libera assentos com bloqueio expirado (mais de 15 minutos)
    $pdo->query("UPDATE assentos SET status = 'livre', tempo_bloqueio = NULL WHERE status = 'bloqueado' AND tempo_bloqueio < NOW()");

    // 2. BUSCA OS ASSENTOS ATUALIZADOS SEMPRE NA ORDEM CORRETA
    $stmt = $pdo->prepare("SELECT id, numero_assento, status, preco FROM assentos WHERE evento_id = ? ORDER BY id ASC");
    $stmt->execute([$evento_id]);
    $assentos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "data" => $assentos]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>