<?php
// Configurações de email (Gmail SMTP)
// Para usar: ative a verificação em 2 etapas no Gmail e crie uma "Senha de app"
// em https://myaccount.google.com/apppasswords
define('SMTP_HOST',     'smtp.gmail.com');
define('SMTP_PORT',     587);
define('SMTP_USER',     'SEU_EMAIL@gmail.com');   // <-- altere aqui
define('SMTP_PASS',     'SUA_SENHA_DE_APP');       // <-- senha de app de 16 caracteres
define('SMTP_FROM',     'SEU_EMAIL@gmail.com');   // <-- mesmo email acima
define('SMTP_FROM_NAME','FORRIASC 2026');
