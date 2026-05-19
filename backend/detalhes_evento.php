<?php
require_once 'config/db.php';
require_once 'config/constants.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

echo json_encode([
    "success" => true,
    "data" => [
        "preco_individual" => PRECO_INDIVIDUAL_ATUAL,
        "preco_mesa"       => PRECO_MESA_ATUAL,
        "lote_atual"       => LOTE_ATUAL,
        "lotes" => [
            ["numero" => 1, "inicio" => LOTE_1_INICIO, "fim" => LOTE_1_FIM, "preco_mesa" => PRECO_MESA_LOTE1, "preco_individual" => PRECO_INDIVIDUAL_LOTE1],
            ["numero" => 2, "inicio" => LOTE_2_INICIO, "fim" => LOTE_2_FIM, "preco_mesa" => PRECO_MESA_LOTE2, "preco_individual" => PRECO_INDIVIDUAL_LOTE2],
            ["numero" => 3, "inicio" => LOTE_3_INICIO, "fim" => DATA_EVENTO, "preco_mesa" => PRECO_MESA_LOTE3, "preco_individual" => PRECO_INDIVIDUAL_LOTE3],
        ]
    ]
]);
?>
