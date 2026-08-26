import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { GraphView } from "../lib/api";
import { nodeLabel, useI18n } from "../lib/i18n";

const nodeWidth = 160;
const nodeHeight = 68;
const normalGap = 52;

type Position = { x: number; y: number };

export function ProcessGraph({ graph }: { graph: GraphView }) {
  const { language, t } = useI18n();
  const [scale, setScale] = useState(1);
  const [selectedID, setSelectedID] = useState(graph.current_node);
  const layoutKey = graph.nodes.map((node) => node.node_id).join("|");
  const positions = useMemo(() => graphPositions(graph), [layoutKey]);
  const viewport = useRef<HTMLDivElement>(null);
  const actual = new Set(graph.actual_transition_ids);
  const legal = new Set(graph.current_legal_transition_ids);
  const future = new Set(graph.future_transition_ids);
  const futureNodes = new Set(graph.future_node_ids);
  const normalCount = graph.nodes.filter((node) => node.kind === "normal").length;
  const specialCount = graph.nodes.length - normalCount;
  const width = Math.max(900, 80 + normalCount * (nodeWidth + normalGap), 80 + specialCount * (nodeWidth + normalGap));
  const height = specialCount === 0 ? 210 : 390;
  const selected = graph.nodes.find((node) => node.node_id === selectedID) ?? graph.nodes.find((node) => node.node_id === graph.current_node) ?? graph.nodes[0];
  useEffect(() => {
    const position = positions.get(selected?.node_id ?? graph.current_node);
    if (position === undefined || viewport.current === null) return;
    viewport.current.scrollLeft = Math.max(0, (position.x + nodeWidth / 2) * scale - viewport.current.clientWidth / 2);
  }, [layoutKey, scale, selectedID]);
  const selectWithKeyboard = (event: KeyboardEvent<SVGGElement>, nodeID: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedID(nodeID);
  };

  return <div className="graph-region">
    <div className="graph-topline">
      <div className="graph-legend" aria-label={t("graph.legendAria")}><span className="actual">{t("graph.committed")}</span><span className="current">{t("graph.current")}</span><span className="legal">{t("graph.legal")}</span><span className="future">{t("graph.possible")}</span></div>
      <div className="graph-controls" role="group" aria-label={t("detail.graph")}><button type="button" aria-label={t("graph.zoomOut")} title={t("graph.zoomOut")} disabled={scale <= .8} onClick={() => setScale((value) => Math.max(.8, value - .1))}>−</button><button type="button" aria-label={t("graph.resetZoom")} title={t("graph.resetZoom")} onClick={() => setScale(1)}>{Math.round(scale * 100)}%</button><button type="button" aria-label={t("graph.zoomIn")} title={t("graph.zoomIn")} disabled={scale >= 1.4} onClick={() => setScale((value) => Math.min(1.4, value + .1))}>+</button></div>
    </div>
    {graph.resume_node !== null && <p className="blocked-relation"><strong>{t("graph.recovery")}</strong> {t("graph.recoveryBody", { node: graph.resume_node })}</p>}
    <div ref={viewport} className="graph-viewport" role="region" aria-label={t("graph.aria", { node: graph.current_node })} tabIndex={0}>
      <svg style={{ width: width * scale, minWidth: width * scale }} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t("graph.aria", { node: graph.current_node })}>
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
        {graph.transitions.map((transition, index) => {
          const from = positions.get(transition.source);
          const to = positions.get(transition.destination);
          if (from === undefined || to === undefined) return null;
          const kind = actual.has(transition.transition_id) ? "actual" : legal.has(transition.transition_id) ? "legal" : future.has(transition.transition_id) ? "future" : "inactive";
          return <path key={transition.transition_id} className={`graph-edge ${kind}`} d={edgePath(from, to, index)} markerEnd="url(#arrow)" />;
        })}
        {graph.nodes.map((node) => {
          const position = positions.get(node.node_id)!;
          const selectedNode = selected?.node_id === node.node_id;
          const classes = ["graph-node", node.kind, node.node_id === graph.current_node ? "current" : "", futureNodes.has(node.node_id) ? "future" : "", selectedNode ? "selected" : ""].filter(Boolean).join(" ");
          return <g key={node.node_id} role="button" className={classes} data-node-id={node.node_id} tabIndex={0} aria-pressed={selectedNode} aria-label={`${nodeLabel(node.node_id, language)}. ${node.node_id}. ${node.node_id === graph.current_node ? `${t("graph.currentMarker")}. ` : ""}${node.purpose || node.kind}`} onClick={() => setSelectedID(node.node_id)} onKeyDown={(event) => selectWithKeyboard(event, node.node_id)}>
            <rect x={position.x} y={position.y} width={nodeWidth} height={nodeHeight} rx="10" />
            {node.node_id === graph.current_node && <><circle className="current-indicator" cx={position.x + 13} cy={position.y + 13} r="4" /><text className="current-label" x={position.x + 24} y={position.y + 17}>{t("graph.currentMarker")}</text></>}
            <text className="node-label" x={position.x + nodeWidth / 2} y={position.y + 35} textAnchor="middle">{nodeLabel(node.node_id, language)}</text>
            <text className="node-id" x={position.x + nodeWidth / 2} y={position.y + 54} textAnchor="middle">{node.node_id}</text>
          </g>;
        })}
      </svg>
    </div>
    {selected !== undefined && <div className="graph-selection" role="status"><span>{t("graph.selectedNode")}</span><strong>{nodeLabel(selected.node_id, language)}</strong><code>{selected.node_id}</code>{selected.purpose !== "" && <p>{selected.purpose}</p>}</div>}
    <details className="transition-list"><summary>{t("graph.textList")}<span className="disclosure-chevron" aria-hidden="true" /></summary><ul>{graph.transitions.map((transition) => <li key={transition.transition_id}><code>{transition.transition_id}</code><span>{transition.source} → {transition.destination}</span>{legal.has(transition.transition_id) && <strong>{t("graph.legal")}</strong>}{future.has(transition.transition_id) && !legal.has(transition.transition_id) && <em>{t("graph.guardNotEvaluated")}</em>}</li>)}</ul></details>
  </div>;
}

