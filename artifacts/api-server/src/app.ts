import http from "http";

const TARGET_PORT = 5000;

const server = http.createServer((req, res) => {
  const options: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${TARGET_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    res.writeHead(proxyRes.statusCode || 500, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("API proxy: upstream unavailable");
    }
  });

  req.pipe(proxyReq, { end: true });
});

export default server;
