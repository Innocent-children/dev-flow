<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow Symbol" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Halte lange KI-Coding-Aufgaben innerhalb der festgelegten Änderungs- und Testgrenzen.</strong></p>

<p align="center">Lokale Leitplanken, dauerhafter Fortschritt und sichere Wiederaufnahme für Codex und DeepSeek.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="Stabile Plattform: macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#schnellstart">Schnellstart</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#dokumentation">Dokumentation</a>
</p>

## Halte die freigegebene Aufgabe auf Kurs

Lange Coding-Aufgaben scheitern selten auf einmal. Sie driften: Aus einer ungeplanten Datei werden drei,
eine gezielte Prüfung wird zu einem Testlauf ohne Ende, derselbe Fehler führt zu einer weiteren ähnlichen
Korrektur oder eine neu gestartete Sitzung rekonstruiert den Fortschritt aus einem unvollständigen Chatverlauf.

Dev Flow speichert die vereinbarte Anfrage, erwartete Pfade, das Prüfbudget, die aktuelle Phase und die
Ergebnisse in einer lokalen Task. Codex oder DeepSeek liest und ändert weiterhin den Code und führt Befehle
aus; Dev Flow macht Umfangsänderungen, Wiederholungen, Wiederaufnahme und Auslieferung zu ausdrücklichen
Entscheidungen.

## Was unter Kontrolle bleibt

| Thema | Was Dev Flow tut |
| --- | --- |
| **Änderungsumfang** | Hält erwartete Pfade fest, pausiert unterstützte Schreibvorgänge außerhalb des Plans und prüft die gesammelten Änderungspfade vor Tests und Abschluss erneut. |
| **Prüfaufwand** | Bewahrt ein Befehlsbudget, verlangt vorherige Erlaubnis für die vollständige Suite und stoppt bei der dritten exakten Wiederholung desselben Fehlers oder unveränderten Ergebnisses. |
| **Dauerhafter Fortschritt** | Speichert die Task außerhalb des Chats, damit eine neue Sitzung dieselbe Phase, Grenzen, Aufzeichnungen und Blocker fortsetzt. |
| **Aktuelle Ergebnisse** | Macht Tests und Verständnisbestätigungen ungültig, wenn sich Anfrage, Plan, Implementierung oder Repository ändern. |
| **Freigabe durch Entwickler** | Verlangt vor der Auslieferung eine Prüfung der tatsächlichen Änderungen, unnötigen Komplexität und Wartungsrisiken. |

## Schnellstart

> Das stabile npm `@latest` ist derzeit auf macOS arm64 verifiziert. Die Host Adapter benötigen
> Node.js `>=24`. Prüfe vor der Installation in einer anderen Umgebung die
> [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Installieren und einen Host verbinden

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Im interaktiven Setup kannst du Dev Flow für Codex, DeepSeek oder beide installieren. Derselbe Einstieg
bietet später Status, Diagnose, Upgrade, Reparatur und Entfernung.

### 2. Eine begrenzte Task starten

Sende in **Codex** diese Benutzernachricht:

```text
$dev-flow-codex:dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Sende in **DeepSeek Harness**:

```text
/dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Das sind Selektoren für die Unterhaltung, keine Shell-Befehle. Beschreibe Ziel, Abnahmekriterien,
Dateigrenze und Testlimit so konkret wie möglich.

### 3. Fortsetzen oder ansehen

Kehre nach einem Neustart zum beteiligten Repository zurück und verwende denselben Host-Selektor erneut.
Dev Flow liest die gespeicherte Task und setzt die aktuelle Phase fort, statt den Fortschritt aus dem
Gespräch zu rekonstruieren.

```bash
# Adapter-Status nur lesend prüfen
dev-flow status --host all

# Lokales Control Center öffnen
dev-flow webui start
```

Control Center zeigt die aktuelle Phase, geplante und geänderte Pfade, den Prüfverlauf, Blocker,
Hinweise zur Wiederaufnahme und die nächste Entscheidung. Es liest dieselben lokalen Task-Daten wie
beide Host-Integrationen.

Nicht interaktives Setup, native Host-Befehle, eigene DeepSeek-Profile, Upgrades und Entfernung sind in
der [Command Reference](docs/COMMANDS_en.md) beschrieben.

## Verhalten während einer Task

1. **Grenzen planen.** Die Task speichert Anfrage, beteiligte Repositories, erwartete Pfade, Arbeitspakete und Prüfbudget.
2. **Über den Host arbeiten.** Codex oder DeepSeek ändert den Code; unterstützte strukturierte Dateiwerkzeuge fragen vor Schreibvorgängen außerhalb des Plans.
3. **Tatsächliche Änderungen prüfen.** Vor Tests und Abschluss gleicht Core alle Änderungspfade der Task ab, auch solche ohne Vorabprüfung.
4. **Unproduktive Schleifen stoppen.** Die dritte exakte Wiederholung pausiert die Task und verlangt einen anderen Weg oder eine ausdrückliche Erlaubnis zum Fortsetzen.
5. **Aktuelle Ergebnisse ausliefern.** Spätere Codeänderungen machen alte Prüfungen ungültig. Tests und Verständnis des Entwicklers müssen zur ausgelieferten Implementierung passen.

Endet eine Operation ohne eindeutige Antwort, liest die Integration die gespeicherte Action und das
aktuelle Repository, bevor sie über einen sicheren Wiederholungsversuch entscheidet.

## Wann es passt

| Dev Flow verwenden, wenn … | Den Host direkt verwenden, wenn … |
| --- | --- |
| Die Arbeit mehrere Sitzungen, Neustarts oder Tage dauern kann | Du eine einmalige Antwort oder Codeerklärung brauchst |
| Geänderte Dateien und Testaufwand klare Grenzen brauchen | Die Änderung klein und mechanisch ist und keinen gespeicherten Fortschritt benötigt |
| Nacharbeit keine veralteten Ergebnisse wiederverwenden darf | Du nur den Status prüfen oder ein Design besprechen möchtest |
| Die Auslieferung eine klare Entwicklerprüfung braucht | Du keine dauerhafte Task oder Wiederaufnahmedaten brauchst |

## Unterstützung

| Stabiles npm-`@latest`-Produkt | Verifizierte Umgebung |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Der aktuelle Quellcode enthält außerdem die lokale WebUI und die exakte `win32-x64`-Runtime, aber für
Windows gibt es noch keine stabile `@latest` Host Journey. Die
[Support Matrix](docs/SUPPORT-MATRIX_en.md) bestimmt die stabil unterstützten Plattformen;
[Project Status](docs/PROJECT-STATUS_en.md) trennt stabile Releases, reine Quellcodefunktionen,
öffentliche Journeys und aktuelle Lücken.

## Grenzen

- Dev Flow ist eine Steuerungsschicht, kein Coding-Agent. Vom Benutzer autorisiertes Codex oder DeepSeek ändert Dateien und führt Befehle aus.
- Go Core beobachtet Git nur lesend. Es führt weder commit, push, merge, rebase, tag noch publish aus.
- Die Vorabprüfung deckt nur die aufgeführten strukturierten Host-Werkzeuge ab. Bash und externe Werkzeuge können zuerst schreiben; Dev Flow ist daher keine Shell- oder Dateisystem-Sandbox.
- Control Center lauscht nur am lokalen Loopback für einen Benutzer und bietet keinen Fernzugriff, keine Cloud-Synchronisierung und keine Teamrechte.

## Dokumentation

- **Einstieg:** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **Verwendung:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **System:** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **Sicherheit und Beiträge:** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## Lizenz

[Apache License 2.0](LICENSE)
