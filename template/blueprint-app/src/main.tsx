import { createRoot } from "react-dom/client";
import "@netapp/blueprint/css";
import "./index.css";
import App from "./App";

document.documentElement.setAttribute("data-theme", "light");
document.documentElement.classList.add("light-theme");

createRoot(document.getElementById("root")!).render(<App />);
