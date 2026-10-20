# CYRNEA — Envoi e-mail PWA (préparation NON DÉPLOYÉE)

Le Worker est distinct de Tally, SimplyBook, Payment Gateway, Missions API et du site en production.
Aucun mot de passe, jeton ou identifiant secret ne doit être ajouté à GitHub ou partagé dans une conversation.

## Serveur professionnel (documentation officielle WMaker)

SMTP : `mail.wmaker.net` ; port `587` ; `STARTTLS` ; authentification du compte complet.

- Contrat `RELAIS` → `contact@relaisproprietaire.fr`
- Contrats `PRÉSENCE PROPRIÉTAIRES` ou `PRÉSENCE ENTREPRISES` → `contact@cyrneapresence.fr`

## Éléments manquants avant activation

1. Créer uniquement le Worker `cyrnea-mailer` depuis le compte Cloudflare existant.
2. Déployer `mail-worker/worker.js` de la branche de préparation.
3. Saisir uniquement dans les **Secrets** Cloudflare (jamais comme variables publiques):
   - `MAIL_SEND_KEY` : clé de synchro CYRNEA déjà saisie dans la PWA, **au moins 24 caractères**.
   - `SMTP_PASSWORD_PRESENCE` : mot de passe de la boîte WMaker PRÉSENCE.
   - `SMTP_PASSWORD_RELAIS` : mot de passe de la boîte WMaker RELAIS.
4. Vérifier `GET /health` → `{"ok":true,"ready":true}`.
5. Tester l'envoi **sans paiement** avec une adresse e-mail de test contrôlée.
6. Vérifier que l'e-mail est reçu avec expéditeur correct, objet, texte, lien Tally cliquable masqué, et absence d'expéditeur erroné dans les trois contrats.
7. **Seulement après** ces vérifications : fusionner la PR n°36 dans `main`.

Les références sécurisées sont enregistrées par le circuit existant ; le Worker ne modifie ni le paiement, ni les formulaires Tally, ni les réservations.

## Sécurité et limites

- Liste blanche des origines et des 6 identifiants Tally selon le contrat.
- Contrôle de la référence temporaire dans le lien et dans le dossier.
- `POST /send` uniquement avec jeton `Bearer`.
- HTML e-mail avec lien cliquable et libellé court ; alternative texte brut.
- Envoi confirmé côté PWA seulement après validation SMTP (code de réponse positif).
- Si réseau ou SMTP incertain : avertissement, **pas de relance automatique** (évite les doublons).
- L'envoi via SMTP indépendant ne copie pas automatiquement le message dans **Messages envoyés** d'Apple Mail. Le statut d'envoi confirmé reste enregistré dans le dossier PWA.
- Pour production durable : ajouter une idempotence persistante côté serveur et des limites de débit ; le garde-fou actuel sur le client ne suffit pas en cas de double appel direct à l'API.

**Ne pas fusionner cette branche tant que le Worker n'est pas déployé et testé sur de vraies boîtes.**
