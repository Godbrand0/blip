import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import verifyRoutes from "./routes/verify.routes";
import bridgeRoutes from "./routes/bridge.routes";

dotenv.config();

const app: express.Application = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(compression());
app.use(express.json());

// Routes
app.use("/api/bridge", bridgeRoutes);
app.use("/api", verifyRoutes);
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default app;
