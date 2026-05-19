<?php
require_once 'config/db.php';

try {
    $pdo->beginTransaction();

    // 1. Apagar todas as vendas
    $pdo->exec("DELETE FROM vendas");

    // 2. Resetar todos os assentos/mesas para o estado inicial
    $pdo->exec("UPDATE assentos SET status = 'livre', tempo_bloqueio = NULL, session_id = NULL");

    // 3. Limpar o log do webhook para o novo teste
    file_put_contents('webhook_log.txt', "");

    $pdo->commit();
    echo "Sistema resetado com sucesso! Vendas apagadas e mesas liberadas.\n";
} catch (Exception $e) {
    $pdo->rollBack();
    die("Erro ao resetar: " . $e->getMessage() . "\n");
}
