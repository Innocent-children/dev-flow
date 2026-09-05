<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow Symbol" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Bewahre Umfang, Prüfgrenzen und aktuellen Fortschritt langer KI-Coding-Aufgaben über Sitzungen hinweg.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Lange Aufgaben auf Kurs halten

Je länger eine Coding-Aufgabe dauert, desto leichter verändert sie sich schleichend: Weitere Dateien
kommen hinzu, eine gezielte Prüfung wird zu einem Testlauf ohne Ende, derselbe Fehler löst einen ähnlichen
Versuch aus oder eine neu gestartete Sitzung muss den Fortschritt aus dem Chat rekonstruieren.

Dev Flow speichert die vereinbarte Anfrage, erwartete Pfade, den nach der Analyse erstellten Prüfplan, die aktuelle Phase und Ergebnisse
in einer lokalen Aufgabe. Codex oder DeepSeek ändert weiterhin den Code.

Jede neue Anfrage wird zuerst schreibgeschützt bewertet. Wenn du Dev Flow auswählst, bestätigst du Remote,
Basis-Branch und einen neuen Task-Branch; der Host erstellt von dieser entfernten Basis einen sauberen,
eigenen Worktree, bevor Core die Task anlegt. Änderungen aus dem Quell-Checkout werden nicht kopiert.

Die Repository-Suche und die Nutzung des Code-Index folgen den aktuellen Benutzeranweisungen und der
anwendbaren `AGENTS.md`. Verlangen diese einen Projektindex, untersucht der Host die möglichen
Repositories vor der Bestätigung schreibgeschützt und legt den bestätigten Umfang in der Task fest.
Diese Anweisungen haben Vorrang vor der Code-Index-Einstellung des Plugins.

- **Der Umfang bleibt klar.** Erwartete Pfade werden festgehalten, unterstützte strukturierte Werkzeuge
  fragen vor Schreibvorgängen außerhalb des Plans und tatsächliche Änderungen werden vor Tests und
  Auslieferung erneut geprüft.
- **Jeder Worktree hat genau einen Änderungsbesitzer.** Core ermittelt die tatsächlichen Änderungen der Task mit
  Git. Normale lineare Commits können fortgesetzt werden; Branch-Rewrites oder ein ersetzter Worktree stoppen die Task.
- **Der Prüfaufwand passt zur Aufgabe.** TASKS speichert Prüfungen, Gründe, Anfangsaufwand und Erwartungen
  für Vollsuite/Testcode. Nur konkrete neue Auswirkungen, Risiken, Fehler oder Lücken erhöhen das Budget.
- **Die Prüfung endet bei der aktuellen Änderung.** Danach werden nur Diff, kausale Auswirkungen und
  Abnahmebedarf geprüft; ein Fix löst nur verwandte Nachprüfungen aus, ein explizites Code Review bleibt schreibgeschützt.
- **Die Arbeit übersteht Neustarts.** Eine neue Sitzung stellt dieselbe Aufgabe, übrige Prüfungen und die
  aktuelle Entscheidung wieder her, statt sie aus dem Gespräch zu rekonstruieren.
- **Nur aktuelle Ergebnisse gelten weiter.** Änderungen an Anfrage, Plan, Implementierung oder Repository
  machen alte Prüfungen ungültig; vor der Auslieferung prüft der Entwickler das tatsächliche Ergebnis.

## Schnellstart

> Die unter `@latest` auf npm veröffentlichte stabile Version ist derzeit auf macOS arm64 verifiziert. Installiere zuerst Node.js `>=24`
> und eine unterstützte Version von Codex oder DeepSeek Harness. Genaue Versionen und weitere Umgebungen
> stehen in der [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Dev Flow installieren

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Wähle im interaktiven Setup Codex, DeepSeek oder beide. Führe vor der ersten Aufgabe außerdem den letzten
vom Installer angezeigten Schritt aus:

- **Codex:** Öffne `/hooks`, prüfe den mitgelieferten Dev-Flow-Hook und vertraue ihm. Die unterstützte
  Schreibprüfung für `apply_patch` ist erst danach aktiv.
- **DeepSeek Harness:** Starte das ausgewählte DSH-Profil nach der Installation neu.

### 2. Eine Aufgabe starten

Sende in **Codex** diese Benutzernachricht:

```text
$dev-flow-codex:dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Oder sende in **DeepSeek Harness**:

```text
/dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Das sind Selektoren für die Unterhaltung, keine Shell-Befehle. Nenne ein konkretes Ziel, Abnahmekriterien,
die Dateigrenze und das Testlimit. Die erste Antwort bewertet die Auswirkungen und fragt nach direkter
Arbeit oder Dev Flow; auch ein expliziter Selektor überspringt diese Entscheidung nicht. Bei Dev Flow
bestätigst du Remote, Basis und Ziel-Branch. Codex öffnet einen verwalteten Worktree, wenn der Host das
unterstützt; DeepSeek zeigt den Neustart aus dem neuen Worktree, weil der Workspace Root der Sitzung feststeht.

### 3. Fortsetzen und Fortschritt prüfen

Bitte nach einem Sitzungsneustart ausdrücklich darum, die Task in ihrem ursprünglichen Worktree
fortzusetzen. Das System prüft diesen Worktree und setzt die Arbeit anhand des gespeicherten
Aufgabenstands fort. Die Anfrage wird nicht erneut bewertet, und du musst Dev Flow nicht erneut
wählen. Fehlt der ursprüngliche Worktree oder wurde er ersetzt, pausiert die Task, bis du ihn
wiederherstellst oder die Task ausdrücklich aufgibst (abandon). Das System wechselt nicht zu einem anderen Worktree.

```bash
# Installierte Integrationen prüfen
dev-flow status --host all

# Lokale Aufgabenansicht öffnen
dev-flow webui start
```

Nicht interaktive Installation, eigene DSH-Profile, Upgrades, Reparatur und Entfernung sind in der
[Command Reference](docs/COMMANDS_en.md) beschrieben.

## Wann es passt

Dev Flow eignet sich für Repository-Arbeit über mehrere Sitzungen, mit einer echten Dateigrenze,
begrenztem Testaufwand oder möglicher Nacharbeit, die keine veralteten Ergebnisse wiederverwenden darf.

Für einmalige Fragen, Codeerklärungen, Statusabfragen und kleine mechanische Änderungen ohne gespeicherten
Fortschritt ist Codex oder DeepSeek allein meist einfacher.

## Dokumentation

- **Verwendung:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projekt:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Lizenz

[Apache License 2.0](LICENSE)
