<?php
/**
 * SCRIPT DE RESET COMPLETO
 * Apaga vendas, logs de check-in e reseta ingressos físicos para 'disponivel'
 * USE APENAS EM AMBIENTE DE TESTES
 */
require_once 'config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo->beginTransaction();

    // 1. Apaga logs de check-in
    $deletedLogs = 0;
    try {
        $deletedLogs = $pdo->exec("DELETE FROM checkin_logs");
    } catch (Exception $e) { /* tabela pode não existir */ }

    // 2. Apaga todas as vendas
    $deletedVendas = $pdo->exec("DELETE FROM vendas");

    // 3. Reseta assentos para 'livre'
    $resetAssentos = $pdo->exec("UPDATE assentos SET status = 'livre', tempo_bloqueio = NULL, session_id = NULL");

    // 4. Reseta ingressos físicos para 'disponivel' (mantém os códigos pré-gerados)
    $resetIngressos = 0;
    try {
        $resetIngressos = $pdo->exec("UPDATE ingressos_fisicos SET status = 'disponivel', order_nsu = NULL");
    } catch (Exception $e) { /* tabela pode não existir ainda */ }

    $pdo->commit();

    echo json_encode([
        'success'             => true,
        'vendas_removidas'    => $deletedVendas,
        'logs_removidos'      => $deletedLogs,
        'assentos_liberados'  => $resetAssentos,
        'ingressos_resetados' => $resetIngressos,
        'message'             => 'Banco resetado com sucesso. Pronto para novos testes.'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
