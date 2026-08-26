import { AppShell } from "../components/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { OpenTaskPage } from "../pages/OpenTaskPage";
import { TaskDetailPage } from "../pages/TaskDetailPage";
import { TaskListPage } from "../pages/TaskListPage";
import { SystemStatePage } from "../pages/SystemStatePage";
import { useRoute } from "./router";
import { useI18n } from "../lib/i18n";

export function App() {
  const route = useRoute();
  const { t } = useI18n();
  let page: React.ReactNode;
  switch (route.page) {
    case "dashboard":
      page = <DashboardPage />;
      break;
    case "tasks":
      page = <TaskListPage />;
      break;
    case "open-task":
      page = <OpenTaskPage />;
      break;
    case "task":
      page = <TaskDetailPage taskID={route.taskID} />;
      break;
    case "system":
      page = <SystemStatePage />;
      break;
    default:
      page = (
        <section className="state-panel" aria-labelledby="missing-title">
          <p className="eyebrow">{t("app.notFoundEyebrow")}</p>
          <h1 id="missing-title">{t("app.notFoundTitle")}</h1>
        </section>
      );
  }
  return <AppShell>{page}</AppShell>;
}
