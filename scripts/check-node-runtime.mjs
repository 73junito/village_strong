const [major, minor] = process.versions.node.split(".").map(Number);

if (major !== 22 || minor < 13) {
  console.error(
    `Unsupported Node.js runtime: v${process.versions.node}. Expected Node 22.13 or later within the Node 22 LTS line.`,
  );
  process.exitCode = 1;
} else {
  console.log(`Node.js runtime contract satisfied: v${process.versions.node}`);
}
