#!/bin/bash

# Construir a imagem
docker build -t solana-dev .

# Executar o container
docker run -it --rm \
    -v "$(pwd):/app" \
    -w /app \
    -u $(id -u):$(id -g) \
    --name solana-dev-container \
    --platform linux/amd64 \
    solana-dev 