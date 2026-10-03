import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Navigate } from "react-router-dom";

test("route guards redirect guests and authenticated users correctly", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { AuthContext } = await server.ssrLoadModule("/src/auth/AuthContext.jsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthProvider.jsx");
    const { default: ProtectedRoute } = await server.ssrLoadModule("/src/components/ProtectedRoute.jsx");
    const { default: GuestRoute } = await server.ssrLoadModule("/src/components/GuestRoute.jsx");
    const child = createElement("p", null, "Guest form");
    function inspect(Component, user, path, props = {}) {
      let result;
      function Probe() {
        result = Component(props);
        // Inspect the actual guard's output without running Navigate's browser effect.
        return null;
      }
      renderToString(createElement(MemoryRouter, { initialEntries: [path] },
        createElement(AuthContext.Provider, { value: { user, logout() {} } }, createElement(Probe))));
      return result;
    }
    for (const path of ["/", "/favorites", "/orders", "/profile", "/cart", "/checkout", "/pharmacy/123", "/order-success/123", "/pharmacy/dashboard"]) {
      const result = inspect(ProtectedRoute, null, path);
      assert.equal(result.type, Navigate);
      assert.equal(result.props.to, "/login");
      assert.equal(result.props.replace, true);
    }
    assert.notEqual(inspect(ProtectedRoute, { id: "123" }, "/").type, Navigate);
    assert.equal(inspect(ProtectedRoute, { role: "customer" }, "/pharmacy/dashboard", { role: "pharmacy_owner" }).props.to, "/");
    assert.equal(inspect(ProtectedRoute, { role: "pharmacy_owner" }, "/", { role: "customer" }).props.to, "/pharmacy/dashboard");
    assert.notEqual(inspect(ProtectedRoute, { role: "pharmacy_owner" }, "/pharmacy/dashboard", { role: "pharmacy_owner" }).type, Navigate);
    assert.notEqual(inspect(ProtectedRoute, { id: "legacy" }, "/", { role: "customer" }).type, Navigate);
    for (const path of ["/login", "/register"]) {
      assert.equal(inspect(GuestRoute, null, path, { children: child }), child);
      const result = inspect(GuestRoute, { id: "123" }, path, { children: child });
      assert.equal(result.type, Navigate);
      assert.equal(result.props.to, "/");
      assert.equal(result.props.replace, true);
      const ownerResult = inspect(GuestRoute, { role: "pharmacy_owner" }, path, { children: child });
      assert.equal(ownerResult.props.to, "/pharmacy/dashboard");
    }
    const pending = renderToString(createElement(AuthProvider, null, createElement("p", null, "Home content")));
    assert.ok(pending.includes("Checking your session"));
    assert.ok(!pending.includes("Home content"));
  } finally {
    await server.close();
  }
});
