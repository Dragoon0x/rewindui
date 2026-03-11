# Publishing REWIND to npm

## Pre-flight

- [ ] Node.js 18+ installed
- [ ] npm account ([npmjs.com/signup](https://www.npmjs.com/signup))
- [ ] GitHub Desktop installed

---

## Step 1: Check the name

```bash
npm view rewindui
```

If taken, change `"name"` in `package.json` to `@dragoon0x/rewindui` or another name.

---

## Step 2: GitHub Desktop

1. Open GitHub Desktop
2. **File → Add Local Repository** → pick the `rewindui` folder
3. Click **Create a Repository**
4. Name: `rewindui`, click **Create Repository**
5. Commit message: `initial commit` → **Commit to main**
6. **Publish repository** → uncheck private → **Publish**

---

## Step 3: Terminal

```bash
cd path/to/rewindui
npm install
npm run build
npm test
```

You should see: 60 tests passing, clean build with ESM + CJS + types.

---

## Step 4: Publish

```bash
npm login
npm publish
```

If the name is taken:

```bash
npm publish --access=public
```

(after changing name to `@dragoon0x/rewindui` in package.json)

---

## Step 5: Verify

```bash
npm view rewindui
```

---

## Updating

```bash
npm version patch   # 0.1.0 → 0.1.1
npm run build
npm test
npm publish
```

Push in GitHub Desktop.

---

## Quick reference

| Command | What it does |
|---------|-------------|
| `npm run build` | Compile TS → dist/ (ESM + CJS + types) |
| `npm test` | Run 60 tests |
| `npm publish` | Publish to npm |
| `npm pack --dry-run` | Preview what gets published |
