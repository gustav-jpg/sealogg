import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativePlugins } from "./lib/native-init";

// Initialize native Capacitor plugins (status bar, splash screen, deep linking)
initNativePlugins();

createRoot(document.getElementById("root")!).render(<App />);
