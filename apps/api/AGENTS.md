# API implementation rules

- Keep controllers free of business rules.
- Put domain decisions and ownership checks in services.
- Access persistence only through module repositories.
- Do not import another module's internal service or repository.
- Never log cookies, tokens, passwords, signed URLs, file content, or personal data.
- Every new endpoint must already exist in `docs/api/openapi.yaml`, or update the contract first.
- Use stable error codes and attach a trace ID at the HTTP boundary.
- Add positive, negative authorization, state-transition, and concurrency tests in proportion to risk.
