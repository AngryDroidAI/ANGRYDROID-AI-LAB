import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";
import { initLogWebSocket } from "./ws/logs.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use("/api", routes);
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const wss = new WebSocketServer({ server, path: "/ws/logs" });
const broadcastLog = initLogWebSocket(wss);

server.listen(PORT, () => {
  console.log(`✅ AI-Lab backend running on port ${PORT}`);
  broadcastLog("AI-Lab backend started");
});

