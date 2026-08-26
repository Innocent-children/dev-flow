import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { I18nProvider } from "./lib/i18n";
import "./styles/tokens.css";
import "./styles/layout.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Dev Flow WebUI root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider><App /></I18nProvider>
  </StrictMode>,
);
