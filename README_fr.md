<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Gardez les longues tâches de programmation avec IA dans les limites de modification et de test définies, et vérifiez la fiabilité de l’état actuel avant de reprendre.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Quand une tâche commence à dériver

Imaginez demander à un Agent :

```text
Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d’authentification et exécutez au plus 4 contrôles ciblés.
```

La tâche dure plus longtemps. L’Agent veut toucher une configuration voisine, le même test échoue encore
et la session redémarre avant la fin. Le chat seul ne dit plus clairement si le fichier supplémentaire
fait partie du travail, combien de tests restent permis, si un autre essai apportera quelque chose ou si
un ancien résultat vert correspond encore au code actuel.

Dev Flow conserve ces décisions avec la tâche. L’Agent continue à lire et modifier le code et à lancer
des commandes ; élargir le périmètre, tester davantage, répéter et livrer deviennent des choix visibles.

## Ce que Dev Flow change

| Agent seul | Avec Dev Flow |
| --- | --- |
| Les limites de fichiers restent dans le prompt | Les fichiers prévus sont enregistrés et une écriture compatible hors plan attend votre décision |
| « Tests ciblés seulement » peut s’étendre sans fin | Les contrôles automatiques ont une limite ; une suite complète exige une autorisation préalable |
| Le même échec déclenche une correction semblable | La troisième répétition exacte s’arrête et demande une autre voie ou un accord |
| Après redémarrage, le progrès est reconstruit depuis le chat | La même tâche, ses limites et les contrôles restants continuent |
| Un résultat vert survit à des changements ultérieurs | Les résultats devenus obsolètes sont écartés avant livraison |

## Les différences essentielles

### La tâche ne grandit pas en silence

Chaque travail garde les fichiers attendus et les contrôles nécessaires. Les outils pris en charge
s’arrêtent avant une écriture hors plan ; vous pouvez l’autoriser une fois, modifier le plan ou refuser.
Avant les tests et la fin, les chemins réellement modifiés sont comparés à nouveau.

### Réessayer doit apporter une information

Dev Flow compare les trois dernières tentatives et ne s’arrête que pour le même échec, résultat ou
motif chemins-échec répété exactement. Si la demande, le plan ou l’implémentation change, les anciens
tests et confirmations ne sont plus valables.

### Reprendre sans deviner ni rejouer à l’aveugle

La demande, le plan, l’avancement, les contrôles et les motifs d’arrêt sont conservés localement. Une
nouvelle session reprend la même tâche. Si une opération reste incertaine, l’état sauvegardé et le
repository actuel sont lus avant de décider d’un nouvel essai.

### Le développeur décide de la fin

Réussir les tests ne suffit pas. Avant livraison, le développeur examine les changements, la complexité
inutile et les risques de maintenance, puis confirme qu’il peut expliquer et maintenir le résultat.

### Voir toute la tâche en local

Le code source actuel contient un Control Center local pour les tâches Codex et DeepSeek, l’avancement,
les chemins prévus et réels, l’historique des tests, les pauses et les décisions suivantes. Ce n’est pas un service cloud.

## Démarrage rapide

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d’authentification et exécutez au plus 4 contrôles ciblés.
/dev-flow Ajoutez une limitation de fréquence aux échecs de connexion. Modifiez uniquement les fichiers d’authentification et exécutez au plus 4 contrôles ciblés.
```

## Quand l’utiliser

Dev Flow convient aux vrais travaux de repository sur plusieurs sessions, avec limites de fichiers ou
de tests, retours possibles ou remise claire. Pour une question, une explication, un état ou une petite
modification mécanique, l’Agent seul est souvent plus simple.

## Périmètre réellement disponible

### npm `@latest` stable

| Produit | Environnement vérifié |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Les enregistrements stables couvrent installation, disponibilité, suppression, désinstallation et
repository cible inchangé. La Journey stable DeepSeek couvre aussi activation, redémarrage, fin et réouverture.

### Source actuelle et enregistrements publics

- La source contient WebUI local, décisions de périmètre, frein automatique et `darwin-arm64`/`win32-x64`.
- Windows reste une capacité source : des enregistrements Windows 11 existent, sans Journey stable.
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) documente une Journey Codex réelle avec redémarrage, refactorisation, nouveaux tests, revue, livraison et fin.

### Pas encore démontré ou stable

- La baisse du coût des tests, des défauts ou de la maintenance n’est pas démontrée ; l’adoption longue reste limitée.
- Linux, Windows Server, Windows 32-bit/ARM64, Intel Mac, Rosetta et remote MCP n’ont pas de support stable.
- Vue d’équipe, synchronisation cloud, export de Task et transfert explicite entre Hosts restent futurs.

## Limites et documentation

- Core observe Git en lecture seule et n’exécute aucun commit, push, merge, rebase, tag ou publish.
- Le contrôle préalable ne couvre que les outils structurés indiqués ; ce n’est pas un sandbox shell ou fichier.
- WebUI est local, loopback et mono-utilisateur.
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## Licence

[Apache License 2.0](LICENSE)
