<?php
require_once 'config/db.php';

// Libera o CORS completamente
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Intercepta a requisição de segurança (preflight) do navegador e responde com OK
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['assento_id']) || !isset($data['cliente_nome']) || !isset($data['cliente_email']) || !isset($data['preco'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dados incompletos"]);
    exit;
}

// Sua InfiniteTag
$handle = "rodrigo-daniel-7u7";
$order_nsu = "RES-" . uniqid();

try {
    $pdo->beginTransaction();

    // Trava a linha do assento para evitar concorrência (venda dupla)
    $stmt = $pdo->prepare("SELECT status FROM assentos WHERE id = ? FOR UPDATE");
    $stmt->execute([$data['assento_id']]);
    $assento = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($assento['status'] !== 'livre') {
        throw new Exception("Esta mesa não está mais disponível.");
    }

    // Bloqueia a mesa por 15 minutos
    $stmt = $pdo->prepare("UPDATE assentos SET status = 'bloqueado', tempo_bloqueio = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?");
    $stmt->execute([$data['assento_id']]);

    // Registra a venda como pendente
    $stmt = $pdo->prepare("INSERT INTO vendas (assento_id, cliente_nome, cliente_email, status_pagamento, order_nsu) VALUES (?, ?, ?, 'pendente', ?)");
    $stmt->execute([$data['assento_id'], $data['cliente_nome'], $data['cliente_email'], $order_nsu]);

    // Payload para a InfinitePay
    $payload = [
        "handle" => $handle,
        "order_nsu" => $order_nsu,
        "redirect_url" => "http://localhost:5173",
        // A URL do Ngrok será inserida aqui
        "webhook_url" => "https://brittle-unbounded-fetal.ngrok-free.dev/reserva-forroiasc/backend/webhook_infinitepay.php",
        "items" => [
            [
                "quantity" => 1,
                "price" => (int) ($data['preco'] * 100), // Converte R$ 1,00 para 100 centavos
                "description" => "Reserva: " . $data['numero_assento']
            ]
        ],
        "customer" => [
            "name" => $data['cliente_nome'],
            "email" => $data['cliente_email']
        ]
    ];

    $ch = curl_init("https://api.checkout.infinitepay.io/links");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response_json = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $res = json_decode($response_json, true);

    if ($http_code == 201 || $http_code == 200) {
        $pdo->commit();
        echo json_encode(["success" => true, "payment_url" => $res['url']]);
    } else {
        throw new Exception("Falha na API de Pagamento: " . $response_json);
    }

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(400);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>