<?php
require_once 'c:/xampp/htdocs/reserva-forriasc/backend/config/constants.php';

$cliente_ra = '240393'; // Some random RA to test
$url_ra = RA_API_URL . $cliente_ra;

echo "Calling: $url_ra\n";

$ch_ra = curl_init($url_ra);
curl_setopt($ch_ra, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_ra, CURLOPT_HTTPHEADER, [
    'X-Ingresso-Key: ' . RA_API_KEY
]);
curl_setopt($ch_ra, CURLOPT_SSL_VERIFYPEER, false);
$response_ra = curl_exec($ch_ra);
$http_code_ra = curl_getinfo($ch_ra, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch_ra);
$curl_errno = curl_errno($ch_ra);
curl_close($ch_ra);

echo "HTTP Code: $http_code_ra\n";
echo "CURL Error ($curl_errno): $curl_error\n";
echo "Response: $response_ra\n";
?>
