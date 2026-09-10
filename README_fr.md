<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icône Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Conservez le périmètre, les limites de vérification et l'avancement des longues tâches de programmation avec IA d'une session à l'autre.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Ce que Dev Flow vous permet de faire

Dev Flow vous aide à gérer de longues tâches de programmation avec IA dans Codex ou DeepSeek.
Il enregistre localement les exigences convenues, le périmètre des fichiers, le plan de vérification,
l’avancement et les résultats pour poursuivre le travail après la fin d’une session.

- **Clarifier le périmètre :** enregistrez les fichiers prévus et comparez les modifications réelles au plan.
- **Planifier les tests :** choisissez les contrôles utiles et fixez une limite à l’effort de vérification.
- **Reprendre le travail :** poursuivez la même tâche et le travail restant depuis son répertoire d’origine.
- **Consulter les résultats :** suivez l’avancement, les contrôles et les problèmes à traiter.

Il convient aux travaux sur un dépôt qui s’étendent sur plusieurs sessions ou nécessitent des limites
claires de fichiers et de tests. Pour les questions ponctuelles, les explications de code et les petites
modifications sans suivi persistant, utiliser directement Codex ou DeepSeek est généralement plus simple.

## Démarrage rapide

> La version stable npm `@latest` est actuellement vérifiée sur macOS arm64. Utilisez Node.js `>=24`
> et installez d’abord une version compatible de Codex ou DeepSeek Harness. Consultez les versions des
> applications hôtes et les autres environnements dans la [matrice de support](docs/SUPPORT-MATRIX_en.md).

### 1. Installer Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Choisissez Codex, DeepSeek ou les deux dans la configuration interactive, puis suivez les instructions de l’installateur :

- **Codex:** ouvrez `/hooks`, examinez le hook Dev Flow et approuvez-le pour activer les contrôles avant écriture pris en charge.
- **DeepSeek Harness:** redémarrez le Profile DSH sélectionné après l’installation.

### 2. Démarrer une tâche

Envoyez ce message dans **Codex** :

```text
$dev-flow-codex:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Ou dans **DeepSeek Harness** :

```text
/dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
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
répertoire si l’hôte le permet ; DeepSeek fournit la commande de redémarrage correspondante.

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

```bash
# Consulter les intégrations installées
dev-flow status --host all

# Ouvrir la vue locale des tâches
dev-flow webui start
```

Pour l’installation non interactive, les Profiles DSH personnalisés, les mises à jour, la réparation
et la suppression, consultez la [référence des commandes](docs/COMMANDS_en.md).

## Mascotte de bureau

La mascotte de bureau affiche l’état enregistré d’une tâche sélectionnée et ouvre sa WebUI. Vous
pouvez choisir la tâche, personnaliser l’apparence, contrôler les animations, modifier la taille et
la démarrer ou l’arrêter indépendamment. Terminez d’abord l’installation et la configuration de
Codex ou DeepSeek décrites ci-dessus.

```bash
dev-flow pet start
dev-flow pet stop
```

Les applications de bureau ciblent macOS arm64 et Windows 10/11 x64. Consultez le
[guide de la mascotte](docs/DESKTOP-PETS_en.md) pour l’installation et les commandes, et la
[matrice de support](docs/SUPPORT-MATRIX_en.md) pour les environnements vérifiés.

## Limites d’utilisation

Un worktree dédié sépare les modifications de code. Les processus, le réseau, les identifiants et
les services externes restent partagés avec votre environnement.

Terminer une tâche ne crée pas automatiquement de commit, n’effectue pas de push et ne supprime pas
son worktree. Ces opérations nécessitent une autorisation distincte de votre part.

## Documentation

- **Utilisation :** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commandes](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projet :** [Définition du produit](docs/PRODUCT_en.md) · [Matrice de support](docs/SUPPORT-MATRIX_en.md) · [Sécurité](SECURITY.md)
- **Développement et contributions :** [Index de documentation](MANIFEST_en.md) · [Guide de contribution](CONTRIBUTING.md)

## Licence

[Apache License 2.0](LICENSE)
