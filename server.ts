import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const BACKEND_API_URL = "https://history-verifier-ai-984307638587.asia-southeast1.run.app/api/v1/evidence-map";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json({ limit: "5mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy endpoint for Vietnamese Historical Evidence Map
  app.post("/api/evidence-map", async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        res.status(400).json({
          error: "Nội dung văn bản lịch sử không được để trống.",
        });
        return;
      }

      const trimmedContent = content.trim();
      if (trimmedContent.length < 5) {
        res.status(400).json({
          error: "Vui lòng nhập đoạn văn có ít nhất 5 ký tự để phân tích.",
        });
        return;
      }

      // Controller for request timeout (up to 75 seconds for AI extraction & vector search)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 75000);

      try {
        const response = await fetch(BACKEND_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ content: trimmedContent }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(`Upstream API error (${response.status}):`, errorText);
          
          if (response.status === 422) {
            res.status(422).json({
              error: "Dữ liệu gửi lên không hợp lệ hoặc không đúng định dạng.",
            });
            return;
          }

          if (response.status >= 500) {
            res.status(502).json({
              error: "Dịch vụ phân tích lịch sử hiện đang quá tải hoặc gặp sự cố máy chủ. Vui lòng thử lại sau.",
            });
            return;
          }

          res.status(response.status).json({
            error: `Máy chủ trả về lỗi mã ${response.status}. Vui lòng thử lại.`,
          });
          return;
        }

        const data = await response.json();
        res.json(data);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === "AbortError") {
          console.error("Upstream API request timed out");
          res.status(504).json({
            error: "Quá trình phân tích mất nhiều thời gian hơn dự kiến. Vui lòng thử lại hoặc giảm độ dài đoạn văn.",
          });
          return;
        }
        throw fetchErr;
      }
    } catch (err: any) {
      console.error("Proxy error in /api/evidence-map:", err);
      res.status(500).json({
        error: "Không thể kết nối tới dịch vụ tìm nguồn sử liệu. Vui lòng kiểm tra kết nối mạng và thử lại.",
      });
    }
  });

  // Proxy endpoint for Source PDF Signed URL
  app.get(["/api/source-pdf", "/api/sources/:source_id/pdf"], async (req, res) => {
    try {
      const sourceId = (req.params.source_id || req.query.source_id) as string;
      if (!sourceId || typeof sourceId !== "string" || !sourceId.trim()) {
        res.status(400).json({ error: "Thiếu mã nguồn sử liệu (source_id)." });
        return;
      }

      const cleanSourceId = encodeURIComponent(sourceId.trim());
      const upstreamPdfUrl = `https://history-verifier-ai-984307638587.asia-southeast1.run.app/api/v1/sources/${cleanSourceId}/pdf`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(upstreamPdfUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(`Upstream PDF API error (${response.status}):`, errorText);
          res.status(response.status).json({
            error: `Không thể tải tệp PDF cho nguồn '${sourceId}'. Mã lỗi: ${response.status}`,
          });
          return;
        }

        const data = await response.json();
        res.json(data);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === "AbortError") {
          res.status(504).json({ error: "Quá thời gian kết nối tới máy chủ PDF." });
          return;
        }
        throw fetchErr;
      }
    } catch (err: any) {
      console.error("Proxy error in /api/source-pdf:", err);
      res.status(500).json({ error: "Không thể kết nối tới dịch vụ thư tịch PDF." });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
