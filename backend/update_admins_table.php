<?php
require 'config/db.php';
try {
    $pdo->exec("ALTER TABLE admins ADD COLUMN token VARCHAR(255) NULL");
    echo "OK";
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage();
}
?>
