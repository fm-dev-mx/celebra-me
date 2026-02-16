#!/bin/bash
#
# Script de rotación de credenciales - Fase 0
# Este script verifica y guía el proceso de rotación de credenciales
#

set -e

echo "🔐 Security Hardening - Fase 0: Rotación de Credenciales"
echo "========================================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Ejecutar desde la raíz del proyecto${NC}"
    exit 1
fi

echo "📋 Lista de credenciales a rotar:"
echo ""
echo "1. SendGrid API Key"
echo "   - URL: https://app.sendgrid.com/settings/api_keys"
echo "   - Acción: Revocar key existente y crear nueva"
echo ""
echo "2. Gmail App Password"
echo "   - URL: https://myaccount.google.com/apppasswords"
echo "   - Acción: Revocar password existente y crear nuevo"
echo ""
echo "3. Supabase Service Role Key"
echo "   - URL: https://supabase.com/dashboard/project/_/settings/api"
echo "   - Acción: Regenerar service_role key"
echo ""
echo "4. Supabase Anon Key"
echo "   - URL: https://supabase.com/dashboard/project/_/settings/api"
echo "   - Acción: Regenerar anon key"
echo ""
echo "5. RSVP Admin Password"
echo "   - Acción: Cambiar password en Supabase Auth o variable de entorno"
echo ""

read -p "¿Has rotado TODAS las credenciales listadas arriba? (s/N): " confirm

if [[ $confirm != [sS] ]]; then
    echo -e "${YELLOW}⚠️  Por favor, rota las credenciales antes de continuar${NC}"
    echo "Sigue las instrucciones en docs/security-hardening/CREDENTIAL_ROTATION.md"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Confirmación recibida${NC}"
echo ""

# Verificar que .env* están en .gitignore
echo "🔍 Verificando .gitignore..."
if grep -q "^\.env" .gitignore 2>/dev/null || grep -q "\.env" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ .gitignore contiene reglas para .env*${NC}"
else
    echo -e "${YELLOW}⚠️  Agregando .env* a .gitignore...${NC}"
    echo "" >> .gitignore
    echo "# Environment variables" >> .gitignore
    echo ".env" >> .gitignore
    echo ".env.local" >> .gitignore
    echo ".env.*.local" >> .gitignore
    echo -e "${GREEN}✅ .gitignore actualizado${NC}"
fi

# Verificar que archivos no están trackeados
echo ""
echo "🔍 Verificando que .env files no están trackeados..."
if git ls-files | grep -q "\.env"; then
    echo -e "${RED}❌ ATENCIÓN: Archivos .env aún están en git${NC}"
    echo "Ejecuta: git rm --cached .env .env.local"
    exit 1
else
    echo -e "${GREEN}✅ Archivos .env no están trackeados${NC}"
fi

# Verificar que nuevas credenciales están en Vercel
echo ""
echo "🔍 Verificando variables en Vercel..."
echo "Por favor, verifica manualmente que las nuevas credenciales están configuradas en:"
echo "https://vercel.com/dashboard"
echo ""
read -p "¿Las nuevas credenciales están configuradas en Vercel? (s/N): " vercel_confirm

if [[ $vercel_confirm != [sS] ]]; then
    echo -e "${YELLOW}⚠️  Configura las credenciales en Vercel antes de continuar${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Fase 0.1 completada${NC}"
echo ""
echo "Próximo paso: Eliminar archivos .env del historial git"
echo "Ejecuta: ./scripts/remove-env-from-history.sh"
