import fs from "fs";
import yaml from "yaml";

export function loadRoster() {
  const raw = fs.readFileSync("./yaml.txt", "utf8");
  const parsed = yaml.parse(raw);
  return parsed;
}

