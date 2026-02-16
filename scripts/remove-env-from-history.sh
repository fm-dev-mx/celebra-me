#!/bin/bash
#
# Script para eliminar archivos .env del historial git
# ⚠️  ADVERTENCIA: Este script reescribe el historial de git
#

set -e

echo "🧹 Eliminando archivos .env del historial git"
echo "=============================================="
echo ""
echo "⚠️  ADVERTENCIA: Este script reescribe el historial de git"
echo "   - Todos los commits serán modificados"
echo "   - Requiere force push"
echo "   - Todo el equipo debe reclonar el repo después"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar que estamos en el directorio correcto
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: No es un repositorio git${NC}"
    exit 1
fi

echo "📋 Archivos que serán eliminados del historial:"
git log --all --full-history --name-only --pretty=format: | grep -E "^\.env" | sort | uniq

echo ""
read -p "¿Estás seguro de continuar? Escribe 'ELIMINAR' para confirmar: " confirm

if [[ $confirm != "ELIMINAR" ]]; then
    echo -e "${YELLOW}⚠️  Operación cancelada${NC}"
    exit 0
fi

echo ""
echo "🔧 Eliminando archivos del historial..."

# Método 1: git-filter-branch (más compatible)
echo "Usando git-filter-branch..."
git filter-branch --force --index-filter \
    'git rm --cached --ignore-unmatch .env .env.local .env.production .env.*.local' \
    --prune-empty --tag-name-filter cat -- --all

# Limpiar refs originales
echo ""
echo "🧹 Limpiando referencias..."
rm -rf .git/refs/original/

# Expirar reflog
echo "🗑️  Expirando reflog..."
git reflog expire --expire=now --all

# Garbage collection
echo "♻️  Garbage collection..."
git gc --prune=now --aggressive

echo ""
echo -e "${GREEN}✅ Archivos eliminados del historial${NC}"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1. Verificar que no quedan rastros:"
echo "   git log --all --full-history -- .env"
echo "   (Debe no mostrar nada)"
echo ""
echo "2. Force push al remote:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. Notificar al equipo:"
echo "   - Enviar mensaje en Slack/Teams"
echo "   - Pedir a todos hacer git clone fresco"
echo "   - O ejecutar: git fetch --all && git reset --hard origin/main"
echo ""
echo "4. Verificar en GitHub/GitLab:"
echo "   - Revisar que archivos .env no aparecen en el historial web"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE: No olvides hacer el force push${NC}"
