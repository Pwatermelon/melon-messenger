import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";
import { registerServiceWorker } from "./lib/pushNotifications";

const savedTheme = typeof window !== "undefined" && (localStorage.getItem("wm_theme") === "light" || localStorage.getItem("melon_theme") === "light") ? "light" : "dark";
if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", savedTheme);

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);
