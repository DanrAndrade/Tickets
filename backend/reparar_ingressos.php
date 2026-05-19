<?php
/**
 * SCRIPT DE REPARO COMPLETO DO BANCO DE DADOS
 * Execute UMA VEZ: /backend/reparar_ingressos.php
 */
require_once 'config/db.php';
header('Content-Type: application/json; charset=utf-8');

$relatorio = [];
$erros = [];

// =====================================================
// PASSO 1: DDL fora da transação (MySQL auto-commit em DDL)
// =====================================================
try {
    $check = $pdo->query("SHOW COLUMNS FROM vendas LIKE 'numero_cadeira'");
    if ($check->rowCount() === 0) {
        $pdo->exec("ALTER TABLE vendas ADD COLUMN numero_cadeira TINYINT UNSIGNED NULL AFTER tipo_ingresso");
        $relatorio[] = "✅ Coluna 'numero_cadeira' criada.";
    } else {
        $relatorio[] = "ℹ️ Coluna 'numero_cadeira' já existe.";
    }
} catch (Exception $e) {
    $erros[] = "Erro DDL: " . $e->getMessage();
}

// =====================================================
// PASSOS 2-4: DML dentro de transação
// =====================================================
try {
    $pdo->beginTransaction();

    // Passo 2: Gerar codigos faltantes
    $semCodigo = $pdo->query("SELECT id FROM vendas WHERE codigo_validacao IS NULL OR codigo_validacao = ''")->fetchAll(PDO::FETCH_COLUMN);
    $codigosGerados = 0;
    if (!empty($semCodigo)) {
        $stmtUpdate = $pdo->prepare("UPDATE vendas SET codigo_validacao = ? WHERE id = ?");
        foreach ($semCodigo as $id) {
            for ($t = 0; $t < 20; $t++) {
                $novo = str_pad(mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT);
                $existe = $pdo->prepare("SELECT id FROM vendas WHERE codigo_validacao = ? AND id != ?");
                $existe->execute([$novo, $id]);
                if (!$existe->fetch()) {
                    $stmtUpdate->execute([$novo, $id]);
                    $codigosGerados++;
                    break;
                }
            }
        }
        $relatorio[] = "✅ Códigos gerados para $codigosGerados ingressos.";
    } else {
        $relatorio[] = "ℹ️ Todos os ingressos já possuem código.";
    }

    // Passo 3: Numerar cadeiras e completar mesas
    $stmtMesas = $pdo->query("
        SELECT assento_id, order_nsu, GROUP_CONCAT(id ORDER BY id ASC) as ids, COUNT(*) as total
        FROM vendas
        WHERE tipo_ingresso = 'mesa' AND assento_id IS NOT NULL AND order_nsu IS NOT NULL
        GROUP BY assento_id, order_nsu
    ");
    $grupos = $stmtMesas->fetchAll(PDO::FETCH_ASSOC);

    $cadeirasCorrigidas = 0;
    $registrosCriados = 0;
    $stmtNum = $pdo->prepare("UPDATE vendas SET numero_cadeira = ? WHERE id = ?");

    foreach ($grupos as $grupo) {
        $ids = explode(',', $grupo['ids']);
        $total = (int)$grupo['total'];

        foreach ($ids as $idx => $vid) {
            $stmtNum->execute([$idx + 1, $vid]);
            $cadeirasCorrigidas++;
        }

        if ($total < 4) {
            $base = $pdo->prepare("SELECT * FROM vendas WHERE id = ? LIMIT 1");
            $base->execute([$ids[0]]);
            $row = $base->fetch(PDO::FETCH_ASSOC);

            $stmtIns = $pdo->prepare("INSERT INTO vendas
                (assento_id, cliente_nome, cliente_email, ra, status_pagamento, order_nsu, tipo_ingresso, numero_cadeira, codigo_validacao)
                VALUES (?, ?, ?, ?, ?, ?, 'mesa', ?, ?)");

            for ($i = $total + 1; $i <= 4; $i++) {
                $cod = '';
                for ($t = 0; $t < 20; $t++) {
                    $cod = str_pad(mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT);
                    $chk = $pdo->prepare("SELECT id FROM vendas WHERE codigo_validacao = ?");
                    $chk->execute([$cod]);
                    if (!$chk->fetch()) break;
                }
                $stmtIns->execute([
                    $row['assento_id'], $row['cliente_nome'], $row['cliente_email'],
                    $row['ra'], $row['status_pagamento'], $row['order_nsu'], $i, $cod
                ]);
                $registrosCriados++;
            }
        }
    }

    $relatorio[] = "✅ Cadeiras numeradas: $cadeirasCorrigidas. Registros criados: $registrosCriados.";

    // Passo 4: Numerar individuais
    $stmtInd = $pdo->query("
        SELECT order_nsu, GROUP_CONCAT(id ORDER BY id ASC) as ids
        FROM vendas WHERE tipo_ingresso = 'individual' AND order_nsu IS NOT NULL
        GROUP BY order_nsu
    ");
    $indNumerados = 0;
    foreach ($stmtInd->fetchAll(PDO::FETCH_ASSOC) as $g) {
        foreach (explode(',', $g['ids']) as $idx => $vid) {
            $stmtNum->execute([$idx + 1, $vid]);
            $indNumerados++;
        }
    }
    $relatorio[] = "✅ $indNumerados ingressos individuais numerados.";

    $pdo->commit();

    $totalVendas  = $pdo->query("SELECT COUNT(*) FROM vendas")->fetchColumn();
    $semCodFinal  = $pdo->query("SELECT COUNT(*) FROM vendas WHERE codigo_validacao IS NULL OR codigo_validacao = ''")->fetchColumn();

    echo json_encode([
        'success' => true,
        'relatorio' => $relatorio,
        'erros_ddl' => $erros,
        'total_ingressos' => (int)$totalVendas,
        'sem_codigo_restantes' => (int)$semCodFinal,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'relatorio_parcial' => $relatorio,
        'erros_ddl' => $erros,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>
