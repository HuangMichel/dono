# Tests API exécutables avec curl

Deux scripts Bash appellent réellement FastAPI et vérifient les codes HTTP et le contenu JSON. Ils utilisent `curl`, `jq` et `python3`. Ils ne lisent pas `backend/.env` ; le serveur FastAPI le charge. Les tokens Auth de test sont fournis séparément. Les scripts créent des données et conservent l'historique : utiliser uniquement un projet de développement dédié, avec migrations appliquées.

## Lancer

Terminal 1, depuis la racine :

```sh
cd backend
uv run uvicorn app.main:app --reload
```

Terminal 2, depuis la racine, avec Bash :

```bash
export BASE_URL=http://127.0.0.1:8000/api/v1
export TEST_TARGET=development

# read -s évite de mettre les tokens dans l'historique du shell.
read -rsp 'Token donateur D1 : ' DONOR_TOKEN; echo
read -rsp 'Token donateur D2 : ' OTHER_DONOR_TOKEN; echo
read -rsp 'Token administrateur association A : ' ADMIN_TOKEN; echo
read -rsp 'Token staff A : ' STAFF_TOKEN; echo
read -rsp 'Token administrateur association B : ' OTHER_ADMIN_TOKEN; echo
read -rsp 'Token administrateur plateforme : ' PLATFORM_TOKEN; echo
export DONOR_TOKEN OTHER_DONOR_TOKEN ADMIN_TOKEN STAFF_TOKEN OTHER_ADMIN_TOKEN PLATFORM_TOKEN

# Photo réelle d'un vêtement : le scénario confirme humainement cette catégorie.
export PHOTO=/chemin/vers/vetement.png

# 0 : parcours manuel sans appel IA ; 1 : appel OpenAI réel, facturable.
export RUN_OPENAI=0
bash backend/scripts/test-api.sh
bash backend/scripts/test-api-expiry.sh
```

Utiliser six comptes différents avec tokens Supabase valides. Le compte plateforme doit déjà posséder ce rôle attribué par un opérateur de confiance ; le script ne l'élève pas. Il crée lui-même les profils manquants, deux associations de test avec identifiants synthétiques, approuve leurs inscriptions, attribue le membre staff et configure A (BAN, horaires, besoin, stockage, quota et créneau).

Les données sont exclusivement des fixtures de développement, pas de vraies inscriptions à approuver. Aucun email ou invitation n'est envoyé. Pour tester OpenAI : refaire une exécution avec `RUN_OPENAI=1`, après avoir choisi/configuré le modèle dans le backend et confirmé la photo comme vêtement. Un échec fournisseur provoque un échec du test, pas une réussite silencieuse. Le champ de confirmation humaine suppose que la photo est bien celle du vêtement de test : ne pas utiliser une photo de médicament pour ce scénario.

## Contenu des scripts

`test-api.sh` enchaîne des commandes curl avec IDs et révisions récupérés par jq :

- Profil, session absente, deux donateurs, isolation des données, inscription/approbation associations, droits staff/admin et historique des membres.
- Configuration du site et du matching, photo valide/invalide, analyse optionnelle, correction humaine et original inchangé, publication, matching par coordonnées puis adresse BAN.
- Offre, refus d'une décision par le donateur, approbation staff, réservation, rejeu identique, conflit de clé, QR valide/falsifié, réception complète et rejeu sans doublon.
- Inventaire, FEFO, comptes de dates, galerie, distribution complète, rejeu et seconde distribution refusée.
- Refus puis nouvelle offre sur la même donation, retrait/restauration, annulation de réservation, pagination, protection du dernier administrateur, révocation staff avec token encore valide et réconciliation.
- Rejet de la quatrième photo, d’un fichier de plus de 5 MiB et d’une image de plus de 20 MP. Le fichier de plus de 5 MiB dépasse la limite actuelle de 4 MiB ; ce scénario ne vérifie pas la borne exacte de 4 MiB.

Le script attend le début du créneau réel (environ trois minutes), sans modifier l'heure ou contourner la fenêtre de réception. Une interruption laisse les fixtures et l'historique en place. Une nouvelle exécution crée un autre jeu de données. Il affiche PASS par requête et échoue dès qu'un résultat ne correspond pas ; les groupes non exécutés sont explicitement affichés. Aucun corps de réponse privé ou token n'est affiché.

`test-api-expiry.sh` crée 17 brouillons sans upload/IA, puis vérifie leurs projections GET : hier/aujourd'hui et bornes 7/30/90 jours, date absente/illisible, non applicable, DDM/DLC partielle, PAO non ouvert et PAO sans date d'ouverture. Les dates relatives sont calculées en Python dans Europe/Paris. Éviter une exécution à cheval sur minuit local.

## Limites explicites par rapport au plan complet

Des appels curl seuls ne prouvent pas tous les scénarios déterministes et visuels de [test-plan.md](test-plan.md). Restent à compléter :

| Groupe | Moyen de validation |
|---|---|
| 72h/24h, no-show, égalité exacte aux échéances, changement de jour, résultat IA tardif, gardes périmées | Tests pytest à horloge contrôlée ; ne pas falsifier les dates de la base hébergée. |
| Dernière place/quota/stockage en concurrence | Tests PostgreSQL concurrents existants, puis campagne dédiée sur préproduction. Le script séquentiel ne prétend pas tester ces courses. |
| Médicaments, aliments froids, cinq catégories et qualité OCR | Jeu annoté de 25–35 photos et revue humaine ; une réponse JSON valide ne suffit pas. |
| Accès direct Data API/private, transfert/récupération administrateur, preuves futures réservées à B | Régressions automatisées existantes et essais ciblés additionnels sur la cible. Non couverts intégralement par ces deux scripts. |
| Sauvegarde/restauration, HTTPS/CORS, limites de charge/coût | Validation d'exploitation de la cible. |

Le `.env` configuré ne fournit pas de tokens utilisateurs. La connexion par email et mot de passe doit produire des sessions avant ces essais. Authorize et les scripts utilisent les tokens déjà obtenus. Ne jamais transmettre la clé Supabase secrète comme bearer utilisateur. Ne pas activer `set -x`, `curl -v` ou enregistrer l'environnement dans un rapport partagé.

## Vérification des scripts

Les deux scripts ont été exécutés avec de vrais processus curl vers FastAPI sur localhost et les migrations dans PostgreSQL jetable, via `backend/tests/test_curl_runner.py`. Le transport Supabase/Auth/OpenAI/BAN est simulé dans ce test ; les contraintes, RLS et commandes SQL sont réelles. Ce résultat ne valide pas les identifiants du `.env` ou les services hébergés. La syntaxe Bash et Ruff ont aussi été vérifiés.

Validation finale de cette livraison : `ruff check .` et `mypy app` réussis ; suite complète `pytest -q` : **97 tests réussis**, avec un avertissement de dépréciation Starlette/AnyIO. Aucun appel vers les services réels et aucune lecture du fichier backend/.env pendant cette validation.

Dernière campagne : [rapport du 25 octobre 2026](reports/api-tests-2026-10-25.md), avec preuve JUnit et distinction explicite entre tests locaux et services réels.
