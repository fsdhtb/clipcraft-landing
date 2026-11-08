# clipcraft — pagina de prezentare

Pagină statică, un singur fișier `index.html` plus folderul `media/`. Fără build, fără
dependențe: orice gazdă de fișiere statice o servește ca atare.

## Cum ajunge pe Vercel, prin GitHub

1. Faci un repo nou pe GitHub (gol, fără README).
2. Din folderul ăsta:

```bash
git remote add origin https://github.com/<contul-tau>/clipcraft-landing.git
```

```bash
git push -u origin main
```

3. Pe [vercel.com/new](https://vercel.com/new) alegi repo-ul. La „Framework Preset" lași
   **Other**, la „Build Command" nu pui nimic, la „Output Directory" lași gol (rădăcina).
4. Deploy. De atunci, orice `git push` o publică din nou singură.

## Ce schimbi înainte să o faci publică

- **Videoul demo** (`media/demo.mp4`) e montat din trei clipuri publice de YouTube, ca
  dovadă că aplicația funcționează. Clipurile aparțin celor care le-au filmat. Dacă pagina
  devine publică, pune în loc o reclamă montată din materialul tău sau al furnizorului tău,
  plus cadrele din `media/cadru-*.jpg`.
- **Butonul „Ia-l de pe GitHub"** din secțiunea finală trimite deocamdată la github.com.
  Pune linkul repo-ului tău.
- Dacă vrei formular de înscriere în loc de buton, se adaugă în secțiunea `#final`.

## Local

Orice server static merge:

```bash
npx --yes serve .
```
