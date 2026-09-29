import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import SlowRequestNotice from "./components/ui/SlowRequestNotice";
import { AuthProvider } from "./context/AuthContext";
import { installErrorReporting } from "./utils/reportError";
import { applyCachedAppearance } from "./utils/appearance";
import "./index.css";

installErrorReporting();
applyCachedAppearance();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <SlowRequestNotice />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
