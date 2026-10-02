import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// Render the actual pages with the project's Vite/React setup, without a browser or API writes.
test("auth pages render the expected fields and reciprocal route links", async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    for (const [page, path, target, count] of [["Login", "/login", "/register", 2], ["Register", "/register", "/login", 5]]) {
      const { default: Component } = await server.ssrLoadModule(`/src/pages/${page}.jsx`);
      const markup = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Component)));
      assert.ok(markup.includes(`href="${target}"`));
      assert.equal((markup.match(/<input /g) || []).length, count);
      assert.ok(markup.includes("MediNear"));
      assert.ok(markup.includes('type="password"'));
      assert.ok(markup.includes("Show password"));
      if (page === "Login") {
        assert.ok(markup.includes("Welcome Back"));
        assert.ok(markup.includes("Login to find pharmacies near you"));
        assert.ok(markup.includes("Forgot Password?"));
      }
    }
  } finally {
    await server.close();
  }
});
