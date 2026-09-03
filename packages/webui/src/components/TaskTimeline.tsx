import { TaskEventView } from "../lib/api";
import { formatDate, useI18n } from "../lib/i18n";

export function TaskTimeline({ events }: { events: TaskEventView[] }) {
  const { language, t } = useI18n();
  return <ol className="timeline">{events.map((event) => <li key={`${event.revision}-${event.event_type}`}><span className="timeline-marker">r{event.revision}</span><div><strong>{event.source_node} <span aria-hidden="true">→</span> {event.destination_node}</strong><small>{event.event_type} · {formatDate(event.created_at, language)}</small>{event.transition_id !== null && <code>{event.transition_id}</code>}{event.reason !== null && <p>{event.reason}</p>}{event.repository_delta_paths.length > 0 && <div className="timeline-paths"><small>{t("timeline.repositoryDelta", { count: event.repository_delta_paths.length })}</small><ul>{event.repository_delta_paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul></div>}</div></li>)}</ol>;
}
