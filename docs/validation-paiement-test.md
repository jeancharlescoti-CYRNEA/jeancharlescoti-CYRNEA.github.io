# Validation de paiement — chemin le plus court (sans débit réel)

## État
Les tests Playwright isolés contrôlent le code de la PWA et des simulations locales. Ils ne prouvent PAS un paiement Stripe/PayPal de bout en bout. Ne jamais utiliser les URLs Workers de production pour les tests de webhook.

## Étape 1 — Préparer un environnement de paiement TEST séparé
Créer dans Cloudflare un Worker de test et un stockage/namespace séparé (aucune ressource de production). Déployer la même version du code que le Worker de production, avec uniquement des clés Stripe TEST et PayPal Sandbox. Ne pas copier les secrets LIVE dans GitHub.

## Étape 2 — Brancher GitHub Actions
Configurer les secrets du dépôt ou de l'environnement GitHub de test (noms à confirmer avec le code du Worker) : TEST_GATEWAY_URL, TEST_GATEWAY_TOKEN si requis, STRIPE_TEST_WEBHOOK_SECRET, PAYPAL_SANDBOX_* si requis. Ne jamais exposer ces valeurs dans les logs. Autoriser le test E2E uniquement si les URLs pointent explicitement vers l'environnement de test; bloquer workers.dev/stripe-webhook de production.

## Étape 3 — Scénarios probants
1. RELAIS: intention au tarif TTC correct, carte Stripe de test, statut payé confirmé via webhook dans stockage de test.
2. PRÉSENCE: montant HT+TVA exact, carte Stripe de test, statut payé confirmé.
3. PayPal Sandbox: payer avec acheteur Sandbox et vérifier le webhook.
4. Paiement refusé, webhook en double, timeout, montant erroné: aucune commande marquée payée.
5. Vérifier référence Tally, montant, mission, identité de l'environnement et absence d'écritures en production.

## Critère de succès
Rapport GitHub horodaté contenant chaque étape et les identifiants TEST anonymisés. Tant que le webhook et le statut final n'ont pas été observés dans l'environnement isolé, afficher « paiement non certifié ».

## Contraintes
Zéro débit réel, zéro paiement LIVE, zéro écriture sur production, zéro abonnement payant requis. Ne pas activer les scénarios E2E tant que les paramètres d'environnement de test n'ont pas été vérifiés.
