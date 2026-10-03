const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { seedUsers, assertDevelopmentDatabase, developmentUsers } = require("../scripts/seed");

test("development seed refuses production and remote databases", () => {
  assert.throws(() => assertDevelopmentDatabase("mongodb://localhost/medinear", "production"));
  assert.throws(() => assertDevelopmentDatabase("mongodb://remote.example/medinear", "development"));
  assert.throws(() => assertDevelopmentDatabase(undefined, "development"));
  assert.doesNotThrow(() => assertDevelopmentDatabase("mongodb://127.0.0.1/medinear", "development"));
});

test("seed uses hashed insert-only upserts and remains safe to repeat", async () => {
  const records = new Map();
  const model = { async updateOne(filter, update, options) {
    assert.equal(options.upsert, true);
    assert.equal(options.runValidators, true);
    assert.equal(options.timestamps, false);
    assert.deepEqual(Object.keys(update), ["$setOnInsert"]);
    if (records.has(filter.email)) return { upsertedCount: 0 };
    records.set(filter.email, update.$setOnInsert);
    return { upsertedCount: 1 };
  } };
  assert.ok((await seedUsers(model)).every((result) => result.created));
  for (const account of developmentUsers) {
    const saved = records.get(account.email);
    assert.equal(saved.role, account.role);
    assert.notEqual(saved.password, account.password);
    assert.ok(await bcrypt.compare(account.password, saved.password));
  }
  const hashes = [...records.values()].map((record) => record.password);
  assert.ok((await seedUsers(model)).every((result) => !result.created));
  assert.equal(records.size, 2);
  assert.deepEqual([...records.values()].map((record) => record.password), hashes);
});
