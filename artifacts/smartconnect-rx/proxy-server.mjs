import http from "http";
import net from "net";

const PORT = parseInt(process.env.PORT) || 26196;
const TARGET_PORT = 5000;
const TARGET_HOST = "127.0.0.1";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

const STARTUP_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SmartConnect RX</title>
<meta http-equiv="refresh" content="3">
<style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#1E3A8A,#2563EB,#00AEEF);color:white;}
.box{text-align:center;padding:2rem;}.spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;}
@keyframes spin{to{transform:rotate(360deg);}}</style></head>
<body><div class="box"><div class="spinner"></div><h2>SmartConnect RX</h2><p>Starting up... this page will refresh automatically.</p></div></body></html>`;

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const mergedHeaders = { ...proxyRes.headers, ...NO_CACHE_HEADERS };
    res.writeHead(proxyRes.statusCode, mergedHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(503, { ...NO_CACHE_HEADERS, "Content-Type": "text/html" });
      res.end(STARTUP_HTML);
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.on("upgrade", (req, socket, head) => {
  const proxySocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    proxySocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`
    );
    if (head && head.length) proxySocket.write(head);
    socket.pipe(proxySocket);
    proxySocket.pipe(socket);
  });
  proxySocket.on("error", () => socket.destroy());
  socket.on("error", () => proxySocket.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SmartConnect RX proxy: port ${PORT} → ${TARGET_HOST}:${TARGET_PORT}`);
});
