# Smoke test Socket.IO de production

Ce test vérifie le contrat réellement déployé sur `https://ma.jatek.app` :

1. le preflight autorise `https://driver.jatek.app` ;
2. `/socket.io/` renvoie une trame Engine.IO v4 et non du HTML ;
3. un JWT invalide est refusé par Socket.IO ;
4. si une session livreur et une commande existante sont configurées, un test
   supplémentaire observe `order_ready`, puis `order_assigned` sur cette commande.

## Vérification sans mutation

Le test ne crée ni commande ni événement synthétique, ne change aucun statut
et n'appelle aucun endpoint de déclenchement. Les événements doivent provenir
de l'activité normale sur une commande existante. Les payloads marqués
`smokeTest` sont ignorés. Aucun JWT n'est imprimé.

## Exécution

La vérification du handshake, du CORS et du refus d'un JWT invalide fonctionne
sans identifiants. Pour observer aussi les événements réels, configurer les
variables suivantes via le gestionnaire de secrets, sans les committer :

- `JATEK_SOCKET_SMOKE_JWT` : JWT court du chauffeur de recette ;
- `JATEK_SOCKET_SMOKE_DRIVER_ID` : identifiant de ce chauffeur ;
- `JATEK_SOCKET_SMOKE_ORDER_ID` : identifiant d'une commande existante dont
  l'activité normale permettra d'observer les deux événements.

Sans JWT/commande configurés, l'observation authentifiée est explicitement
ignorée : les autres tests ne prouvent pas la réception des commandes.

Puis lancer :

```sh
pnpm test:socket-smoke
```

Le script est séparé de `pnpm test` afin que les tests unitaires restent
hermétiques et qu'une exécution accidentelle ne sollicite pas la production.