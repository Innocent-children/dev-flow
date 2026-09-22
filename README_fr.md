<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icône Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>La programmation IA au long cours, sous contrôle.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Ce que Dev Flow vous permet de faire

Votre agent choisit la prochaine action technique.<br />
Dev Flow garde la tâche sous contrôle.

Utilisez-le avec Codex, DeepSeek, Claude Code ou ZCode. L’agent raisonne sur le code ; Dev Flow conserve le périmètre, les limites de vérification, l’état et les données de reprise.

- **Périmètre explicite:** Comparez les modifications aux fichiers approuvés. Sortir du plan demande une décision.
- **Vérification bornée:** Prévoyez les contrôles utiles et leurs limites. Tout ajout demande une raison concrète.
- **État persistant:** L’état de référence de la tâche reste enregistré localement entre les sessions.
- **Reprise sûre:** Consultez l’état et les opérations enregistrées pour résoudre un échec ou un résultat incertain avant de réessayer.

Il convient aux travaux sur un dépôt qui s’étendent sur plusieurs sessions ou nécessitent des limites
claires de fichiers et de tests. Pour les questions ponctuelles, les explications de code et les petites
modifications sans suivi persistant, utiliser directement Codex, DeepSeek, Claude Code ou ZCode est généralement plus simple.

## Démarrage rapide

> Installez Node.js `>=24` et le Host choisi. Consultez les versions requises et les plateformes vérifiées dans la [matrice de support](docs/SUPPORT-MATRIX_en.md).

### 1. Installer Dev Flow

L’installation publique ci-dessous concerne les intégrations publiées de Codex et DeepSeek. Pour Claude Code, suivez le [guide d’installation depuis les sources](docs/CLAUDE_en.md) ; l’ancienne CLI publique n’installe pas un Adapter disponible uniquement dans les sources.

ZCode utilise également le [guide d’installation depuis les sources](docs/ZCODE_en.md). Les paquets locaux ciblent Windows x64 et macOS arm64 ; la validation de ZCode sur un Mac reste à effectuer.

```sh
npm install -g @imotong/dev-flow@latest
dev-flow
```

Choisissez votre Host parmi les options de l’installateur utilisé. Dans Codex, examinez et autorisez le hook Dev Flow dans `/hooks` ; dans DeepSeek, redémarrez le Profile sélectionné. Dans Claude Code, rechargez les plugins ou ouvrez une nouvelle conversation, puis examinez les permissions demandées.

Dans ZCode, installez et activez le plugin dans Settings → Plugins, puis ouvrez une nouvelle conversation pour activer les hooks. La préparation locale du paquet ne confirme pas son chargement par ZCode.

### 2. Démarrer une tâche

Après l’installation correspondante, envoyez l’un de ces messages dans la conversation du Host :

**Codex**

```text
$dev-flow-codex:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

**DeepSeek Harness**

```text
/dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

**Claude Code**

