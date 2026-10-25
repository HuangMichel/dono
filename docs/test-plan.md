# Plan de test du backend Dono

Ce plan vérifie progressivement le backend configuré avec `backend/.env`, avant déploiement. Il complète les [contrats API](api.md), les [scénarios de règles](rules-test-cases.md) et le [guide de configuration](setup.md). AGENTS.md reste prioritaire. Aucun frontend n'est nécessaire pour les essais HTTP ; la caméra, l'affichage graphique et le scan mobile du QR seront testés avec le futur frontend.

**Statut : plan à exécuter.** Sa rédaction ne lance aucun appel réel, n'applique aucune migration et ne valide pas le contenu du `.env`. Les 96 tests/91 % de couverture dans [readiness](readiness.md) sont le dernier bilan enregistré, pas un nouveau résultat.

## Scripts curl disponibles

Voir [les commandes de lancement](api-curl-tests.md) et les scripts [parcours API](../backend/scripts/test-api.sh) / [dates](../backend/scripts/test-api-expiry.sh). Ils exécutent les scénarios HTTP indiqués ; les groupes nécessitant horloge contrôlée, concurrence ou revue photo restent distingués explicitement.

## 1. Préparer les essais

Utiliser un projet Supabase de développement dédié. Appliquer les migrations selon [setup](setup.md), sans reset d'une base contenant des données à conserver. Ne pas utiliser la production pour les scénarios de concurrence, de révocation ou d'échec.

Préparer :

- Deux donateurs D1/D2 ; deux associations A/B avec chacune un administrateur et un membre staff ; un administrateur plateforme provisionné par un opérateur de confiance.
- Des comptes Supabase Auth et leurs access tokens valides. Sans frontend, obtenir une session via un client Auth de développement utilisant le fournisseur configuré. Swagger ne réalise pas la connexion Google : son bouton Authorize reçoit un token déjà obtenu. Ne pas utiliser une clé publishable/secret comme token utilisateur et ne pas forger de JWT.
- Pour A et B : approbation plateforme, adresse géocodée, fuseau, horaires, besoin actif, capacité de stockage, quota journalier et créneau futur compatibles. Les créneaux doivent respecter les horaires et la fenêtre documentée de 168 heures.
- Des photos de test sans données personnelles : JPEG/PNG/WebP valides, fichier invalide, image dépassant les limites et quatrième photo d'une donation.
- Pour l'évaluation IA : 25–35 photos annotées couvrant les cinq catégories, médicaments, para, aliments réfrigérés/congelés, étiquettes difficiles et cas ambigus.

Chaque mutation demandant `Idempotency-Key` reçoit un UUID neuf. Pour tester un rejeu, conserver exactement la même clé et le même corps. Relire les ressources avant modification et utiliser leur dernière `revision` : ne pas supposer qu'elle vaut encore 1 après un upload ou une analyse.

Les essais OpenAI réels sont facturables. Fixer un budget de test ; ne jamais copier clés, tokens, `.env`, photos privées ou payloads QR complets dans les résultats partagés.

## 2. Tests automatisés locaux — priorité P0

Depuis la racine :

```sh
cd backend
uv sync --locked
uv run ruff check .
uv run mypy app
uv run pytest -q --cov=app --cov-report=term-missing
```

Résultat attendu : aucune erreur Ruff/mypy et tous les tests réussis. Relever le nombre et la couverture réellement obtenus. En cas d'échec, conserver le nom du test et le diagnostic nettoyé avant de poursuivre les essais réels.

Ces tests utilisent PostgreSQL temporaire pour les migrations/RLS/transactions ; les échanges HTTP Auth, Supabase, OpenAI et BAN sont simulés. Ils ne prouvent pas que les identifiants du `.env`, Google OAuth ou le projet hébergé fonctionnent.

| Groupe | Fichiers dans backend/tests/ | Objet |
|---|---|---|
| Analyse et upload | test_analysis.py, test_providers_photos.py, test_provider_edges.py | Cinq schémas, probabilités, OCR, limites et pannes fournisseur. |
| Dates et matching | test_expiry.py, test_rule_edges.py, test_matching.py | Bornes, PAO/FEFO, correction auditée, budgets, saison et distance. |
| Base et sécurité | test_database.py, test_security_history.py | Migrations, RLS, originaux immuables, périmètre d'une association, résultats tardifs. |
| Parcours et membres | test_http_flow.py, test_http_membership_lifecycle.py, test_workflow_database.py | Parcours HTTP/SQL, cycle de vie, droits, rejeux et historique. |
| Concurrence | test_concurrency.py | Dernière place de stockage, de rendez-vous et de quota. |

## 3. Démarrage et authentification réels — P0

Depuis `backend/` :

```sh
uv run uvicorn app.main:app --reload
```

