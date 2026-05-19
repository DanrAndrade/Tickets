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
$codigo = $data['codigo'] ?? '';

if (!verifyAuth($pdo)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado. Token inválido ou ausente."]);
    exit;
}

if (empty($codigo)) {
    echo json_encode(["success" => false, "message" => "Código é obrigatório."]);
    exit;
}

try {
    // 1. Buscar a venda pelo código de validação
    $stmt = $pdo->prepare("SELECT v.*, a.numero_assento 
                          FROM vendas v 
                          LEFT JOIN assentos a ON v.assento_id = a.id 
                          WHERE v.codigo_validacao = ?");
    $stmt->execute([$codigo]);
    $venda = $stmt->fetch(PDO::FETCH_ASSOC);

    // Função helper para logar
    $registrarLog = function($status, $msg, $v = null) use ($pdo, $codigo) {
        $stmt = $pdo->prepare("INSERT INTO checkin_logs (codigo_ingresso, status_leitura, mensagem, cliente_nome, ra, tipo_ingresso, numero_assento, numero_cadeira) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $codigo,
            $status,
            $msg,
            $v['cliente_nome'] ?? null,
            $v['ra'] ?? null,
            $v['tipo_ingresso'] ?? null,
            $v['numero_assento'] ?? null,
            $v['numero_cadeira'] ?? null
        ]);
    };

    if (!$venda) {
        $msg = "Ingresso não encontrado ou inválido.";
        $registrarLog('negado_invalido', $msg);
        echo json_encode(["success" => false, "message" => $msg]);
        exit;
    }

    if ($venda['status_pagamento'] !== 'aprovado') {
        $msg = "Este ingresso ainda não teve o pagamento aprovado.";
        $registrarLog('negado_pagamento', $msg, $venda);
        echo json_encode(["success" => false, "message" => $msg]);
        exit;
    }

    if ($venda['ja_entrou']) {
        $msg = "Atenção! Este ingresso já foi utilizado.";
        $registrarLog('negado_ja_usado', $msg, $venda);
        echo json_encode([
            "success" => false, 
            "message" => $msg,
            "data_entrada" => $venda['data_entrada']
        ]);
        exit;
    }

    // 2. Realizar o check-in
    $stmt = $pdo->prepare("UPDATE vendas SET ja_entrou = TRUE, data_entrada = NOW() WHERE id = ?");
    $stmt->execute([$venda['id']]);

    // 3. Se for mesa, buscar status da mesa (quantos entraram do mesmo pedido)
    $stats = null;
    if ($venda['tipo_ingresso'] === 'mesa') {
        $stmt = $pdo->prepare("SELECT COUNT(*) as total, SUM(ja_entrou) as entraram 
                              FROM vendas 
                              WHERE order_nsu = ? AND tipo_ingresso = 'mesa'");
        $stmt->execute([$venda['order_nsu']]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    $msg = "Check-in realizado com sucesso!";
    $registrarLog('autorizado', $msg, $venda);

    echo json_encode([
        "success" => true,
        "message" => $msg,
        "cliente" => [
            "nome" => $venda['cliente_nome'],
            "ra" => $venda['ra'],
            "tipo" => $venda['tipo_ingresso'],
            "assento" => $venda['numero_assento'] ?? 'Individual',
            "cadeira" => $venda['numero_cadeira'] ?? null
        ],
        "stats_mesa" => $stats
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor: " . $e->getMessage()]);
}
?>
