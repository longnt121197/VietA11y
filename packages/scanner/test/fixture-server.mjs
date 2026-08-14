import http from "node:http";
import { URL } from "node:url";

const pages = {
  "/baseline": `<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Baseline fixture</title></head>
      <body><main><h1>Fixture heading</h1><p>Readable content.</p></main></body>
    </html>`,
  "/missing-alt": `<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Missing alt fixture</title></head>
      <body><main><h1>Product</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body>
    </html>`,
  "/unlabeled-input": `<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Unlabeled input fixture</title></head>
      <body><main><h1>Search</h1><input type="text"></main></body>
    </html>`,
  "/missing-lang": `<!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Missing language fixture</title></head>
      <body><main><h1>Fixture heading</h1></main></body>
    </html>`,
  "/multiple": `<!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Multiple violations fixture</title></head>
      <body><main><h1>Product search</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><input type="text"></main></body>
    </html>`,
  "/web-e2e": `<!doctype html>
    <html lang="vi">
      <head><meta charset="utf-8"><title>Web E2E fixture</title></head>
      <body>
        <main id="primary-content">
          <h1>Sản phẩm thử nghiệm</h1>
          <img id="unsafe-excerpt" data-probe="&lt;script id=&quot;interpreted-probe&quot;&gt;" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
          <img id="second-missing-alt" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
        </main>
        <main id="duplicate-content"><p>Nội dung trong mốc chính trùng lặp.</p></main>
      </body>
    </html>`,
  "/restrictive-csp": `<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>Restrictive CSP fixture</title></head>
      <body>
        <main><h1>Product</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main>
        <script>document.querySelector("img").alt = "Added only if CSP is bypassed";</script>
      </body>
    </html>`,
};

export async function startFixtureServer() {
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://fixture.test");

    if (requestUrl.pathname === "/redirect") {
      response.writeHead(302, { location: "/missing-alt" });
      response.end();
      return;
    }

    if (requestUrl.pathname === "/hang") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.write("<!doctype html><html><head><title>Never complete");
      return;
    }

    if (requestUrl.pathname === "/disconnect") {
      request.socket.destroy();
      return;
    }

    const page = pages[requestUrl.pathname];

    if (page === undefined) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const headers = { "content-type": "text/html; charset=utf-8" };

    if (requestUrl.pathname === "/restrictive-csp") {
      headers["content-security-policy"] =
        "default-src 'none'; script-src 'self'; img-src data:";
    }

    response.writeHead(200, headers);
    response.end(page);
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("The fixture server did not bind to a TCP port.");
  }

  return {
    url(pathname) {
      return `http://127.0.0.1:${address.port}${pathname}`;
    },
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }

      await new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    },
  };
}