Ouvrir `http://localhost:8000/docs`. Dans Swagger, utiliser Authorize avec le token utilisateur approprié ; changer de token lors des changements d'acteur. Les exemples ci-dessous sont relatifs à `/api/v1`. Les schémas complets sont dans Swagger et [api.md](api.md).

| ID | Action | Résultat attendu |
|---|---|---|
| RUN-01 | GET /openapi.json et ouvrir /docs | HTTP 200 ; référence API disponible. Le démarrage ne prouve pas l'accès aux fournisseurs. |
| AUTH-01 | GET /account/profile sans token, puis token invalide/expiré | 401 ; aucune donnée privée. |
| AUTH-02 | Token valide d'un nouveau compte : POST /account/profile avec `{}` et une clé d'idempotence | 201 ; profil du sujet Auth, capacité donor uniquement. |
| AUTH-03 | GET /account/profile avec ce token | 200 ; ID du compte connecté. Un compte Auth sans profil peut être refusé par les routes nécessitant un profil actif. |
| AUTH-04 | D1 demande la donation/photo de D2 | Accès refusé, sans données de D2. |
| AUTH-05 | Donateur tente décision ; staff tente modification de capacité ou gestion de membres | Refus selon contrat ; aucun changement. |
| AUTH-06 | Inscrire une association puis l'approuver comme plateforme | Administrateur candidat inactif avant approbation ; activation atomique du candidat d'origine après approbation. |
| AUTH-07 | Révoquer un membre puis réutiliser son token encore valide | Ancien accès refusé immédiatement par les permissions courantes. Dernier administrateur protégé. |

## 4. Parcours complet réel — P0

Exécuter d'abord avec un vêtement, une quantité entière et un besoin compatible, afin de ne pas mêler le diagnostic initial aux dates alimentaires. Conserver les IDs et les révisions à chaque étape.

| ID | Acteur et requête | Résultat attendu |
|---|---|---|
| FLOW-01 | D1 : POST /donations avec `{"facts":{"category":"clothes","attributes":{"type":"coat"},"quantity":"1","unit":"item"}}` | 201 ; brouillon appartenant à D1. |
| FLOW-02 | D1 : POST /donations/{id}/photos, multipart `file` + `kind=item` | 201 ; métadonnées et URL de contenu authentifiée, aucun base64 dans le DTO. GET du contenu restitue les mêmes octets. |
| FLOW-03 | D1 : POST /donations/{id}/analyses avec `{"photo_ids":["<photoId>"]}` | 201 si fournisseur disponible ; catégorie, extraction, indicateurs/provenance. Aucun verdict d'acceptation/refus. |
| FLOW-04 | D1 : PATCH /donations/{id} avec révision actuelle et faits complets corrigés | Valeurs humaines appliquées ; analyse/indicateurs originaux inchangés ; mismatch visible si catégorie différente. |
| FLOW-05 | D1 : POST /donations/{id}/publication avec expected_revision | Donation ready ; possibilité de publication manuelle sans succès IA si faits/photos valides. |
| FLOW-06 | D1 : POST /donations/{id}/matches avec `{"origin":{"latitude":48.85,"longitude":2.35}}`, puis essai séparé avec une adresse | Matching déterministe ; seconde variante utilise BAN. Aucun modèle pour le matching, aucune réservation ni conservation de l'origine donateur. |
| FLOW-07 | D1 : POST /donations/{id}/offers avec association_id, need_id, expected_donation_revision | 201 ; offre pending_review avec faits/preuves figés ; une seule tentative active. |
| FLOW-08 | Staff A : GET /offers/{id}/evidence puis POST /offers/{id}/decision | Décision humaine approved après contrôles ; demande et stockage réservés. Fournir not_medicine et les confirmations/reason applicables. |
| FLOW-09 | D1 : lire les créneaux disponibles puis POST /offers/{id}/bookings | 201 ; quota journalier et place réservés ; créneau compatible avec dates/état. |
| FLOW-10 | D1 : GET /bookings/{id}/qr ; staff A : résolution du QR via route documentée | Payload signé lié à la réservation et au bon tenant ; aucun droit accordé par le QR seul. |
| FLOW-11 | Pendant la fenêtre de réception : staff A POST /bookings/{id}/reception | Une réception complète ; booking received, offre fulfilled, donation transferred. |
| FLOW-12 | Staff A : lire inventory, expiry, expiry-counts et images | Un seul lot reçu, métadonnées/preuves autorisées, calculs de dates à la lecture et ordre FEFO. |
| FLOW-13 | Staff A : POST /inventory/{receiptId}/distributions avec confirm_full_distribution | Un seul mouvement complet ; stockage libéré, demande/intake déjà consommés non rétablis. |

Pour FLOW-08 sans analyse exploitable, utiliser `analysis_unavailable_ack: true` et un motif après vérification humaine. Pour la réception, attendre le début du créneau : ne pas modifier l'horloge ou des dates métier en base hébergée pour contourner le contrôle. La fenêtre est `[début, fin + 30 min)`.

## 5. Erreurs, sécurité et récupération — P0

