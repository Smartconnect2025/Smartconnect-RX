import http from "http";
import net from "net";

const PORT = parseInt(process.env.PORT) || 26196;
const TARGET_PORT = 5000;
const TARGET_HOST = "localhost";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

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
      res.writeHead(502, NO_CACHE_HEADERS);
      res.end("SmartConnect RX is starting up... please wait a moment.");
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
  console.log(`SmartConnect RX proxy: port ${PORT} → localhost:${TARGET_PORT}`);
});
