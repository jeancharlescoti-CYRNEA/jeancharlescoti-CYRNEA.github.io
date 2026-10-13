# CYRNEA RELAIS STANDARD — anomalies d'affichage publiques (13/10/2026)

**Périmètre :** formulaire PUBLIC https://tally.so/r/xXOqpk, sans soumission ni paiement, contrôles Playwright sur branche GitHub isolée.

## Constat 1 — question moins de 24 heures

- Champ dropdown `265977a9-c01e-4482-bc4c-d34e705d915b`
- Intitulé de question `29442854-4b30-442b-8cbb-b9eabbd8825c`
- À l'arrivée, le champ sans titre est affiché bien que sa question soit masquée.
- La correction de la visibilité initiale aurait été enregistrée en brouillon via Ask Tally, mais **n'est pas vérifiée sur la version publiée**.
- Règle à préserver : `bd27f342-1256-46cd-b446-2818ec756bb3` et l'ensemble des STOP liés au délai.

**Attendu :** titre et input masqués ensemble initialement; affichés et obligatoires ensemble lorsque les clés du continent exigent un contrôle de délai, y compris REMETTRE sans accès privé et clés indisponibles/inconnues en Corse. Les options OUI/NON/JE NE SAIS PAS restent présentes. Aucun STOP, calcul ou paiement ne doit être modifié.

## Constat 2 — La Poste apparaît avec le mauvais moyen d'accès

- Bloc texte du guide La Poste (selon historique de l'éditeur) : `697247b1-1f4b-43ab-8b86-62169aba1400`
- Règle de présentation historisée : `f0c6b0fc-74fb-457c-adda-44f13110981e`
- La question **« Comment RELAIS disposera-t-il du moyen d'accès nécessaire à votre mission ? »** est `a8032422-b3a0-49a8-b004-d430b08de1ae`.
- Sur le PUBLIC : A (code/boîte) → absent PASS; **B (remise directe) → présent FAIL**; C (récupération locale) → absent PASS; **D (expédition du continent) → absent FAIL**; E (aucun accès) → absent PASS.
- Sur REMETTRE sans accès privé avec clés au continent, le bloc s'affiche bien (PASS) et disparaît si les clés deviennent disponibles en Corse (PASS).

**Attendu :** afficher le bloc La Poste UNIQUEMENT si
(1) moyen d'accès D = « Les clés devront être expédiées depuis le continent » lorsque l'accès privé exige un moyen matériel;
**OU** (2) mission RELAIS SIMPLE, opération REMETTRE, accès privé NON, clés à remettre NON disponibles en Corse (réponse « NON — Ils sont encore sur le continent ... »).
Aucune autre réponse, notamment remise directe B, ne déclenche le texte.

## Correctifs à opérer dans Tally

Dans l'éditeur de l'ORIGINAL xXOqpk **en brouillon seulement**, vérifier les conditions effectives sur les UUID correspondants et corriger leur SHOW/HIDE. Aucune suppression. Ne pas toucher aux 5 missions, tarifs, TVA, CGV V16, STOP, Gateway, paiement, PWA. Ne pas publier sans contrôle.

## Tests automatiques réutilisables

- `tests/relais-audit/probe.cjs` : matrice d'accès juridique, matériel et prix (dernier audit complet passé avec 95 vérifications PASS, 0 FAIL, 0 interruption ; ce n'est pas une certification de paiement).
- `tests/relais-audit/conditional.cjs` : tests ciblés des deux défauts de présentation, cumul des STOP et restitution; **doit être ROUGE tant que ces défauts restent dans le public**.
- `.github/workflows/relais-standard-audit.yml` : workflow isolé sur la branche `audit/relais-standard-20261013`.

## Après publication

Exécuter à nouveau la matrice complète et le contrôle ciblé sur le vrai URL public; PASS uniquement si aucun FAIL ou scénario incomplet. Contrôles Gateway/paiement end-to-end à mener séparément en environnement test.
