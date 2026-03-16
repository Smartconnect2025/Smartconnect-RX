import { useEffect } from "react";

const APP_URL = "https://c5a9dbd1-1b6e-4eff-a868-457131d3f4e1-00-2fypc76wplyc6.spock.replit.dev";

export default function App() {
  useEffect(() => {
    window.location.replace(APP_URL + window.location.pathname + window.location.search);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", background: "#0f172a", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>SmartConnect RX</div>
        <div style={{ color: "#94a3b8" }}>Loading...</div>
      </div>
    </div>
  );
}