```text
/dev-flow-claude:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

**ZCode**

Sélectionnez `dev-flow` dans le menu `/` → Skills du champ de saisie, puis décrivez la tâche.

```text
Utilisez Dev Flow pour limiter les échecs de connexion. Modifiez uniquement les fichiers d’authentification et exécutez au plus 4 contrôles ciblés.
```

Envoyez ces messages dans la conversation, pas dans un terminal. Précisez l’objectif, les critères
d’acceptation, le périmètre des fichiers et la limite de tests.

La première réponse évalue la demande et propose de travailler directement ou avec Dev Flow. En
choisissant Dev Flow, une nouvelle branche de tâche est créée par défaut depuis le HEAD actuel dans
le répertoire actuel. Confirmez la branche et l’inclusion des modifications non commitées existantes.
Les dépendances, la configuration locale, les fichiers et l’état de l’index sont conservés ; la même
session continue si elle peut accéder à tous les répertoires concernés.

Vous pouvez aussi choisir explicitement la branche actuelle ou un worktree Git dédié. Pour un worktree,
précisez également la source locale ou distante et la branche de départ. Codex ouvre le nouveau
répertoire si l’hôte le permet ; DeepSeek et Claude Code fournissent la commande de redémarrage correspondante.

Un répertoire ne peut accueillir qu’une seule Task active. Les modifications manuelles ou provenant
d’autres outils sont également observées, et changer de branche pendant la tâche suspend le processus.
Les répertoires et branches locaux sont conservés à la fin ; les modifications non commitées doivent
être prises en compte au lancement de la tâche suivante.

Avant l’implémentation, examinez et discutez les exigences, la conception, les tâches, les fichiers prévus et le plan de vérification. Le développement commence après votre accord explicite sur le plan complet. Toute révision du plan ou extension du périmètre des fichiers demande un nouvel accord. Choisir Dev Flow ou un worktree ne remplace pas cet accord.

### 3. Reprendre et consulter l’avancement

Après un redémarrage de session, revenez au répertoire d’origine et demandez de poursuivre la tâche.
Dev Flow reprend l’avancement enregistré. Si ce répertoire a disparu ou a été remplacé, la tâche reste
en pause jusqu’à sa restauration ou jusqu’à ce que vous l’abandonniez explicitement.

Dans DeepSeek Harness, incluez `/dev-flow` dans le message demandant de reprendre la tâche.

Dans Claude, rouvrez le répertoire et la conversation d’origine, puis demandez explicitement la reprise de la tâche enregistrée avec `/dev-flow-claude:dev-flow`.

Dans ZCode, rouvrez le répertoire d’origine, sélectionnez la Skill Dev Flow et demandez la reprise de la tâche enregistrée. Si un nouveau répertoire est préparé, suivez les instructions fournies pour ouvrir cet espace de travail.

Ces commandes utilisent le gestionnaire global installé. Pour une installation depuis les sources, utilisez l’entrée correspondante du guide.

```bash
# Consulter les intégrations installées
dev-flow status --host all

# Ouvrir la vue locale des tâches
dev-flow webui start
```

Pour l’installation non interactive, les Profiles DSH personnalisés, les mises à jour, la réparation
et la suppression, consultez la [référence des commandes](docs/COMMANDS_en.md).

## Mascotte de bureau

La mascotte nécessite un Adapter configuré et l’application de bureau installée. L’installation d’un Adapter seul n’installe pas l’application de bureau.

La mascotte affiche plusieurs tâches dans des bulles superposées et ouvre la WebUI de chacune. Elle donne la priorité aux tâches bloquées et passe automatiquement à une tâche inachevée lorsque la tâche actuelle se termine ; vous pouvez aussi épingler une tâche. Vous pouvez personnaliser son apparence, contrôler les animations, modifier sa taille et la démarrer ou l’arrêter indépendamment.

```bash
dev-flow pet start
dev-flow pet stop
```

Les applications de bureau ciblent macOS arm64 et Windows 10/11 x64. Consultez le
[guide de la mascotte](docs/DESKTOP-PETS_en.md) pour l’installation et les commandes, et la
[matrice de support](docs/SUPPORT-MATRIX_en.md) pour les environnements vérifiés.

## Limites d’utilisation

Dev Flow contrôle le déroulement de la tâche, pas les permissions du système. Il n’intercepte pas chaque opération sur les fichiers ni chaque commande shell.

Un worktree dédié sépare les modifications de code. Les processus, le réseau, les identifiants et
les services externes restent partagés avec votre environnement.

Terminer une tâche ne crée pas automatiquement de commit, n’effectue pas de push et ne supprime pas
son worktree. Ces opérations nécessitent une autorisation distincte de votre part.

## Documentation

- **Utilisation :** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Claude Code](docs/CLAUDE_en.md) · [ZCode](docs/ZCODE_en.md) · [Commandes](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projet :** [Définition du produit](docs/PRODUCT_en.md) · [Matrice de support](docs/SUPPORT-MATRIX_en.md) · [Sécurité](SECURITY.md)
- **Développement et contributions :** [Index de documentation](MANIFEST_en.md) · [Guide de contribution](CONTRIBUTING.md)

## Communauté

[LINUX DO](https://linux.do/)

## Licence

[Apache License 2.0](LICENSE)
