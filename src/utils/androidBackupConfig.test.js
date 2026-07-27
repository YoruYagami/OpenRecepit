import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Guard against silent regressions in the Android backup posture: a
 * `cap sync` or template regeneration can revert the manifest, and
 * semantically-wrong-but-valid XML (the domain="file" no-op this replaces)
 * produces no build error. CI runs vitest, so this is the assertion layer
 * the android/ folder otherwise lacks.
 */
const read = (p) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("android backup configuration", () => {
  it("keeps Auto Backup disabled and the rule files wired", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
  });

  it("cloud-backup rules deny every storage domain", () => {
    const rules = read("android/app/src/main/res/xml/data_extraction_rules.xml");
    for (const domain of ["root", "file", "database", "sharedpref", "external"]) {
      expect(rules).toContain(`<exclude domain="${domain}" />`);
    }
  });

  it("device-to-device transfer deliberately carries the data", () => {
    const rules = read("android/app/src/main/res/xml/data_extraction_rules.xml");
    expect(rules).not.toContain("<device-transfer>");
  });

  it("legacy full-backup rules are a domain-wide deny-all", () => {
    const rules = read("android/app/src/main/res/xml/backup_rules.xml");
    for (const domain of ["root", "file", "database", "sharedpref", "external"]) {
      expect(rules).toContain(`<exclude domain="${domain}" />`);
    }
    // The path-scoped variant was a no-op (wrong domain); it must not come back.
    expect(rules).not.toContain('path="app_webview"');
  });
});