| ID | Scénario | Résultat attendu |
|---|---|---|
| NEG-01 | Faux MIME, fichier non image, image >5 MiB, >20 MP ou quatrième photo | Erreur explicite, aucune nouvelle photo persistée ni appel IA pour l'upload rejeté. |
| NEG-02 | Révision obsolète ; corps identique rejoué ; même clé avec corps différent | Respectivement 409 ; pas d'effet supplémentaire ; conflit d'idempotence. |
| NEG-03 | Offre refusée puis nouvelle offre sur la même donation | Donation réutilisable ; nouvel ID d'offre, ancienne décision/historique conservés. |
| NEG-04 | Annulation/retrait avant réception ; expiration/no-show | Libération des ressources non consommées, historique conservé ; lectures correctes sans scheduler. Tester les longues échéances dans les tests déterministes, pas en modifiant la base partagée. |
| NEG-05 | QR falsifié, mauvais staff/tenant, réception hors fenêtre ou répétée | Refus du nouvel effet ; aucun doublon de réception/distribution. Rejeu valide avec même clé reste idempotent. |
| NEG-06 | Nouvelle preuve/correction pour B après fermeture de l'offre A | A ne voit que son périmètre figé ; originaux immuables. |
| NEG-07 | Appel Data API avec une session utilisateur : écriture directe/commande réservée/lecture private.photo_contents | Refus ; RLS et grants ne peuvent pas être contournés. Vérifier avec compte utilisateur/publishable, pas une clé privilégiée. |
| NEG-08 | Deux approbations ou bookings concurrents sur la dernière ressource | Un seul succès ; budgets jamais négatifs ni sur-réservés. À répéter sur la cible de préproduction. |

Les pannes IA et réponses tardives se testent d'abord via les simulations existantes. Pour confirmer la configuration manuelle de secours, lancer une instance locale distincte sans clé OpenAI, sans modifier les secrets partagés : erreur explicite de fournisseur et aucune décision/donnée inventée ; saisie manuelle toujours possible.

## 6. Analyse et dates — P0

Exécuter les cas [AN-T001–AN-T016 et EX-T001–EX-T034](rules-test-cases.md). Les tests de calcul utilisent une référence fixe ; les essais réels utilisent la date locale du fuseau de l'association. Ne pas attendre que des exemples datés de la documentation produisent les mêmes buckets à une autre date.

- Pour chaque photo annotée : relever catégorie, extraction brute, confiance, indicateurs, erreur éventuelle et comparaison humaine. Tester les cinq catégories avec le modèle réellement configuré.
- Médicament : conserver le signal et la redirection pharmacie disponible ; aucun parcours ne doit permettre de donner un médicament. Aliment froid/congelé : signal conservé et absence d'éligibilité individuelle ; aucune acceptation automatique.
- Dates : hier/aujourd'hui, exactement 7/30/90 jours, inconnue/illisible/ambiguë, DLC/DDM/expiry et PAO avec/sans ouverture. Aucune valeur calculée par le modèle ni persistée comme source.
- Une correction de catégorie ne supprime pas une alerte de date stricte originale. L'assertion date_label_correction_confirmed exige faits humains et motif ; elle ne contourne pas une date stricte corrigée expirée/non résolue. Une nouvelle preuve invalide la réutilisation de la revue.
- En stock : ordre FEFO total et stable, lots bloqués séparés, comptes sans doublon, inconnus distincts de not_applicable. Cursor expiré après changement de jour rejeté.

La structure JSON valide ne prouve pas l'exactitude visuelle. Aucun seuil de précision supplémentaire n'est inventé ici : les résultats sur photos doivent être revus avant validation de la fonctionnalité.

## 7. Décision de déploiement et compte rendu

Avant validation : tests automatiques verts, parcours complet réel réussi, isolation/RLS/révocation confirmées sur Supabase hébergé, cinq schémas OpenAI essayés et jeu photo revu, aucun effet physique dupliqué, six règles AGENTS respectées. Vérifier aussi limites HTTP/multipart, secrets/CORS/HTTPS, suivi des erreurs/budgets et procédure de sauvegarde/restauration ; les limites de performance doivent être mesurées et décidées, pas supposées acquises.

Modèle de compte rendu :

| ID | Cible et version du code | Acteur | Attendu | Observé / code HTTP | Statut | Preuve nettoyée / anomalie |
|---|---|---|---|---|---|---|
| FLOW-01 | Projet de développement, commit/date | D1 | 201 draft | À renseigner | Non exécuté | request_id et ID de ressource, sans secret |

Utiliser les statuts Réussi / Échec / Bloqué / Non exécuté. Une étape bloquée n'est pas une réussite. Reporter les résultats mesurés et les anomalies restantes dans [readiness](readiness.md). Pas de suppression d'historique métier ou de données d'une autre personne pour « nettoyer » les essais ; employer le projet de test et la politique de conservation retenue.
