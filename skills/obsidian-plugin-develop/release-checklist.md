# Release and Community Directory Checklist

## Contents

- Pre-release checklist
- Release with GitHub Actions
- Submit to the community directory
- After submission: review results
- Manage the listing
- Beta testing with BRAT

Source: developer docs under `Community directory/` and `Plugins/Releasing/` (2026-10-21) and the current sample plugin, read 2026-11-13.
<https://docs.obsidian.md/Community+directory/Developer+policies> · <https://docs.obsidian.md/Community+directory/Submission+requirements+for+plugins> · <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>

A release or submission is public and cannot be withdrawn quietly. Work through the checklist, fix what fails, re-run it from the top, and publish only after the user approves.

## Pre-release checklist

### Repository

- [ ] `README.md` in the root: what the plugin does and how to use it (an excerpt is shown on the listing; relative links and images are rewritten against the repository)
- [ ] `LICENSE` in the root, a license GitHub recognizes (a "Custom license" result is a warning), with your own copyright line
- [ ] Licenses of bundled code respected, with attribution in the README where required
- [ ] README disclosures present for everything that applies: network use (which services, why), payment, account, files outside the vault, static ads in the plugin's own UI, server-side telemetry with a privacy-policy link, closed-source code
- [ ] "Obsidian" is not used in a way that suggests a first-party product
- [ ] Not a fork, or: public written approval from the original author, or proof of 6+ months of inactivity plus a contact attempt and a 30-day wait. The original author is credited either way
- [ ] `main.js` is not committed (TypeScript project)

### manifest.json (at the HEAD of the default branch)

