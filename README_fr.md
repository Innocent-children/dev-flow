<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Reprenez les longues tâches de programmation avec IA depuis un état persistant, pas depuis l’historique du chat.</strong></p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> Cette page est un instantané stable de la documentation. Pour les informations actuelles et
> continuellement synchronisées, consultez [简体中文](README.md) ou [English](README_en.md).

Dev Flow est une couche locale de contrôle et de reprise pour les longues tâches de programmation
avec IA. En dehors du chat, il conserve l’objectif, le périmètre, l’étape actuelle, le budget de
vérification, les vérifications terminées, les blocages et l’état de Recovery. Codex ou DeepSeek peut
ainsi continuer le même Task après une compression du contexte, un redémarrage du Host ou un résultat
incertain.

## Le problème principal

Après une interruption, une nouvelle session reconstruit souvent l’avancement à partir d’un chat
incomplet et du repository actuel. Elle peut répéter des modifications, ignorer une vérification
restante ou réutiliser un ancien résultat. Dev Flow lit d’abord le Task local et reprend depuis
l’étape et la prochaine action enregistrées.

## En 30 secondes

| Avec un Agent seul | Ce que Dev Flow ajoute |
| --- | --- |
| Après une interruption, l’avancement est deviné à nouveau | Reprise du même Task local |
| Une petite tâche élargit progressivement son périmètre | Conservation de l’objectif initial et des limites explicites |
| Les tests ciblés continuent de s’élargir | Conservation du verification budget |
| Une réponse perdue déclenche un nouvel essai immédiat | Lecture préalable du Task et de l’état de Recovery |
| Les résultats de test se mélangent aux changements ultérieurs | Conservation de l’étape actuelle et de ses enregistrements |

## Quand l’utiliser

Dev Flow convient aux travaux réels dans un repository qui se poursuivent sur plusieurs sessions,
jours ou redémarrages du Host, surtout lorsqu’ils exigent un périmètre clair, une vérification ciblée,
des retours explicites ou une vérification de compréhension avant livraison.

Pour une question ponctuelle, une explication de code, une consultation d’état ou une petite
modification mécanique sans avancement persistant, Codex ou DeepSeek seul est généralement plus
simple. Dev Flow n’est ni un orchestrateur général, ni une plateforme d’exécution distante, ni un
sandbox de sécurité.

## Relation avec les autres outils

| Outil | Responsabilité |
| --- | --- |
| Codex / DeepSeek | Lire les repositories, modifier le code et exécuter des commandes |
| OpenSpec / Spec Kit | Aider à organiser exigences, conception et tâches |
| Dev Flow | Conserver l’étape, le périmètre, le budget de vérification, Recovery et la prochaine action valide |

Il n’existe actuellement aucun artifact importer OpenSpec / Spec Kit. Une intégration plus légère
reste une orientation future.

## Installation et démarrage

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Entrée explicite Codex :

```text
$dev-flow-codex:dev-flow Corrigez la limite d’échecs de connexion et exécutez uniquement les tests ciblés.
```

Entrée explicite DeepSeek Harness :

```text
/dev-flow Corrigez la limite d’échecs de connexion et exécutez uniquement les tests ciblés.
```

## Support stable et limites actuelles

| Produit | Environnement vérifié |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

- Core observe Git en lecture seule et n’exécute aucun commit, push, merge, rebase, tag ou publish.
- Codex ou DeepSeek, autorisé par l’utilisateur, reste responsable des fichiers et commandes.
- Core n’intercepte pas chaque opération du Host et n’est pas un sandbox shell ou système de fichiers.
- WebUI est une vue locale loopback et un point de diagnostic mono-utilisateur.
- Le projet reste jeune et son adoption externe est limitée ; le périmètre stable est défini par Support Matrix.

## Documentation actuelle

- [English README](README_en.md)
- [Product Definition](docs/PRODUCT_en.md)
- [Démo d’interruption et de reprise](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) et [Threat Model](docs/THREAT-MODEL_en.md)

## Licence

[Apache License 2.0](LICENSE)
