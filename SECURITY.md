# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, use GitHub's private vulnerability reporting on
[japofc/japqr](https://github.com/japofc/japqr/security/advisories/new),
or contact the maintainer directly through the profile listed on the repository.

You should expect an initial response within 72 hours. If a fix is warranted, a
patch release will be issued and the reporter credited in the release notes
unless they prefer otherwise.

## Scope

This package is a pure QR Code encoder: it takes a string or byte array and
returns a matrix or an SVG string. It performs **no network access, no file
system access and no code evaluation**, which keeps the attack surface small.

Out of scope:

- Vulnerabilities in the runtime (Node.js, Bun, Deno, browsers).
- Vulnerabilities in consumer code that uses the generated QR Code.
- Social-engineering issues around QR Code destinations.

## Disclosure timeline

| Stage | Target |
| --- | --- |
| Acknowledgement | 72 hours |
| Triage and severity assessment | 7 days |
| Fix released | 30 days for high severity, next minor for low severity |
