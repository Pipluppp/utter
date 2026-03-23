import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles/index.css";

// Clean up legacy Supabase JS client token stored in localStorage.
// The app now uses HttpOnly cookies exclusively — this key is a stale
// leftover that would be readable via XSS if it were ever refreshed.
for (const key of Object.keys(localStorage)) {
  if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
    localStorage.removeItem(key);
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element "#root" not found.');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
