# CYRNEA ASSISTANT — Audit et matrice de tests du 17 novembre 2026

**Statut : BRANCHE DE TRAVAIL — NON DÉPLOYÉE.**
Branche : `pwa-rapport-client-audit-20261117`.
Pas de commande client, transaction, e-mail ou changement de production pendant ces tests.

## 1. Périmètre vérifié

21 variantes métier de missions (RELAIS et CYRNEA PRÉSENCE B2B), 27 parcours de qualification croisés avec quatre états de zone (inclus, à vérifier, devis, exception), préparation obligatoire, mission simple et 2/3 passages, compte rendu et archive.

### Préparation selon les missions

- **Accès / rendez-vous :** opération, personne désignée, fermeture et état prévu.
- **Logistique :** intervenant ou livreur, heure et durée convenue, sortie et fermeture.
- **Gestes simples :** gestes autorisés, équipement précis, limites et conduite en cas d'anomalie.
- **Clés (1 ou 2 passages) :** provenance, destination, preuve ; ordre explicite pour les 2 passages.
- **Visite / observations :** points et zones autorisés, vues et preuves.
- **Présence à rendez-vous 1 h 15 / 3 h :** objectif, participants / visio, questions prévues.
- **Observations comparatives :** objet unique, 1 à 8 repères nommés, angle photo reproductible ; repères figés après début terrain.
- **Intempéries :** éléments concernés, zone et règles d'arrêt.

Les champs sont conservés dans le dossier ; une préparation incomplète empêche l'étape terrain avant départ. Les pièces sélectionnées dans la PWA sont sauvegardées dans IndexedDB, identifiées comme documents préparatoires **internes** et consultables sur l'appareil d'origine.

### Comparaison sur place et restitution

Pour chaque repère et passage :
- passage 1 : OBSERVÉ ou NON OBSERVABLE, description factuelle ;
- passage 2/3 : AUCUNE DIFFÉRENCE VISIBLE, DIFFÉRENCE VISIBLE ou NON OBSERVABLE ;
- une description est obligatoire si différence ou impossibilité ;
- une photo peut être associée au point et au passage ;
- une photo de référence est affichée si réellement accessible sur cet appareil, sinon le défaut est explicite.

Ces données sont conservées dans l'historique et reprises dans le PDF client, point par point et passage par passage, sans conclusion technique.

### Documents et restitution

- ZIP **CLIENT** : PDF + pièces client et photos conservées, réparties par passage ; documents préparatoires internes exclus.
- ZIP **INTERNE** : données JSON/TXT + PDF client + pièces terrain + documents préparatoires, dossiers distincts.
- Si une pièce attendue est absente sur l'appareil : **export interne refusé**, même si une pièce du même nom existe sur un autre passage.
- Envoi client et enregistrement iCloud restent manuels, avec validation et attestation de l'opérateur.
- Consultation des archives en lecture seule, sans nouveau passage de clôture.

## 2. Résultats automatisés

| Groupe | Contrôles | Résultat |
|---|---:|---|
| Compilation et chargement offline des modules, préparation, comparaison, qualification / secteurs, compteur | 395 | 395 réussis |
| PDF/ZIP client, fichiers absents, doublons de noms, variantes métier, verrou de clôture | 275 | 275 réussis |
| Pièces préparatoires : aucune, 2 conservées, retrait d'une pièce et contrôle d'identité | 4 | 4 réussis |
| ZIP interne : structure, pièces des passages 1/2, pièces préparatoires et sorties incomplètes | 12 | 12 réussis |
| Consultation d'une archive sans réarchivage | 3 | 3 réussis |
| Séparation interne/client dans le ZIP client | 4 | 4 réussis |
| **TOTAL** | **693** | **693 contrôles réussis** |

Dans ces scénarios : 72 dossiers client PDF/ZIP générés et 18 exports refusés conformément aux contrôles de pièces attendues.

**Portée du résultat :** tests automatisés et simulations de fonctions JavaScript. Ces 693 assertions ne sont **pas** 693 scénarios complets sur de vrais appareils. Le nombre de saisies, fichiers, réseaux et combinaisons possibles étant illimité, aucun test ne peut certifier littéralement « toutes les combinaisons ».

## 3. Vérification réelle obligatoire avant publication

Effectuer les tests sur une copie de test de la PWA, jamais en production avec des données de client réel :

1. **Préparation de chaque famille** : vérifier adresse, contacts, accès, consignes et pièces ; laisser un champ requis vide et constater le blocage ; revenir sur le dossier et vérifier sa persistance.
2. **Accès / rendez-vous** : attente, tiers absent, fermeture, limites horaires.
3. **Gestes simples** : 45 min, anomalie, refus de toute action non prévue.
4. **Clés 1 et 2 passages** : séquence dans les deux sens, réception/restauration des preuves, retour postal selon conditions contractuelles.
5. **VOIR / visites de site** : périmètre, photos, points non observables, compte rendu factuel.
6. **PRÉSENCE 1 h 15 / 3 h** : participants, visio, questions, temps et dépassement.
7. **SUIVRE / comparaisons 2 et 3 passages** : repères figés, photo de référence, différences et impossibilités, historique et restitution PDF.
8. **Intempéries** : contrôles de sécurité et arrêt sur doute.
9. **iPhone hors connexion** : ouvrir la PWA en réseau, ajouter un document, couper le réseau, fermer/réouvrir, vérifier notes, coches et consultation de la pièce.
10. **Photos** : sélectionner, attendre « conservée », essayer de clôturer si une pièce annoncée manque ; contrôler le même nom sur deux passages différents.
11. **ZIP client** : ouvrir et vérifier PDF, accents, dates, passages, photos et documents ; vérifier l'absence de pièces internes.
12. **Mac ↔ iPhone** : données synchronisées, mais photos non transférées ; confirmer le blocage d'export depuis le mauvais appareil.
13. **iCloud / archivage** : attestation d'envoi puis export ZIP interne, contrôle du fichier enregistré, confirmation manuelle et archive consultable en lecture seule.
14. **Régression** : vérifier tous les parcours de réservation connus jusqu'au paiement sans déclencher de paiement réel, y compris devis sans paiement et standard/hors standard.

## 4. Limites non résolues et prérequis

- Les pièces de Tally ne sont **pas** importées automatiquement. Il faut les ajouter à la PWA avant le départ si consultation hors réseau nécessaire.
- Les **médias et documents locaux** ne sont pas automatiquement transférés entre iPhone et Mac. Les données de mission (texte) utilisent la synchronisation existante ; les fichiers restent sur l'appareil qui les a enregistrés.
- Partage client, e-mail et classement iCloud restent sous contrôle humain. Une action « partager » ne prouve pas à elle seule la réception du client.
- Les tests ne remplacent pas une validation d'usage sur Safari iPhone/Mac avec les permissions Fichiers, iCloud, réseau intermittent et capacités réelles de stockage.
- Les flux de paiement Tally, Gateway/Bridge Cloudflare, PWA Sync centrale et les données de production n'ont pas été modifiés ni testés avec des transactions.
- La génération ZIP non compressée peut demander de la mémoire pour de gros médias ; vérifier avec un volume réaliste de photos/vidéos sur iPhone.

## 5. Décision de déploiement

Ne fusionner avec `main` qu'après vérification du parcours complet sur iPhone et Mac et sauvegarde de l'état de production, avec accord explicite. La branche actuelle est destinée à la revue et aux tests.
