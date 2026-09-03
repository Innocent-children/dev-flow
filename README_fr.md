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

Dev Flow conserve dans une seule tâche locale la demande convenue, les chemins prévus, les limites de
vérification, l'étape actuelle et les résultats. Codex ou DeepSeek continue à modifier le code.

- **Le périmètre reste clair.** Les chemins prévus sont enregistrés, les outils structurés pris en charge
  demandent confirmation avant d'écrire hors du plan et les changements réels sont revérifiés avant les
  tests et la livraison.
- **La vérification reste limitée.** Le nombre de commandes automatiques est plafonné, la suite complète
  nécessite une autorisation préalable et la troisième répétition exacte suspend la tâche.
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
conditions d'acceptation, le périmètre des fichiers et la limite de tests.

### 3. Reprendre et consulter l'avancement

Après un redémarrage, revenez dans le même répertoire de travail du dépôt et utilisez à nouveau le même
sélecteur. Dev Flow lit la tâche sauvegardée et reprend à l'étape actuelle.

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

## Documentation

- **Utilisation :** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projet :** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING_en.md)

## Licence

[Apache License 2.0](LICENSE)
