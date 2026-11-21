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
