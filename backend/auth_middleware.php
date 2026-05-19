<?php

function verifyAuth($pdo) {
    $headers = apache_request_headers();
    $token = '';
    
    if (isset($headers['Authorization'])) {
        $token = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $token = $headers['authorization'];
    }
    
    if (empty($token)) {
        return false;
    }
    
    $token = str_replace('Bearer ', '', $token);
    
    $stmt = $pdo->prepare("SELECT id FROM admins WHERE token = ?");
    $stmt->execute([$token]);
    return $stmt->fetch() !== false;
}
?>
