# Security and data handling

This is a new self-hostable application. Its controls are tested, but it has not undergone an independent security assessment.

Please use GitHub's private vulnerability reporting for security issues when available. Do not include real customer records, passwords, recovery codes, or session cookies in public issues. A reproducible report using synthetic records is sufficient.

The production deployment must use HTTPS, an exact APP_ORIGIN and persistent SQLite storage. Run one application instance. Trust the reverse proxy only when the backend is inaccessible through an untrusted route. See docs/OPERATIONS.md for backup and recovery.

The browser's offline copy is not application-level encrypted. Use a trusted device. Sign out after resolving pending changes to clear the device copy. Cached offline data cannot be remotely erased while the device is disconnected.

Sessions use HttpOnly, SameSite=Lax cookies, and Secure in production. Passwords use salted scrypt hashes. Recovery uses a single-use code. Email verification, roles, SSO and distributed throttling are not implemented.

The graph organizes entered records. Evidence references and audit hashes are not third-party verification or independent signatures. A stored path or lack of a path must not be treated as a determination that food is safe or unsafe.
