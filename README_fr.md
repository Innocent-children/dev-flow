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

## Préparation des fichiers

Avant la soumission, Codex exécute `dev-flow-codex artifacts collect` et `dev-flow-codex artifacts prepare`. Core énumère toutes les modifications de l’Action en cours ; Codex classe chaque fichier et la commande génère les listes d’artefacts. Les omissions sont signalées avec leurs chemins exacts et une procédure de correction limitée. Les contrôles de l’arbre de travail, de l’historique et des permissions du nœud restent appliqués. Voir [collecte et soumission des fichiers](docs/ARTIFACTS_en.md).

Avant de démarrer Codex, définissez `DEV_FLOW_DATA_DIR` sur le chemin absolu canonique d’un répertoire existant. Le serveur MCP, le hook et les commandes de préparation des fichiers utilisent ce même répertoire. `dev-flow-codex artifacts <collect|prepare> --help` renvoie des exemples JSON, la description des champs, les sorties et l’étape suivante sans démarrer Core.

## Démarrage rapide

> La version stable publiée sur npm sous `@latest` est actuellement vérifiée sur macOS arm64. Installez d'abord Node.js `>=24`
> et une version compatible de Codex ou de DeepSeek Harness. Consultez les versions exactes et les autres
> environnements dans la [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Installer Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Le menu de cycle de vie affiche l’état des Adapters et permet de revenir, quitter, corriger une saisie et ouvrir Control Center. Les versions et chemins concernés sont affichés avant confirmation. `install`, `repair` et `reinstall` conservent par défaut la version installée ; `upgrade` choisit `latest`. Répéter une installation ou réparation saine, une mise à jour déjà appliquée ou une suppression terminée ne produit aucun changement ; `reinstall` remplace à nouveau le paquet. `doctor` affiche les contrôles en échec et les commandes de résolution. Consultez `dev-flow repair --help` ; le mode JSON ne pose aucune question. Ces commandes gèrent les Adapters ; mettez à jour le lanceur public avec `npm install -g @imotong/dev-flow@latest`.

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

## Mascotte de bureau (macOS arm64)

Le paquet local conserve l’apparence par défaut. La Fille Baleine et les autres apparences personnalisées s’importent sous forme de paquets de ressources séparés ; les mises à jour de l’application préservent les ressources importées.

La mascotte est disponible sur macOS arm64 via un paquet local de développement contenant `DevFlowPet.app` ; les listes habituelles de fichiers npm et la préparation des versions officielles omettent l’application native. Un paquet déjà compilé s’exécute sans Swift/Xcode et utilise le Core d’un Adapter Codex ou DeepSeek configuré. La mascotte affiche l’état enregistré d’une Task et ouvre sa WebUI, sans déduire l’activité en direct du Host ni un pourcentage de progression. Quitter conserve les Tasks et la WebUI.

Importez un PNG ou SVG statique, un pack d’animation natif PNG/SVG ou un atlas au format Codex 1/2. Les packs natifs exigent cinq animations de tâche et peuvent en ajouter quatre ; les atlas Codex fournissent neuf animations et 57 images. L’extension haute résolution de Dev Flow nécessite un atlas distinct aux dimensions standard pour être utilisée dans Codex. Les ressources disponibles déterminent les promenades, saluts et gestes de réflexion au repos, avec un réglage indépendant et la priorité aux alertes de tâche. La mise à jour du programme et la réimportation des ressources sont deux opérations distinctes.

La barre de menus affiche le logo monochrome aux lignes courbes de Dev Flow, dont la couleur s’adapte à l’apparence du système. La taille de la mascotte propose six réglages de 50% à 200%, en conservant la taille du texte de la bulle. L’apparence par défaut est fournie dans un pack distinct de neuf animations et 312 images SVG.

Tant qu’aucune tâche n’est sélectionnée, la mascotte continue de rechercher de nouvelles tâches : elle choisit en priorité la tâche bloquée mise à jour le plus récemment, puis la tâche active mise à jour le plus récemment. La sélection reste inchangée jusqu’à une modification manuelle.

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

## Adaptation aux PC Windows

Windows 10/11 x64 cible les PC de bureau courants équipés de processeurs Intel ou AMD 64 bits. Les règles de chemins, permissions, commandes et nettoyage du Host sont séparées dans `platform/windows/` et `platform/macos/` ; Core partage la sémantique des tâches indépendante de la plateforme. Les lanceurs de commandes Windows utilisent UTF-8 et l’observation Git de Core masque les fenêtres de console. Consultez le [rapport d’adaptation](docs/WINDOWS-ADAPTATION_en.md) pour la vérification native sous Windows et ses limites ; ces résultats n’étendent pas la prise en charge des paquets stables.

Windows propose aussi la mascotte de bureau : sélection des tâches et bulles d’état, menu de notification, apparences PNG/SVG, animations natives, atlas Codex PNG/WebP, neuf actions, déplacement à la souris, six tailles, masquage/restauration et démarrage/arrêt indépendants. Créez le paquet local Windows avec `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"` ; les prérequis et l’installation figurent dans le [guide de la mascotte](docs/DESKTOP-PETS_en.md). Les implémentations Windows et macOS restent séparées.
Sous Windows, le redimensionnement termine l’activité de repos en cours et reprend la planification normale.

Sous Windows, les répertoires AppData existants sont résolus vers leurs chemins réels, y compris les alias des hôtes de bureau empaquetés ; les liens symboliques restent refusés.

La distribution de développement Windows contient les deux paquets Adapter et l’application de bureau. Après l’installation du lanceur, utilisez `dev-flow install --host all --yes` et `dev-flow pet start`. La réparation et la réinstallation passent par la même entrée, vérifient les empreintes, actualisent l’application et conservent les données Task, préférences et apparences.

`dev-flow-codex host-launch <operation>` lit un objet JSON UTF-8 de 1 MiB au maximum depuis le flux stdin, y compris les entrées fragmentées et les caractères multioctets répartis entre fragments. Les erreurs de lecture, UTF-8 invalide, membres dupliqués, JSON invalide, tableaux et null sont rejetés avant toute opération. Les erreurs sont écrites sur stderr et les résultats JSON réussis sur stdout.

## Aide des commandes et reprise des tâches

L’aide de Codex décrit les paramètres des opérations sur les arbres de travail, les champs de réponse et l’étape suivante. Une fois tous les dépôts préparés, le Host rassemble le périmètre enregistré des arbres de travail. Les Schemas de résultat MCP indiquent où lire Task et Action ; les sessions reprises traitent les soumissions en attente avant de continuer.

```bash
dev-flow-codex --help
dev-flow-codex host-launch prepare --help
dev-flow-codex artifacts --help
dev-flow-codex artifacts collect --help
dev-flow-codex artifacts prepare --help
```

Les paramètres et les règles de reprise figurent dans la [référence des commandes](docs/COMMANDS_en.md).

`host-launch prepare` génère `launch_id` lorsqu’il est omis et utilise cet ID pour vérifier l’enregistrement du lancement. Pour reprendre le même lancement, transmettez le `receipt.launch_id` renvoyé ; si l’enregistrement est déjà à l’état `prepared`, fetch est ignoré. Un ID explicite doit correspondre à l’enregistrement sauvegardé.

`host-launch dispatch-result` accepte la réponse complète de création de Codex, y compris le JSON dans `content[].text`. Il enregistre `clientThreadId` dans `host_client_thread_id` avec la phase `queued` ; renvoyer un résultat conservé avec les mêmes `launch_id` et `repository_key` permet de récupérer un enregistrement `uncertain`. Les vérifications suivantes suivent la même création, sans nouvelle demande de création.

Codex conserve les requêtes complètes de création d’espaces de travail pour les relire. `dispatch-start` prépare, `dispatch-call` autorise un appel, `dispatch-recover` reprend une opération dont l’appel n’a pas eu lieu et `dispatch-reconcile` retrouve une tâche existante lorsque le résultat est inconnu. L’appelant analyse des fichiers JSON complets ; un résultat manquant n’autorise pas une création en double.

## Planification des fichiers repris dans Codex

Lorsque Codex reprend des modifications locales, il inscrit leur conservation dans REQUIREMENTS et compare tous les `current_changed_paths` aux `expected_paths` et aux artefacts de processus conservés dans TASKS. Le nouveau développement et la conservation disposent de travaux et de vérifications distincts ; une liste de fichiers vide pour l’Action courant ne remplace pas la comparaison de tous les chemins du Task. Les vérifications de conservation comparent l’instantané de départ et ne certifient pas que le comportement existant a été testé. Les blocages de périmètre déjà présents suivent les choix et transitions actuels du Core.

## Capacité supplémentaire pour les vérifications prévues

Lors d’une augmentation de la capacité de vérification, `additional_checks` peut reprendre les noms de vérifications du plan courant ou d’ajustements précédents ; `rationale` explique le travail restant ou la réexécution. Les noms restent uniques dans chaque envoi ; des motifs précis, une augmentation réelle et les limites existantes restent obligatoires. L’augmentation de capacité ne crée aucun résultat réussi.
