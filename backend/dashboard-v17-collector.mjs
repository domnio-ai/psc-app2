import fs from "node:fs";
import { query } from "./src/db.js";
import { pulseForUser } from "./src/pulse-service.js";

async function main() {
  const out = process.env.APP2_DASHBOARD_V17_OUT;
  if (!out) throw new Error("APP2_DASHBOARD_V17_OUT is missing.");

  const users = await query("SELECT * FROM users WHERE active = TRUE ORDER BY name");

  const requiredCards = [
    "Needs My Attention",
    "Assignments",
    "Tasks",
    "Research Repository",
    "Reviews & Approvals",
    "Notifications",
    "Calendar",
    "Team & Users",
    "Reports & Analytics"
  ];

  const rows = [];

  for (const user of users.rows) {
    const pulse = await pulseForUser(user);
    if (!pulse || !pulse.cardCounts) {
      throw new Error("Missing cardCounts for " + user.id);
    }

    const cardCounts = {};
    for (const card of requiredCards) {
      const value = pulse.cardCounts[card];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("Invalid count for " + user.id + " / " + card + ": " + value);
      }
      cardCounts[card] = value;
    }

    rows.push({
      id: user.id,
      role: user.role || "",
      division: user.division || "",
      scope: pulse.scope || "",
      cardCounts
    });
  }

  fs.writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows
  }, null, 2), "utf8");

  console.log("Active users collected: " + rows.length);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
