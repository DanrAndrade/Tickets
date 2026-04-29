<?php
$host = 'localhost';
$db = 'sistema_reservas';
$user = 'root'; // Altere se o seu usuário do MySQL for diferente
$pass = '';     // Altere se o seu MySQL tiver senha

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(["success" => false, "message" => "Conexão falhou: " . $e->getMessage()]));
}
?>