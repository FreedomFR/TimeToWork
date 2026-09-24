import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import clientRoutes from "./routes/clients";
import tagRoutes from "./routes/tags";
import timeEntryRoutes from "./routes/timeEntries";
import reportRoutes from "./routes/reports";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/time-entries", timeEntryRoutes);
app.use("/api/reports", reportRoutes);
