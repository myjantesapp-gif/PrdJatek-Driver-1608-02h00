#!/bin/bash
set -e

OLD_ID="c7b51ba9-fdb7-46e2-9bc0-2ce54203a1f5"
NEW_ID="38b2a449-33b2-4549-8f5f-c7f535d41a34"
OLD_OWNER="jatekapp"
NEW_OWNER="jateksys"

echo "1. Mise à jour du Project ID et de l'Owner ($OLD_OWNER -> $NEW_OWNER)..."
files=("eas.json" "app.json" "app.config.js" "app.config.ts")
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    sed -i "s/$OLD_ID/$NEW_ID/g" "$file"
    sed -i "s/$OLD_OWNER/$NEW_OWNER/g" "$file"
    sed -i "s/Jatekapp/$NEW_OWNER/g" "$file" 2>/dev/null || true
    echo "  - $file mis à jour"
  fi
done

echo "2. Sécurité GOOGLE_MAPS_API_KEY dans app.config.js..."
if [ -f "app.config.js" ]; then
  sed -i 's/process.env.GOOGLE_MAPS_API_KEY/process.env.GOOGLE_MAPS_API_KEY || ""/g' app.config.js 2>/dev/null || true
fi

echo "3. Resynchronisation du pnpm-lock.yaml..."
pnpm install --no-frozen-lockfile

echo "4. Commit et Push sur Git..."
if [ -d ".git" ]; then
  git add .
  git commit -m "fix: update project id to $NEW_ID, owner to $NEW_OWNER and sync lockfile" || echo "Aucun changement à commiter"
  git push || echo "Fais un git push manuellement si besoin"
fi

echo "Tout est prêt ! Relance ton build EAS."
