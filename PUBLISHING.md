# Publishing vivi as an editor extension

vivi is a **VS Code-compatible editor extension**, not a Cursor Agent Plugin. To make `Suzuka24.vivi` searchable in both editors, publish the same VSIX version to **Visual Studio Marketplace** (VS Code) and **Open VSX** (the third-party extension source used by Cursor). Cursor applies its own marketplace proxy and review before an Open VSX version appears in search; publishing to Open VSX does not guarantee immediate Cursor availability.

The extension ID changed from `local-science.vivi` to `Suzuka24.vivi` in 0.6.1. Keep `publisher` and `name` unchanged in future releases. Existing development installations need the old ID removed after the new package is installed.

## Release preparation

1. Review [README.md](README.md), [README.zh-CN.md](README.zh-CN.md), [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and the current [menu coverage](docs/imagej-menu-coverage.md). Confirm that the promised commands work on local and Remote SSH hosts.
2. Increase the three-part `version` in `package.json`; add a matching entry to `changelog.md`.
3. Run the project checks and package from the repository root:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run check
   pnpm test
   .venv/bin/python -m unittest discover -s tests -p 'test_*.py' -q
   pnpm run package
   ```

4. Inspect the VSIX file list with `pnpm exec vsce ls` or unzip the VSIX. The marketplace icon must be PNG (at least 128×128), and the package must contain the worker, LUT data, webview files, license, and README. Never include credentials, data files, or a virtual environment.
5. Install the VSIX in clean VS Code and Cursor profiles. Test a local image and a Remote SSH image. Python packages are a separate host-side prerequisite and are **not** bundled in the VSIX.

## VS Code: Visual Studio Marketplace

1. Sign in with a Microsoft account and create an Azure DevOps organization if needed.
2. In [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/), create or obtain the **Suzuka24** publisher. The publisher ID must match `package.json`. Confirm that this ID is available and owned by the account that will publish.
3. Configure the publishing credential described by the [official VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension). As of September 2026, the guide documents an Azure DevOps Personal Access Token with **Marketplace → Manage** scope; Microsoft says global PATs retire on December 1, 2026, so plan to move to its Microsoft Entra ID automated publishing route before that date.
4. Upload the prepared VSIX in the publisher management portal, or use authenticated `vsce publish`. Keep tokens in a password manager or CI secret, never in the repository or command logs.
5. Check the listing at `https://marketplace.visualstudio.com/items?itemName=Suzuka24.vivi`, including README links, icon, version, and installability.

## Cursor: Open VSX

1. Create an Eclipse account, sign in to [Open VSX](https://open-vsx.org/), complete the Eclipse login linkage, and accept its Publisher Agreement as described in the [Open VSX publishing guide](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions).
2. Create an Open VSX access token in your profile and create or gain contributor access to the **Suzuka24** namespace. A newly created namespace can publish without the optional verified-owner badge. Ownership can be [claimed separately](https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access).
3. From a trusted shell with a securely supplied `OVSX_PAT` environment variable, create the namespace if needed and publish the **same** VSIX:

   ```bash
   npx ovsx create-namespace Suzuka24 -p "$OVSX_PAT"
   npx ovsx publish vivi-0.6.1.vsix -p "$OVSX_PAT"
   ```

   Do not run `create-namespace` if the namespace already exists and belongs to another account; request access or choose a new publisher ID before first public release. Do not commit or paste the token into an issue.
4. Check `https://open-vsx.org/extension/Suzuka24/vivi`. Then search for **vivi** in Cursor. Cursor's [extension documentation](https://prod.cursor.com/help/customization/extensions) explains that extensions come through its Open VSX-based proxy and may be held for security review.

The [Cursor plugin submission page](https://prod.cursor.com/docs/reference/plugins) is for Agent Plugins with a `plugin.json` manifest. It is not the submission path for this VS Code-compatible image viewer.

## After publication

- Announce the two verified listings in the README and release notes; do not link to a listing before it exists.
- Create a GitHub Release for the same version and attach the VSIX if direct installation should remain available.
- For each later release, publish the same incremented version to **both** registries, then confirm Cursor search and installation after its review.
