#!/bin/bash
#
# Instalador de pre-commit hooks para detectar secrets
#

set -e

echo "🔒 Instalando pre-commit hooks"
echo "==============================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar que estamos en el directorio correcto
if [ ! -d ".git" ]; then
    echo "❌ Error: No es un repositorio git"
    exit 1
fi

# Crear directorio de hooks si no existe
mkdir -p .git/hooks

# Crear pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
#
# Pre-commit hook para detectar secrets
#

echo "🔍 Verificando posibles secrets en el commit..."

# Archivos a revisar
FILES=$(git diff --cached --name-only --diff-filter=ACM)

# Patrones de secrets sospechosos
PATTERNS=(
    "api[_-]?key.*=.*['\"][a-zA-Z0-9]{20,}['\"]"
    "secret.*=.*['\"][a-zA-Z0-9]{20,}['\"]"
    "password.*=.*['\"][^'\"]{8,}['\"]"
    "token.*=.*['\"][a-zA-Z0-9]{20,}['\"]"
    "SG\.[a-zA-Z0-9]{20,}"  # SendGrid
    "eyJ[a-zA-Z0-9_-]{20,}"  # JWT tokens
    "sk-[a-zA-Z0-9]{20,}"    # OpenAI/Stripe keys
    "xox[baprs]-[a-zA-Z0-9]{10,}"  # Slack tokens
)

# Verificar cada archivo
FOUND_SECRETS=0

for file in $FILES; do
    # Ignorar archivos de configuración legítimos
    if [[ $file == *.example ]] || [[ $file == *.md ]] || [[ $file == *.sh ]]; then
        continue
    fi
    
    # Verificar si es texto
    if file "$file" | grep -q text; then
        for pattern in "${PATTERNS[@]}"; do
            if grep -iEn "$pattern" "$file" 2>/dev/null; then
                echo ""
                echo "⚠️  Posible secret detectado en: $file"
                echo "   Patrón: $pattern"
                echo ""
                FOUND_SECRETS=1
            fi
        done
    fi
done

# Verificar archivos .env
ENV_FILES=$(echo "$FILES" | grep -E "^\.env" || true)
if [ -n "$ENV_FILES" ]; then
    echo ""
    echo "🚨 ATENCIÓN: Intentando commitear archivos .env:"
    echo "$ENV_FILES"
    echo ""
    echo "Los archivos .env no deben ser commiteados."
    echo "Si esto es intencional, usa: git commit --no-verify"
    echo ""
    exit 1
fi

if [ $FOUND_SECRETS -eq 1 ]; then
    echo ""
    echo "❌ Commit bloqueado: Posibles secrets detectados"
    echo ""
    echo "Si esto es un falso positivo, usa: git commit --no-verify"
    echo ""
    exit 1
fi

echo "✅ No se detectaron secrets"
exit 0
EOF

# Hacer ejecutable
chmod +x .git/hooks/pre-commit

echo -e "${GREEN}✅ Pre-commit hook instalado${NC}"
echo ""
echo "📋 Qué hace este hook:"
echo "   - Detecta patrones de API keys, secrets, passwords"
echo "   - Bloquea commits de archivos .env"
echo "   - Revisa archivos antes de cada commit"
echo ""
echo "⚠️  Para saltar el hook (en casos especiales):"
echo "   git commit --no-verify"
echo ""

# Verificar si detect-secrets está instalado
if command -v detect-secrets &> /dev/null; then
    echo -e "${GREEN}✅ detect-secrets ya está instalado${NC}"
else
    echo -e "${YELLOW}⚠️  detect-secrets no está instalado${NC}"
    echo ""
    echo "Para instalar (opcional pero recomendado):"
    echo "   pip install detect-secrets"
    echo "   detect-secrets scan > .secrets.baseline"
    echo ""
fi

echo "🎉 Configuración completada"
