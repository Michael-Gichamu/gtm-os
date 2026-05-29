import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { leadRoutes } from "./routes/leadRoutes.js";
import { pipelineRoutes } from "./routes/pipelineRoutes.js";
import { tagRoutes } from "./routes/tagRoutes.js";
import { activityRoutes } from "./routes/activityRoutes.js";
import { workspaceRoutes } from "./routes/workspaceRoutes.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: [`http://localhost:${env.WEB_PORT}`],
    credentials: true,
  }),
);
// 25mb covers bulk-import payloads (~5000 leads). All endpoints share this
// budget; for higher loads we'd want per-route limits via a middleware.
app.use(express.json({ limit: "25mb" }));
app.use(pinoHttp({ logger }));

// --- Public ---
app.get("/health", (_req, res) => res.json({ ok: true, service: "gtm-api" }));

// --- Authenticated ---
const api = express.Router();
api.use(requireAuth);
api.use("/workspace", workspaceRoutes);
api.use("/leads", leadRoutes);
api.use("/pipeline", pipelineRoutes);
api.use("/tags", tagRoutes);
api.use("/activities", activityRoutes);
app.use("/v1", api);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "gtm-api listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
