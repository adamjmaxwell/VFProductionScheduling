# Matt Planner / VF Production Scheduling

This repository owns the standalone planner application. Contributors need write
access here only; no FMDS repository access or deployment credentials are needed.

## Local development

Run `npm ci`, `npm test -- --runInBand`, then `npm start` (port 3000).
Standalone login behavior is unchanged. Local JSON state is stored in ignored
`data/*.json` files. Do not commit secrets or operational records.

## FMDS hosting preparation

The planned route is `https://app.voyagefoodsos.com/matt-planner/`. The FMDS gateway
owns login, planner-section access and edit permission. `FMDS_HOSTED=true`
enables trusted gateway identity, disables local login and user management,
and avoids seeding a default administrator. The Cloud Run service must be private
and invokable only by the gateway and release smoke identity. These HTTP headers
are not authentication on a public service.

UI requests use relative API and stylesheet paths for the mounted prefix.
Hosted users return to FMDS through the existing sign-out control; FMDS owns
their session. App code stays here; FMDS will own source pins, private runtime
configuration, and immutable production promotion after integration is complete.

**Not production-ready yet:** the JSON filesystem store requires durable storage
and an explicit decision between planning scenarios and Masterdata-owned live
production records. Browser React/Babel CDN scripts also need bundling for the
FMDS content-security policy. Existing dependency-audit findings need triage.
Do not configure the FMDS backend URL until these steps and hosted smoke pass.
No old database or Cin7 credentials are imported by this preparation change.
