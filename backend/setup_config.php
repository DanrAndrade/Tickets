<?php
/**
 * Cria a tabela configuracoes e insere os valores padrão dos lotes.
 * Execute UMA VEZ: /backend/setup_config.php
 */
require_once 'config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuracoes (
        chave        VARCHAR(50)  PRIMARY KEY,
        valor        VARCHAR(255) NOT NULL,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $defaults = [
        'lote1_inicio'           => '2026-05-19',
        'lote1_fim'              => '2026-05-29',
        'lote1_preco_mesa'       => '1.00',
        'lote1_preco_individual' => '1.00',
        'lote2_inicio'           => '2026-05-30',
        'lote2_fim'              => '2026-06-08',
        'lote2_preco_mesa'       => '1.00',
        'lote2_preco_individual' => '1.00',
        'lote3_inicio'           => '2026-06-09',
        'lote3_fim'              => '2026-06-12',
        'lote3_preco_mesa'       => '1.00',
        'lote3_preco_individual' => '1.00',
    ];

    $stmt = $pdo->prepare("INSERT IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)");
    foreach ($defaults as $k => $v) {
        $stmt->execute([$k, $v]);
    }

    $atual = $pdo->query("SELECT chave, valor FROM configuracoes ORDER BY chave")
                 ->fetchAll(PDO::FETCH_KEY_PAIR);

    echo json_encode([
        'success' => true,
        'message' => 'Tabela configuracoes criada com sucesso.',
        'config'  => $atual,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