function graphPositions(graph: GraphView): Map<string, Position> {
  const normal = graph.nodes.filter((node) => node.kind === "normal");
  const special = graph.nodes.filter((node) => node.kind !== "normal");
  const positions = new Map<string, Position>();
  normal.forEach((node, index) => positions.set(node.node_id, { x: 40 + index * (nodeWidth + normalGap), y: 84 }));
  special.forEach((node, index) => positions.set(node.node_id, { x: 40 + index * (nodeWidth + normalGap), y: 260 }));
  return positions;
}

function edgePath(from: Position, to: Position, index: number): string {
  const fromCenter = { x: from.x + nodeWidth / 2, y: from.y + nodeHeight / 2 };
  const toCenter = { x: to.x + nodeWidth / 2, y: to.y + nodeHeight / 2 };
  if (from.y !== to.y) {
    const startY = from.y < to.y ? from.y + nodeHeight : from.y;
    const endY = from.y < to.y ? to.y : to.y + nodeHeight;
    const bend = Math.max(38, Math.abs(endY - startY) * .52);
    return `M ${fromCenter.x} ${startY} C ${fromCenter.x} ${startY + (from.y < to.y ? bend : -bend)}, ${toCenter.x} ${endY + (from.y < to.y ? -bend : bend)}, ${toCenter.x} ${endY}`;
  }
  const forward = to.x > from.x;
  const startX = forward ? from.x + nodeWidth : from.x;
  const endX = forward ? to.x : to.x + nodeWidth;
  const distance = Math.abs(endX - startX);
  if (distance < nodeWidth + normalGap + 4) return `M ${startX} ${fromCenter.y} L ${endX} ${toCenter.y}`;
  const lane = from.y - 26 - (index % 5) * 13;
  return `M ${startX} ${fromCenter.y} C ${startX} ${lane}, ${endX} ${lane}, ${endX} ${toCenter.y}`;
}
