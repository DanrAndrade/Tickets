CREATE DATABASE IF NOT EXISTS sistema_reservas;
USE sistema_reservas;

CREATE TABLE eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    data_evento DATETIME NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    preco_individual DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
    preco_mesa DECIMAL(10, 2) NOT NULL DEFAULT 150.00
);

CREATE TABLE assentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    numero_assento VARCHAR(10) NOT NULL,
    status ENUM('livre', 'bloqueado', 'vendido') DEFAULT 'livre',
    tempo_bloqueio DATETIME NULL,
    preco DECIMAL(10, 2) NOT NULL,
    session_id VARCHAR(100) DEFAULT NULL,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);

CREATE TABLE vendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assento_id INT DEFAULT NULL,
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_email VARCHAR(255) NOT NULL,
    status_pagamento ENUM('pendente', 'aprovado', 'recusado') DEFAULT 'pendente',
    order_nsu VARCHAR(255) NULL,
    transaction_id VARCHAR(255) NULL,
    data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assento_id) REFERENCES assentos(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    token VARCHAR(255) NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vendas ADD COLUMN ra VARCHAR(50) AFTER cliente_email;
ALTER TABLE vendas ADD COLUMN tipo_ingresso ENUM('mesa', 'individual') DEFAULT 'individual' AFTER ra;

-- Inserindo o usuário admin fornecido (senha: Iasc@8990)
INSERT INTO admins (usuario, senha) VALUES ('ticket@iasc', '$2y$10$tGh04CBL9TPaw.s8oT66VuxFxe45z2pQAscWR3AwtMgVjl2nuk5jW'); 
ALTER TABLE vendas ADD COLUMN codigo_validacao VARCHAR(50) UNIQUE AFTER transaction_id;
ALTER TABLE vendas ADD COLUMN ja_entrou BOOLEAN DEFAULT FALSE AFTER codigo_validacao;
ALTER TABLE vendas ADD COLUMN data_entrada DATETIME NULL AFTER ja_entrou;
