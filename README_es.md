<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icono de Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Conserva el alcance, los límites de verificación y el progreso de las tareas largas de programación con IA entre sesiones.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Qué puedes hacer con Dev Flow

Dev Flow te ayuda a gestionar tareas largas de programación con IA en Codex o DeepSeek. Guarda
localmente los requisitos acordados, el alcance de archivos, el plan de verificación, el progreso y
los resultados para que puedas continuar después de cerrar una sesión.

- **Aclarar el alcance:** registra los archivos previstos y compara los cambios reales con el plan.
- **Planificar las pruebas:** elige comprobaciones pertinentes y limita el esfuerzo de verificación.
- **Retomar el trabajo:** continúa la misma tarea y el trabajo pendiente desde su worktree original.
- **Consultar resultados:** revisa el progreso, las comprobaciones y los problemas que requieren atención.

Resulta útil para trabajo de repositorio que abarca varias sesiones o necesita límites claros de
archivos y pruebas. Para preguntas puntuales, explicaciones de código y pequeños cambios que no
necesitan guardar el progreso, suele ser más sencillo usar Codex o DeepSeek directamente.

## Inicio rápido

> La versión estable de npm `@latest` está verificada actualmente en macOS arm64. Usa Node.js `>=24`
> e instala primero una versión compatible de Codex o DeepSeek Harness. Consulta las versiones de los
> entornos anfitriones y otros sistemas en la [matriz de soporte](docs/SUPPORT-MATRIX_en.md).

### 1. Instala Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Elige Codex, DeepSeek o ambos en la configuración interactiva y sigue las indicaciones del instalador:

- **Codex:** abre `/hooks`, revisa el hook de Dev Flow y márcalo como confiable para activar las comprobaciones previas a escritura compatibles.
- **DeepSeek Harness:** reinicia el Profile de DSH seleccionado después de la instalación.

### 2. Inicia una tarea

Envía este mensaje en **Codex**:

```text
$dev-flow-codex:dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

O en **DeepSeek Harness**:

```text
/dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

Envía estos mensajes en la conversación, no en una terminal. Describe el objetivo, los criterios de
aceptación, el alcance de archivos y el límite de pruebas.

La primera respuesta evalúa la solicitud y pregunta si quieres trabajar directamente o usar Dev Flow.
Si eliges Dev Flow, confirma la fuente local o remota, la rama inicial, la nueva rama de tarea y si
quieres incorporar los cambios locales existentes.

El trabajo continúa en un worktree de Git dedicado, un directorio independiente para la tarea.
Codex lo abre cuando el entorno anfitrión lo permite; DeepSeek proporciona un comando para reiniciar
desde el nuevo directorio.

### 3. Retoma y consulta el progreso

Después de reiniciar la sesión, vuelve al worktree original y solicita continuar la tarea. Dev Flow
retoma el progreso guardado. Si ese worktree desapareció o fue reemplazado, la tarea se pausa hasta
que lo restaures o abandones explícitamente la tarea.

En DeepSeek Harness, incluye `/dev-flow` en el mensaje que solicita retomar la tarea.

```bash
# Consultar las integraciones instaladas
dev-flow status --host all

# Abrir la vista local de tareas
dev-flow webui start
```

Para instalación no interactiva, Profiles de DSH personalizados, actualizaciones, reparación y
eliminación, consulta la [referencia de comandos](docs/COMMANDS_en.md).

## Mascota de escritorio

La mascota de escritorio muestra el estado guardado de una tarea seleccionada y abre su WebUI.
Puedes elegir tareas, personalizar su apariencia, controlar animaciones, cambiar su tamaño e
iniciarla o detenerla por separado. Antes de usarla, completa la instalación y la configuración de
Codex o DeepSeek indicadas arriba.

```bash
dev-flow pet start
dev-flow pet stop
```

Las aplicaciones de escritorio están destinadas a macOS arm64 y Windows 10/11 x64. Consulta la
[guía de la mascota](docs/DESKTOP-PETS_en.md) para instalarla y manejarla, y la
[matriz de soporte](docs/SUPPORT-MATRIX_en.md) para conocer la disponibilidad verificada.

## Límites de uso

Un worktree dedicado separa los cambios de código. Los procesos, el acceso a la red, las credenciales
y los servicios externos siguen compartidos con tu entorno.

Completar una tarea no crea commits, envía cambios ni elimina su worktree automáticamente. Esas
operaciones requieren tu autorización por separado.

## Documentación

- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Comandos](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Proyecto:** [Definición del producto](docs/PRODUCT_en.md) · [Matriz de soporte](docs/SUPPORT-MATRIX_en.md) · [Seguridad](SECURITY.md)
- **Desarrollo y contribuciones:** [Índice de documentación](MANIFEST_en.md) · [Guía de contribución](CONTRIBUTING.md)

## Licencia

[Apache License 2.0](LICENSE)
