#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Iniciando ambiente de desenvolvimento...${NC}"

# Inicia o Redis
echo -e "${GREEN}Iniciando Redis...${NC}"
./scripts/start-redis.sh

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
  echo -e "${GREEN}Instalando dependências...${NC}"
  npm install
fi

# Inicia o servidor de desenvolvimento
echo -e "${GREEN}Iniciando servidor Next.js na porta 3003...${NC}"
npm run dev 