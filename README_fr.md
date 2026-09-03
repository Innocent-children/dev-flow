<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icône Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Gardez les longues tâches de programmation avec IA dans les limites de modification et de test que vous avez fixées.</strong></p>

<p align="center">Garde-fous locaux, progression persistante et reprise sûre pour Codex et DeepSeek.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="Plateforme stable : macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#démarrage-rapide">Démarrage rapide</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#documentation">Documentation</a>
</p>

## Gardez la tâche que vous avez approuvée

Les longues tâches de programmation échouent rarement d'un seul coup. Elles dérivent : un fichier hors
plan en devient trois, un contrôle ciblé se transforme en campagne de tests sans limite, le même échec
entraîne une nouvelle correction similaire, ou une session redémarrée reconstitue l'avancement depuis
un historique de discussion incomplet.

Dev Flow conserve dans une Task locale la demande convenue, les chemins prévus, le budget de vérification,
l'étape actuelle et les résultats. Codex ou DeepSeek continue à lire et modifier le code et à exécuter
les commandes ; Dev Flow transforme les changements de périmètre, les répétitions, la reprise et la
livraison en décisions explicites.

## Ce qu'il garde sous contrôle

| Sujet | Comportement de Dev Flow |
| --- | --- |
| **Périmètre des modifications** | Enregistre les chemins prévus, suspend les écritures prises en charge hors plan et revérifie les chemins modifiés cumulés avant les tests et la fin. |
| **Effort de vérification** | Conserve un budget de commandes, demande une autorisation préalable pour la suite complète et s'arrête à la troisième répétition exacte du même échec ou d'un résultat inchangé. |
| **Progression persistante** | Stocke la Task hors du chat afin qu'une nouvelle session reprenne la même étape, les mêmes limites, les mêmes enregistrements et Blockers. |
| **Résultats encore valides** | Invalide les tests et confirmations de compréhension devenus obsolètes lorsque la demande, le plan, l'implémentation ou le repository change. |
| **Validation du développeur** | Avant livraison, impose une revue des changements réels, de la complexité inutile et des risques de maintenance. |

## Démarrage rapide

> Le npm `@latest` stable est actuellement vérifié sur macOS arm64. Les Host Adapter nécessitent
> Node.js `>=24`. Consultez la [Support Matrix](docs/SUPPORT-MATRIX_en.md) avant toute installation dans un autre environnement.

### 1. Installer et connecter un Host

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

La configuration interactive permet d'installer Dev Flow pour Codex, DeepSeek ou les deux. Le même
point d'entrée sert ensuite à consulter l'état, diagnostiquer, mettre à niveau, réparer ou supprimer.

### 2. Démarrer une Task bornée

Dans **Codex**, envoyez ce message utilisateur :

```text
$dev-flow-codex:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Dans **DeepSeek Harness**, envoyez :

```text
/dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Ce sont des selectors de conversation, pas des commandes shell. Décrivez aussi précisément que
possible l'objectif, les conditions d'acceptation, la limite des fichiers et le plafond de tests.

### 3. Reprendre ou examiner

Après un redémarrage, revenez dans le repository participant à la Task et utilisez de nouveau le même
selector du Host. Dev Flow lit la Task conservée et reprend son étape actuelle sans reconstruire
l'avancement à partir de la conversation.

```bash
# État des Adapter en lecture seule
dev-flow status --host all

# Ouvrir le Control Center local
dev-flow webui start
```

Control Center affiche l'étape actuelle, les chemins prévus et modifiés, l'historique des contrôles,
les Blockers, les conseils de reprise et la prochaine décision. Il lit les mêmes données Task locales
que les deux intégrations Host.

Pour la configuration non interactive, les commandes natives du Host, les Profiles DeepSeek
personnalisés, les mises à niveau et la suppression, consultez la
[Command Reference](docs/COMMANDS_en.md).

## Comportement pendant une Task

1. **Définir la limite.** La Task conserve la demande, les repositories participants, les chemins prévus, les travaux et le budget de vérification.
2. **Travailler via le Host.** Codex ou DeepSeek modifie le code ; les outils de fichiers structurés pris en charge demandent confirmation avant d'écrire hors du plan.
3. **Vérifier les changements réels.** Avant les tests et la fin, Core rapproche tous les chemins modifiés par la Task, y compris ceux qui n'ont pas passé de contrôle préalable.
4. **Arrêter les boucles improductives.** La troisième répétition exacte suspend la Task et exige une autre voie ou une autorisation explicite de continuer.
5. **Livrer les résultats actuels.** Les changements de code ultérieurs invalident les anciens contrôles ; les tests et la compréhension du développeur doivent correspondre à l'implémentation livrée.

Si une opération se termine sans réponse claire, l'intégration lit l'Action enregistrée et le repository
actuel avant de décider si une nouvelle tentative est sûre.

## Quand l'utiliser

| Utilisez Dev Flow lorsque… | Utilisez directement le Host lorsque… |
| --- | --- |
| Le travail peut s'étendre sur plusieurs sessions, redémarrages ou jours | Vous avez besoin d'une réponse ponctuelle ou d'une explication de code |
| Les fichiers modifiés et l'effort de test ont besoin de limites explicites | La modification est petite, mécanique et ne nécessite pas de progression persistante |
| Un retour en arrière ne doit pas réutiliser de résultats obsolètes | Vous souhaitez seulement consulter l'état ou discuter de la conception |
| La livraison exige une revue claire du développeur | Vous n'avez besoin ni d'une Task persistante ni d'un état de reprise |

## Compatibilité

| Produit npm `@latest` stable | Environnement vérifié |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Le code source actuel contient également la WebUI locale et le runtime exact `win32-x64`, mais Windows
ne dispose pas encore d'une Host Journey `@latest` stable. La
[Support Matrix](docs/SUPPORT-MATRIX_en.md) définit les plateformes stables ;
[Project Status](docs/PROJECT-STATUS_en.md) distingue les versions stables, les capacités présentes
uniquement dans le code, les Journeys publiques et les lacunes actuelles.

## Limites

- Dev Flow est une couche de contrôle, pas un Agent de programmation. Codex ou DeepSeek, autorisé par l'utilisateur, modifie les fichiers et exécute les commandes.
- Go Core observe Git en lecture seule. Il n'exécute aucun commit, push, merge, rebase, tag ou publish.
- Les contrôles avant écriture couvrent uniquement les outils structurés du Host indiqués. Bash et les outils externes peuvent écrire en premier ; Dev Flow n'est donc pas un sandbox shell ou système de fichiers.
- Control Center écoute uniquement sur le loopback local pour un utilisateur ; il n'offre ni accès distant, ni synchronisation cloud, ni permissions d'équipe.

## Documentation

- **Pour commencer :** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **Utilisation :** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Fonctionnement :** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **Sécurité et contribution :** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## Licence

[Apache License 2.0](LICENSE)
