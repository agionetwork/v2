#!/bin/bash

# Verifica se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
  echo "Docker não está rodando. Por favor, inicie o Docker primeiro."
  exit 1
fi

# Verifica se o container do Redis já existe
if docker ps -a | grep -q redis-local; then
  echo "Container Redis já existe. Iniciando..."
  docker start redis-local
else
  echo "Criando novo container Redis..."
  docker run -d \
    --name redis-local \
    -p 6379:6379 \
    redis:latest
fi

echo "Redis está rodando em localhost:6379" 