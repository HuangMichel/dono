# Rapport d'intégration réelle — Supabase, OpenAI et BAN

Date : **25 octobre 2026**. **Les connexions et l'appel Vision structuré ont réussi avec les paramètres réels de backend/.env.** Cette campagne complète le [rapport local précédent](api-tests-2026-10-25.md) ; elle n'utilise pas ses transports simulés.

## Résultats observés

| Test réel | Résultat | Ce que cela prouve |
|---|---|---|
| Chargement backend/.env via app.config.Settings | Réussi ; URL Supabase, clés publishable/secret et OpenAI présentes ; modèle gpt-5.4-mini | Le backend peut lire la configuration fournie. Aucune clé n'est affichée dans les résultats. |
| Supabase GET /auth/v1/settings avec clé publishable | **HTTP 200** | URL et clé publique acceptées par Supabase Auth. Fournisseur Google activé. |
| Supabase GET /auth/v1/settings avec clé secret | **HTTP 200** | Clé serveur acceptée par le même service Auth. |
| Supabase GET /rest/v1/ avec clé secret | **HTTP 200** | Data API accessible ; les **22 noms de RPC Dono** correspondent aux fonctions attendues dans les migrations locales, aucun nom manquant ou supplémentaire. |
| Supabase POST RPC dono_offer_context avec acteur inexistant | **HTTP 400, P0001, account_disabled — rejet attendu** | La fonction est réellement exécutée et refuse un acteur non autorisé. Pas une panne de connexion : le garde métier est atteint. Fonction de lecture, aucune écriture. |
| BAN via app.adapters.geocoding.BANGeocoder | **Réussi** | Recherche d'adresse réelle, réponse analysée et coordonnées valides. |
| OpenAI POST /v1/responses via app.adapters.openai.OpenAIAnalyzer | **HTTP 200** | Clé API et accès au modèle configuré gpt-5.4-mini fonctionnels ; entrée image et Structured Outputs acceptés. |
| Validation du résultat OpenAI par le modèle Pydantic de l'application | **Réussie** | Catégorie clothes, **7 indicateurs**, contrat analysis-v1 valide, aucun champ decision. |

Preuve structurée nettoyée : [résultats JSON](live-integrations-2026-10-25.json). La comparaison des noms RPC ne valide pas à elle seule toutes les colonnes, contraintes, signatures, versions de migrations ou politiques RLS de la cible.

## Méthode

Exécution d'un contrôle Python local depuis backend/, chargeant le vrai fichier .env et utilisant HTTPX sans MockTransport. Les adaptateurs OpenAI/BAN de l'application sont utilisés directement. La clé serveur Supabase est envoyée uniquement à l'URL Supabase configurée ; la clé OpenAI uniquement à api.openai.com. Les réponses de configuration Auth et le document Data API ne sont pas copiés intégralement dans les artefacts.

Un seul appel OpenAI a été effectué, facturable selon le compte configuré. L'image envoyée est un dessin synthétique de vêtement généré localement ; aucune photo privée n'a été utilisée. Le modèle reçoit store=false comme prévu par l'adaptateur. Il s'agit d'un test de compatibilité et de connexion, pas d'une mesure de précision visuelle/OCR.

Aucun utilisateur, profil, association, donation, photo, analyse ou mouvement n'a été créé dans Supabase. Aucun envoi de message/email et aucune modification des migrations, des secrets ou de la configuration hébergée.

## Limites et suite

- Google est activé, mais une connexion OAuth complète avec un utilisateur n'a pas été effectuée. Les clés d'application ne sont pas des tokens utilisateurs.
- Le parcours FastAPI complet photo → persistance → analyse → décision staff → booking/QR → réception n'a pas été exécuté contre les données hébergées. Il nécessite des sessions des acteurs et des fixtures dans un projet de développement identifié. Cela ne bloque pas les contrôles de connexion réalisés ici.
- Une seule catégorie a été retournée par le modèle réel. L'évaluation des cinq catégories, des médicaments, des dates et des 25–35 photos réelles reste à faire.
- La confidentialité interutilisateurs/interassociations, les grants complets et les courses doivent être revérifiés sur la cible avec des sessions distinctes. Le rejet d'un acteur inexistant ne remplace pas cette campagne.

**Conclusion : les identifiants/configurations Supabase et OpenAI fonctionnent réellement. Il reste à valider le parcours métier hébergé avec des utilisateurs, et la qualité de l'analyse sur photos réelles.**

## Nouvel appel enregistré pour visualiser entrée/sortie

Un [exemple complet](openai-example-2026-10-25/README.md) a ensuite été sauvegardé à la demande de l'utilisateur. HTTP 200, mais **validation métier rejetée** : cinq indicateurs reçus au lieu des sept requis (chilled_or_frozen et label_unreadable absents). Le premier succès de connexion ne garantit donc pas la conformité de chaque sortie. La réponse brute et l'erreur sont conservées sans correction ; aucun enregistrement Supabase. Cette fiabilité contractuelle doit être corrigée/vérifiée avant validation de l'analyse en production.
