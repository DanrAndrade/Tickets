<?php
/**
 * SETUP: Cria tabela ingressos_fisicos e popula todos os ingressos.
 * Execute UMA VEZ: /backend/setup_ingressos_fisicos.php
 */
require_once 'config/db.php';
header('Content-Type: application/json; charset=utf-8');

$relatorio = [];
$erros     = [];

// Quantidade de ingressos individuais e acompanhantes a pré-gerar
$QTD_INDIVIDUAIS  = 300;
$QTD_ACOMPANHANTES = 254; // 127 alunos Irmãs Vieira × 2 acompanhantes

// ------------------------------------------------------------------
// PASSO 1 — DDL (fora de transação)
// ------------------------------------------------------------------
try {
    // Tabela principal
    $pdo->exec("CREATE TABLE IF NOT EXISTS ingressos_fisicos (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        codigo_validacao  VARCHAR(50) UNIQUE NOT NULL,
        tipo              ENUM('mesa','individual','acompanhante') NOT NULL,
        assento_id        INT NULL,
        numero_cadeira    TINYINT UNSIGNED NULL,
        status            ENUM('disponivel','reservado','entregue') DEFAULT 'disponivel',
        order_nsu         VARCHAR(255) NULL,
        criado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assento_id) REFERENCES assentos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $relatorio[] = "✅ Tabela 'ingressos_fisicos' criada/verificada.";

    // Coluna ingresso_fisico_id em vendas
    $chk = $pdo->query("SHOW COLUMNS FROM vendas LIKE 'ingresso_fisico_id'");
    if ($chk->rowCount() === 0) {
        $pdo->exec("ALTER TABLE vendas ADD COLUMN ingresso_fisico_id INT NULL AFTER id,
                    ADD CONSTRAINT fk_venda_ingresso FOREIGN KEY (ingresso_fisico_id)
                    REFERENCES ingressos_fisicos(id) ON DELETE SET NULL");
        $relatorio[] = "✅ Coluna 'ingresso_fisico_id' adicionada em vendas.";
    } else {
        $relatorio[] = "ℹ️ Coluna 'ingresso_fisico_id' já existe.";
    }
} catch (Exception $e) {
    $erros[] = "Erro DDL: " . $e->getMessage();
}

// ------------------------------------------------------------------
// PASSO 2 — Popula ingressos (dentro de transação)
// ------------------------------------------------------------------
try {
    $pdo->beginTransaction();

    // Função auxiliar: gera código único de 8 dígitos
    $gerarCodigo = function() use ($pdo) {
        for ($t = 0; $t < 30; $t++) {
            $c = str_pad(mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT);
            $chk = $pdo->prepare("SELECT id FROM ingressos_fisicos WHERE codigo_validacao = ?");
            $chk->execute([$c]);
            if (!$chk->fetch()) return $c;
        }
        throw new Exception("Não foi possível gerar código único.");
    };

    // --- MESAS: 4 ingressos por assento ---
    $assentos = $pdo->query("SELECT id, numero_assento FROM assentos ORDER BY id")
                    ->fetchAll(PDO::FETCH_ASSOC);
    $stmtMesa = $pdo->prepare("INSERT IGNORE INTO ingressos_fisicos
        (codigo_validacao, tipo, assento_id, numero_cadeira)
        VALUES (?, 'mesa', ?, ?)");

    $mesasGeradas = 0;
    foreach ($assentos as $ass) {
        // Verifica quantas cadeiras já existem para este assento
        $existentes = (int)$pdo->prepare("SELECT COUNT(*) FROM ingressos_fisicos WHERE assento_id = ?")
            ->execute([$ass['id']]) ? $pdo->query("SELECT COUNT(*) FROM ingressos_fisicos WHERE assento_id = {$ass['id']}")->fetchColumn() : 0;

        // Recount properly
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM ingressos_fisicos WHERE assento_id = ?");
        $stmtCount->execute([$ass['id']]);
        $existentes = (int)$stmtCount->fetchColumn();

        for ($cad = $existentes + 1; $cad <= 4; $cad++) {
            $stmtMesa->execute([$gerarCodigo(), $ass['id'], $cad]);
            $mesasGeradas++;
        }
    }
    $relatorio[] = "✅ $mesasGeradas ingressos de mesa gerados (" . count($assentos) . " mesas × 4 cadeiras).";

    // --- INDIVIDUAIS ---
    $stmtInd = $pdo->prepare("INSERT INTO ingressos_fisicos (codigo_validacao, tipo) VALUES (?, 'individual')");
    $existInd = (int)$pdo->query("SELECT COUNT(*) FROM ingressos_fisicos WHERE tipo = 'individual'")->fetchColumn();
    $indGerados = 0;
    for ($i = $existInd; $i < $QTD_INDIVIDUAIS; $i++) {
        $stmtInd->execute([$gerarCodigo()]);
        $indGerados++;
    }
    $relatorio[] = "✅ $indGerados ingressos individuais gerados (total: " . ($existInd + $indGerados) . "/{$QTD_INDIVIDUAIS}).";

    // --- ACOMPANHANTES (Irmãs Vieira) ---
    $stmtAcomp = $pdo->prepare("INSERT INTO ingressos_fisicos (codigo_validacao, tipo) VALUES (?, 'acompanhante')");
    $existAcomp = (int)$pdo->query("SELECT COUNT(*) FROM ingressos_fisicos WHERE tipo = 'acompanhante'")->fetchColumn();
    $acompGerados = 0;
    for ($i = $existAcomp; $i < $QTD_ACOMPANHANTES; $i++) {
        $stmtAcomp->execute([$gerarCodigo()]);
        $acompGerados++;
    }
    $relatorio[] = "✅ $acompGerados ingressos de acompanhante gerados (total: " . ($existAcomp + $acompGerados) . "/{$QTD_ACOMPANHANTES}).";

    $pdo->commit();

    $totais = $pdo->query("SELECT tipo, COUNT(*) as total, SUM(status='disponivel') as disponivel, SUM(status='reservado') as reservado, SUM(status='entregue') as entregue FROM ingressos_fisicos GROUP BY tipo")
                  ->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'  => true,
        'relatorio'=> $relatorio,
        'erros_ddl'=> $erros,
        'totais'   => $totais,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'success'           => false,
        'message'           => $e->getMessage(),
        'relatorio_parcial' => $relatorio,
        'erros_ddl'         => $erros,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>
