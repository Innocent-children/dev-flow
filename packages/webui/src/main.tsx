import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Dev Flow WebUI root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Dev Flow</h1>
    </main>
  </StrictMode>,
);
