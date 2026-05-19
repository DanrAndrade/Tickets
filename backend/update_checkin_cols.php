<?php
require_once 'config/db.php';

try {
    $pdo->exec("ALTER TABLE vendas ADD COLUMN codigo_validacao VARCHAR(50) UNIQUE AFTER transaction_id");
    $pdo->exec("ALTER TABLE vendas ADD COLUMN ja_entrou BOOLEAN DEFAULT FALSE AFTER codigo_validacao");
    $pdo->exec("ALTER TABLE vendas ADD COLUMN data_entrada DATETIME NULL AFTER ja_entrou");
    echo "Colunas de check-in adicionadas com sucesso.\n";
} catch (Exception $e) {
    echo "Erro (ou colunas já existem): " . $e->getMessage() . "\n";
}
