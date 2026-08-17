import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import WalletProvider from "./components/wallet/index.jsx";
import { useRoute } from "./router.jsx";
import "./styles.css";

/**
 * The wallet layer needs to know the route to decide whether to boot itself
 * eagerly, and the route is a hook, so it is read here rather than threaded
 * down through the app.
 */
function Root() {
  const route = useRoute();
  return (
    <WalletProvider route={route}>
      <App />
    </WalletProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
