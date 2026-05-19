<?php
// Suprimir erros PHP para não corromper o JSON
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit();
}

require_once 'config/constants.php';
require_once 'config/db.php';

$data = json_decode(file_get_contents("php://input"), true);
$ra   = isset($data['ra']) ? trim($data['ra']) : '';

function responder(array $payload, int $status = 200): void {
    ob_end_clean();
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($ra) || !ctype_digit($ra)) {
    responder(["success" => false, "message" => "RA inválido. Use apenas números."], 400);
}

// Chamada para a API real do IASC
$url_ra = RA_API_URL . $ra;
$ch     = curl_init($url_ra);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HTTPHEADER     => ['X-Ingresso-Key: ' . RA_API_KEY],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);
$response_raw = curl_exec($ch);
$http_code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error   = curl_error($ch);
curl_close($ch);

// --- Caso de sucesso da API ---
if ($http_code === 200 && !empty($response_raw)) {
    $aluno = json_decode($response_raw, true);

    if (!is_array($aluno)) {
        responder(["success" => false, "message" => "Resposta inválida da API do IASC."], 502);
    }

    $unidade_desc    = $aluno['unidade_descricao'] ?? '';
    $no_ano_letivo   = $aluno['no_ano_letivo']     ?? false;
    $is_irmas_vieira = (
        stripos($unidade_desc, 'Irm') !== false &&
        stripos($unidade_desc, 'Vieira') !== false
    );

    // Consulta o banco para verificar quantos ingressos individuais esse RA já comprou
    $LIMITE_POR_RA = 2;
    $stmt_limite = $pdo->prepare(
        "SELECT COUNT(*) FROM vendas WHERE ra = ? AND status_pagamento IN ('pendente','aprovado') AND tipo_ingresso = 'individual' AND is_acompanhante = 0"
    );
    $stmt_limite->execute([$ra]);
    $ja_comprados   = (int) $stmt_limite->fetchColumn();
    $ja_restantes   = max(0, $LIMITE_POR_RA - $ja_comprados);

    responder([
        "success"             => true,
        "nome"                => $aluno['nome']    ?? "Aluno ($ra)",
        "unidade"             => $aluno['unidade'] ?? 0,
        "unidade_descricao"   => $unidade_desc,
        "no_ano_letivo"       => (bool) $no_ano_letivo,
        "is_irmas_vieira"     => $is_irmas_vieira,
        "api_status"          => "ok",
        "message"             => "RA Válido",
        "ingressos_comprados" => $ja_comprados,
        "ingressos_restantes" => $ja_restantes,
        "limite"              => $LIMITE_POR_RA
    ]);
}

// --- Falha de conexão (timeout, sem rede) ---
if (!empty($curl_error)) {
    error_log("[validar_ra] cURL error RA=$ra: $curl_error");
    responder([
        "success"    => false,
        "api_status" => "connection_error",
        "message"    => "Não foi possível conectar ao servidor do IASC. Tente novamente."
    ], 503);
}

// --- Erro interno da API do IASC (HTTP 5xx) ---
// A API pode estar com problema temporário no banco de dados (erro 500).
// Neste caso, tratamos como indisponibilidade temporária e retornamos um
// status especial para o frontend poder informar o usuário adequadamente.
if ($http_code >= 500) {
    $error_body = json_decode($response_raw, true);
    $detail     = $error_body['detail'] ?? '';
    error_log("[validar_ra] API IASC erro $http_code para RA=$ra: $detail");

    responder([
        "success"    => false,
        "api_status" => "api_error",
        "http_code"  => $http_code,
        "message"    => "O servidor do IASC está com instabilidade no momento. Tente novamente em alguns minutos ou procure a organização do evento."
    ], 503);
}

// --- RA não encontrado (404) ou outro erro ---
responder([
    "success"    => false,
    "api_status" => "not_found",
    "message"    => "RA não encontrado no sistema do IASC. Verifique o número digitado."
], 404);
?>