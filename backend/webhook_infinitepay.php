<?php
require_once 'config/db.php';

$log_file = 'webhook_log.txt';
$payload  = file_get_contents('php://input');
file_put_contents($log_file, date('Y-m-d H:i:s') . " - Recebido: " . $payload . "\n", FILE_APPEND);

$data = json_decode($payload, true);

if (!$data || !isset($data['order_nsu'])) {
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Erro: Payload invalido ou sem order_nsu\n", FILE_APPEND);
    http_response_code(400);
    exit("Invalid Payload");
}

$order_nsu      = $data['order_nsu'];
$transaction_id = $data['transaction_nsu'] ?? 'sem-id';
$status_evento  = strtolower($data['status'] ?? 'approved'); // 'approved' | 'refused' | 'cancelled'

try {
    $pdo->beginTransaction();

    // Idempotência — evita processar duas vezes
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM vendas WHERE order_nsu = ? AND status_pagamento = 'aprovado'");
    $checkStmt->execute([$order_nsu]);
    if ($checkStmt->fetchColumn() > 0) {
        $pdo->rollBack();
        file_put_contents($log_file, date('Y-m-d H:i:s') . " - Ignorado: Pedido $order_nsu ja estava aprovado.\n\n", FILE_APPEND);
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "already_processed"]);
        exit;
    }

    if ($status_evento === 'refused' || $status_evento === 'cancelled') {
        // Pagamento recusado — libera ingressos físicos e marca vendas como recusado
        $pdo->prepare("UPDATE vendas SET status_pagamento = 'recusado', transaction_id = ? WHERE order_nsu = ?")->execute([$transaction_id, $order_nsu]);
        $pdo->prepare("UPDATE assentos a INNER JOIN vendas v ON v.assento_id = a.id SET a.status = 'livre', a.tempo_bloqueio = NULL, a.session_id = NULL WHERE v.order_nsu = ? AND v.assento_id IS NOT NULL")->execute([$order_nsu]);
        // Libera os ingressos físicos de volta para disponivel
        $pdo->prepare("UPDATE ingressos_fisicos SET status = 'disponivel', order_nsu = NULL WHERE order_nsu = ?")->execute([$order_nsu]);

        $pdo->commit();
        file_put_contents($log_file, date('Y-m-d H:i:s') . " - Pagamento RECUSADO para $order_nsu. Ingressos liberados.\n\n", FILE_APPEND);
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "refused_processed"]);
        exit;
    }

    // Pagamento APROVADO
    // 1. Atualiza vendas
    $stmt = $pdo->prepare("UPDATE vendas SET status_pagamento = 'aprovado', transaction_id = ? WHERE order_nsu = ?");
    $stmt->execute([$transaction_id, $order_nsu]);
    $vendasAfetadas = $stmt->rowCount();
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Vendas atualizadas: $vendasAfetadas linha(s) para order_nsu=$order_nsu\n", FILE_APPEND);

    // 2. Atualiza assentos para 'vendido'
    $stmtAssento = $pdo->prepare("
        UPDATE assentos a
        INNER JOIN vendas v ON v.assento_id = a.id
        SET a.status = 'vendido', a.tempo_bloqueio = NULL, a.session_id = NULL
        WHERE v.order_nsu = ? AND v.assento_id IS NOT NULL
    ");
    $stmtAssento->execute([$order_nsu]);
    $assentosAfetados = $stmtAssento->rowCount();
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Assentos atualizados: $assentosAfetados linha(s) para order_nsu=$order_nsu\n", FILE_APPEND);

    // 3. Ingressos físicos permanecem 'reservado' até entrega física (admin marca como 'entregue')

    // 4. Busca dados do comprador e ingressos para enviar email de confirmação
    $stmtEmail = $pdo->prepare("
        SELECT v.cliente_nome, v.cliente_email, v.numero_cadeira, v.codigo_validacao,
               v.tipo_ingresso, v.is_acompanhante,
               a.numero_assento,
               i.tipo AS tipo_fisico
        FROM vendas v
        LEFT JOIN assentos a         ON v.assento_id = a.id
        LEFT JOIN ingressos_fisicos i ON v.ingresso_fisico_id = i.id
        WHERE v.order_nsu = ?
    ");
    $stmtEmail->execute([$order_nsu]);
    $vendasEmail = $stmtEmail->fetchAll(PDO::FETCH_ASSOC);

    $pdo->commit();
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Sucesso: Pedido $order_nsu processado. Vendas=$vendasAfetadas, Assentos=$assentosAfetados\n\n", FILE_APPEND);

    // Envia email ao comprador (fora da transação para não afetar o commit)
    if (!empty($vendasEmail)) {
        $compradorNome  = $vendasEmail[0]['cliente_nome']  ?? '';
        $compradorEmail = $vendasEmail[0]['cliente_email'] ?? '';

        if (!empty($compradorEmail)) {
            require_once __DIR__ . '/send_email.php';

            $ingressosParaEmail = array_map(function($v) {
                $tipo = $v['tipo_fisico'] ?? ($v['is_acompanhante'] ? 'acompanhante' : $v['tipo_ingresso']);
                return [
                    'codigo_validacao' => $v['codigo_validacao'],
                    'tipo'             => $tipo,
                    'numero_assento'   => $v['numero_assento'] ?? null,
                    'numero_cadeira'   => $v['numero_cadeira'] ?? null,
                ];
            }, $vendasEmail);

            $emailEnviado = enviarEmailConfirmacao($compradorEmail, $compradorNome, $ingressosParaEmail, $order_nsu);
            file_put_contents($log_file, date('Y-m-d H:i:s') . " - Email para $compradorEmail: " . ($emailEnviado ? "ENVIADO" : "FALHOU") . "\n\n", FILE_APPEND);
        }
    }

    http_response_code(200);
    echo json_encode(["success" => true]);

} catch (Exception $e) {
    $pdo->rollBack();
    file_put_contents($log_file, date('Y-m-d H:i:s') . " - Erro no Banco de Dados: " . $e->getMessage() . "\n\n", FILE_APPEND);
    http_response_code(500);
}
?>