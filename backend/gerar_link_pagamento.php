<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);
ob_start();

require_once 'config/db.php';
require_once 'config/constants.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['cliente_nome']) || !isset($data['cliente_email']) || !isset($data['session_id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dados do cliente incompletos."]);
    exit;
}

$handle       = INFINITEPAY_HANDLE;
$order_nsu    = "RES-" . uniqid();
$session_id   = $data['session_id'];
$tipo_compra  = isset($data['tipo']) ? $data['tipo'] : 'mesa';
$cliente_ra   = isset($data['cliente_ra']) ? trim($data['cliente_ra']) : '';

// --- BLOQUEIO: Plataforma fechada ---
if (LOTE_ATUAL === 0) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "As vendas pela plataforma foram encerradas em " . date('d/m/Y', strtotime(LOTE_2_FIM)) . ". O evento acontece em 12/06/2026."]);
    exit;
}

// --- VALIDAÇÃO DE RA (API IASC) ---
if (empty($cliente_ra)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "O RA é obrigatório para realizar a compra."]);
    exit;
}

$url_ra = RA_API_URL . $cliente_ra;
$ch_ra  = curl_init($url_ra);
curl_setopt_array($ch_ra, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HTTPHEADER     => ['X-Ingresso-Key: ' . RA_API_KEY],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);
$response_ra  = curl_exec($ch_ra);
$http_code_ra = curl_getinfo($ch_ra, CURLINFO_HTTP_CODE);
$curl_err_ra  = curl_error($ch_ra);
curl_close($ch_ra);

$aluno_data      = [];
$nome_aluno      = $data['cliente_nome'];
$unidade_desc    = '';
$no_ano_letivo   = true;
$is_irmas_vieira = false;
$api_ok          = false;

if ($http_code_ra === 200 && !empty($response_ra)) {
    $api_ok     = true;
    $aluno_data = json_decode($response_ra, true) ?? [];

    $unidade_desc    = $aluno_data['unidade_descricao'] ?? '';
    $nome_aluno      = $aluno_data['nome']              ?? $data['cliente_nome'];
    $no_ano_letivo   = $aluno_data['no_ano_letivo']     ?? false;
    $is_irmas_vieira = (
        stripos($unidade_desc, 'Irm') !== false &&
        stripos($unidade_desc, 'Vieira') !== false
    );

    if (!$no_ano_letivo) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Aluno sem matrícula ativa no ano letivo atual. Compra não permitida."]);
        exit;
    }

} elseif (!empty($curl_err_ra)) {
    ob_end_clean();
    http_response_code(503);
    echo json_encode(["success" => false, "message" => "Não foi possível conectar ao servidor do IASC. Tente novamente."]);
    exit;

} elseif ($http_code_ra >= 400 && $http_code_ra < 500) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "RA inválido ou não encontrado. Apenas alunos do IASC podem realizar compras."]);
    exit;

} else {
    error_log("[gerar_link] API IASC retornou HTTP $http_code_ra para RA=$cliente_ra. Compra liberada com aviso.");
}

// Validação de limite GLOBAL de 300 ingressos individuais
if ($tipo_compra === 'individual') {
    $LIMITE_GLOBAL_INDIVIDUAL = 300;
    $quantidade_pedida_global = intval($data['quantidade']);
    $stmt_global = $pdo->prepare(
        "SELECT COUNT(*) FROM vendas WHERE tipo_ingresso = 'individual' AND is_acompanhante = 0 AND status_pagamento IN ('pendente','aprovado')"
    );
    $stmt_global->execute();
    $total_vendidos     = (int) $stmt_global->fetchColumn();
    $disponiveis_global = $LIMITE_GLOBAL_INDIVIDUAL - $total_vendidos;

    if ($disponiveis_global <= 0) {
        echo json_encode(["success" => false, "message" => "Os 300 ingressos individuais do evento já foram esgotados. Consulte a organização."]);
        exit;
    }
    if ($quantidade_pedida_global > $disponiveis_global) {
        echo json_encode(["success" => false, "message" => "Restam apenas $disponiveis_global ingresso(s) individual(is) disponíveis. Ajuste a quantidade."]);
        exit;
    }
}

