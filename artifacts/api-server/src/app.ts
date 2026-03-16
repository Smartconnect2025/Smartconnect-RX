import express, { type Express } from "express";
import cors from "cors";
import http from "http";
import router from "./routes";

const app: Express = express();

app.use(cors());

app.use("/api", (req, res, next) => {
  const options = {
    hostname: "localhost",
    port: 5000,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: "localhost:5000" },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      next();
    }
  });

  req.pipe(proxyReq, { end: true });
});

export default app;
