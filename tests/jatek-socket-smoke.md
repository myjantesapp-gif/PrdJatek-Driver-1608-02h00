# Smoke test Socket.IO de production

Ce test vérifie le contrat réellement déployé sur `https://ma.jatek.app` :

1. le preflight autorise `https://driver.jatek.app` ;
2. `/socket.io/` renvoie une trame Engine.IO v4 et non du HTML ;
3. un JWT de chauffeur de recette ouvre une connexion Socket.IO ;
4. un endpoint backend contrôlé émet `order_ready`, puis `order_assigned` pour ce chauffeur.

## Contrat de l'endpoint contrôlé

L'endpoint reçoit une requête `POST` authentifiée avec ce corps :

```json
{
  "smokeTestId": "uuid",
  "driverId": 7,
  "orderId": "smoke:uuid",
  "events": ["order_ready", "order_assigned"],
  "persist": false
}
```

Il doit refuser `persist: true`, ne créer ni modifier aucune commande, et émettre
les deux événements dans l'ordre. Les deux payloads contiennent `smokeTest:
true`, `smokeTestId` et `orderId`. `order_assigned` contient aussi le `driverId`
du chauffeur de recette authentifié.

## Exécution

Configurer les variables suivantes dans l'environnement d'exécution, sans les
committer :

- `JATEK_SOCKET_SMOKE_JWT` : JWT court du chauffeur de recette ;
- `JATEK_SOCKET_SMOKE_DRIVER_ID` : identifiant de ce chauffeur ;
- `JATEK_SOCKET_SMOKE_TRIGGER_URL` : endpoint contrôlé sur `https://ma.jatek.app` ;
- `JATEK_SOCKET_SMOKE_TRIGGER_TOKEN` : jeton dédié à cet endpoint.

Puis lancer :

```sh
pnpm test:socket-smoke
```

Le script est séparé de `pnpm test` afin que les tests unitaires restent
hermétiques et qu'une exécution accidentelle ne sollicite pas la production.