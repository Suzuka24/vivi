# Security policy

## Supported versions

Security fixes target the latest published vivi release.

## Reporting a vulnerability

Use this repository's GitHub private vulnerability reporting feature if it is enabled. If it is unavailable, open a minimal issue asking for a private contact method without including exploit details. Do not post private images, server paths, credentials, or proof-of-concept data in a public issue.

Include the affected vivi and editor versions, operating system, local/Remote SSH configuration, impact, and a minimal reproduction outline.

## Security boundaries

vivi can browse any path that the extension-host user can access. Explorer Rename/Delete and terminal path insertion are user-triggered actions; display operations read source images and usually write temporary results. The Python worker runs with the extension-host user's permissions. Install vivi and its Python dependencies only on hosts and environments you trust, and review who can access the host's temporary directory and workspace.
