import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "zh-CN" | "en";

const en = {
  "app.notFoundEyebrow": "Unknown route", "app.notFoundTitle": "This local page does not exist.",
  "shell.dashboardAria": "Dev Flow dashboard", "shell.subtitle": "Control Center", "shell.navAria": "Primary navigation",
  "shell.overview": "Overview", "shell.tasks": "Tasks", "shell.openTask": "Resume Task", "shell.system": "System",
  "shell.skip": "Skip to main content", "shell.workspace": "Workspace", "shell.runtime": "Local service",
  "shell.language": "Language", "shell.chinese": "中文", "shell.english": "English", "shell.readinessTitle": "Current Core WebUI readiness",
  "dashboard.eyebrow": "Task overview", "dashboard.title": "Overview", "dashboard.lede": "See local Task progress and recent changes.",
  "dashboard.browse": "Browse tasks", "dashboard.stale": "Dashboard is stale.", "dashboard.loading": "Loading overview",
  "dashboard.countsAria": "Task lifecycle counts", "dashboard.viewMatching": "View tasks", "dashboard.recentEyebrow": "Recent activity",
  "dashboard.recentTitle": "Latest revisions", "dashboard.emptyTitle": "No tasks yet", "dashboard.emptyDetail": "Tasks created by a compatible Host appear here.",
  "list.eyebrow": "Task center", "list.title": "Tasks", "list.lede": "Review and filter Tasks created by Codex, DeepSeek, and other compatible tools.",
  "list.filtersAria": "Task filters", "list.search": "Search", "list.searchPlaceholder": "Intent, Task ID, blocker…", "list.host": "Host",
  "list.allHosts": "All hosts", "list.lifecycle": "Lifecycle", "list.allStates": "All states", "list.allNodes": "All stages", "list.repository": "Repository",
  "list.repositoryPlaceholder": "Key or path", "list.node": "Node", "list.updatedFrom": "Updated from", "list.updatedTo": "Updated to",
  "list.apply": "Apply filters", "list.stale": "Results are stale.", "list.loading": "Loading tasks", "list.emptyTitle": "No matching tasks",
  "list.emptyDetail": "Adjust the filters or wait for a compatible Host to create one.", "list.task": "Task", "list.state": "State",
  "list.revision": "Revision", "list.updated": "Updated", "list.previous": "Previous", "list.next": "Next", "list.page": "Page {page}",
  "list.filtersTitle": "Filters", "list.clear": "Clear", "list.resultsTitle": "Task results", "list.resultsCount": "{count} on this page", "list.archived": "Archived",
  "repository.group": "Repository group", "repository.worktree": "Worktree",
  "open.eyebrow": "Create or resume", "open.createTitle": "Open a new Task", "open.resumeTitle": "Resume active work",
  "open.lede": "Choose repositories, describe the goal, or continue an active Task.", "open.modeAria": "Task open mode", "open.create": "Create",
  "open.resume": "Resume", "open.scope": "Repository scope", "open.primaryKey": "Primary key", "open.executionHost": "Execution Host",
  "open.createHint": "Define a new goal and its completion criteria.", "open.resumeHint": "Continue the active Task already bound to a repository.",
  "open.primaryPath": "Primary repository path", "open.additional": "Additional repositories", "open.additionalHint": "one absolute path per line",
  "open.intent": "Task intent", "open.request": "Request", "open.acceptance": "Acceptance criteria", "open.acceptanceHint": "one criterion per line",
  "open.method": "Method profile", "open.budget": "Verification budget", "open.level": "Level", "open.maxCommands": "Maximum automatic commands",
  "open.allowFull": "Allow full suite", "open.allowManual": "Allow manual handoff", "open.submitting": "Submitting…",
  "open.createSubmit": "Create Task", "open.resumeSubmit": "Resume Task", "open.failure": "Task operation failed",
  "open.repoFormat": "Each additional repository must be an absolute path.", "open.resumeRequest": "Resume the active Task.",
  "open.resumeAcceptance": "Resume the matching active Task.",
  "open.advanced": "Advanced settings", "open.advancedHint": "Execution method and verification limits",
  "open.methodPlain": "Work directly in the repository.", "open.methodSpecKit": "Follow the repository's Spec Kit workflow.", "open.methodOpenSpec": "Follow the repository's OpenSpec workflow.",
  "open.budgetMinimal": "Run only the smallest required checks.", "open.budgetTargeted": "Run checks targeted to the current change.", "open.budgetFull": "Allow broad verification when the Task requires it.",
  "open.resumeOnlyLede": "Resume a Task from the exact worktree instance it already owns.", "open.createInHost": "New Tasks start in Codex or DeepSeek.", "open.createInHostDetail": "The Host assesses the request, confirms remote/base/task branch, provisions an isolated worktree, and only then opens Core. This page cannot create a Task in a shared checkout.", "open.worktreePath": "Original Task worktree path", "open.resumeInstanceHint": "A recreated directory or same-named branch is not the original worktree instance.",
  "detail.loading": "Loading Task", "detail.unavailable": "Task unavailable", "detail.allTasks": "All tasks",
  "detail.currentRevision": "Current revision", "detail.stale": "Task view is stale.", "detail.readOnly": "Read-only Task view.",
  "detail.readOnlyGuidance": "Some workflow or history details are incomplete, so editing is paused.", "detail.authority": "Current progress",
  "detail.stage": "Current stage", "detail.updated": "Last updated", "detail.archived": "Archived",
  "detail.commandLimit": "{count} automatic commands", "detail.fullSuiteAllowed": "Full suite allowed", "detail.manualHandoffAllowed": "Manual handoff allowed",
  "detail.method": "Method", "detail.verification": "Verification", "detail.action": "Action", "detail.legalPaths": "Legal paths",
  "detail.none": "None", "detail.scope": "Repository scope", "detail.repositories": "{count} repositories", "detail.definition": "Resolved definition",
  "detail.graph": "Process graph", "detail.graphDisclaimer": "Future paths are structural possibilities; their guards have not been evaluated.",
  "detail.history": "Committed history", "detail.timeline": "Timeline", "detail.facts": "Task facts", "detail.evidence": "Evidence and records",
  "detail.acceptance": "Acceptance", "detail.outcome": "Task outcome", "detail.noneRecorded": "None recorded.",
  "scope.eyebrow": "File scope", "scope.ready": "Changed paths are explained", "scope.blocked": "Changed paths need attention",
  "scope.explained": "Ready for final scope check", "scope.unexplained": "{count} unexplained", "scope.expected": "Planned paths",
  "scope.changed": "Current Task paths", "scope.decisions": "Developer decisions", "scope.coveredTools": "Write-before tools",
  "scope.needsDecision": "These paths are not covered by the current plan or a consumed authorization.",
  "scope.boundary": "The Host checks listed structured tools before writing. Core derives the complete Task surface from the frozen base, commits, index, worktree, and untracked entries; shell, external-process, and specialized-tool writes may only be found then.",
  "workspace.eyebrow": "Task workspace", "workspace.title": "Dedicated worktree", "workspace.provisioning": "Provisioning", "workspace.provisioningLastKnown": "Last known", "workspace.provisioningLastKnownDetail": "This panel shows the latest workspace observation retained by Core; WebUI does not probe Git.", "workspace.provisioningUnavailable": "Unavailable", "workspace.provisioningUnavailableDetail": "Core recorded that the original worktree instance was unavailable when this Task was abandoned.", "workspace.origin": "Origin", "workspace.observation": "Current observation", "workspace.remoteBase": "Remote / base", "workspace.baseCommit": "Frozen base commit", "workspace.taskBranch": "Task branch / current HEAD", "workspace.receipt": "Provisioning receipt", "workspace.history": "History relation", "workspace.content": "Content digest", "workspace.currentSurface": "Current Task surface", "workspace.clean": "No current changed paths", "workspace.changed": "{count} current changed paths", "workspace.historyConflict": "Workspace history requires review before continuing.", "workspace.relocationPending": "Relocation {id} is pending; Core still retains the source claim.", "workspace.cleanupTitle": "Terminal workspace choices", "workspace.cleanupBody": "Core never deletes a worktree or branch. Keep, review, handoff, worktree removal, and branch removal stay separate Host actions with separate confirmation.",
  "timeline.repositoryDelta": "{count} repository paths changed",
  "lifecycle.eyebrow": "Lifecycle", "lifecycle.title": "Task controls", "lifecycle.cancel": "Cancel Task", "lifecycle.restore": "Restore from archive",
  "lifecycle.archive": "Archive Task", "lifecycle.purge": "Permanently purge", "lifecycle.cancelEyebrow": "Terminal transition",
  "lifecycle.cancelTitle": "Cancel this active Task?", "lifecycle.cancelBody": "Core records the reason, moves the Task to CANCELLED and releases repository claims.",
  "lifecycle.reason": "Reason", "lifecycle.continue": "Continue Task", "lifecycle.cancelling": "Cancelling…", "lifecycle.confirmCancel": "Confirm cancellation",
  "lifecycle.prepareRelocation": "Prepare relocation", "lifecycle.preparingRelocation": "Preparing relocation…", "lifecycle.confirmRelocation": "Block the Task and prepare a same-machine Host relocation? The source claim remains until Core verifies the destination.", "lifecycle.abandon": "Abandon unavailable workspace", "lifecycle.abandonTitle": "Abandon this Task?", "lifecycle.abandonBody": "Use this only when the original worktree instance is unavailable. Core records the last known binding and releases claims; it does not delete Git resources.", "lifecycle.abandoning": "Abandoning…", "lifecycle.confirmAbandon": "Abandon Task",
  "lifecycle.failure": "Lifecycle operation failed", "purge.failure": "Purge failed", "purge.eyebrow": "Irreversible operation",
  "purge.title": "Permanently purge this Task?", "purge.body": "This deletes the current Task, committed events, claim rows and archive state. It cannot be undone.",
  "purge.typeID": "Type the exact Task ID", "purge.keep": "Keep Task", "purge.busy": "Purging…", "purge.confirm": "Permanently purge",
  "action.eyebrow": "Next step", "action.conditions": "Conditions", "action.effects": "Allowed effects", "action.evidence": "Required evidence",
  "action.steps": "Method steps", "action.rejected": "This submission did not pass validation.", "action.guard": "Guard {guard} was not satisfied.",
  "action.payload": "Action payload", "action.requirements": "Execution requirements and effects", "action.submitting": "Submitting…", "action.submit": "Submit current Action", "action.failure": "Action submission failed",
  "action.kind.RESOLVE_BLOCKER": "Resolve blocker", "action.kind.COMPLETE_REQUIREMENTS": "Complete requirements", "action.kind.COMPLETE_DESIGN": "Complete design", "action.kind.COMPLETE_TASKS": "Complete task plan", "action.kind.COMPLETE_IMPLEMENTATION": "Complete implementation", "action.kind.COMPLETE_TEST": "Complete testing", "action.kind.COMPLETE_COMPREHENSION_REVIEW": "Complete comprehension review", "action.kind.COMPLETE_REFACTOR": "Complete refactor", "action.kind.COMPLETE_DELIVERY": "Complete delivery",
  "blocker.title": "Task is blocked.", "blocker.body": "Complete only the current blocker-resolution contract. Core chooses the resume node.",
  "graph.legendAria": "Graph legend", "graph.committed": "Committed", "graph.current": "Current", "graph.legal": "Legal now",
  "graph.possible": "Structurally possible", "graph.recovery": "Blocked recovery:", "graph.recoveryBody": "Core resumes at {node} after the blocker contract is satisfied.",
  "graph.aria": "Process graph. Current node {node}. Future paths are structural possibilities and do not prove guards pass.",
  "graph.textList": "Text transition list", "graph.guardNotEvaluated": "Possible; guard not evaluated",
  "graph.zoomOut": "Zoom out", "graph.zoomIn": "Zoom in", "graph.resetZoom": "Reset zoom", "graph.selectedNode": "Selected stage", "graph.currentMarker": "Current",
  "recovery.eyebrow": "Uncertain operation", "recovery.title": "Ask Core before another write",
  "recovery.body": "This page kept the information needed to check the previous operation before retrying.",
  "recovery.safe": "Core reports this Action retry is safe.", "recovery.unsafe": "Do not retry outside this advice.", "recovery.assessing": "Assessing…",
  "recovery.assess": "Assess operation", "recovery.follow": "Follow Core advice", "recovery.failure": "Recovery operation failed",
  "recovery.action.none": "No further action", "recovery.action.correct_current_action": "Correct the current Action", "recovery.action.retry_current_action": "Retry the current Action", "recovery.action.submit_recovery_apply": "Apply recovery", "recovery.action.read_next_action": "Read the next Action", "recovery.action.resolve_blocker": "Resolve the blocker", "recovery.action.stop_for_repository_drift": "Stop for repository drift",
  "schema.provide": "Provide value", "schema.variant": "Variant", "schema.clear": "Clear optional value", "schema.remove": "Remove",
  "schema.add": "Add {name}", "schema.rejected": "Core rejected: {paths}", "schema.option": "Option {index}",
  "system.eyebrow": "Service status", "system.title": "System state", "system.lede": "Check the local service, data folder, and connection status.",
  "system.runtime": "Local service", "system.unavailable": "Unavailable", "system.returnShell": "Run dev-flow webui status in the shell.",
  "system.loading": "Reading local runtime state", "runtime.dataRoot": "Data root", "runtime.url": "Loopback URL", "runtime.notAvailable": "Not available",
  "runtime.readyBody": "The local service is running and ready to view or update Tasks.",
  "runtime.readOnlyBody": "Tasks are available to view, but updates stay disabled until the data folder is writable.",
  "runtime.incompatibleBody": "A local runtime is present but does not match this Core or data root. Stop it from the runtime that started it.",
  "runtime.unavailableBody": "No reusable local WebUI process is responding for this data root.",
  "readiness.ready": "Ready", "readiness.read_only": "Read-only",
  "readiness.incompatible": "Incompatible", "readiness.unavailable": "Unavailable", "state.active": "Active", "state.blocked": "Blocked",
  "state.done": "Done", "state.cancelled": "Cancelled", "api.session": "The local WebUI session is unavailable. Reload this page.",
  "api.requestFailed": "Request failed with status {status}",
  "node.REQUIREMENTS":"Requirements","node.DESIGN":"Design","node.TASKS":"Task plan","node.IMPLEMENT":"Implementation","node.TEST":"Testing","node.COMPREHENSION_REVIEW":"Comprehension review","node.REFACTOR":"Refactor","node.DELIVERY":"Delivery","node.DONE":"Done","node.BLOCKED":"Blocked","node.CANCELLED":"Cancelled",
} as const;

