import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
};

http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const filename = path.resolve(
        publicDirectory,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      const relative = path.relative(publicDirectory, filename);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const content = await readFile(filename);
      response.writeHead(200, {
        "Content-Type":
          contentTypes[path.extname(filename)] || "application/octet-stream",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Ritim İzi: http://127.0.0.1:4173"),
  );
