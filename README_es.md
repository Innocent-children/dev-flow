<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Reanuda tareas largas de programación con IA desde un estado persistente, no desde el historial del chat.</strong></p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> Esta página es una instantánea estable de la documentación. Para la información actualizada y
> sincronizada de forma continua, consulta [简体中文](README.md) o [English](README_en.md).

Dev Flow es una capa local de control y recuperación para tareas largas de programación con IA.
Guarda fuera del chat el objetivo, el alcance, la etapa actual, el presupuesto de verificación, las
verificaciones realizadas, los bloqueos y el estado de Recovery. Así, Codex o DeepSeek pueden
continuar el mismo Task tras una compactación de contexto, un reinicio del Host o un resultado incierto.

## El problema principal

Después de una interrupción, una nueva sesión suele reconstruir el progreso a partir de un chat
incompleto y del repository actual. Puede repetir cambios, omitir verificaciones pendientes o tratar
resultados antiguos como actuales. Dev Flow lee primero el Task local y continúa desde la etapa y el
siguiente paso guardados.

## En 30 segundos

| Al usar un Agent directamente | Lo que añade Dev Flow |
| --- | --- |
| Tras una interrupción se vuelve a adivinar el progreso | Reanuda el mismo Task local |
| Una tarea pequeña amplía gradualmente su alcance | Guarda el objetivo inicial y límites explícitos |
| Las pruebas dirigidas siguen creciendo | Guarda el verification budget |
| Se reintenta de inmediato al perder una respuesta | Lee primero el Task y el estado de Recovery |
| Los resultados de pruebas se mezclan con cambios posteriores | Guarda la etapa actual y sus registros |

## Cuándo usarlo

Dev Flow encaja en trabajo real de repository que continúa entre sesiones, días o reinicios del Host,
especialmente cuando se necesita un alcance claro, verificación dirigida, rutas de retrabajo o una
revisión de comprensión antes de la entrega.

Para preguntas puntuales, explicaciones de código, consultas de estado o cambios mecánicos pequeños
sin progreso persistente, suele ser más sencillo usar Codex o DeepSeek directamente. Dev Flow no es
un orquestador general, una plataforma de ejecución remota ni un sandbox de seguridad.

## Relación con otras herramientas

| Herramienta | Responsabilidad |
| --- | --- |
| Codex / DeepSeek | Leer repositories, modificar código y ejecutar comandos |
| OpenSpec / Spec Kit | Ayudar a organizar requisitos, diseño y tareas |
| Dev Flow | Guardar la etapa, el alcance, el presupuesto de verificación, Recovery y el siguiente paso válido |

Actualmente no existe un artifact importer para OpenSpec / Spec Kit. Una integración más ligera sigue
siendo una dirección futura.

## Instalación e inicio

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Entrada explícita de Codex:

```text
$dev-flow-codex:dev-flow Corrige el límite de intentos fallidos de inicio de sesión y ejecuta solo pruebas dirigidas.
```

Entrada explícita de DeepSeek Harness:

```text
/dev-flow Corrige el límite de intentos fallidos de inicio de sesión y ejecuta solo pruebas dirigidas.
```

## Soporte estable y límites actuales

| Producto | Entorno verificado |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

- Core solo observa Git en modo lectura; no ejecuta commit, push, merge, rebase, tag ni publish.
- Codex o DeepSeek, con autorización del usuario, siguen modificando archivos y ejecutando comandos.
- Core no intercepta cada operación del Host y no es un sandbox de shell o sistema de archivos.
- WebUI es una vista y entrada de diagnóstico local loopback para un solo usuario.
- El proyecto sigue en una fase temprana y la adopción externa es limitada; el alcance estable está en Support Matrix.

## Documentación actual

- [English README](README_en.md)
- [Product Definition](docs/PRODUCT_en.md)
- [Demo de interrupción y reanudación](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) y [Threat Model](docs/THREAT-MODEL_en.md)

## Licencia

[Apache License 2.0](LICENSE)
