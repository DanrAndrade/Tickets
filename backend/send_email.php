<?php
require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';
require_once __DIR__ . '/config/email.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/**
 * Envia email de confirmação de compra ao comprador.
 *
 * @param string $destinatario  Email do comprador
 * @param string $nome          Nome do comprador
 * @param array  $ingressos     Lista de ingressos [['codigo_validacao'=>'...','tipo'=>'...','numero_assento'=>'...','numero_cadeira'=>'...'], ...]
 * @param string $order_nsu     NSU do pedido
 * @return bool
 */
function enviarEmailConfirmacao(string $destinatario, string $nome, array $ingressos, string $order_nsu): bool {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        $mail->addAddress($destinatario, $nome);
        $mail->isHTML(true);
        $mail->Subject = 'Confirmação de Compra — FORRIASC 2026';
        $mail->Body    = buildEmailHtml($nome, $ingressos, $order_nsu);
        $mail->AltBody = buildEmailText($nome, $ingressos, $order_nsu);

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("[send_email] Erro ao enviar para $destinatario: " . $mail->ErrorInfo);
        return false;
    }
}

function buildEmailHtml(string $nome, array $ingressos, string $order_nsu): string {
    $primeiroNome = explode(' ', trim($nome))[0];
    $linhas = '';
    foreach ($ingressos as $ing) {
        $tipo = strtoupper($ing['tipo'] ?? 'individual');
        if ($tipo === 'MESA') {
            $detalhe = 'Mesa ' . ($ing['numero_assento'] ?? '-') . ' · Cadeira ' . ($ing['numero_cadeira'] ?? '-') . '/4';
        } elseif ($tipo === 'ACOMPANHANTE') {
            $detalhe = 'Ingresso Acompanhante';
        } else {
            $detalhe = 'Ingresso Individual';
        }
        $codigo = htmlspecialchars($ing['codigo_validacao'] ?? '');
        $linhas .= "
        <tr>
            <td style='padding:10px 12px;border-bottom:1px solid #f0e8df;'>
                <span style='font-size:13px;color:#555;'>{$detalhe}</span>
            </td>
            <td style='padding:10px 12px;border-bottom:1px solid #f0e8df;text-align:right;'>
                <span style='font-family:monospace;font-size:13px;font-weight:700;color:#f16137;letter-spacing:1px;'>{$codigo}</span>
            </td>
        </tr>";
    }

    $totalIngressos = count($ingressos);
    $nsu = htmlspecialchars($order_nsu);

    return "
<!DOCTYPE html>
<html lang='pt-BR'>
<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body style='margin:0;padding:0;background:#faf7f4;font-family:Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#faf7f4;padding:30px 0;'>
    <tr><td align='center'>
      <table width='600' cellpadding='0' cellspacing='0' style='background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);max-width:600px;width:100%;'>
        <!-- Header -->
        <tr>
          <td style='background:#f16137;padding:32px 40px;text-align:center;'>
            <h1 style='color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.5px;'>FORRIASC 2026</h1>
            <p style='color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;'>12 de junho de 2026 · 19:00</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style='padding:36px 40px;'>
            <p style='font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 8px;'>Olá, {$primeiroNome}!</p>
            <p style='font-size:14px;color:#555;margin:0 0 28px;line-height:1.6;'>
              Seu pagamento foi <strong style='color:#16a34a;'>aprovado</strong>! 🎉<br>
              Apresente os códigos abaixo na entrada do evento para retirar seu(s) ingresso(s).
            </p>

            <table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #f0e8df;border-radius:10px;overflow:hidden;margin-bottom:28px;'>
              <tr style='background:#fdf6f2;'>
                <th style='padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;'>Ingresso</th>
                <th style='padding:10px 12px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;'>Código</th>
              </tr>
              {$linhas}
            </table>

            <div style='background:#fdf6f2;border-radius:10px;padding:16px 20px;margin-bottom:28px;'>
              <p style='margin:0;font-size:12px;color:#888;'>Número do pedido</p>
              <p style='margin:4px 0 0;font-family:monospace;font-size:13px;font-weight:700;color:#333;'>{$nsu}</p>
            </div>

            <p style='font-size:13px;color:#888;line-height:1.6;margin:0;'>
              Este email foi gerado automaticamente. Em caso de dúvidas, entre em contato com a organização do evento.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style='background:#f9f5f2;padding:20px 40px;text-align:center;border-top:1px solid #f0e8df;'>
            <p style='margin:0;font-size:12px;color:#aaa;'>FORRIASC 2026 · Instituto Aziz Sattamini Costa</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";
}

function buildEmailText(string $nome, array $ingressos, string $order_nsu): string {
    $primeiroNome = explode(' ', trim($nome))[0];
    $linhas = '';
    foreach ($ingressos as $ing) {
        $tipo = strtoupper($ing['tipo'] ?? 'individual');
        if ($tipo === 'MESA') {
            $detalhe = 'Mesa ' . ($ing['numero_assento'] ?? '-') . ' Cadeira ' . ($ing['numero_cadeira'] ?? '-') . '/4';
        } elseif ($tipo === 'ACOMPANHANTE') {
            $detalhe = 'Ingresso Acompanhante';
        } else {
            $detalhe = 'Ingresso Individual';
        }
        $codigo = $ing['codigo_validacao'] ?? '';
        $linhas .= "  - {$detalhe}: {$codigo}\n";
    }

    return "Olá, {$primeiroNome}!\n\n"
         . "Seu pagamento foi aprovado! 🎉\n"
         . "Apresente os códigos abaixo na entrada do evento para retirar seu(s) ingresso(s).\n\n"
         . "SEUS INGRESSOS:\n{$linhas}\n"
         . "Pedido: {$order_nsu}\n\n"
         . "FORRIASC 2026 — 12 de junho de 2026 · 19:00\n"
         . "Instituto Aziz Sattamini Costa";
}
