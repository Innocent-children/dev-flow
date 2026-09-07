<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icône Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Conservez le périmètre, les limites de vérification et l'avancement des longues tâches de programmation avec IA d'une session à l'autre.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Empêcher les longues tâches de dériver

Plus une tâche de programmation dure, plus elle risque de changer progressivement de forme : des fichiers
s'ajoutent, un contrôle ciblé devient une campagne de tests sans limite, le même échec provoque un nouvel
essai similaire ou une session redémarrée doit reconstituer l'avancement depuis la conversation.

Dev Flow conserve dans une seule tâche locale la demande convenue, les chemins prévus, le plan de
vérification établi après analyse, l'étape actuelle et les résultats. Codex ou DeepSeek continue à modifier le code.

Chaque nouvelle demande est d'abord évaluée en lecture seule. Si vous choisissez Dev Flow, vous confirmez
le remote, la branche de base et une nouvelle branche de tâche ; le Host crée depuis cette base distante
un worktree propre et dédié avant que Core ne crée la Task. Les changements du checkout source ne sont pas copiés.

La recherche de dépôts et l'utilisation de l'index de code suivent les instructions actuelles de
l'utilisateur et le fichier `AGENTS.md` applicable. Si ces instructions imposent un index de projets,
le Host examine les dépôts candidats en lecture seule avant confirmation, puis fixe le périmètre
confirmé dans la Task. Ces instructions priment sur la préférence du plugin pour l'index de code.

- **Le périmètre reste clair.** Les chemins prévus sont enregistrés, les outils structurés pris en charge
  demandent confirmation avant d'écrire hors du plan et les changements réels sont revérifiés avant les
  tests et la livraison.
- **Chaque worktree a un seul propriétaire des modifications.** Core calcule les modifications actuelles de la
  Task depuis Git ; les commits linéaires normaux continuent, tandis qu'une réécriture de branche ou le
  remplacement du worktree arrête la tâche.
- **La vérification suit la tâche.** TASKS conserve contrôles, raisons, effort initial et attentes de suite
  complète/code de test. Seuls un impact, un risque, un échec ou un manque concret augmentent le budget.
- **La revue s'arrête au changement courant.** Après modification, elle couvre le diff, l'impact causal et
  l'acceptation ; une correction ne relance que les contrôles liés et une code review explicite reste en lecture seule.
- **Le travail reprend après un redémarrage.** Une nouvelle session retrouve la même tâche, les contrôles
  restants et la décision en cours sans les reconstruire depuis la conversation.
- **Seuls les résultats encore valides sont réutilisés.** Toute modification de la demande, du plan, de
  l'implémentation ou du dépôt invalide les anciens contrôles ; le développeur examine le résultat avant livraison.

## Démarrage rapide

> La version stable publiée sur npm sous `@latest` est actuellement vérifiée sur macOS arm64. Installez d'abord Node.js `>=24`
> et une version compatible de Codex ou de DeepSeek Harness. Consultez les versions exactes et les autres
> environnements dans la [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Installer Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Choisissez Codex, DeepSeek ou les deux dans la configuration interactive. Avant de lancer la première
tâche, effectuez également la dernière opération indiquée par l'installateur :

- **Codex :** ouvrez `/hooks`, examinez le hook fourni avec Dev Flow et marquez-le comme fiable. Le contrôle
  préalable pris en charge pour `apply_patch` ne fonctionne pas tant que le hook n'est pas approuvé.
- **DeepSeek Harness :** redémarrez le Profile DSH choisi après l'installation.

### 2. Démarrer une tâche

Envoyez ce message utilisateur dans **Codex** :

```text
$dev-flow-codex:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Ou envoyez ce message dans **DeepSeek Harness** :

```text
/dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Ce sont des sélecteurs de conversation, pas des commandes shell. Indiquez un objectif concret, les
conditions d'acceptation, le périmètre des fichiers et la limite de tests. La première réponse évalue
l'impact et demande de travailler directement ou avec Dev Flow ; même un sélecteur explicite ne saute
pas ce choix. Si vous choisissez Dev Flow, confirmez le remote, la base et la branche cible. Codex ouvre
un worktree géré lorsque le Host le permet ; DeepSeek indique comment redémarrer depuis le nouveau
worktree, car le Workspace Root de la session est fixe.

### 3. Reprendre et consulter l'avancement

Après un redémarrage de la session, demandez explicitement de poursuivre la Task dans son worktree
d'origine. Le système vérifie ce worktree et reprend à partir de l'état enregistré, sans réévaluer
la demande ni vous demander de choisir à nouveau Dev Flow. Si le worktree d'origine a disparu ou a
été remplacé, la Task reste en pause jusqu'à sa restauration ou à l'abandon explicite de la tâche
(abandon). Le système ne passe pas à un autre worktree.

```bash
# Consulter les intégrations installées
dev-flow status --host all

# Ouvrir la vue locale des tâches
dev-flow webui start
```

Pour l'installation non interactive, les Profiles DSH personnalisés, les mises à niveau, la réparation
et la suppression, consultez la [Command Reference](docs/COMMANDS_en.md).

## Quand l'utiliser

Dev Flow convient aux travaux de dépôt qui s'étendent sur plusieurs sessions, nécessitent un véritable
périmètre de fichiers, limitent l'effort de test ou peuvent demander des reprises sans réutiliser de
résultats obsolètes.

Pour une question ponctuelle, une explication de code, une consultation d'état ou une petite modification
mécanique sans progression à conserver, Codex ou DeepSeek seul est généralement plus simple.

## Mascotte de bureau (macOS arm64)

Le paquet local conserve l’apparence par défaut. La Fille Baleine et les autres apparences personnalisées s’importent sous forme de paquets de ressources séparés ; les mises à jour de l’application préservent les ressources importées.

La mascotte est disponible sur macOS arm64 via un paquet local de développement contenant `DevFlowPet.app` ; les listes habituelles de fichiers npm et la préparation des versions officielles omettent l’application native. Un paquet déjà compilé s’exécute sans Swift/Xcode et utilise le Core d’un Adapter Codex ou DeepSeek configuré. La mascotte affiche l’état enregistré d’une Task et ouvre sa WebUI, sans déduire l’activité en direct du Host ni un pourcentage de progression. Quitter conserve les Tasks et la WebUI.

Importez un PNG ou SVG statique, un pack d’animation natif PNG/SVG ou un atlas au format Codex 1/2. Les packs natifs exigent cinq animations de tâche et peuvent en ajouter quatre ; les atlas Codex fournissent neuf animations et 57 images. L’extension haute résolution de Dev Flow nécessite un atlas distinct aux dimensions standard pour être utilisée dans Codex. Les ressources disponibles déterminent les promenades, saluts et gestes de réflexion au repos, avec un réglage indépendant et la priorité aux alertes de tâche. La mise à jour du programme et la réimportation des ressources sont deux opérations distinctes.

La barre de menus affiche le logo monochrome aux lignes courbes de Dev Flow, dont la couleur s’adapte à l’apparence du système. La taille de la mascotte propose six réglages de 50% à 200%, en conservant la taille du texte de la bulle. L’apparence par défaut est fournie dans un pack distinct de neuf animations et 312 images SVG.

Consultez le [guide de la mascotte](docs/DESKTOP-PETS_en.md) pour obtenir l’application, l’installer, la mettre à jour et connaître les règles, limites et solutions aux problèmes. La matrice de support définit le support public.

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentation

- **Utilisation :** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projet :** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Licence

[Apache License 2.0](LICENSE)
