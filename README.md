# Tekma

Strona marketingowa tekma.app: statyczny HTML/CSS/JS w `site/` (bez builda).

## Deploy
Każdy push do `main`, który zmienia `site/`, uruchamia `.github/workflows/deploy.yml` i wysyła zawartość `site/` przez FTP (lftp, TLS gdy dostępny; port z sekretu `FTP_PORT`, domyślnie 21).

Sekrety (Settings → Secrets and variables → Actions): `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, opcjonalnie `FTP_PORT`, `FTP_REMOTE_DIR`.

## Lokalny podgląd
`cd site && python3 -m http.server 8000`

Fonty: Inter (SIL OFL), pliki w `site/assets/fonts/`.
