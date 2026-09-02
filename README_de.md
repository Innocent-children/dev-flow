<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Setze lange KI-Coding-Aufgaben aus dauerhaftem Zustand fort und halte Umfang, Verifizierungsbudget und Lieferbedingungen explizit.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> Diese Seite ist eine stabile Dokumentations-Momentaufnahme. Aktuelle und laufend synchronisierte
> Informationen stehen in [English](README.md) oder [简体中文](README_zh-CN.md).

Dev Flow ist eine lokale Prozesssteuerungs- und Wiederherstellungsschicht für lange KI-Coding-Aufgaben.
Es speichert nicht nur den Fortschritt außerhalb des Chats, sondern begrenzt auch Task-Umfang und
Verifizierung und macht alte, nicht mehr zur aktuellen Implementierung passende Ergebnisse ungültig.
Nach Kontextkomprimierung, Repository-Abweichung oder einem unklaren Operationsergebnis erhält Codex
oder DeepSeek aus demselben Task den nächsten Schritt, eine Recovery-Entscheidung oder einen klaren
Blocker.

## Das wichtigste Problem

Nach einer Unterbrechung rekonstruiert eine neue Sitzung den Fortschritt oft aus einem unvollständigen
Chat und dem aktuellen Repository. Dadurch können Änderungen wiederholt, verbleibende Prüfungen
übersprungen oder alte Testergebnisse weiterverwendet werden. Dev Flow liest zuerst den lokalen Task
und setzt bei der gespeicherten Phase und dem nächsten Schritt fort.

## In 30 Sekunden

| Agent direkt verwenden | Was Dev Flow ergänzt |
| --- | --- |
| Nach einer Unterbrechung wird der Fortschritt neu erraten | Denselben lokalen Task fortsetzen |
| Eine kleine Aufgabe erweitert schrittweise ihren Umfang | Ursprüngliches Ziel und klare Grenzen speichern |
| Zielgerichtete Tests werden immer weiter ausgeweitet | verification budget speichern |
| Eine verlorene Antwort wird sofort erneut versucht | Zuerst Task- und Recovery-Status lesen |
| Testergebnisse vermischen sich mit späteren Codeänderungen | Aktuelle Phase und zugehörige Einträge speichern |

## Wann es passt

Dev Flow eignet sich für echte Repository-Arbeit über mehrere Sitzungen, Tage oder Host-Neustarts,
besonders bei klaren Grenzen, gezielter Verifizierung, Überarbeitungspfaden oder einer
Verständnisprüfung vor der Auslieferung.

Für einmalige Fragen, Codeerklärungen, Statusabfragen oder kleine mechanische Änderungen ohne
dauerhaften Fortschritt sind Codex oder DeepSeek allein meist einfacher. Dev Flow ist weder ein
allgemeiner Orchestrator noch eine Remote-Ausführungsplattform oder Security-Sandbox.

## Verhältnis zu anderen Werkzeugen

| Werkzeug | Aufgabe |
| --- | --- |
| Codex / DeepSeek | Repositories lesen, Code ändern und Befehle ausführen |
| OpenSpec / Spec Kit | Anforderungen, Design und Aufgaben strukturieren |
| Dev Flow | Task-Phase, Umfang, Verifizierungsbudget, Recovery und nächsten gültigen Schritt speichern |

Derzeit gibt es keinen OpenSpec / Spec Kit artifact importer. Eine schlankere Integration bleibt
eine zukünftige Richtung.

## Installation und Start

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Expliziter Codex-Einstieg:

```text
$dev-flow-codex:dev-flow Behebe das Limit fehlgeschlagener Anmeldungen und führe nur gezielte Tests aus.
```

Expliziter DeepSeek-Harness-Einstieg:

```text
/dev-flow Behebe das Limit fehlgeschlagener Anmeldungen und führe nur gezielte Tests aus.
```

## Aktueller stabiler Support und Grenzen

| Produkt | Verifizierte Umgebung |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

- Core beobachtet Git nur lesend und führt weder commit, push, merge, rebase, tag noch publish aus.
- Dateiänderungen und Befehle bleiben bei vom Benutzer autorisiertem Codex oder DeepSeek.
- Core fängt nicht jede Host-Dateioperation ab und ist keine Shell- oder Dateisystem-Sandbox.
- WebUI ist eine lokale loopback Ansicht und Diagnoseoberfläche für einen Benutzer.
- Das Projekt ist noch jung und extern wenig verbreitet; der stabile Umfang steht in der Support Matrix.

## Aktuelle Dokumentation

- [English README](README.md)
- [Product Definition](docs/PRODUCT_en.md)
- [Unterbrechungs- und Fortsetzungs-Demo](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) und [Threat Model](docs/THREAT-MODEL_en.md)

## Lizenz

[Apache License 2.0](LICENSE)
