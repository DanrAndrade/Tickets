<?php
// Script de migração: roda uma vez para adicionar numero_cadeira à tabela vendas
require_once 'config/db.php';
header('Content-Type: application/json');

try {
    // Verifica se a coluna já existe
    $check = $pdo->query("SHOW COLUMNS FROM vendas LIKE 'numero_cadeira'");
    if ($check->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Coluna numero_cadeira já existe.']);
        exit;
    }

    $pdo->exec("ALTER TABLE vendas ADD COLUMN numero_cadeira TINYINT UNSIGNED NULL AFTER tipo_ingresso");
    echo json_encode(['success' => true, 'message' => 'Coluna numero_cadeira adicionada com sucesso.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
