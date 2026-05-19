<?php
// Configurações do Sistema
define('BASE_URL', 'http://localhost/reserva-forriasc');
define('API_BASE_URL', BASE_URL . '/backend');

// Configurações InfinitePay
define('INFINITEPAY_HANDLE', 'forriasc');
define('WEBHOOK_URL', 'https://brittle-unbounded-fetal.ngrok-free.dev/reserva-forriasc/backend/webhook_infinitepay.php');
define('REDIRECT_URL', 'http://localhost:5173');

// Configurações Validação RA (IASC)
define('RA_API_URL', 'https://45.181.220.226:8443/ingresso/aluno/');
define('RA_API_KEY', 'ingresso@2026');

// -------------------------------------------------------
// Lotes — valores padrão (substituídos pelo banco se disponível)
// ⚠ Para alterar preços em produção: use o painel Admin > Configurações
// -------------------------------------------------------
$_cfg_defaults = [
    'lote1_inicio'           => '2026-05-19',
    'lote1_fim'              => '2026-05-29',
    'lote1_preco_mesa'       => 1.00,   // Produção: 250.00
    'lote1_preco_individual' => 1.00,   // Produção: 65.00
    'lote2_inicio'           => '2026-05-30',
    'lote2_fim'              => '2026-06-08',
    'lote2_preco_mesa'       => 1.00,   // Produção: 280.00
    'lote2_preco_individual' => 1.00,   // Produção: 75.00
    'lote3_inicio'           => '2026-06-09',
    'lote3_fim'              => '2026-06-12',
    'lote3_preco_mesa'       => 1.00,   // Produção: 300.00
    'lote3_preco_individual' => 1.00,   // Produção: 85.00
];

// Tenta carregar do banco (tabela configuracoes)
$_cfg = $_cfg_defaults;
try {
    if (isset($pdo)) {
        $rows = $pdo->query("SELECT chave, valor FROM configuracoes")
                    ->fetchAll(PDO::FETCH_KEY_PAIR);
        if ($rows) $_cfg = array_merge($_cfg_defaults, array_map('trim', $rows));
    }
} catch (Exception $e) { /* tabela ainda não criada — usa defaults */ }

define('LOTE_1_INICIO', $_cfg['lote1_inicio']);
define('LOTE_1_FIM',    $_cfg['lote1_fim']);
define('LOTE_2_INICIO', $_cfg['lote2_inicio']);
define('LOTE_2_FIM',    $_cfg['lote2_fim']);
define('LOTE_3_INICIO', $_cfg['lote3_inicio']);
define('DATA_EVENTO',   $_cfg['lote3_fim']);

define('PRECO_MESA_LOTE1',        (float)$_cfg['lote1_preco_mesa']);
define('PRECO_INDIVIDUAL_LOTE1',  (float)$_cfg['lote1_preco_individual']);
define('PRECO_MESA_LOTE2',        (float)$_cfg['lote2_preco_mesa']);
define('PRECO_INDIVIDUAL_LOTE2',  (float)$_cfg['lote2_preco_individual']);
define('PRECO_MESA_LOTE3',        (float)$_cfg['lote3_preco_mesa']);
define('PRECO_INDIVIDUAL_LOTE3',  (float)$_cfg['lote3_preco_individual']);

// Determina lote atual
$hoje = date('Y-m-d');
if ($hoje > DATA_EVENTO) {
    define('LOTE_ATUAL', 0);
} elseif ($hoje >= LOTE_3_INICIO) {
    define('LOTE_ATUAL', 3);
} elseif ($hoje >= LOTE_2_INICIO) {
    define('LOTE_ATUAL', 2);
} elseif ($hoje >= LOTE_1_INICIO) {
    define('LOTE_ATUAL', 1);
} else {
    define('LOTE_ATUAL', 0);
}

$_lote = LOTE_ATUAL ?: 1;
define('PRECO_MESA_ATUAL',       constant("PRECO_MESA_LOTE{$_lote}"));
define('PRECO_INDIVIDUAL_ATUAL', constant("PRECO_INDIVIDUAL_LOTE{$_lote}"));
?>
