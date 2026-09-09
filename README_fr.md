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

Chaque nouvelle demande est évaluée en lecture seule avant de choisir Dev Flow. Le Host demande ensuite
si la source est locale ou distante, quelle branche utiliser et comment nommer la nouvelle branche de tâche.
Pour une source locale, il demande aussi s’il faut copier les modifications indexées, non indexées et les fichiers
non suivis que Git n’ignore pas, en conservant le répertoire source et l’état de l’index. La création locale fonctionne
sans réseau ; seule la création distante exécute fetch. Un conflit arrête la création du Task et conserve la destination pour examen.

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
- **La finalisation et la reprise restent vérifiables.** Core exige que tous les éléments du plan soient terminés et relie chaque critère d’acceptation à des vérifications valides pour l’état actuel. Après une interruption, WebUI reprend les soumissions conservées par Core.

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

L’Adapter du code source actuel nécessite DSH `>=0.1.2-rc.1` ; chaque opération Dev Flow vérifie l’autorisation saisie directement par l’utilisateur dans le tour actuel.

### 2. Démarrer une tâche

Envoyez ce message utilisateur dans **Codex** :

```text
$dev-flow-codex:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Codex conserve les choix et autorisations encore valides, sans pause supplémentaire pour « confirmer et continuer ». Si une décision reste à prendre ou si une information nécessaire manque, il pose une question précise.

Ou envoyez ce message dans **DeepSeek Harness** :

```text
/dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d'authentification et exécutez au plus 4 contrôles ciblés.
```

Ce sont des sélecteurs de conversation, pas des commandes shell. Indiquez un objectif concret, les
conditions d'acceptation, le périmètre des fichiers et la limite de tests. La première réponse évalue
l'impact et demande de travailler directement ou avec Dev Flow ; même un sélecteur explicite ne saute
pas ce choix. Si vous choisissez Dev Flow, confirmez la source, les branches et la copie des modifications décrites ci-dessus. Codex ouvre
un worktree géré lorsque le Host le permet ; DeepSeek indique comment redémarrer depuis le nouveau
worktree, car le Workspace Root de la session est fixe.

Avant de démarrer une nouvelle session Codex, la session source enregistre la discussion originale pertinente et un document structuré, en distinguant les exigences confirmées des suggestions non acceptées et des questions ouvertes. La création de tâches sur le bureau et le redémarrage via la CLI utilisent les mêmes éléments enregistrés ; les contenus longs sont transmis dans des fichiers complets, sans troncature. Voir l’[architecture](docs/ARCHITECTURE_en.md#codex-requirements-handoff).

Le document conserve les instructions et autorisations propres à la session ; Codex charge normalement les fichiers `AGENTS.md` globaux et du dépôt applicables, sans en dupliquer le contenu dans la transmission. Les compléments nécessaires aux règles que la session destinataire ne peut pas détecter précisent leur origine et leur champ d’application.

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

## Accéder aux tâches depuis le bureau

Les paquets de développement locaux pour macOS arm64 et Windows 10/11 x64 proposent une mascotte de bureau. Elle affiche l’état enregistré d’un Task sélectionné et ouvre sa WebUI, sans indiquer l’activité en direct du Host ni un pourcentage d’avancement. Elle permet de choisir une tâche, d’importer des apparences, de contrôler les animations, de changer la taille et de démarrer ou quitter séparément. Core provient d’un Adapter Codex ou DeepSeek installé et configuré.

Les paquets npm habituels ne contiennent pas l’application native macOS. Consultez le [guide de la mascotte](docs/DESKTOP-PETS_en.md) pour obtenir le paquet local, le compiler, l’installer, le mettre à jour et utiliser les ressources graphiques. Les vérifications locales n’élargissent pas le [support stable](docs/SUPPORT-MATRIX_en.md).

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentation

- **Utilisation :** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projet :** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Licence

[Apache License 2.0](LICENSE)
