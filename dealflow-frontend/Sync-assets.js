// Downloads all exportable assets (PNGs, JPGs, SVGs) from your Figma file to /src/assets
console.log("🌀 Auto-sync triggered...");

import axios from "axios";
import fs from "fs-extra";
import dotenv from "dotenv";

// Load local .env when running outside CI; in CI, secrets come from env
dotenv.config();

const FILE_KEY = process.env.FIGMA_FILE_KEY;
const TOKEN = process.env.FIGMA_TOKEN;
const OUTPUT = "./src/assets";

if (!FILE_KEY || !TOKEN) {
  console.error("❌ Missing FIGMA_FILE_KEY or FIGMA_TOKEN in environment (.env or CI secrets)");
  process.exit(1);
}

function mask(v, show = 4) {
  if (!v) return "<missing>";
  const s = String(v);
  return s.length <= show ? "*".repeat(s.length) : "*".repeat(s.length - show) + s.slice(-show);
}

console.log(`🔐 Using FIGMA_FILE_KEY=${mask(FILE_KEY)} TOKEN=${mask(TOKEN)}`);

async function fetchExportableNodes() {
  const res = await axios.get(`https://api.figma.com/v1/files/${FILE_KEY}`, {
    headers: { "X-Figma-Token": TOKEN },
  });

  const document = res.data.document;
  const nodes = [];

  function walk(node) {
    if (node.exportSettings) nodes.push(node.id);
    if (node.children) node.children.forEach(walk);
  }

  walk(document);
  return nodes;
}

async function exportImages(ids) {
  await fs.ensureDir(OUTPUT);
  console.log(`📦 Exporting ${ids.length} assets...`);

  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const url = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${batch.join(",")}&format=png`;
    const res = await axios.get(url, { headers: { "X-Figma-Token": TOKEN } });
    const images = res.data.images;

    for (const [id, imgUrl] of Object.entries(images)) {
      if (!imgUrl) continue;
      const img = await axios.get(imgUrl, { responseType: "arraybuffer" });
      const filePath = `${OUTPUT}/${id}.png`;
      await fs.writeFile(filePath, img.data);
      console.log(`✅ Saved ${filePath}`);
    }
  }
}

(async () => {
  try {
    console.log("🚀 Syncing Figma assets...");
    const nodes = await fetchExportableNodes();
    if (!nodes.length) {
      console.log("⚠️ No exportable assets found in Figma file.");
      return;
    }
    await exportImages(nodes);
    console.log("🎉 Done! Assets saved to src/assets");
  } catch (err) {
    const msg = err?.response?.data || err?.message || String(err);
    console.error("❌ Error:", msg);
    process.exit(1);
  }
})();