- [ ] Only known fields: `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly`, optional `authorUrl`, `fundingUrl`, `helpUrl`
- [ ] `id`: lowercase letters and hyphens, no `obsidian`, does not end with `plugin`, [not already taken](https://community.obsidian.md/plugins). It cannot be changed after publishing
- [ ] `name`: unique across plugins and themes, no "Obsidian"/"Obsi-"/"-sidian", no "Plugin", no emoji, not a core feature name
- [ ] `description`: 10–250 characters, ends with a period, action sentence, no "Obsidian", no "This plugin…", does not repeat the name, no emoji
- [ ] `minAppVersion` covers every API used (`no-unsupported-api` is clean)
- [ ] `isDesktopOnly` is `true` if Node.js/Electron APIs are used without a `Platform.isDesktopApp` guard
- [ ] `fundingUrl` points to real funding services, or is removed
- [ ] `authorUrl` is a reachable HTTPS page that is not a GitHub repository or the Obsidian website
- [ ] `version` is `x.y.z` and will equal the release tag exactly (no leading `v`)

### Code

- [ ] `npm run build` passes (the scanner runs the first of `build`, `build:plugin`, `compile`)
- [ ] `npm run lint` (`eslint .` from the root) reports zero errors; every remaining warning is fixed or has a justified disable comment
- [ ] No obfuscation, no network-loaded ads, no client-side telemetry, no self-update, no runtime installation of dependencies
- [ ] Every listener, interval, and child component is registered (`registerEvent`, `registerDomEvent`, `registerInterval`, `addChild`) or released in `onunload()`
- [ ] Secrets are stored through `app.secretStorage`, not in `data.json`
- [ ] Tested with the plugin disabled and re-enabled (no leaked listeners), and on mobile if `isDesktopOnly` is `false`

### versions.json

Maps a plugin version to the minimum Obsidian version it needs. Update it **only when `minAppVersion` changes**; not every release needs an entry.

```json
{
  "1.0.0": "1.13.2"
}
```

## Release with GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release Obsidian plugin

on:
  push:
    tags:
      - '*'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
      attestations: write
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm

      - name: Build plugin
        run: |
          npm ci
          npm run build

      - name: Check for optional styles
        id: styles
        run: |
          [ -f styles.css ] && echo "exists=true" >> "$GITHUB_OUTPUT" || echo "exists=false" >> "$GITHUB_OUTPUT"

      - name: Attest build provenance
        uses: actions/attest@v4
        with:
          subject-path: |
            main.js
            ${{ steps.styles.outputs.exists == 'true' && 'styles.css' || '' }}

      - name: Create release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tag="${GITHUB_REF#refs/tags/}"
          gh release create "$tag" \
            --title="$tag" \
            --draft \
            main.js manifest.json ${{ steps.styles.outputs.exists == 'true' && 'styles.css' || '' }}
```

- The attestation step signs the release assets; the scorecard shows "verified GitHub artifact attestations". The docs recommend it for directory submissions.
- Repository **Settings → Actions → General → Workflow permissions**: "Read and write permissions".
- Release: bump `version` in `manifest.json` (and `versions.json` if `minAppVersion` changed), commit, then

  ```bash
  git tag -a 1.0.1 -m "1.0.1"
  git push origin 1.0.1
  ```

- The workflow creates a **draft**. Add release notes and select **Publish release** — after the user approves.
- Assets must be attached as individual files: `main.js`, `manifest.json`, `styles.css` (if used).

## Submit to the community directory

Only the first version is submitted. Later GitHub releases are picked up automatically.

1. Sign in at <https://community.obsidian.md> with an **Obsidian account** (not GitHub).
2. On your community profile, under **GitHub**, select **Connect**. This proves you own the repository.
3. Optional: enable **Action required notifications** to get an email when a plugin fails a check.
4. **Plugins → New plugin**: enter the GitHub repository URL and the **Owner** (yourself or an organization you belong to).
5. Agree to the Developer policies and confirm you will keep supporting the plugin, or remove or transfer it. Select **Submit**.

The directory reads `manifest.json` from the HEAD of the default branch. Obsidian installs `main.js`, `manifest.json`, and `styles.css` from the GitHub release whose tag equals the manifest `version`, so both must exist.

Plugins already listed before the directory existed can be claimed after connecting GitHub (**Available to claim → Claim as**).

## After submission: review results

- Results appear on the entry page, grouped as Manifest, Releases, Source code, Build verification. Errors block installation; warnings do not, but address them.
- Fix in the repository, then publish a **new release with a higher version**. A new release triggers a fresh review.
- **… → Check for new releases** if a release is not detected yet; **… → Request review** to re-scan now.
- **Review branch → Run preview scan** scans any branch, tag, or commit without a release. Use it before tagging.
- "Invalid identifier" after publishing: the `id` cannot be changed by you. Ask in `#community-directory` on the Obsidian Discord; changing it resets downloads and forces users to reinstall.
- After the plugin is published: announce in the forum's Share & showcase and in `#updates` on Discord (needs the `developer` role).

How each rule is scored: `review-rules.md`.

## Manage the listing

- **Edit listing**: icon, short and long description, categories, **payment type**, screenshots (up to 5 desktop at 1200×800 and 5 mobile at 900×1600; JPEG, PNG, or WebP; 5 MB each).
- **Payment type**: Free (no payments at all), Optional payment (relies on a paid third-party service, or locks some features), Paid (usable only with payment). A free alternative to a paid service is still Optional payment; a plugin that is unusable after a trial is Paid.
- **Funding links** on your profile appear on all of your plugin pages.
- **Private source repository**: keep release assets in a public repository, submit that one, then install the *Obsidian Community directory* GitHub App on the private repository. The directory verifies that the public build matches the private source.
- **Credit a contributor**: public credit without edit rights.
- **Transfer ownership**: to an organization or a user by their community directory handle. Moving the repository to another GitHub user is different and needs an admin (`#community-directory` on Discord).
- **Organizations**: shared ownership; members edit entries, admins also manage members and the profile.
- **Archive**: removes the entry and blocks new installs; **Unarchive** restores it. Unmaintained or broken plugins may be removed by the Obsidian team.

## Beta testing with BRAT

Obsidian has no official beta channel. Before submitting, let testers install from the repository with the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin: publish a GitHub release with `main.js`, `manifest.json`, `styles.css`, and testers add `username/repo` in BRAT.
