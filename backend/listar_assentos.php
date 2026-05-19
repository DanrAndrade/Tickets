<?php
require_once 'config/db.php';
require_once 'config/constants.php';

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
    // 1. FAXINA AUTOMÁTICA: Libera assentos com bloqueio expirado (mais de 10 minutos) e limpa o session_id
    // Também marca as vendas pendentes associadas a esses assentos como 'recusado'
    $pdo->query("UPDATE vendas v 
                 INNER JOIN assentos a ON v.assento_id = a.id 
                 SET v.status_pagamento = 'recusado' 
                 WHERE v.status_pagamento = 'pendente' 
                 AND a.status = 'bloqueado' 
                 AND a.tempo_bloqueio < NOW()");

    $pdo->query("UPDATE assentos SET status = 'livre', tempo_bloqueio = NULL, session_id = NULL WHERE status = 'bloqueado' AND tempo_bloqueio < NOW()");

    // Faxina geral: Vendas individuais pendentes há mais de 2 horas também são recusadas
    $pdo->query("UPDATE vendas SET status_pagamento = 'recusado' WHERE status_pagamento = 'pendente' AND data_venda < DATE_SUB(NOW(), INTERVAL 2 HOUR)");

    // 2. BUSCA OS ASSENTOS ATUALIZADOS COM O SESSION_ID
    $stmt = $pdo->prepare("SELECT id, numero_assento, status, preco, session_id FROM assentos WHERE evento_id = ? ORDER BY id ASC");
    $stmt->execute([$evento_id]);
    $assentos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Aplica preço do lote atual em todos os assentos
    $precoMesa = PRECO_MESA_ATUAL;
    $assentos = array_map(function($a) use ($precoMesa) {
        $a['preco'] = $precoMesa;
        return $a;
    }, $assentos);

    echo json_encode(["success" => true, "data" => $assentos]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>