type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const zh: Messages = {
  "app.notFoundEyebrow":"未知路径","app.notFoundTitle":"此本机页面不存在。","shell.dashboardAria":"Dev Flow 概览","shell.subtitle":"控制中心","shell.navAria":"主导航","shell.overview":"概览","shell.tasks":"任务","shell.openTask":"恢复任务","shell.system":"系统","shell.skip":"跳到主要内容","shell.workspace":"工作区","shell.runtime":"本机服务","shell.language":"语言","shell.chinese":"中文","shell.english":"English","shell.readinessTitle":"当前 Core WebUI 就绪状态",
  "dashboard.eyebrow":"任务概览","dashboard.title":"概览","dashboard.lede":"查看本机任务的进度和最近变化。","dashboard.browse":"查看全部任务","dashboard.stale":"概览暂时未能更新。","dashboard.loading":"正在加载概览","dashboard.countsAria":"任务状态统计","dashboard.viewMatching":"查看任务","dashboard.recentEyebrow":"最近更新","dashboard.recentTitle":"最近变化的任务","dashboard.emptyTitle":"还没有任务","dashboard.emptyDetail":"通过 Codex 或 DeepSeek 创建任务后，会显示在这里。",
  "list.eyebrow":"任务中心","list.title":"全部任务","list.lede":"查看和筛选由 Codex、DeepSeek 等工具创建的任务。","list.filtersAria":"筛选任务","list.search":"搜索任务","list.searchPlaceholder":"任务内容、ID 或阻塞原因","list.host":"执行工具","list.allHosts":"全部工具","list.lifecycle":"任务状态","list.allStates":"全部状态","list.allNodes":"全部阶段","list.repository":"所属仓库","list.repositoryPlaceholder":"仓库名称或路径","list.node":"当前阶段","list.updatedFrom":"开始时间","list.updatedTo":"结束时间","list.apply":"筛选","list.stale":"列表暂时未能更新。","list.loading":"正在加载任务","list.emptyTitle":"没有找到任务","list.emptyDetail":"可以调整筛选条件，或先创建一个任务。","list.task":"任务","list.state":"状态","list.revision":"版本","list.updated":"更新时间","list.previous":"上一页","list.next":"下一页","list.page":"第 {page} 页","list.filtersTitle":"筛选条件","list.clear":"清除","list.resultsTitle":"任务列表","list.resultsCount":"本页 {count} 个任务","list.archived":"已归档","repository.group":"逻辑仓库","repository.worktree":"工作树",
  "open.eyebrow":"恢复任务","open.createTitle":"新建任务","open.resumeTitle":"继续已有任务","open.lede":"选择仓库并填写任务目标，也可以继续仓库中已有的任务。","open.modeAria":"选择操作","open.create":"新建任务","open.resume":"继续任务","open.createHint":"填写新的任务目标和完成标准。","open.resumeHint":"继续仓库中已有的进行中任务。","open.scope":"选择仓库","open.primaryKey":"主仓库标识","open.executionHost":"执行工具","open.primaryPath":"主仓库路径","open.additional":"其他仓库","open.additionalHint":"每行填写一个绝对路径","open.intent":"任务内容","open.request":"要完成什么","open.acceptance":"完成标准","open.acceptanceHint":"每行填写一条标准","open.method":"执行方式","open.budget":"验证设置","open.level":"验证范围","open.maxCommands":"自动命令数量上限","open.allowFull":"允许运行完整测试","open.allowManual":"允许交给用户确认","open.submitting":"正在提交…","open.createSubmit":"创建任务","open.resumeSubmit":"继续任务","open.failure":"任务操作失败","open.repoFormat":"其他仓库必须填写绝对路径。","open.resumeRequest":"继续仓库中已有的任务。","open.resumeAcceptance":"继续匹配的进行中任务。","open.advanced":"高级设置","open.advancedHint":"执行方式和验证范围","open.methodPlain":"直接在仓库中完成任务。","open.methodSpecKit":"按照仓库的 Spec Kit 流程执行。","open.methodOpenSpec":"按照仓库的 OpenSpec 流程执行。","open.budgetMinimal":"只运行完成任务必需的最少检查。","open.budgetTargeted":"运行与当前改动直接相关的检查。","open.budgetFull":"任务需要时可以进行更全面的验证。","open.resumeOnlyLede":"从任务原来占用的同一个工作树实例继续。","open.createInHost":"新任务请在 Codex 或 DeepSeek 中启动。","open.createInHostDetail":"Host 会先评估请求、确认 remote/base/task branch，再创建隔离工作树并打开 Core。本页面不能在共享 checkout 中创建 Task。","open.worktreePath":"原 Task 工作树路径","open.resumeInstanceHint":"重新创建的同路径目录或同名 branch 不是原工作树实例。",
  "detail.loading":"正在加载任务","detail.unavailable":"任务暂时不可用","detail.allTasks":"全部任务","detail.currentRevision":"当前版本","detail.stale":"任务内容已发生变化。","detail.readOnly":"当前只能查看。","detail.readOnlyGuidance":"部分流程或历史信息不完整，为避免误操作，写入功能已暂停。","detail.authority":"当前进度","detail.stage":"当前阶段","detail.updated":"最近更新","detail.archived":"已归档","detail.commandLimit":"最多自动执行 {count} 条命令","detail.fullSuiteAllowed":"允许完整测试","detail.manualHandoffAllowed":"允许交给用户确认","detail.method":"执行方式","detail.verification":"验证设置","detail.action":"下一步","detail.legalPaths":"可选方向","detail.none":"无","detail.scope":"相关仓库","detail.repositories":"{count} 个仓库","detail.definition":"任务流程","detail.graph":"流程图","detail.graphDisclaimer":"后续路径只表示流程上可能到达，不代表条件已经满足。","detail.history":"操作记录","detail.timeline":"时间线","detail.facts":"任务资料","detail.evidence":"证据和记录","detail.acceptance":"完成标准","detail.outcome":"任务结果","detail.noneRecorded":"暂无记录。",
  "scope.eyebrow":"文件范围","scope.ready":"修改路径已有说明","scope.blocked":"修改路径需要处理","scope.explained":"可以进行最终范围检查","scope.unexplained":"{count} 个未说明路径","scope.expected":"计划路径","scope.changed":"当前任务修改路径","scope.decisions":"用户决定","scope.coveredTools":"写入前检查工具","scope.needsDecision":"以下路径不在当前计划内，也没有已使用的明确授权。","scope.boundary":"Host 会在列出的结构化工具写入前检查；Core 会根据 frozen base、commit、index、worktree 和 untracked 内容计算完整 Task surface。Shell、外部进程和专用工具的写入可能到这时才被发现。",
  "workspace.eyebrow":"任务工作区","workspace.title":"独立工作树","workspace.provisioning":"创建状态","workspace.provisioningLastKnown":"最后一次已知状态","workspace.provisioningLastKnownDetail":"这里显示 Core 最近一次保存的工作区观察；WebUI 不会直接检查 Git。","workspace.provisioningUnavailable":"工作树不可用","workspace.provisioningUnavailableDetail":"放弃这个 Task 时，Core 已确认原工作树实例不可用。","workspace.origin":"创建来源","workspace.observation":"当前观察","workspace.remoteBase":"远端 / 基础分支","workspace.baseCommit":"冻结的基础 commit","workspace.taskBranch":"任务分支 / 当前 HEAD","workspace.receipt":"创建 receipt","workspace.history":"历史关系","workspace.content":"内容摘要","workspace.currentSurface":"当前 Task surface","workspace.clean":"当前没有修改路径","workspace.changed":"当前有 {count} 个修改路径","workspace.historyConflict":"工作树历史需要确认后才能继续。","workspace.relocationPending":"迁移 {id} 正在等待；Core 仍保留源工作树 claim。","workspace.cleanupTitle":"终态工作树选择","workspace.cleanupBody":"Core 不删除工作树或分支。保留、检查、handoff、删除工作树和删除分支都是 Host 的独立动作，并分别确认。",
  "timeline.repositoryDelta":"本次涉及 {count} 个仓库路径",
  "lifecycle.eyebrow":"任务管理","lifecycle.title":"管理任务","lifecycle.cancel":"取消任务","lifecycle.restore":"取消归档","lifecycle.archive":"归档任务","lifecycle.purge":"永久删除","lifecycle.cancelEyebrow":"取消任务","lifecycle.cancelTitle":"确定取消这个任务？","lifecycle.cancelBody":"取消原因会被记录，任务状态将变为 CANCELLED，并释放占用的工作树。工作树和分支本身会保留。","lifecycle.reason":"原因","lifecycle.continue":"暂不取消","lifecycle.cancelling":"正在取消…","lifecycle.confirmCancel":"确认取消","lifecycle.failure":"任务管理操作失败","lifecycle.prepareRelocation":"准备迁移","lifecycle.preparingRelocation":"正在准备迁移…","lifecycle.confirmRelocation":"要暂停 Task 并准备同机 Host 迁移吗？Core 验证目标前会保留源工作树 claim。","lifecycle.abandon":"放弃不可用工作树的 Task","lifecycle.abandonTitle":"确定放弃这个 Task？","lifecycle.abandonBody":"仅在原工作树实例不可用时使用。Core 会保存最后一次已知 binding 并释放 claim，不会删除 Git 资源。","lifecycle.abandoning":"正在放弃…","lifecycle.confirmAbandon":"放弃 Task","purge.failure":"删除失败","purge.eyebrow":"永久删除","purge.title":"确定永久删除这个任务？","purge.body":"任务、操作记录、仓库占用和归档状态都会被删除，且无法恢复。工作树和分支不会删除。","purge.typeID":"请输入完整的任务 ID","purge.keep":"保留任务","purge.busy":"正在删除…","purge.confirm":"永久删除",
  "action.eyebrow":"下一步操作","action.conditions":"执行条件","action.effects":"允许的修改","action.evidence":"需要提交的证据","action.steps":"操作步骤","action.rejected":"本次提交未通过校验。","action.guard":"条件 {guard} 未满足。","action.payload":"操作内容","action.requirements":"执行要求和影响","action.submitting":"正在提交…","action.submit":"提交操作","action.failure":"提交失败","action.kind.RESOLVE_BLOCKER":"解决当前问题","action.kind.COMPLETE_REQUIREMENTS":"完成需求梳理","action.kind.COMPLETE_DESIGN":"完成方案设计","action.kind.COMPLETE_TASKS":"完成任务拆分","action.kind.COMPLETE_IMPLEMENTATION":"完成开发实现","action.kind.COMPLETE_TEST":"完成测试验证","action.kind.COMPLETE_COMPREHENSION_REVIEW":"完成理解确认","action.kind.COMPLETE_REFACTOR":"完成代码整理","action.kind.COMPLETE_DELIVERY":"完成交付准备","blocker.title":"任务当前无法继续。","blocker.body":"请按下面的要求处理当前问题，完成后系统会回到合适的步骤。",
  "graph.legendAria":"流程图图例","graph.committed":"已经走过","graph.current":"当前位置","graph.legal":"当前可选","graph.possible":"后续可能","graph.recovery":"问题解决后：","graph.recoveryBody":"任务会从 {node} 继续。","graph.aria":"流程图。当前节点 {node}。后续路径只表示可能到达，不代表条件已经满足。","graph.textList":"查看全部流转","graph.guardNotEvaluated":"可能到达；条件尚未检查","graph.zoomOut":"缩小","graph.zoomIn":"放大","graph.resetZoom":"恢复大小","graph.selectedNode":"已选阶段","graph.currentMarker":"当前位置",
  "recovery.eyebrow":"确认操作结果","recovery.title":"先确认上次操作是否成功","recovery.body":"页面保留了这次操作所需的信息，可以先检查结果，避免重复提交。","recovery.safe":"这次操作可以安全重试。","recovery.unsafe":"请不要在当前建议之外重试。","recovery.assessing":"正在确认…","recovery.assess":"检查操作结果","recovery.follow":"按建议处理","recovery.failure":"结果确认失败","recovery.action.none":"无需继续处理","recovery.action.correct_current_action":"修正当前操作","recovery.action.retry_current_action":"重试当前操作","recovery.action.submit_recovery_apply":"应用恢复操作","recovery.action.read_next_action":"读取下一步操作","recovery.action.resolve_blocker":"解决当前问题","recovery.action.stop_for_repository_drift":"仓库发生变化，停止操作",
  "schema.provide":"填写值","schema.variant":"类型","schema.clear":"清除可选值","schema.remove":"移除","schema.add":"添加 {name}","schema.rejected":"Core 拒绝：{paths}","schema.option":"选项 {index}",
  "system.eyebrow":"运行状态","system.title":"系统状态","system.lede":"查看本机服务、数据目录和连接状态。","system.runtime":"本机服务","system.unavailable":"不可用","system.returnShell":"请在终端运行 dev-flow webui status 查看详情。","system.loading":"正在读取系统状态","runtime.dataRoot":"数据目录标识","runtime.url":"访问地址","runtime.notAvailable":"不可用","runtime.readyBody":"本机服务运行正常，可以查看和操作任务。","runtime.readOnlyBody":"任务可以查看，但数据目录恢复可写前无法进行操作。","runtime.incompatibleBody":"检测到另一个不兼容的本机服务，请使用启动它的程序停止服务。","runtime.unavailableBody":"当前数据目录没有正在运行的 WebUI 服务。",
  "readiness.ready":"运行正常","readiness.read_only":"只能查看","readiness.incompatible":"版本不兼容","readiness.unavailable":"服务不可用","state.active":"进行中","state.blocked":"暂时受阻","state.done":"已完成","state.cancelled":"已取消","api.session":"当前页面已失效，请刷新后重试。","api.requestFailed":"请求失败，状态码 {status}",
  "node.REQUIREMENTS":"需求梳理","node.DESIGN":"方案设计","node.TASKS":"任务拆分","node.IMPLEMENT":"开发实现","node.TEST":"测试验证","node.COMPREHENSION_REVIEW":"理解确认","node.REFACTOR":"代码整理","node.DELIVERY":"交付准备","node.DONE":"已完成","node.BLOCKED":"暂时受阻","node.CANCELLED":"已取消",
};

