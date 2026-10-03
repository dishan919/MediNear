const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (file.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (result.status !== 0) { console.error(result.stderr); process.exitCode = 1; }
    }
  }
}
check(join(__dirname, ".."));
