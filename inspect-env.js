import fs from "fs";

// Read raw bytes of the .env file
const data = fs.readFileSync("./.env");

// Print raw byte values (to spot BOM or weird chars)
console.log("🔍 Raw bytes in .env:");
console.log([...data]);

// Convert to visible string with escaped characters
const content = data.toString("utf8");
console.log("\n🧠 Visible text with escape sequences:");
console.log(JSON.stringify(content));
