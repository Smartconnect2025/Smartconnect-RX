#!/bin/bash

# Script para sincronizar el estado de Drizzle con la DB actual
# Esto genera un nuevo snapshot sin crear una migración SQL

echo "🔄 Sincronizando estado de Drizzle..."

# 1. Generar migración (esto crea el snapshot actualizado)
npx drizzle-kit generate --name sync_current_state

# 2. Encontrar y eliminar el archivo SQL generado (ya está aplicado en DB)
LATEST_SQL=$(ls -t core/database/migrations/*.sql | head -1)
if [[ "$LATEST_SQL" == *"sync_current_state"* ]]; then
    echo "🗑️  Eliminando SQL innecesario: $LATEST_SQL"
    rm "$LATEST_SQL"
    echo "✅ Snapshot actualizado, SQL eliminado"
else
    echo "⚠️  No se encontró el archivo SQL esperado. Revisa manualmente."
fi

echo "✅ Drizzle sincronizado. Ahora 'drizzle-kit generate' no debería generar nada."
