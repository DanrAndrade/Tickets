<?php
require_once 'config/db.php';

try {
    // 1. Criar tabela admins se não existir
    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Adicionar coluna ra em vendas se não existir
    $stmt = $pdo->query("SHOW COLUMNS FROM vendas LIKE 'ra'");
    if (!$stmt->fetch()) {
        $pdo->exec("ALTER TABLE vendas ADD COLUMN ra VARCHAR(50) AFTER cliente_email");
    }

    // 3. Adicionar coluna tipo_ingresso em vendas se não existir
    $stmt = $pdo->query("SHOW COLUMNS FROM vendas LIKE 'tipo_ingresso'");
    if (!$stmt->fetch()) {
        $pdo->exec("ALTER TABLE vendas ADD COLUMN tipo_ingresso ENUM('mesa', 'individual') DEFAULT 'individual' AFTER ra");
    }

    // 4. Inserir usuário admin se não existir
    $stmt = $pdo->prepare("SELECT id FROM admins WHERE usuario = ?");
    $stmt->execute(['ticket@iasc']);
    if (!$stmt->fetch()) {
        $hash = '$2y$10$tGh04CBL9TPaw.s8oT66VuxFxe45z2pQAscWR3AwtMgVjl2nuk5jW';
        $stmt = $pdo->prepare("INSERT INTO admins (usuario, senha) VALUES (?, ?)");
        $stmt->execute(['ticket@iasc', $hash]);
        echo "Admin criado com sucesso.\n";
    }

    echo "Banco de dados atualizado com sucesso.\n";
} catch (PDOException $e) {
    die("Erro ao atualizar banco de dados: " . $e->getMessage() . "\n");
}
