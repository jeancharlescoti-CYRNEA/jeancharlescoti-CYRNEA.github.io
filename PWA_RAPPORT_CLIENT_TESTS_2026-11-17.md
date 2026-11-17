# CYRNEA ASSISTANT — version de travail du 17 novembre 2026

**Cette branche n'est pas la production.** Ne pas fusionner avec `main` tant que les essais iPhone et Mac ne sont pas satisfaisants. Aucun test de paiement réel ne doit être lancé pendant cette validation.

## Ce qui change
- Préparation : consignes spécialisées selon la mission, champs conservés pendant la saisie, récupération du brouillon après interruption.
- Terrain : saisie et coches sauvegardées, photos conservées dans IndexedDB, fin de mission bloquée si une pièce annoncée manque sur l'appareil.
- Compteur : durées de 30, 45, 60, 75 et 180 min reconnues, y compris pour les formules multipassages.
- Restitution : trois champs facultatifs (observations factuelles, déclarations de tiers attribuées, limites / points non vérifiés).
- Comparaison : rappel des faits et photos disponibles du passage précédent.
- Compte rendu : aperçu dans l'interface ; création d'un véritable PDF et d'un ZIP client avec les pièces conservées localement, classées par passage. `EMAIL_PRET_A_ENVOYER.txt` est inclus.
- Archives : dossier ZIP interne distinct (contenant JSON, données de mission, médias et une copie du PDF client) ; l'archivage définitif impose attestation d'envoi de la restitution, préparation du ZIP interne et confirmation manuelle de son classement dans iCloud Drive.
- Le paiement, les CGV, les formulaires Tally, les Workers Cloudflare et les prix ne sont pas modifiés.

## Parcours utilisateur cible
1. Mission réservée et confirmée.
2. Préparer : adresse, accès, contact, consignes, documents et vérifications adaptées à la mission.
3. Avant de partir : cocher les contrôles.
4. Terrain : horodater, cocher les faits, saisir si besoin, enregistrer les photos et contrôler leur conservation avant sortie.
5. Restitution : vérifier les faits, compléter les trois champs facultatifs, valider.
6. Clôture : prévisualiser, exporter et envoyer le ZIP **client** (PDF et pièces), attester l'envoi.
7. Exporter et vérifier le ZIP **interne** dans iCloud Drive ; confirmer la sauvegarde ; archiver la mission.

## À tester en conditions réelles AVANT FUSION
- [ ] RELAIS : accès / rendez-vous et restitutions.
- [ ] RELAIS : clé remise, clé récupérée, deux passages et preuve de restitution.
- [ ] RELAIS : VOIR / DÉCIDER, SUIVRE, avant intempéries.
- [ ] B2B : donner accès, présence logistique, gestes simples (45 min).
- [ ] B2B : clés/badges (un et deux passages).
- [ ] B2B : visite de site (1 h), présence (1 h 15 et 3 h).
- [ ] B2B : observations comparatives deux et trois passages, avec photos précédentes.
- [ ] Fermer l'application pendant une saisie puis reprendre : coches et notes conservées.
- [ ] Passer hors connexion sur le terrain après chargement initial : interface et formulaires accessibles.
- [ ] Enregistrer trois photos ; exporter depuis l'iPhone : PDF et trois fichiers dans le ZIP.
- [ ] Exporter depuis le Mac lorsqu'une photo existe seulement sur iPhone : refus explicite.
- [ ] Compléter observations, déclarations et limites : présentes dans le PDF.
- [ ] Ajouter une pièce reçue dans Tally depuis l'écran d'aperçu : présente dans le ZIP.
- [ ] Avant l'envoi du compte rendu : pas de clôture définitive possible.
- [ ] Envoi attesté + ZIP interne enregistré et confirmé : archivage possible.
- [ ] Ouvrir une archive ultérieurement et en reconstituer le dossier.

## Limites connues
- Les pièces envoyées dans Tally ne sont pas importées automatiquement par la PWA. Joindre manuellement les pièces utiles dans l'aperçu du compte rendu.
- Les photos/vidéos terrain sont conservées sur **l'appareil d'origine**, pas transférées automatiquement par la synchronisation des missions Mac ↔ iPhone. Exporter le ZIP sur l'appareil qui détient les fichiers.
- Le ZIP client est prêt à joindre ; **la PWA n'envoie pas automatiquement** le message au client. Le propriétaire de la mission garde la validation et l'envoi.
- Le dépôt dans iCloud et l'envoi sont attestés manuellement. Les navigateurs ne peuvent garantir à eux seuls qu'un partage a été réellement enregistré.
- Les essais automatisés statiques ont validé la syntaxe JS, le PDF et les durées, mais **aucun essai complet en conditions réelles Safari iPhone/Cloudflare/Tally/iCloud** n'a été exécuté.

## Fichiers modifiés
- `index.html` — adaptations ciblées
- `terrain-clock.js` — lecture des plafonds
- `mission-ux.js` — nouveau : préparation, brouillons, comparatif
- `client-report.js` — nouveau : PDF client, pièces, ZIP, garde d'archivage
- `service-worker.js` — nouvelle version du cache et fichiers ajoutés

## Règle de déploiement
Une fois les tests validés, faire une sauvegarde/point de retour du `main` puis fusionner **uniquement après décision explicite**. Ne pas modifier les Worker, Tally ni la HOME des deux sites lors de cette étape.
