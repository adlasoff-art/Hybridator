import { readFileSync } from "node:fs";
import { join } from "node:path";

const packages = ["core-model", "licensing-billing", "timeline-engine", "media-engine", "ai-core"];
const forbidden = ["react", "react-dom", "react-native"];
let failed = false;

for (const name of packages) {
  const pkgPath = join(process.cwd(), "packages", name, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  for (const dep of forbidden) {
    if (dep in deps) {
      console.error(`[check:no-react-core] ${pkg.name} depends on "${dep}"`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("[check:no-react-core] OK — core packages have no React dependency");