// Validação de limite por RA (máximo 2 por RA)
if ($tipo_compra === 'individual' && !empty($cliente_ra)) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM vendas WHERE ra = ? AND status_pagamento IN ('pendente', 'aprovado') AND tipo_ingresso = 'individual' AND is_acompanhante = 0");
    $stmt->execute([$cliente_ra]);
    $ja_comprados = $stmt->fetchColumn();

    $quantidade_pedida = intval($data['quantidade']);
    if (($ja_comprados + $quantidade_pedida) > 2) {
        $restantes = 2 - $ja_comprados;
        $msg = $restantes > 0
            ? "Este RA já possui $ja_comprados ingresso(s) pagos. Você só pode comprar mais $restantes (alunos do Vieira ganham o acompanhante grátis)."
            : "Este RA já atingiu o limite máximo de 2 ingressos individuais pagos.";
        echo json_encode(["success" => false, "message" => $msg]);
        exit;
    }
}

$valor_total_centavos = 0;
$descricao_payload    = "";

try {
    $pdo->beginTransaction();

    if ($tipo_compra === 'mesa') {
        if (!isset($data['assentos']) || empty($data['assentos'])) {
            throw new Exception("Nenhuma mesa selecionada.");
        }

        $valor_total = 0;
        $mesas_nomes = [];

        foreach ($data['assentos'] as $assento) {
            $assento_id      = $assento['id'];
            $preco           = $assento['preco'];
            $numero_assento  = $assento['numero_assento'];

            // Verifica disponibilidade do assento
            $stmt = $pdo->prepare("SELECT status, session_id FROM assentos WHERE id = ? FOR UPDATE");
            $stmt->execute([$assento_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row['status'] === 'vendido') {
                throw new Exception("A mesa " . $numero_assento . " já foi vendida.");
            }
            if ($row['status'] === 'bloqueado' && $row['session_id'] !== $session_id) {
                throw new Exception("A mesa " . $numero_assento . " está reservada por outra pessoa no momento.");
            }

            // Bloqueia assento
            $stmt = $pdo->prepare("UPDATE assentos SET status = 'bloqueado', tempo_bloqueio = DATE_ADD(NOW(), INTERVAL 10 MINUTE), session_id = ? WHERE id = ?");
            $stmt->execute([$session_id, $assento_id]);

            // Busca os 4 ingressos físicos pré-gerados para esta mesa
            $stmtIF = $pdo->prepare("SELECT id, codigo_validacao, numero_cadeira FROM ingressos_fisicos WHERE assento_id = ? AND status = 'disponivel' ORDER BY numero_cadeira LIMIT 4 FOR UPDATE");
            $stmtIF->execute([$assento_id]);
            $ingressosFisicos = $stmtIF->fetchAll(PDO::FETCH_ASSOC);

            if (count($ingressosFisicos) < 4) {
                throw new Exception("Ingressos físicos da mesa " . $numero_assento . " não encontrados. Contate a organização.");
            }

            // Reserva os ingressos físicos e cria as vendas vinculadas
            $stmtReservaIF = $pdo->prepare("UPDATE ingressos_fisicos SET status = 'reservado', order_nsu = ? WHERE id = ?");
            $stmtVenda     = $pdo->prepare("INSERT INTO vendas (ingresso_fisico_id, assento_id, cliente_nome, cliente_email, ra, status_pagamento, order_nsu, tipo_ingresso, numero_cadeira, codigo_validacao, lote) VALUES (?, ?, ?, ?, ?, 'pendente', ?, 'mesa', ?, ?, ?)");

            foreach ($ingressosFisicos as $ingFisico) {
                $stmtReservaIF->execute([$order_nsu, $ingFisico['id']]);
                $stmtVenda->execute([
                    $ingFisico['id'],
                    $assento_id,
                    $data['cliente_nome'],
                    $data['cliente_email'],
                    $cliente_ra,
                    $order_nsu,
                    $ingFisico['numero_cadeira'],
                    $ingFisico['codigo_validacao'],
                    LOTE_ATUAL
                ]);
            }

            $valor_total   += $preco;
            $mesas_nomes[] = $numero_assento;
        }

        $valor_total_centavos = (int) ($valor_total * 100);
        $descricao_payload    = "FORRIASC 2026 - Mesa(s): " . implode(", ", $mesas_nomes);

    } else if ($tipo_compra === 'individual') {
        $quantidade  = isset($data['quantidade']) ? intval($data['quantidade']) : 1;
        $valor_total = isset($data['valor_total']) ? floatval($data['valor_total']) : 0;

        if ($quantidade <= 0 || $valor_total <= 0) {
            throw new Exception("Quantidade ou valor inválido para ingresso individual.");
        }

        $stmtVenda = $pdo->prepare("INSERT INTO vendas (ingresso_fisico_id, assento_id, cliente_nome, cliente_email, ra, status_pagamento, order_nsu, tipo_ingresso, codigo_validacao, is_acompanhante, lote) VALUES (?, NULL, ?, ?, ?, 'pendente', ?, 'individual', ?, ?, ?)");

        for ($i = 0; $i < $quantidade; $i++) {
            // Busca 1 ingresso individual disponível
            $stmtIF = $pdo->prepare("SELECT id, codigo_validacao FROM ingressos_fisicos WHERE tipo = 'individual' AND status = 'disponivel' LIMIT 1 FOR UPDATE");
            $stmtIF->execute();
            $ingFisico = $stmtIF->fetch(PDO::FETCH_ASSOC);

            if (!$ingFisico) {
                throw new Exception("Ingressos individuais físicos esgotados. Contate a organização.");
            }

            // Reserva ingresso físico
            $pdo->prepare("UPDATE ingressos_fisicos SET status = 'reservado', order_nsu = ? WHERE id = ?")->execute([$order_nsu, $ingFisico['id']]);

            // Cria venda do aluno
            $stmtVenda->execute([
                $ingFisico['id'],
                $data['cliente_nome'],
                $data['cliente_email'],
                $cliente_ra,
                $order_nsu,
                $ingFisico['codigo_validacao'],
                0,
                LOTE_ATUAL
            ]);

            // Se for Irmãs Vieira, busca 2 ingressos de acompanhante
            if ($is_irmas_vieira) {
                $stmtAcomp = $pdo->prepare("SELECT id, codigo_validacao FROM ingressos_fisicos WHERE tipo = 'acompanhante' AND status = 'disponivel' LIMIT 2 FOR UPDATE");
                $stmtAcomp->execute();
                $acompTickets = $stmtAcomp->fetchAll(PDO::FETCH_ASSOC);

                if (count($acompTickets) < 2) {
                    throw new Exception("Ingressos de acompanhante físicos insuficientes. Contate a organização.");
                }

                foreach ($acompTickets as $acomp) {
                    $pdo->prepare("UPDATE ingressos_fisicos SET status = 'reservado', order_nsu = ? WHERE id = ?")->execute([$order_nsu, $acomp['id']]);
                    $stmtVenda->execute([
                        $acomp['id'],
                        $data['cliente_nome'] . " (Pai/Mãe)",
                        $data['cliente_email'],
                        $cliente_ra,
                        $order_nsu,
                        $acomp['codigo_validacao'],
                        1,
                        LOTE_ATUAL
                    ]);
                }
            }
        }

        $valor_total_centavos = (int) ($valor_total * 100);
        $desc_ext          = $is_irmas_vieira ? " + acompanhantes grátis" : "";
        $descricao_payload = "FORRIASC 2026 - " . ($quantidade > 1 ? "{$quantidade}x Ingresso Individual" : "Ingresso Individual") . $desc_ext;
    }

    // Payload para a InfinitePay
    $payload = [
        "handle"       => $handle,
        "order_nsu"    => $order_nsu,
        "redirect_url" => REDIRECT_URL,
        "webhook_url"  => WEBHOOK_URL,
        "items"        => [[
            "quantity"    => 1,
            "price"       => $valor_total_centavos,
            "description" => $descricao_payload
        ]],
        "customer" => [
            "name"  => $data['cliente_nome'],
            "email" => $data['cliente_email']
        ]
    ];

    $ch = curl_init("https://api.checkout.infinitepay.io/links");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response_json = curl_exec($ch);
    $http_code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $res = json_decode($response_json, true);

    if ($http_code == 201 || $http_code == 200) {
        $pdo->commit();
        echo json_encode(["success" => true, "payment_url" => $res['url']]);
    } else {
        throw new Exception("Falha na API de Pagamento: " . $response_json);
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();

    // Libera ingressos físicos reservados nesta tentativa (limpeza)
    try {
        $pdo->prepare("UPDATE ingressos_fisicos SET status = 'disponivel', order_nsu = NULL WHERE order_nsu = ?")->execute([$order_nsu]);
    } catch (Exception $ignored) {}

    $msg = $e->getMessage();
    error_log("[gerar_link_pagamento] ERRO: " . $msg);
    file_put_contents(__DIR__ . '/pagamento_error.log', date('Y-m-d H:i:s') . " - " . $msg . "\n", FILE_APPEND);
    http_response_code(400);
    echo json_encode(["success" => false, "message" => $msg]);
}
?>