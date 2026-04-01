import express from "express";

export function createPetRouter({ engine }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({ item: engine.getState() });
  });

  return router;
}
