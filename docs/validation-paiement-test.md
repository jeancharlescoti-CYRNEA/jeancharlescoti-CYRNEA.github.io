# Audit paiements CYRNEA — état vérifié au 21 novembre 2026

## Preuves acquises
- Worker isolé `cyrnea-payment-test` : `/stripe-check` a confirmé l'authentification Stripe TEST.
- Rapport `/run-all` fourni par l'exploitant, horodaté `2026-11-21T13:00:11.026Z` : **19/19** PaymentIntents Stripe TEST avec `status=succeeded`, `livemode=false`, montant reçu égal au montant attendu, 0 échec.
- 8 scénarios RELAIS et 11 scénarios PRÉSENCE. Montants codés dans le Worker de test, TVA 20 % supposée sur les tarifs HT B2B.
- Audit PWA GitHub isolé : dernier run réussi `44905970382`. Tests locaux du code, **sans** paiement réel ni webhook.
- Aucun débit réel, aucun changement des Workers de production.

## Limites à ne pas confondre avec une validation
1. Les 19 paiements ont été créés directement par le Worker TEST, **sans passer par la PWA ni Tally**.
2. Aucune preuve de réception, validation de signature, dédoublonnage ou traitement d'un webhook dans un stockage de test.
3. Aucune preuve qu'une réservation est marquée « payée » après le webhook.
4. Aucun test PayPal Sandbox.
5. Les tarifs de test ne sont pas une lecture dynamique de toutes les réservations PWA. Le scénario RELAIS « CLÉS — 2 PASSAGES » est dirigé vers le site officiel, hors intention PWA, d'après `tests/paiements-simules.spec.cjs`.
6. Les Workers de production `cyrnea-payment-gateway`, `cyrnea-payments-webhook` et leurs secrets/stocks ne sont pas présents dans ce dépôt GitHub. Impossible de certifier leur logique en l'état.

## Protocole E2E à réaliser exclusivement en environnement isolé
- Obtenir une copie **sans secrets** du code Gateway, webhook et bridge Tally.
- Déployer leurs copies dans un Worker et stockage **de test séparés** ; clés Stripe TEST seulement.
- Tester la chaîne PWA test → intention Tally test → Gateway test → paiement Stripe TEST → webhook signé test → état de réservation dans stockage test.
- Tester paiement refusé, événement webhook dupliqué, signature invalide, montant altéré, timeout et rejouement.
- Vérifier aucune écriture dans les systèmes LIVE.
- Rapporter les preuves avec IDs test et timestamps, sans clés ni données personnelles.

## Décision
**Stripe TEST : VALIDÉ sur 19 transactions.**
**Paiement client complet de bout en bout : NON CERTIFIÉ.**

Ne jamais envoyer de fausses notifications webhook aux endpoints de production.

## Contre-tests locaux du webhook (21/11/2026)

Code exact de `cyrnea-payments-webhook-corrige.js` fourni dans la conversation, exécuté localement avec signature HMAC valide et stockage KV simulé (aucun appel production).

- 6/6 tests de base réussis : signature, PAID, doublon, échec tardif, signature invalide, consultation statut.
- **ANOMALIE REPRODUITE** : un événement `checkout.session.completed` correctement signé avec `payment_status=paid`, `amount_total=100` et référence de mission fictive à 10900 centimes est enregistré `PAYMENT:<reference>` avec `status=PAID`. Le webhook ne compare pas le montant de la session à un montant attendu de réservation provenant d'un enregistrement fiable.
- `payment_intent.succeeded` est ignoré par `normalizeStatusPayload` ; les 19 transactions Stripe TEST directes ne prouvent donc pas que le webhook reçoit ou traite une confirmation.
- Risque à analyser : `PAYMENTS` est KV avec lectures/écritures non atomiques ; l'idempotence n'est pas garantie en cas d'événements concurrents.

**Conclusion actualisée : validation E2E refusée, correction/validation du contrôle montant-référence et essais webhook déployé nécessaires.** Ne pas déployer une correction non testée en production.
