import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const notices = [];

const relative = (filePath) => path.relative(root, filePath) || ".";
const resolve = (filePath) => path.resolve(root, filePath);

const requireFile = (filePath) => {
  const absolute = resolve(filePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`missing required file: ${filePath}`);
    return null;
  }
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) {
    errors.push(`required path is not a file: ${filePath}`);
    return null;
  }
  return absolute;
};

const readText = (filePath) => {
  const absolute = requireFile(filePath);
  if (absolute === null) return null;
  return fs.readFileSync(absolute, "utf8");
};

const readJson = (filePath) => {
  const text = readText(filePath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`invalid JSON in ${filePath}: ${message}`);
    return null;
  }
};

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

const expectUniqueIds = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    const id = item?.id;
    if (typeof id !== "string" || id.trim().length === 0) {
      errors.push(`${label} contains an item without a non-empty string id`);
      continue;
    }
    if (seen.has(id)) errors.push(`${label} contains duplicate id: ${id}`);
    seen.add(id);
  }
  return seen;
};

const validateDependencyGraph = (packages) => {
  const byId = new Map(packages.map((item) => [item.id, item]));

  for (const item of packages) {
    expect(Array.isArray(item.dependencies), `package ${item.id} dependencies must be an array`);
    for (const dependency of item.dependencies ?? []) {
      expect(byId.has(dependency), `package ${item.id} has unknown dependency: ${dependency}`);
      expect(dependency !== item.id, `package ${item.id} depends on itself`);
    }
  }

  const visiting = new Set();
  const visited = new Set();

  const visit = (id, trail) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      errors.push(`package dependency cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    visiting.add(id);
    const item = byId.get(id);
    for (const dependency of item?.dependencies ?? []) visit(dependency, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of byId.keys()) visit(id, []);
};

const requiredDocuments = [
  "AGENTS.md",
  "MACBRAINS.md",
  "docs/macbrains/README.md",
  "docs/macbrains/FORK_BASELINE.md",
  "docs/macbrains/DOCUMENTATION_AUDIT.md",
  "docs/macbrains/PRODUCT_SPEC.md",
  "docs/macbrains/PROJECT_PROFILES.md",
  "docs/macbrains/DOMAIN_MODEL.md",
  "docs/macbrains/IMPLEMENTATION_LEDGER.md",
  "docs/macbrains/CAMPAIGN_MANIFEST.json",
  "docs/macbrains/WORKFLOW_TEMPLATES.json",
  "docs/macbrains/ACCEPTANCE_MATRIX.md",
  "docs/macbrains/DEFAULT_POLICIES.json",
  "docs/macbrains/FORK_IDENTITY_AND_RELEASE.md",
  "docs/macbrains/PULL_TO_MAC.md",
  "docs/macbrains/IMPLEMENTATION_HANDOFF.md",
  "docs/macbrains/ORCHESTRATION_PLAN.md",
  "docs/macbrains/F0_EXECUTION_PROMPT.md",
  "docs/macbrains/AGENT_EXECUTION_PROMPT.md",
];

for (const document of requiredDocuments) requireFile(document);

const manifest = readJson("docs/macbrains/CAMPAIGN_MANIFEST.json");
if (manifest !== null) {
  expect(manifest.$schemaVersion === 1, "campaign manifest schema version must be 1");
  expect(
    manifest.campaignId === "macbrains-t3code-agent-workflow-overhaul",
    "campaign manifest has unexpected campaignId",
  );
  expect(Array.isArray(manifest.canonicalDocuments), "campaign canonicalDocuments must be an array");
  for (const document of manifest.canonicalDocuments ?? []) requireFile(document);

  const packages = Array.isArray(manifest.packages) ? manifest.packages : [];
  expect(packages.length > 0, "campaign manifest must contain packages");
  const packageIds = expectUniqueIds(packages, "campaign packages");
  const statuses = new Set(manifest.statusVocabulary ?? []);
  expect(statuses.size > 0, "campaign statusVocabulary must not be empty");

  for (const item of packages) {
    expect(statuses.has(item.status), `package ${item.id} has invalid status: ${item.status}`);
    expect(
      typeof item.ownershipGroup === "string" && item.ownershipGroup.length > 0,
      `package ${item.id} must define ownershipGroup`,
    );
    expect(
      Array.isArray(item.primaryAcceptancePrefixes),
      `package ${item.id} acceptance prefixes must be an array`,
    );
  }

  validateDependencyGraph(packages);
  expect(packageIds.has("F0"), "campaign manifest must contain F0");
  expect(packageIds.has("E0"), "campaign manifest must contain E0");
  const e0 = packages.find((item) => item.id === "E0");
  expect((e0?.dependencies?.length ?? 0) > 0, "E0 must depend on implementation packages");
  expect(
    manifest.releaseGate?.allRequiredAcceptanceRowsProven === true,
    "release gate must require all acceptance rows proven",
  );
  expect(
    manifest.releaseGate?.canonicalE0ScenarioProven === true,
    "release gate must require the canonical E0 scenario",
  );
}

const templates = readJson("docs/macbrains/WORKFLOW_TEMPLATES.json");
if (templates !== null) {
  expect(templates.$schemaVersion === 1, "workflow templates schema version must be 1");
  const items = Array.isArray(templates.templates) ? templates.templates : [];
  const ids = expectUniqueIds(items, "workflow templates");
  for (const required of [
    "implement-feature",
    "fix-bug",
    "review-pull-request",
    "experiment-benchmark",
    "recovery-resume",
    "anvil-package-execution",
    "ane-re-experiment",
  ]) {
    expect(ids.has(required), `missing required workflow template: ${required}`);
  }
  for (const item of items) {
    expect(
      Array.isArray(item.lifecycle) && item.lifecycle.length > 0,
      `workflow ${item.id} needs lifecycle steps`,
    );
    expect(
      Array.isArray(item.topology) && item.topology.length > 0,
      `workflow ${item.id} needs topology`,
    );
    expect(
      Array.isArray(item.requiredReceipts) && item.requiredReceipts.length > 0,
      `workflow ${item.id} needs required receipts`,
    );
  }
}

const policies = readJson("docs/macbrains/DEFAULT_POLICIES.json");
if (policies !== null) {
  expect(policies.$schemaVersion === 1, "default policy schema version must be 1");
  const expectedClaims = ["PROVEN", "INFERRED", "SUSPECTED", "UNKNOWN"];
  expect(
    JSON.stringify(policies.product?.claimLabels) === JSON.stringify(expectedClaims),
    "default policies must use the canonical claim labels in canonical order",
  );
  expect(policies.linuxNode?.pythonAllowed === false, "Linux node policy must prohibit Python");
  expect(
    policies.completion?.providerMessageMayCompleteLane === false,
    "provider messages must not complete lanes",
  );
  expect(
    policies.work?.substantialWorkUsesWorktree === true,
    "substantial work must use worktrees by default",
  );
}

const contract = readText("MACBRAINS.md");
if (contract !== null) {
  for (const required of [
    "PROVEN",
    "INFERRED",
    "SUSPECTED",
    "UNKNOWN",
    "no Python implementation",
    "ANVIL",
    "deliverable-ready",
    "safe to continue here or start a fresh context",
  ]) {
    expect(contract.includes(required), `MACBRAINS.md is missing required contract text: ${required}`);
  }
}

const acceptance = readText("docs/macbrains/ACCEPTANCE_MATRIX.md");
if (acceptance !== null) {
  for (const section of "ABCDEFGHIJKLMNOPQRSTU") {
    expect(
      acceptance.includes(`## ${section}.`),
      `acceptance matrix is missing section ${section}`,
    );
  }
  expect(
    acceptance.includes("## Final release gate"),
    "acceptance matrix is missing final release gate",
  );
  expect(acceptance.includes("U01"), "acceptance matrix is missing canonical end-to-end row U01");
}

const index = readText("docs/macbrains/README.md");
if (index !== null) {
  const indexedDocuments = requiredDocuments.filter(
    (item) => item.startsWith("docs/macbrains/") && item !== "docs/macbrains/README.md",
  );
  for (const document of indexedDocuments) {
    const basename = path.basename(document);
    expect(index.includes(basename), `specification index does not reference ${basename}`);
  }
}

if (errors.length > 0) {
  console.error(`MacBrains specification validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  notices.push(`validated ${requiredDocuments.length} required files`);
  notices.push(`repository root: ${relative(root)}`);
  console.log("MacBrains specification validation passed.");
  for (const notice of notices) console.log(`- ${notice}`);
}
