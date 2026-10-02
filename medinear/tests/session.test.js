import test from "node:test";
import assert from "node:assert/strict";
import { checkSession, clearSession, saveSession } from "../src/auth/session.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("missing token is logged out without making a session request", async () => {
  const saved = storage({ user: "stale" });
  assert.equal(await checkSession({ get() { assert.fail("unexpected request"); } }, saved), null);
  assert.equal(saved.getItem("user"), null);
});

test("refresh verifies the stored token with the existing profile endpoint", async () => {
  const saved = storage({ token: "backend-issued-token", user: "stale" });
  const user = { id: "123", name: "Test" };
  const api = { async get(path, options) {
    assert.equal(path, "/auth/profile");
    assert.equal(options.headers.Authorization, "Bearer backend-issued-token");
    return { data: { success: true, user } };
  } };
  assert.deepEqual(await checkSession(api, saved), user);
  assert.deepEqual(JSON.parse(saved.getItem("user")), user);
});

test("expired or invalid sessions clear both saved authentication values", async () => {
  const saved = storage({ token: "expired", user: "stale" });
  const api = { async get() { throw { response: { status: 401 } }; } };
  assert.equal(await checkSession(api, saved), null);
  assert.equal(saved.getItem("token"), null);
  assert.equal(saved.getItem("user"), null);
});

test("temporary session check failures preserve credentials for retry", async () => {
  const saved = storage({ token: "valid" });
  await assert.rejects(checkSession({ async get() { throw new Error("offline"); } }, saved), /offline/);
  assert.equal(saved.getItem("token"), "valid");
});

test("login saves the backend session and logout removes only authentication", () => {
  const saved = storage({ cart: "items" });
  const user = { id: "123" };
  assert.equal(saveSession(saved, { token: "issued", user }), user);
  assert.equal(saved.getItem("token"), "issued");
  clearSession(saved);
  assert.equal(saved.getItem("token"), null);
  assert.equal(saved.getItem("user"), null);
  assert.equal(saved.getItem("cart"), "items");
});
