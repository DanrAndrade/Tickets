<?php
require_once 'config/db.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS checkin_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo_ingresso VARCHAR(20) NOT NULL,
        status_leitura VARCHAR(50) NOT NULL,
        mensagem TEXT,
        cliente_nome VARCHAR(255),
        ra VARCHAR(50),
        tipo_ingresso VARCHAR(50),
        numero_assento VARCHAR(50),
        numero_cadeira INT,
        data_leitura TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";

    $pdo->exec($sql);
    echo "Tabela checkin_logs criada com sucesso.";
} catch (PDOException $e) {
    echo "Erro: " . $e->getMessage();
}
?>
