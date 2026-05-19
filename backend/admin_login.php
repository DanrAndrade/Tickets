<?php
require_once 'config/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);
$usuario = $data['usuario'] ?? '';
$senha = $data['senha'] ?? '';

if (empty($usuario) || empty($senha)) {
    echo json_encode(["success" => false, "message" => "Usuário e senha são obrigatórios."]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM admins WHERE usuario = ?");
    $stmt->execute([$usuario]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($admin && password_verify($senha, $admin['senha'])) {
        $token = bin2hex(random_bytes(32));
        $stmtUpdate = $pdo->prepare("UPDATE admins SET token = ? WHERE id = ?");
        $stmtUpdate->execute([$token, $admin['id']]);

        echo json_encode([
            "success" => true,
            "message" => "Login realizado com sucesso",
            "token" => $token,
            "admin" => [
                "id" => $admin['id'],
                "usuario" => $admin['usuario']
            ]
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Usuário ou senha incorretos."]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor: " . $e->getMessage()]);
}
