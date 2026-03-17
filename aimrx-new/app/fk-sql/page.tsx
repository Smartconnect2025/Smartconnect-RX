import { readFileSync } from "fs";
import path from "path";

export default function FKSqlPage() {
  const sql = readFileSync(path.join(process.cwd(), "add_foreign_keys.sql"), "utf8");
  return (
    <div style={{ padding: "20px", background: "#1a1a1a", minHeight: "100vh" }}>
      <h1 style={{ color: "white", marginBottom: "10px" }}>Foreign Key SQL - Select All and Copy</h1>
      <p style={{ color: "#aaa", marginBottom: "20px" }}>Click inside the box, press Ctrl+A (or Cmd+A) to select all, then Ctrl+C (Cmd+C) to copy. Paste into Supabase SQL Editor.</p>
      <textarea
        readOnly
        defaultValue={sql}
        style={{
          width: "100%",
          height: "80vh",
          background: "#0d0d0d",
          color: "#00ff88",
          fontFamily: "monospace",
          fontSize: "13px",
          padding: "15px",
          border: "1px solid #333",
          borderRadius: "8px",
        }}
      />
    </div>
  );
}
