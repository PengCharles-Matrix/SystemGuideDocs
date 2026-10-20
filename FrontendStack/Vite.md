# Vite

## Purpose

Vite provides the development server, fast module replacement, and production build pipeline for the frontend.

## Required role

Vite is the enforced frontend build tool. Do not replace it with another frontend bundler for the standard project.

## Common commands

```bash
npm run dev
npm run build
npm run preview
```

## Network access

System Guide Docs is configured to bind Vite to **0.0.0.0**, so the development server and production preview can accept connections from other machines on the network.

The current configuration uses:

- Development: port **5173**
- Production preview: port **4173**
- Host binding: **0.0.0.0**

You can also explicitly start the development server with:

```bash
npm run dev -- --host
```

This is redundant with the project configuration, but is useful when testing the setting from the command line.

### Local network access

After starting the development server, Vite prints a Network URL such as:

```text
http://192.168.100.28:5173/
```

Another device on the same LAN can open that address if the network permits connections to port 5173.

### Public internet access

Binding to `0.0.0.0` does **not** by itself expose the application to the internet.

For public access, the machine or hosting provider must allow the relevant port through its firewall/security group. A home/router connection also requires port forwarding from the router to the machine.

For production, prefer serving the built application through a reverse proxy or proper web server rather than exposing the Vite development server directly.

### Host security

Vite's host checking should not be disabled globally unless there is a specific reason. When using a domain or hostname, configure only the required allowed hostnames in `vite.config.ts`.

Do not use a blanket `allowedHosts: true` setting for a publicly exposed server unless the security implications are understood.

## Current configuration

The project `vite.config.ts` contains:

```ts
server: { host: "0.0.0.0", port: 5173 },
preview: { host: "0.0.0.0", port: 4173 },
```

## Verification

Confirm both the Vite configuration and the actual listening socket before troubleshooting network access.

Example:

```bash
ss -ltnp | grep -E ':5173|:4173'
```

Expected development output includes:

```text
0.0.0.0:5173
```

Expected preview output includes:

```text
0.0.0.0:4173
```
