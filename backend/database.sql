CREATE DATABASE IF NOT EXISTS sistema_reservas;
USE sistema_reservas;

CREATE TABLE eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    data_evento DATETIME NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    numero_assento VARCHAR(10) NOT NULL,
    status ENUM('livre', 'bloqueado', 'vendido') DEFAULT 'livre',
    tempo_bloqueio DATETIME NULL,
    preco DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);

CREATE TABLE vendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assento_id INT NOT NULL,
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_email VARCHAR(255) NOT NULL,
    status_pagamento ENUM('pendente', 'aprovado', 'recusado') DEFAULT 'pendente',
    order_nsu VARCHAR(255) NULL,
    transaction_id VARCHAR(255) NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assento_id) REFERENCES assentos(id) ON DELETE CASCADE
);
