# clipcraft — interfața

Aici stă **doar fața** aplicației: paginile, stilul și scriptul care desenează totul.
Vercel o servește ca pagină statică.

**Motorul nu e aici și nu poate fi.** Căutarea clipurilor, descărcarea lor, vocea și
montajul au nevoie de yt-dlp, ffmpeg și de joburi care țin minute. Alea rulează pe
calculatorul lui Sergiu, din `D:\claude management\03-skills\clipcraft`.

## Cum se leagă

1. Pe calculator: `porneste-retea.bat` (pornește aplicația), apoi `porneste-tunel.bat`
   (scoate un link public `https://....trycloudflare.com`).
2. Pe pagina de aici, la prima deschidere apare o fereastră: pui adresa tunelului și
   cheia. Se țin minte în browser, nu se trimit nicăieri altundeva.
3. De atunci, pagina de pe Vercel comandă motorul de acasă.

Dacă deschizi aplicația direct de pe calculator (`http://127.0.0.1:3200`), nu trebuie
configurat nimic — interfața și motorul sunt în același loc.

## Ce se schimbă aici

Fișierele sunt copii din `clipcraft/web/`. Dacă se modifică interfața, se copiază din nou
și se face push; Vercel publică singur.

| aici | în aplicație |
|---|---|
| `index.html` | `web/index.html` |
| `prezentare.html` | `web/prezentare.html` |
| `static/app.js` | `web/app.js` |
| `static/stil.css` | `web/stil.css` |
| `static/media/` | `web/media/` |
