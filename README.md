# FY27 CoE Portfolio Pulse

Static executive dashboard for `FY27 Program Status_CoE.xlsx`.

## Publish with GitHub Pages

1. In Terminal, from this folder, run `gh auth login` and complete the browser sign-in.
2. Create a private or public repository and push this folder:

```sh
git init
git add index.html "FY27 Program Status_CoE.xlsx" .github/workflows/pages.yml README.md
git commit -m "Add FY27 CoE portfolio dashboard"
gh repo create fy27-coe-portfolio-pulse --source=. --remote=origin --push
```

3. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. The workflow deploys the site automatically. The share link will be:

`https://<your-github-username>.github.io/fy27-coe-portfolio-pulse/`

The Excel workbook must remain in the repository beside `index.html`; the dashboard reads it on load. Do not commit confidential data to a public repository.

## Local preview

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765`.

## V2 bidirectional concept

The `V2` folder contains the Google Apps Script connector for a live, authenticated version. V2 uses the team Google Sheet as the source of truth and supports dashboard-to-sheet updates, including new rows and columns. Deploy V2 only through an authenticated company platform; keep V1 as the static fallback.
