import { Router, Request, Response } from "express";
import { analyzeContent } from "../services/attribution.service";

const router = Router();

router.post("/analyze", async (req: Request, res: Response) => {
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "content (string) is required" });
  }

  const result = await analyzeContent(content);
  return res.json(result);
});

export default router;
