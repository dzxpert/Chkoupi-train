# Chkoupi-lang Docs 🇩🇿

Interactive documentation and tutorials for **Chkoupi-lang** — built on Wrangler

**Live site → [train.brauh.tech](https://train.brauh.tech)**

---

## What's inside

- W3Schools-style docs covering all language features (variables, types, operators, control flow, functions, I/O, and more)
- Live **"Try it"** editor powered by CodeMirror 6 with a full in-browser Chkoupi interpreter
- Syntax highlighting, run output, reset, `Ctrl+Enter` shortcut

## Stack

| Layer | Tech |
|---|---|
| Hosting | Cloudflare Workers (via Wrangler) |
| Editor | CodeMirror 6 (local esbuild bundle) |
| Interpreter | Custom tree-walk interpreter in `public/app.js` |
| Styling | Vanilla CSS — dark theme, Algerian green/red palette |

## Dev

```powershell
npm install
npx wrangler dev   # → http://localhost:8787
```

## Rebuild the CM6 bundle

Only needed if you update CodeMirror versions:

```powershell
node build-cm.mjs
```

## Deploy

```powershell
npx wrangler deploy
```
