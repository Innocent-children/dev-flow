<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icono de Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Mantén las tareas largas de programación con IA dentro de los límites de cambios y pruebas que definiste.</strong></p>

<p align="center">Límites locales, progreso duradero y recuperación segura para Codex y DeepSeek.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="Plataforma estable: macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#inicio-rápido">Inicio rápido</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#documentación">Documentación</a>
</p>

## Mantén la tarea que aprobaste

Las tareas largas de programación rara vez fallan de golpe. Se desvían poco a poco: un archivo fuera
del plan se convierte en tres, una comprobación dirigida pasa a ser una ejecución de pruebas sin límite,
el mismo fallo provoca otra corrección parecida o una sesión reiniciada reconstruye el avance desde un
historial de chat incompleto.

Dev Flow guarda en una Task local la petición acordada, las rutas previstas, el presupuesto de
verificación, la etapa actual y los resultados. Codex o DeepSeek sigue leyendo y modificando código y
ejecutando comandos; Dev Flow convierte los cambios de alcance, las repeticiones, la recuperación y la
entrega en decisiones explícitas.

## Qué mantiene bajo control

| Aspecto | Qué hace Dev Flow |
| --- | --- |
| **Alcance de cambios** | Registra las rutas previstas, pausa las escrituras compatibles fuera del plan y vuelve a comprobar las rutas modificadas acumuladas antes de probar y finalizar. |
| **Esfuerzo de verificación** | Conserva un presupuesto de comandos, exige permiso previo para la suite completa y se detiene en la tercera repetición exacta del mismo fallo o resultado sin cambios. |
| **Progreso duradero** | Guarda la Task fuera del chat para que otra sesión retome la misma etapa, límites, registros y bloqueos. |
| **Resultados vigentes** | Invalida pruebas y confirmaciones de comprensión cuando cambian la petición, el plan, la implementación o el repository. |
| **Aprobación del desarrollador** | Antes de entregar, exige revisar los cambios reales, la complejidad innecesaria y los riesgos de mantenimiento. |

## Inicio rápido

> El npm `@latest` estable está verificado actualmente en macOS arm64. Los Host Adapter requieren
> Node.js `>=24`. Consulta la [Support Matrix](docs/SUPPORT-MATRIX_en.md) antes de instalarlo en otro entorno.

### 1. Instala y conecta un Host

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

La configuración interactiva permite instalar Dev Flow para Codex, DeepSeek o ambos. Más adelante,
el mismo punto de entrada ofrece estado, diagnóstico, actualización, reparación y eliminación.

### 2. Inicia una Task con límites

En **Codex**, envía este mensaje de usuario:

```text
$dev-flow-codex:dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

En **DeepSeek Harness**, envía:

```text
/dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

Son selectores de conversación, no comandos de shell. Describe con la mayor precisión posible el
objetivo, las condiciones de aceptación, el límite de archivos y el tope de pruebas.

### 3. Retoma o inspecciona

Después de un reinicio, vuelve al repository que participa en la Task y utiliza el mismo selector del
Host. Dev Flow lee la Task guardada y retoma su etapa actual sin reconstruir el avance desde la conversación.

```bash
# Estado de los Adapter en modo de solo lectura
dev-flow status --host all

# Abrir el Control Center local
dev-flow webui start
```

Control Center muestra la etapa actual, las rutas previstas y modificadas, el historial de comprobaciones,
los bloqueos, las indicaciones de recuperación y la siguiente decisión. Lee los mismos datos locales de
Task que las dos integraciones de Host.

Para configuración no interactiva, comandos nativos del Host, perfiles personalizados de DeepSeek,
actualizaciones y eliminación, consulta la [Command Reference](docs/COMMANDS_en.md).

## Cómo se comporta durante una Task

1. **Define el límite.** La Task guarda la petición, los repositories participantes, las rutas previstas, los trabajos y el presupuesto de verificación.
2. **Trabaja mediante el Host.** Codex o DeepSeek modifica el código; las herramientas de archivos estructuradas compatibles preguntan antes de escribir fuera del plan.
3. **Comprueba los cambios reales.** Antes de probar y finalizar, Core concilia todas las rutas modificadas por la Task, incluidas las que no pasaron por una comprobación previa.
4. **Detén los bucles improductivos.** La tercera repetición exacta pausa la Task y exige otro camino o permiso explícito para continuar.
5. **Entrega resultados actuales.** Los cambios posteriores invalidan comprobaciones antiguas; las pruebas y la comprensión del desarrollador deben corresponder a la implementación entregada.

Si una operación termina sin una respuesta clara, la integración lee la Action guardada y el repository
actual antes de decidir si es seguro reintentar.

## Cuándo usarlo

| Usa Dev Flow cuando… | Usa el Host directamente cuando… |
| --- | --- |
| El trabajo puede durar varias sesiones, reinicios o días | Necesitas una respuesta puntual o una explicación de código |
| Los archivos modificados y las pruebas necesitan límites explícitos | El cambio es pequeño, mecánico y no requiere guardar el avance |
| El retrabajo no debe reutilizar resultados obsoletos | Solo quieres consultar el estado o hablar del diseño |
| La entrega necesita una revisión clara del desarrollador | No necesitas una Task duradera ni estado de recuperación |

## Compatibilidad

| Producto npm `@latest` estable | Entorno verificado |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

El código fuente actual también contiene la WebUI local y el runtime exacto `win32-x64`, pero Windows
aún no tiene una Host Journey estable de `@latest`. La [Support Matrix](docs/SUPPORT-MATRIX_en.md) define
las plataformas estables; [Project Status](docs/PROJECT-STATUS_en.md) separa versiones estables,
capacidades presentes solo en el código, Journeys públicas y carencias actuales.

## Límites

- Dev Flow es una capa de control, no un Agent de programación. Codex o DeepSeek, con autorización del usuario, modifica archivos y ejecuta comandos.
- Go Core observa Git en modo de solo lectura. No ejecuta commit, push, merge, rebase, tag ni publish.
- Las comprobaciones previas cubren las herramientas estructuradas del Host indicadas. Bash y las herramientas externas pueden escribir primero, por lo que no es un sandbox de shell o del sistema de archivos.
- Control Center escucha solo en loopback local para un usuario; no ofrece acceso remoto, sincronización cloud ni permisos de equipo.

## Documentación

- **Para empezar:** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Sistema:** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **Seguridad y contribuciones:** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## Licencia

[Apache License 2.0](LICENSE)