const storageKey = "dev-flow-language";
const I18nContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: typeof translate }>({ language: "en", setLanguage: () => undefined, t: translate });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => currentLanguage());
  const setLanguage = (next: Language) => { localStorage.setItem(storageKey, next); setLanguageState(next); };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: MessageKey, values?: Record<string, string | number>) => translate(key, values, language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
export function translateCurrent(key: MessageKey, values?: Record<string, string | number>) { return translate(key, values, currentLanguage()); }
export function formatDate(value: string, language: Language) { return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export function readinessKey(value: string): MessageKey { return `readiness.${value}` as MessageKey; }
export function stateKey(value: string): MessageKey { return `state.${value}` as MessageKey; }
export function nodeLabel(value: string, language: Language): string { const key = catalogKey(`node.${value}`); return key === null ? value : translate(key, {}, language); }
export function actionKindKey(value: string): MessageKey | null { return catalogKey(`action.kind.${value}`); }
export function recoveryActionKey(value: string): MessageKey | null { return catalogKey(`recovery.action.${value}`); }

function currentLanguage(): Language {
  const stored = localStorage.getItem(storageKey);
  if (stored === "zh-CN" || stored === "en") return stored;
  for (const locale of navigator.languages) {
    const normalized = locale.toLowerCase();
    if (normalized.startsWith("zh")) return "zh-CN";
    if (normalized.startsWith("en")) return "en";
  }
  return "en";
}

function translate(key: MessageKey, values: Record<string, string | number> = {}, language: Language = currentLanguage()): string {
  let message: string = (language === "zh-CN" ? zh : en)[key];
  for (const [name, value] of Object.entries(values)) message = message.replaceAll(`{${name}}`, String(value));
  return message;
}

function catalogKey(value: string): MessageKey | null { return Object.prototype.hasOwnProperty.call(en, value) ? value as MessageKey : null; }
