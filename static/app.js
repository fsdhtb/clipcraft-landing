// Interfața clipcraft. Fără framework: o pagină, un obiect de stare, fetch.
const S = {
  config: null,
  proiect: null,
  voci: [],
  modele: [],
  filtruVoce: "active",
  pas: "produs",
  audio: new Audio(),
  poll: null,
  aratRespinse: false,
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const durataText = (s) => (!s ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const mii = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n || 0));
const listaDin = (text) => String(text ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

// Motorul: de obicei e chiar serverul care a servit pagina. Dar când interfața stă
// pe Vercel, motorul rămâne pe calculatorul tău, la capătul unui tunel — atunci
// adresa și cheia lui se țin aici.
const MOTOR = {
  baza: (localStorage.getItem("clipcraft-motor") || "").replace(/\/+$/, ""),
  cheie: localStorage.getItem("clipcraft-cheie") || "",
};

function url(cale) {
  if (!MOTOR.baza) return cale;
  try {
    const u = new URL(cale, MOTOR.baza);
    if (MOTOR.cheie) u.searchParams.set("cheie", MOTOR.cheie);
    return u.toString();
  } catch {
    return cale;
  }
}

async function api(cale, optiuni = {}) {
  const antete = { "content-type": "application/json" };
  if (MOTOR.cheie) antete["x-clipcraft"] = MOTOR.cheie;
  let r;
  try {
    r = await fetch(url(cale), {
      method: optiuni.metoda ?? "GET",
      headers: antete,
      body: optiuni.corp ? JSON.stringify(optiuni.corp) : undefined,
    });
  } catch (e) {
    aratMotor(`Nu ajung la motor: ${String(e.message ?? e).slice(0, 80)}`);
    throw e;
  }
  if (r.status === 401) {
    aratMotor("Cheia nu e bună sau lipsește.");
    throw new Error("fără cheie");
  }
  const tip = r.headers.get("content-type") ?? "";
  if (!tip.includes("application/json")) {
    aratMotor("La adresa asta nu răspunde aplicația. Pune adresa tunelului de pe calculatorul tău.");
    throw new Error("nu e motor acolo");
  }
  return r.json();
}

/* ---------------- motorul ---------------- */
function aratMotor(mesaj = "") {
  const d = $("#dialog-motor");
  if (!d) return;
  $("#motor-mesaj").textContent =
    mesaj || "Spune-mi la ce adresa ruleaza aplicatia si cu ce cheie.";
  $("#motor-baza").value = MOTOR.baza;
  $("#motor-cheie").value = MOTOR.cheie;
  if (!d.open) d.showModal();
}

function legaMotor() {
  $("#b-motor-inchide").onclick = () => $("#dialog-motor").close();
  $("#b-motor-salveaza").onclick = async () => {
    let baza = $("#motor-baza").value.trim();
    let cheie = $("#motor-cheie").value.trim();
    // Daca ai lipit linkul intreg, cu cheia in el, le despart eu.
    try {
      const u = new URL(baza);
      const dinLink = u.searchParams.get("cheie");
      if (dinLink) {
        cheie = cheie || dinLink;
        u.search = "";
        u.pathname = "/";
        baza = u.toString();
      }
    } catch {}
    MOTOR.baza = baza.replace(/\/+$/, "");
    MOTOR.cheie = cheie;
    $("#motor-baza").value = MOTOR.baza;
    $("#motor-cheie").value = MOTOR.cheie;
    localStorage.setItem("clipcraft-motor", MOTOR.baza);
    localStorage.setItem("clipcraft-cheie", MOTOR.cheie);
    $("#motor-stare").textContent = "incerc...";
    try {
      const r = await api("/api/stare");
      if (r?.unelte) {
        $("#motor-stare").textContent = "merge";
        $("#dialog-motor").close();
        location.reload();
      }
    } catch {
      $("#motor-stare").textContent = "tot nu merge";
    }
  };
}

/* ---------------- pornire ---------------- */
async function porneste() {
  legaMotor();
  try {
    S.config = await api("/api/stare");
  } catch {
    return; // dialogul cu motorul e deja deschis
  }
  deseneazaUnelte();
  umpleListe();
  legaEvenimente();
  const idSalvat = new URL(location.href).searchParams.get("id") ?? localStorage.getItem("clipcraft-proiect");
  if (idSalvat) await incarcaProiect(idSalvat);
  incarcaVoci();
}

function deseneazaUnelte() {
  const u = S.config.unelte;
  $("#u-ffmpeg").innerHTML = u.ffmpeg ? '<span class="da">da</span>' : '<span class="nu">lipsește</span>';
  $("#u-ytdlp").innerHTML = u.ytdlp ? `<span class="da">${u.ytdlp}</span>` : '<span class="nu">lipsește</span>';
  $("#u-11").innerHTML = u.elevenlabs ? '<span class="da">cheie ok</span>' : '<span class="nu">fără cheie</span>';
}

function umpleListe() {
  const c = S.config;
  const opt = (lista, valoare = "cod", eticheta = "nume") =>
    lista.map((x) => `<option value="${esc(x[valoare])}">${esc(x[eticheta])}</option>`).join("");

  $("#tipuri").innerHTML = c.tipuri
    .map((t) => `<button class="card" data-tip="${t.cod}"><div class="titlu">${esc(t.nume)}</div><div class="descriere">${esc(t.descriere)}</div></button>`)
    .join("");
  $("#narative").innerHTML = c.narative
    .map((n) => `<button class="card" data-narativ="${n.cod}"><div class="titlu">${esc(n.nume)}</div><div class="descriere">${esc(n.descriere)}</div></button>`)
    .join("");
  $("#hookuri").innerHTML = c.hookuri.map((h) => `<button class="pastila" data-hook="${h.cod}">${esc(h.nume)}</button>`).join("");
  $("#oferte").innerHTML = ["1+1 gratis", "Transport gratuit", "-50% azi", "Plată la livrare", "Retur 30 de zile"]
    .map((o) => `<button class="pastila" data-oferta="${esc(o)}">${esc(o)}</button>`)
    .join("");
  $("#surse").innerHTML = c.surse
    .map((s) => `<button class="pastila ${s.implicit ? "aleasa" : ""}" data-sursa="${s.cod}">${esc(s.nume)}</button>`)
    .join("");
  $("#b-format").innerHTML = Object.entries(c.formate).map(([cod, f]) => `<option value="${cod}">${esc(f.nume)}</option>`).join("");
  $("#b-ritm").innerHTML = opt(c.ritm);
  $("#b-pauze").innerHTML = opt(c.pauze);
  $("#b-sub-stil").innerHTML = opt(c.stiluri_subtitrare);
  $("#b-sub-font").innerHTML = opt(c.fonturi);
  $("#b-sub-animatie").innerHTML = opt(c.animatii);
  $("#b-muzica").innerHTML =
    '<option value="fara">Fără muzică</option>' + c.muzica.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  $("#limba-noua").innerHTML = c.limbi.map((l) => `<option value="${l.cod}">${l.steag} ${esc(l.nume)}</option>`).join("");
  $("#fb-motive").innerHTML = c.motive_feedback
    .map((m) => `<button class="pastila mica" data-motiv="${m.cod}">${esc(m.nume)}</button>`)
    .join("");

  if (c.link_public) {
    const b = $("#b-link");
    b.style.display = "";
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(c.link_public);
        b.textContent = "copiat";
        setTimeout(() => (b.textContent = "Link de partajat"), 1800);
      } catch {
        prompt("Trimite linkul asta:", c.link_public);
      }
    };
    b.title = c.link_public;
  }

  const inv = c.invatate;
  if (inv?.reclame > 0) {
    const text = `Am ținut minte ${inv.reclame} reclame. ${inv.motive.slice(0, 2).map((m) => m.nume.toLowerCase()).join(", ") || "nimic de corectat"}.`;
    $(".marca-sub").textContent = text;
  }
}

/* ---------------- proiect ---------------- */
async function incarcaProiect(id) {
  const r = await api(`/api/proiect/${id}`);
  if (r.eroare) {
    localStorage.removeItem("clipcraft-proiect");
    return;
  }
  S.proiect = r.proiect;
  localStorage.setItem("clipcraft-proiect", id);
  history.replaceState(null, "", `?id=${id}`);
  deseneazaTot();
  if (r.ocupat) pornestePoll();
}

function deseneazaTot() {
  deseneazaProdus();
  deseneazaDenumiri();
  deseneazaTipuri();
  deseneazaProblema();
  deseneazaClipuri();
  umpleBrief();
  deseneazaVoci();
  deseneazaRezultat();
  deseneazaJos();
  marcheazaPasi();
}

function deseneazaProdus() {
  const p = S.proiect?.produs;
  if (!p?.ok) {
    $("#card-produs").innerHTML = "";
    $("#panou-denumiri").style.display = "none";
    return;
  }
  $("#card-produs").innerHTML = `
    <div class="panou">
      <div class="rand" style="align-items:flex-start;gap:16px">
        ${p.poze?.[0] ? `<img src="${esc(p.poze[0])}" alt="" style="width:92px;height:92px;object-fit:cover;border-radius:10px;border:1px solid var(--linie)" />` : ""}
        <div style="flex:1;min-width:200px">
          <h2>${esc(p.nume)}</h2>
          <div class="mut">${esc(p.gazda)} ${p.pret ? `· ${esc(p.pret)}` : ""} ${p.marca ? `· ${esc(p.marca)}` : ""}</div>
          <p class="mut" style="margin:8px 0 0">${esc((p.descriere ?? "").slice(0, 240))}</p>
          ${p.videoclipuri_din_pagina?.length ? `<p class="mut" style="margin:8px 0 0">În pagină am găsit ${p.videoclipuri_din_pagina.length} videoclipuri. Le adaug în listă la căutare.</p>` : ""}
        </div>
      </div>
    </div>`;
  $("#panou-denumiri").style.display = "";
}

function deseneazaDenumiri() {
  const d = S.proiect?.denumiri ?? [];
  const steag = (cod) => S.config.limbi.find((l) => l.cod === cod)?.steag ?? "🏳";
  $("#denumiri").innerHTML = d.length
    ? `<div class="coloane c3">${d
        .map(
          (x, i) => `<div class="rand" style="gap:6px">
            <span style="font-size:18px">${steag(x.limba)}</span>
            <input type="text" value="${esc(x.termen)}" data-denumire="${i}" style="flex:1" />
            <button class="buton gol mic" data-sterge-denumire="${i}">×</button>
          </div>`
        )
        .join("")}</div>`
    : '<p class="mut">Nicio denumire încă. Apasă „Traduce automat" sau scrie-le tu.</p>';
}

function deseneazaProblema() {
  const p = S.proiect;
  if (!p) return;
  $("#p-problema").value = p.brief?.problema ?? "";
  const termeni = p.problema?.termeni ?? [];
  const steag = (cod) => S.config.limbi.find((l) => l.cod === cod)?.steag ?? "-";
  $("#termeni-problema").innerHTML = termeni.length
    ? `<div class="coloane c3">${termeni
        .map(
          (x, i) => `<div class="rand" style="gap:6px">
            <span style="font-size:18px">${steag(x.limba)}</span>
            <input type="text" value="${esc(x.termen)}" data-termen-problema="${i}" style="flex:1" />
            <button class="buton gol mic" data-sterge-problema="${i}">&times;</button>
          </div>`
        )
        .join("")}</div>`
    : '<p class="mut">Niciun termen inca. Scrie problema mai sus si apasa butonul de tradus.</p>';

  const areTip = (p.tipuri ?? []).includes("problema");
  $("#stare-problema").textContent = areTip
    ? termeni.length
      ? ""
      : "Ai bifat tipul Problema, dar n-ai termeni - nu voi cauta nimic pentru el."
    : "Bifeaza tipul Problema, fara produs mai sus, ca sa se caute si astea.";
}

function deseneazaTipuri() {
  const alese = S.proiect?.tipuri ?? [];
  $$("#tipuri .card").forEach((b) => b.classList.toggle("ales", alese.includes(b.dataset.tip)));
  const nrLimbi = S.proiect?.denumiri?.length ?? 0;
  $("#estimare-cautare").textContent = alese.length
    ? `${alese.length} tipuri × ${nrLimbi} limbi — durează cam ${Math.max(1, Math.round((alese.length * nrLimbi) / 5))} minute.`
    : "Alege măcar un tip.";
  const c = S.proiect?.cautare ?? {};
  $("#c-obligatorii").value = (c.obligatorii ?? []).join(", ");
  $("#c-interzise").value = (c.interzise ?? []).join(", ");
  $("#c-prag").value = Math.round((c.prag ?? 0.3) * 100);
  $("#et-prag").textContent = `${$("#c-prag").value}%`;
}

/* ---------------- clipuri ---------------- */
function potrivirePreferinte(c) {
  let bonus = 0;
  const titlu = (c.titlu ?? "").toLowerCase();
  const val = (id) => $(id).value;
  if (val("#f-orientare") === "vertical") {
    if (!c.probabil_vertical) return { ascuns: true, bonus };
    bonus += 2;
  }
  if (val("#f-orientare") === "orizontal" && c.probabil_vertical) bonus -= 1;
  const d = c.durata || 0;
  const cerinta = val("#f-durata");
  if (cerinta === "scurt" && d && d > 70) return { ascuns: true, bonus };
  if (cerinta === "mediu" && d && (d < 55 || d > 320)) return { ascuns: true, bonus };
  if (cerinta === "lung" && d && d < 300) return { ascuns: true, bonus };
  const cuvinte = {
    cu: ["review", "i tried", "testing", "my", "vlog", "unboxing", "parerea"],
    fara: ["close up", "4k", "macro", "no talking", "asmr", "satisfying"],
    casa: ["home", "kitchen", "bathroom", "casa", "acasa", "indoor"],
    afara: ["outdoor", "garden", "yard", "afara", "gradina", "car"],
    curat: ["no talking", "asmr", "4k", "cinematic"],
  };
  for (const [cod, lista] of Object.entries(cuvinte)) {
    const activ = [val("#f-oameni"), val("#f-loc"), val("#f-text")].includes(cod);
    if (activ && lista.some((k) => titlu.includes(k))) bonus += 2;
  }
  return { ascuns: false, bonus };
}

function clipuriFiltrate() {
  let lista = (S.proiect?.clipuri ?? []).map((c) => {
    const pref = potrivirePreferinte(c);
    return { ...c, ascuns: pref.ascuns, scorFinal: (c.scor ?? 0) + pref.bonus };
  });
  const f = (id) => $(id).value;
  if (!S.aratRespinse) lista = lista.filter((c) => !c.respins || c.ales);
  if (f("#fc-sursa")) lista = lista.filter((c) => c.sursa === f("#fc-sursa"));
  if (f("#fc-limba")) lista = lista.filter((c) => c.limba === f("#fc-limba"));
  if (f("#fc-tip")) lista = lista.filter((c) => String(c.tip ?? "").includes(f("#fc-tip")));
  if ($("#fc-alese").checked) lista = lista.filter((c) => c.ales);
  lista = lista.filter((c) => !c.ascuns || c.ales);
  const sortare = f("#fc-sortare");
  lista.sort((a, b) =>
    sortare === "durata" ? (b.durata || 0) - (a.durata || 0) : sortare === "vizualizari" ? (b.vizualizari || 0) - (a.vizualizari || 0) : b.scorFinal - a.scorFinal
  );
  return lista;
}

function deseneazaClipuri() {
  const toate = S.proiect?.clipuri ?? [];
  const steag = (cod) => S.config.limbi.find((l) => l.cod === cod)?.steag ?? "";
  for (const [sel, camp] of [["#fc-sursa", "sursa"], ["#fc-limba", "limba"], ["#fc-tip", "tip"]]) {
    const valori = [...new Set(toate.flatMap((c) => String(c[camp] ?? "").split(",")).filter(Boolean))];
    const actual = $(sel).value;
    const prima = $(sel).options[0].textContent;
    $(sel).innerHTML = `<option value="">${prima}</option>` + valori.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    $(sel).value = actual;
  }
  const lista = clipuriFiltrate();
  const respinse = toate.filter((c) => c.respins).length;
  $("#numar-clipuri").innerHTML =
    `${lista.length} din ${toate.length} clipuri · ${toate.filter((c) => c.ales).length} alese` +
    (respinse ? ` · <button class="pastila mica" id="b-respinse">${S.aratRespinse ? "ascunde" : "arată"} ${respinse} aruncate</button>` : "");

  if (!toate.length) {
    $("#lista-clipuri").innerHTML = '<div class="gol-stare">Încă n-am căutat nimic. Pasul 2.</div>';
    return;
  }
  const roluri = ["", "hook", "problema", "demonstratie", "rezultat", "final"];
  $("#lista-clipuri").innerHTML = lista
    .map((c) => {
      const ordine = c.ales ? `<span class="ordine">${(c.ordine ?? 0) + 1}</span>` : "";
      const potrivit = c.potrivire !== undefined ? `${Math.round((c.potrivire ?? 0) * 100)}%` : "";
      return `<div class="clip ${c.ales ? "ales" : ""}" data-clip="${esc(c.id)}" style="${c.respins ? "opacity:.55" : ""}">
        <div class="poza" data-vezi="${esc(c.id)}">
          ${c.thumb ? `<img src="${esc(c.thumb)}" loading="lazy" alt="" />` : ""}
          <span class="sursa">${esc(c.sursa)}</span>
          ${c.durata ? `<span class="durata">${durataText(c.durata)}</span>` : ""}
          ${ordine}
        </div>
        <div class="corp">
          <div class="titlu">${esc(c.titlu || c.url)}</div>
          <div class="meta">
            <span>${steag(c.limba)} ${esc(c.canal || "")}</span>
            ${c.vizualizari ? `<span>· ${mii(c.vizualizari)}</span>` : ""}
            ${potrivit ? `<span>· potrivire ${potrivit}</span>` : ""}
          </div>
          ${c.are_text_ars ? '<div class="meta" style="color:var(--galben)">are text ars — îl acopăr la montaj</div>' : ""}
          ${c.respins ? `<div class="meta" style="color:var(--accent)">aruncat: ${esc(c.motiv_potrivire ?? "")}</div>` : ""}
          ${c.eroare_descarcare ? `<div class="meta" style="color:var(--accent)">nu s-a descărcat: ${esc(String(c.eroare_descarcare).slice(0, 60))}</div>` : ""}
          <div class="actiuni">
            <button class="buton ${c.ales ? "rosu" : "gol"} mic" data-alege="${esc(c.id)}">${c.ales ? "Ales" : "Alege"}</button>
            ${c.ales ? `<select data-rol="${esc(c.id)}">${roluri.map((r) => `<option value="${r}" ${c.rol === r ? "selected" : ""}>${r || "rol"}</option>`).join("")}</select>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");
  const b = $("#b-respinse");
  if (b) b.onclick = () => {
    S.aratRespinse = !S.aratRespinse;
    deseneazaClipuri();
  };
}

async function comutaClip(id) {
  const clipuri = S.proiect.clipuri;
  const c = clipuri.find((x) => x.id === id);
  if (!c) return;
  c.ales = !c.ales;
  const alese = clipuri.filter((x) => x.ales).sort((a, b) => (a.ordine ?? 999) - (b.ordine ?? 999));
  if (c.ales) c.ordine = alese.length - 1;
  alese.forEach((x, i) => (x.ordine = i));
  clipuri.filter((x) => !x.ales).forEach((x) => (x.ordine = undefined));
  deseneazaClipuri();
  deseneazaJos();
  await api(`/api/proiect/${S.proiect.id}`, {
    metoda: "PATCH",
    corp: { selectie: clipuri.map((x) => ({ id: x.id, ales: x.ales, ordine: x.ordine ?? null, rol: x.rol ?? "" })) },
  });
}

/* ---------------- brief ---------------- */
function umpleBrief() {
  const b = S.proiect?.brief;
  if (!b) return;
  const s = b.subtitrare ?? {};
  $("#b-format").value = b.format;
  $("#b-ritm").value = b.ritm;
  $("#b-incadrare").value = b.incadrare;
  $("#b-durata").value = b.durata;
  $("#b-sunet").value = b.sunet_clipuri;
  $("#b-pauze").value = b.pauze ?? "foarte-scurte";
  $("#b-muzica").value = b.muzica ?? "fara";
  $("#b-acopera").checked = b.acopera_text !== false;
  $("#b-benzi").checked = b.scoate_benzi !== false;
  $("#b-miscare").checked = b.miscare === "push-in";
  $("#b-oferta-proprie").value = b.oferta_proprie ?? "";
  $("#b-public").value = b.publicul ?? "";
  $("#b-problema").value = b.problema ?? "";
  $("#b-accent").value = b.accent ?? "";
  $("#b-cta").value = b.cta ?? "";
  $("#b-arata").value = b.arata ?? "";
  $("#b-evita").value = b.evita ?? "";
  $("#b-sub-stil").value = s.stil ?? "galben-karaoke";
  $("#b-sub-font").value = s.font ?? "Segoe UI Black";
  $("#b-sub-animatie").value = s.animatie ?? "pop";
  $("#b-sub-marime").value = s.marime ?? 76;
  $("#b-sub-pozitie").value = Math.round((s.pozitie ?? 0.74) * 100);
  $("#b-sub-cuvinte").value = s.cuvinte ?? 3;
  $("#b-sub-contur").value = s.contur ?? 6;
  $("#b-sub-culoare").value = `#${s.culoare ?? "FFFFFF"}`;
  $("#b-sub-activ").value = `#${s.activ ?? "FFD400"}`;
  $("#b-sub-caps").checked = s.caps ?? true;
  $("#b-sub-cuvant").checked = s.cuvant_cu_cuvant ?? true;
  $("#b-sub-cutie").checked = Boolean(s.cutie);
  $("#b-sub-activa").checked = s.activa !== false;
  etichetezaSub();
  $$("#narative .card").forEach((x) => x.classList.toggle("ales", x.dataset.narativ === b.narativ));
  $$("#hookuri .pastila").forEach((x) => x.classList.toggle("aleasa", x.dataset.hook === b.hook));
  $$("#oferte .pastila").forEach((x) => x.classList.toggle("aleasa", (b.oferte ?? []).includes(x.dataset.oferta)));
  if (S.proiect.script?.linii) $("#script").value = S.proiect.script.linii.join("\n");
  araticaVerificare(S.proiect.script?.verificare);
}

function etichetezaSub() {
  $("#et-marime").textContent = $("#b-sub-marime").value;
  $("#eticheta-pozitie").textContent = `${$("#b-sub-pozitie").value}% de sus`;
  $("#et-cuvinte").textContent = $("#b-sub-cuvinte").value;
  $("#et-contur").textContent = $("#b-sub-contur").value;
}

function araticaVerificare(v) {
  if (!v) return ($("#verificare-script").textContent = "");
  $("#verificare-script").innerHTML = v.ok
    ? `<span style="color:var(--verde)">${v.cuvinte} cuvinte · cam ${v.secundeEstimate}s de vorbit</span>`
    : `<span style="color:var(--galben)">${v.probleme.join(" ")}</span>`;
}

function citesteBrief() {
  return {
    format: $("#b-format").value,
    ritm: $("#b-ritm").value,
    incadrare: $("#b-incadrare").value,
    durata: Number($("#b-durata").value) || 22,
    sunet_clipuri: $("#b-sunet").value,
    pauze: $("#b-pauze").value,
    muzica: $("#b-muzica").value,
    acopera_text: $("#b-acopera").checked,
    scoate_benzi: $("#b-benzi").checked,
    miscare: $("#b-miscare").checked ? "push-in" : "fara",
    oferta_proprie: $("#b-oferta-proprie").value,
    publicul: $("#b-public").value,
    problema: $("#b-problema").value,
    accent: $("#b-accent").value,
    cta: $("#b-cta").value,
    arata: $("#b-arata").value,
    evita: $("#b-evita").value,
    narativ: $(".card.ales[data-narativ]")?.dataset.narativ ?? S.proiect.brief.narativ,
    hook: $(".pastila.aleasa[data-hook]")?.dataset.hook ?? S.proiect.brief.hook,
    oferte: $$("#oferte .pastila.aleasa").map((x) => x.dataset.oferta),
    subtitrare: {
      activa: $("#b-sub-activa").checked,
      stil: $("#b-sub-stil").value,
      font: $("#b-sub-font").value,
      animatie: $("#b-sub-animatie").value,
      marime: Number($("#b-sub-marime").value) || 76,
      pozitie: Number($("#b-sub-pozitie").value) / 100,
      cuvinte: Number($("#b-sub-cuvinte").value) || 3,
      contur: Number($("#b-sub-contur").value),
      culoare: $("#b-sub-culoare").value.replace("#", "").toUpperCase(),
      activ: $("#b-sub-activ").value.replace("#", "").toUpperCase(),
      caps: $("#b-sub-caps").checked,
      cuvant_cu_cuvant: $("#b-sub-cuvant").checked,
      cutie: $("#b-sub-cutie").checked,
    },
  };
}

let ceasBrief = null;
function salveazaBrief(cuPreviz = false) {
  etichetezaSub();
  clearTimeout(ceasBrief);
  ceasBrief = setTimeout(async () => {
    if (!S.proiect) return;
    const r = await api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { brief: citesteBrief() } });
    S.proiect = r.proiect;
    if (cuPreviz) ceraPreviz();
  }, 400);
}

let ceasPreviz = null;
function ceraPreviz() {
  clearTimeout(ceasPreviz);
  ceasPreviz = setTimeout(async () => {
    if (!S.proiect) return;
    $("#previz-stare").textContent = "desenez…";
    const r = await api(`/api/proiect/${S.proiect.id}/previzualizare`, {
      metoda: "POST",
      corp: { ce: "subtitrare", subtitrare: citesteBrief().subtitrare, format: $("#b-format").value, incadrare: $("#b-incadrare").value },
    });
    $("#previz-stare").textContent = r.eroare ?? "";
    if (r.imagine) $("#previz-sub").src = url(r.imagine);
  }, 500);
}

/* ---------------- voci ---------------- */
async function incarcaVoci(reimprospateaza = false) {
  const r = await api(`/api/voci${reimprospateaza ? "?reimprospateaza=1" : ""}`);
  S.voci = r.voci ?? [];
  S.modele = r.modele ?? [];
  $("#v-model").innerHTML = (S.modele.length ? S.modele : [{ id: "eleven_multilingual_v2", nume: "Multilingual v2" }])
    .map((m) => `<option value="${esc(m.id)}">${esc(m.nume ?? m.id)}</option>`)
    .join("");
  const implicit = S.proiect?.voce?.model ?? "eleven_multilingual_v2";
  if ([...$("#v-model").options].some((o) => o.value === implicit)) $("#v-model").value = implicit;
  deseneazaVoci();
}

function deseneazaVoci() {
  let lista = S.voci;
  if (S.filtruVoce === "active") lista = lista.filter((v) => v.activa);
  if (S.filtruVoce === "ro") lista = lista.filter((v) => (v.limba ?? "").startsWith("ro"));
  if (!lista.length) lista = S.voci.slice(0, 12);
  const alesId = S.proiect?.voce?.voice_id;
  $("#voci").innerHTML = lista
    .map(
      (v) => `<div class="voce ${v.voice_id === alesId ? "aleasa" : ""}" data-voce="${esc(v.voice_id)}">
        <div class="info" data-alege-voce="${esc(v.voice_id)}">
          <div class="nume">${esc(v.nume)}</div>
          <div class="ton">${esc([v.gen === "female" ? "Feminină" : v.gen === "male" ? "Masculină" : v.gen, v.ton].filter(Boolean).join(" · "))}</div>
        </div>
        <button class="play" data-asculta="${esc(v.preview_url ?? "")}" title="Ascultă">▶</button>
      </div>`
    )
    .join("");
  const s = S.proiect?.voce?.setari ?? { stability: 0.45, similarity_boost: 0.8, style: 0.35 };
  $("#v-stabilitate").value = Math.round(s.stability * 100);
  $("#v-asemanare").value = Math.round(s.similarity_boost * 100);
  $("#v-stil").value = Math.round((s.style ?? 0.35) * 100);
  etichetezaSlidere();
  if (S.proiect?.voce?.fisier) {
    $("#audio-voce").src = url(`/fisier/${S.proiect.id}/audio/voce.mp3?t=${Date.now()}`);
    $("#audio-voce").style.display = "";
    $("#stare-voce").textContent = `${S.proiect.voce.durata}s`;
  }
}

function etichetezaSlidere() {
  $("#et-stabilitate").textContent = `${$("#v-stabilitate").value}%`;
  $("#et-asemanare").textContent = `${$("#v-asemanare").value}%`;
  $("#et-stil").textContent = `${$("#v-stil").value}%`;
}

/* ---------------- rezultat, feedback, corecturi ---------------- */
function deseneazaRezultat() {
  const i = S.proiect?.iesire;
  $("#panou-feedback").style.display = i?.video ? "" : "none";
  if (i?.video) deseneazaFeedback();
  if (!i?.video) {
    $("#rezultat").innerHTML = "";
    return;
  }
  const plan = S.proiect.plan;
  $("#rezultat").innerHTML = `<div class="panou"><div class="rezultat">
    <div>
      <video controls src="${url(`/fisier/${S.proiect.id}/iesire/reclama.mp4?t=${Date.now()}`)}"></video>
      <div class="rand" style="margin-top:10px">
        <a class="buton mic" href="${url(`/fisier/${S.proiect.id}/iesire/reclama.mp4`)}" download>Descarcă MP4</a>
        ${i.srt ? `<a class="buton gol mic" href="${url(`/fisier/${S.proiect.id}/iesire/reclama.srt`)}" download>Descarcă .srt</a>` : ""}
      </div>
    </div>
    <div>
      <h2>Ce a ieșit</h2>
      <p class="mut">${i.durata}s · ${i.latime}×${i.inaltime} · ${plan?.segmente?.length ?? 0} cadre · voce ${S.proiect.voce?.durata ?? "?"}s</p>
      <table class="tabel"><tr><th>#</th><th>Cadru</th><th>Din clip</th><th>Replica</th><th></th></tr>
      ${(plan?.segmente ?? [])
        .map((s, n) => {
          const clip = S.proiect.clipuri.find((c) => c.id === s.clip);
          return `<tr><td>${n + 1}</td><td>${s.durata}s</td><td><a href="${esc(clip?.url ?? "#")}" target="_blank" rel="noreferrer">${esc((clip?.titlu ?? s.clip).slice(0, 32))}</a> <span class="mut">${s.de_la}s</span></td><td class="mut">${esc((s.replica ?? "").slice(0, 34))}</td><td><button class="pastila mica" data-refa="${n}">refă</button></td></tr>`;
        })
        .join("")}
      </table>
    </div>
  </div></div>`;
  $$("[data-refa]").forEach((b) => {
    b.onclick = async () => {
      b.textContent = "refac…";
      await api(`/api/proiect/${S.proiect.id}/cadru/${b.dataset.refa}`, { metoda: "POST", corp: { motiv: "din interfață" } });
      pornestePoll();
    };
  });
}

/* Cu fiecare incercare nereusita, intreb mai exact. La a patra, ma opresc. */
function nivelIntrebari() {
  return Math.min(4, (S.proiect?.incercari ?? 0) + 1);
}

function deseneazaFeedback() {
  const p = S.proiect;
  if (!p?.iesire?.video) return;
  const nivel = nivelIntrebari();
  const abateri = p.iesire?.abateri ?? [];

  $("#fb-abateri").style.display = abateri.length ? "" : "none";
  if (abateri.length) {
    $("#fb-abateri").innerHTML =
      `<div class="cutie-atentie">Înainte să ți-o dau, am verificat-o față de ce am învățat și nu se potrivește la ${abateri.length}:` +
      `<ul style="margin:8px 0 0;padding-left:18px">${abateri
        .map((a) => `<li>${esc(a.ce)}: așteptam <b>${esc(String(a.asteptat))}</b>, e <b>${esc(String(a.gasit))}</b></li>`)
        .join("")}</ul></div>`;
  }

  if (p.escaladat || nivel >= 4) {
    $("#fb-titlu").textContent = "Am încercat de patru ori și tot nu iese";
    $("#fb-sub").textContent = "Mă opresc aici ca să nu-ți mai pierd timpul.";
    $("#fb-butoane").style.display = "none";
    $("#fb-specific").style.display = "none";
    $("#fb-escaladat").style.display = "";
    $("#fb-escaladat").innerHTML =
      `<div class="cutie-rea"><b>I-am semnalat lui Sergiu.</b><br />` +
      `Patru încercări pe reclama asta, cu tot ce mi-ai spus notat. ` +
      `Apare la el în <code>node cli.mjs lectii</code> și în <code>data/lectii.json</code>.<br />` +
      `<span class="mut">Dacă vrei totuși să mai încerci, apasă mai jos.</span>` +
      `<div class="rand" style="margin-top:10px"><button class="buton gol mic" id="b-fb-oricum">Mai încearcă oricum</button></div></div>`;
    $("#b-fb-oricum").onclick = async () => {
      $("#fb-escaladat").style.display = "none";
      $("#fb-butoane").style.display = "";
      await api(`/api/proiect/${p.id}/mai-incearca`, { metoda: "POST", corp: {} });
      pornestePoll();
    };
    return;
  }

  $("#fb-escaladat").style.display = "none";
  $("#fb-butoane").style.display = "";
  const titluri = {
    1: ["Cum a ieșit?", "Spune-mi pe față. Ce-mi zici aici schimbă și reclama asta, și setările următoarei."],
    2: ["A doua încercare — ce anume n-a mers?", "Hai mai exact, ca să nu mai dau pe lângă."],
    3: ["A treia încercare — mergem pe bucăți", "Întreb de tot ce poate fi greșit, ca următoarea să fie bună."],
  };
  $("#fb-titlu").textContent = titluri[nivel][0];
  $("#fb-sub").textContent = titluri[nivel][1];
}

/** Intrebarile pe bucati, de la a treia incercare incolo. */
function intrebariSpecifice() {
  const segmente = S.proiect?.plan?.segmente ?? [];
  const sel = (id, optiuni) =>
    `<select id="${id}">${optiuni.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
  return `
    <div class="coloane c3">
      <div><label class="eticheta">Ritmul</label>${sel("fs-ritm", [["", "e bun"], ["prea-rapid", "prea rapid"], ["prea-lent", "prea lent"]])}</div>
      <div><label class="eticheta">Vocea</label>${sel("fs-voce", [["", "e bună"], ["voce-pauze", "are pauze, sună lent"], ["voce-nepotrivita", "nu se potrivește"]])}</div>
      <div><label class="eticheta">Subtitrarea</label>${sel("fs-sub", [["", "e bună"], ["subtitrare-mica", "prea mică"], ["subtitrare-mare", "prea mare"], ["subtitrare-pozitie", "stă prost"]])}</div>
      <div><label class="eticheta">Lungimea</label>${sel("fs-durata", [["", "e bună"], ["prea-lunga", "prea lungă"], ["prea-scurta", "prea scurtă"]])}</div>
      <div><label class="eticheta">Scriptul</label>${sel("fs-script", [["", "e bun"], ["script-slab", "nu convinge"]])}</div>
      <div><label class="eticheta">Sunetul din clipuri</label>${sel("fs-sunet", [["", "e bun"], ["sunet", "deranjează"]])}</div>
    </div>
    <label class="eticheta">Care cadre nu sunt bune? <span class="optional">apasă pe ele</span></label>
    <div class="pastile" id="fs-cadre">${segmente
      .map((s, i) => `<button class="pastila mica" data-cadru-rau="${i}">${i + 1}. ${esc((s.replica ?? "").slice(0, 22))}</button>`)
      .join("")}</div>
    <label class="eticheta" for="fs-text">Și cu cuvintele tale, ce ar trebui să fie altfel?</label>
    <textarea id="fs-text" placeholder="ex. primul cadru arată ambalajul altcuiva; vocea se grăbește la final"></textarea>`;
}

function deseneazaCadrePentruFeedback() {
  const plan = S.proiect?.plan;
  if (!plan?.segmente) return;
  $("#lista-cadre").innerHTML = plan.segmente
    .map((s, n) => {
      const clip = S.proiect.clipuri.find((c) => c.id === s.clip);
      return `<div class="clip" style="cursor:pointer" data-cadru="${n}">
        <div class="poza">${clip?.thumb ? `<img src="${esc(clip.thumb)}" alt="" />` : ""}<span class="ordine">${n + 1}</span><span class="durata">${s.durata}s</span></div>
        <div class="corp"><div class="titlu">${esc((s.replica ?? "").slice(0, 44))}</div>
        <div class="meta">${esc((clip?.titlu ?? "").slice(0, 34))} · ${s.de_la}s</div></div>
      </div>`;
    })
    .join("");
  $$("[data-cadru]").forEach((el) => {
    el.onclick = async () => {
      el.style.opacity = 0.5;
      await api(`/api/proiect/${S.proiect.id}/feedback`, {
        metoda: "POST",
        corp: { verdict: "slab", motive: ["clip-prost"], cadru: Number(el.dataset.cadru), detalii: $("#fb-text").value },
      });
      await api(`/api/proiect/${S.proiect.id}/cadru/${el.dataset.cadru}`, { metoda: "POST", corp: { motiv: "ales de tine" } });
      pornestePoll();
      $("#fb-cadre").style.display = "none";
    };
  });
}

function pornestePoll() {
  clearInterval(S.poll);
  S.poll = setInterval(async () => {
    if (!S.proiect) return;
    const r = await api(`/api/proiect/${S.proiect.id}/jurnal`);
    const procent = r.stare?.procent ?? 0;
    const text = r.jurnal.map((j) => `${j.t.slice(11, 19)}  ${j.mesaj}`).join("\n");
    for (const tinta of [$("#progres-cautare"), $("#s-reclama")]) {
      const jurnal = tinta.querySelector(".jurnal");
      const bara = tinta.querySelector(".bara i");
      if (jurnal) {
        jurnal.textContent = text;
        jurnal.scrollTop = jurnal.scrollHeight;
      }
      if (bara) bara.style.width = `${procent}%`;
    }
    const et = $("#eticheta-stare");
    et.textContent = r.stare?.eroare ? "eroare" : r.ocupat ? r.stare?.pas ?? "lucrează" : r.stare?.pas ?? "gata";
    et.className = `eticheta-stare ${r.stare?.eroare ? "eroare" : r.ocupat ? "lucreaza" : "gata"}`;
    $("#stare-jos").textContent = r.stare?.mesaj ?? "";
    if (!r.ocupat) {
      clearInterval(S.poll);
      S.poll = null;
      await incarcaProiect(S.proiect.id);
    }
  }, 1200);
}

function deseneazaJos() {
  const p = S.proiect;
  if (!p) return ($("#stare-jos").textContent = "Niciun proiect deschis.");
  const alese = (p.clipuri ?? []).filter((c) => c.ales).length;
  $("#stare-jos").textContent = `${p.produs?.nume ?? p.url} · ${p.clipuri?.length ?? 0} clipuri găsite · ${alese} alese${p.voce ? ` · voce ${p.voce.durata}s` : ""}`;
}

function marcheazaPasi() {
  const p = S.proiect;
  const gata = {
    produs: Boolean(p?.produs?.ok),
    cautare: Boolean(p?.tipuri?.length),
    clipuri: Boolean(p?.clipuri?.some((c) => c.ales)),
    montaj: Boolean(p?.script?.linii?.length),
    voce: Boolean(p?.voce?.fisier),
    reclama: Boolean(p?.iesire?.video),
  };
  $$("#pasi button").forEach((b) => {
    b.classList.toggle("activ", b.dataset.pas === S.pas);
    b.classList.toggle("gata", Boolean(gata[b.dataset.pas]));
  });
}

function mergiLa(pas) {
  S.pas = pas;
  $$(".sectiune").forEach((s) => s.classList.toggle("activa", s.id === `s-${pas}`));
  marcheazaPasi();
  if (pas === "montaj" && S.proiect) ceraPreviz();
  if (pas === "depozit") incarcaDepozit();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- depozit ---------------- */
S.depozitAlese = new Set();

async function incarcaDepozit() {
  const tema = $("#dep-tema").value;
  const noi = $("#dep-noi").checked ? "&noi=1" : "";
  const d = await api(`/api/depozit?limita=80${tema ? `&tema=${tema}` : ""}${noi}`);
  S.depozit = d;

  if ($("#dep-tema").options.length <= 1) {
    $("#dep-tema").innerHTML =
      '<option value="">Toate temele</option>' +
      (d.teme_config ?? []).map((t) => `<option value="${esc(t.cod)}">${esc(t.nume)}</option>`).join("");
    $("#dep-tema").value = tema;
  }

  const a = d.agent ?? {};
  $("#stare-agent").textContent = d.activ ? "caută" : "oprit";
  $("#stare-agent").className = `eticheta-stare ${d.activ ? "lucreaza" : ""}`;
  $("#b-veghe").textContent = d.activ ? "Oprește agentul" : "Pornește agentul";
  $("#rezumat-agent").textContent = `${d.total} clipuri în depozit · ${a.runde ?? 0} runde · ultima ${a.ultima_runda ? a.ultima_runda.slice(11, 16) : "—"}`;
  $("#jurnal-agent").textContent = (d.jurnal ?? []).map((j) => `${j.t.slice(11, 19)}  ${j.mesaj}`).join("\n") || "Niciun jurnal încă.";
  $("#dep-numar").textContent = `${d.clipuri.length} afișate · ${S.depozitAlese.size} alese`;

  $("#lista-depozit").innerHTML = d.clipuri.length
    ? d.clipuri
        .map(
          (c) => `<div class="clip ${S.depozitAlese.has(c.id) ? "ales" : ""}" data-dep="${esc(c.id)}">
        <div class="poza">${c.thumb ? `<img src="${esc(c.thumb)}" loading="lazy" alt="" />` : ""}
          <span class="sursa">${esc(c.tema)}</span>
          ${c.durata ? `<span class="durata">${durataText(c.durata)}</span>` : ""}
        </div>
        <div class="corp">
          <div class="titlu">${esc((c.titlu || c.url).slice(0, 80))}</div>
          <div class="meta"><span>${esc(c.canal ?? "")}</span>${c.vizualizari ? `<span>· ${mii(c.vizualizari)}</span>` : ""}${c.folosit_in?.length ? "<span>· folosit</span>" : ""}</div>
          <div class="actiuni"><button class="buton ${S.depozitAlese.has(c.id) ? "rosu" : "gol"} mic" data-dep-alege="${esc(c.id)}">${S.depozitAlese.has(c.id) ? "Ales" : "Alege"}</button></div>
        </div>
      </div>`
        )
        .join("")
    : '<div class="gol-stare">Nimic încă. Pornește agentul sau apasă „Caută o dată acum".</div>';
}

/* ---------------- evenimente ---------------- */
function legaEvenimente() {
  $("#pasi").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-pas]");
    if (b) mergiLa(b.dataset.pas);
  });
  const ordine = ["produs", "cautare", "clipuri", "montaj", "voce", "reclama"];
  $("#b-inainte").onclick = () => mergiLa(ordine[Math.min(ordine.length - 1, ordine.indexOf(S.pas) + 1)]);
  $("#b-inapoi").onclick = () => mergiLa(ordine[Math.max(0, ordine.indexOf(S.pas) - 1)]);

  $("#b-citeste").onclick = async () => {
    const url = $("#url").value.trim();
    if (!url) return;
    $("#b-citeste").disabled = true;
    $("#b-citeste").textContent = "Citesc…";
    const r = await api("/api/proiecte", { metoda: "POST", corp: { url } });
    $("#b-citeste").disabled = false;
    $("#b-citeste").textContent = "Citește pagina";
    if (r.eroare) return alert(r.eroare);
    await incarcaProiect(r.proiect.id);
    if (!r.proiect.produs?.ok) alert("N-am putut citi pagina. Scrie denumirile de mână, restul merge la fel.");
    setTimeout(() => incarcaProiect(r.proiect.id), 3500);
  };

  $("#b-motor").onclick = () => aratMotor("Schimba adresa sau cheia motorului.");
  $("#b-proiecte").onclick = async () => {
    const r = await api("/api/proiecte");
    $("#dialog-titlu").textContent = "Proiectele tale";
    $("#dialog-corp").innerHTML = r.proiecte.length
      ? `<div style="padding:12px;display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow:auto">${r.proiecte
          .map(
            (p) => `<button class="card" data-deschide="${esc(p.id)}">
              <div class="titlu">${esc(p.nume)}</div>
              <div class="descriere">${p.clipuri} clipuri · ${p.alese} alese${p.iesire?.video ? " · are reclamă" : ""} · ${esc(String(p.creat).slice(0, 10))}</div>
            </button>`
          )
          .join("")}</div>`
      : '<div style="padding:24px" class="mut">Niciun proiect încă. Dă linkul unui produs la pasul 1.</div>';
    $("#dialog").showModal();
    $$("[data-deschide]").forEach((b) => {
      b.onclick = async () => {
        $("#dialog").close();
        await incarcaProiect(b.dataset.deschide);
        mergiLa("produs");
      };
    });
  };

  $("#denumiri").addEventListener("input", (e) => {
    const i = e.target.dataset.denumire;
    if (i === undefined) return;
    S.proiect.denumiri[Number(i)].termen = e.target.value;
    clearTimeout(ceasBrief);
    ceasBrief = setTimeout(() => api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { denumiri: S.proiect.denumiri } }), 500);
  });
  $("#denumiri").addEventListener("click", async (e) => {
    const i = e.target.dataset.stergeDenumire;
    if (i === undefined) return;
    S.proiect.denumiri.splice(Number(i), 1);
    deseneazaDenumiri();
    await api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { denumiri: S.proiect.denumiri } });
  });
  $("#b-adauga-denumire").onclick = async () => {
    const termen = $("#termen-nou").value.trim();
    if (!termen || !S.proiect) return;
    S.proiect.denumiri.push({ limba: $("#limba-noua").value, termen, sursa: "sergiu" });
    $("#termen-nou").value = "";
    deseneazaDenumiri();
    await api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { denumiri: S.proiect.denumiri } });
  };
  $("#b-traduce").onclick = async () => {
    $("#b-traduce").textContent = "Traduc…";
    const r = await api(`/api/proiect/${S.proiect.id}/denumiri`, { metoda: "POST", corp: { auto: true } });
    $("#b-traduce").textContent = "Traduce automat";
    S.proiect.denumiri = r.denumiri ?? [];
    deseneazaDenumiri();
    deseneazaTipuri();
  };

  $("#tipuri").addEventListener("click", async (e) => {
    const b = e.target.closest(".card");
    if (!b || !S.proiect) return;
    const tipuri = new Set(S.proiect.tipuri ?? []);
    tipuri.has(b.dataset.tip) ? tipuri.delete(b.dataset.tip) : tipuri.add(b.dataset.tip);
    S.proiect.tipuri = [...tipuri];
    deseneazaTipuri();
    deseneazaProblema();
    await api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { tipuri: S.proiect.tipuri } });
  });

  $("#surse").addEventListener("click", (e) => {
    const b = e.target.closest(".pastila");
    if (b) b.classList.toggle("aleasa");
  });
  $("#p-problema").addEventListener("input", () => {
    if (!S.proiect) return;
    S.proiect.brief.problema = $("#p-problema").value;
    clearTimeout(ceasBrief);
    ceasBrief = setTimeout(
      () => api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { brief: { problema: S.proiect.brief.problema } } }),
      500
    );
  });
  $("#b-traduce-problema").onclick = async () => {
    if (!S.proiect) return alert("Intai da linkul produsului.");
    if (!$("#p-problema").value.trim()) return alert("Scrie intai problema, intr-un rand.");
    await api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { brief: { problema: $("#p-problema").value } } });
    $("#b-traduce-problema").textContent = "Traduc...";
    const r = await api(`/api/proiect/${S.proiect.id}/problema`, { metoda: "POST", corp: { auto: true } });
    $("#b-traduce-problema").textContent = "Tradu in toate limbile";
    S.proiect.problema = { ...(S.proiect.problema ?? {}), termeni: r.termeni ?? [] };
    deseneazaProblema();
  };
  $("#termeni-problema").addEventListener("input", (e) => {
    const i = e.target.dataset.termenProblema;
    if (i === undefined) return;
    S.proiect.problema.termeni[Number(i)].termen = e.target.value;
    clearTimeout(ceasBrief);
    ceasBrief = setTimeout(
      () => api(`/api/proiect/${S.proiect.id}/problema`, { metoda: "POST", corp: { termeni: S.proiect.problema.termeni } }),
      500
    );
  });
  $("#termeni-problema").addEventListener("click", async (e) => {
    const i = e.target.dataset.stergeProblema;
    if (i === undefined) return;
    S.proiect.problema.termeni.splice(Number(i), 1);
    deseneazaProblema();
    await api(`/api/proiect/${S.proiect.id}/problema`, { metoda: "POST", corp: { termeni: S.proiect.problema.termeni } });
  });

  $("#c-prag").addEventListener("input", () => ($("#et-prag").textContent = `${$("#c-prag").value}%`));

  $("#b-cauta").onclick = async () => {
    if (!S.proiect) return alert("Întâi dă linkul produsului.");
    const surse = $$("#surse .pastila.aleasa").map((b) => b.dataset.sursa);
    if (!S.proiect.tipuri?.length) return alert("Alege măcar un tip de clip.");
    $("#progres-cautare").style.display = "";
    await api(`/api/proiect/${S.proiect.id}/cautare`, {
      metoda: "POST",
      corp: {
        surse,
        tipuri: S.proiect.tipuri,
        obligatorii: listaDin($("#c-obligatorii").value),
        interzise: listaDin($("#c-interzise").value),
        pragMinim: Number($("#c-prag").value) / 100,
      },
    });
    pornestePoll();
    mergiLa("clipuri");
  };

  for (const id of ["#f-oameni", "#f-orientare", "#f-durata", "#f-loc", "#f-text", "#f-vechime"]) {
    $(id).onchange = () => deseneazaClipuri();
  }
  for (const id of ["#fc-sursa", "#fc-limba", "#fc-tip", "#fc-sortare", "#fc-alese"]) {
    $(id).onchange = () => deseneazaClipuri();
  }

  $("#lista-clipuri").addEventListener("click", async (e) => {
    const alege = e.target.closest("[data-alege]");
    if (alege) return comutaClip(alege.dataset.alege);
    const vezi = e.target.closest("[data-vezi]");
    if (vezi) return previzualizeaza(vezi.dataset.vezi);
  });
  $("#lista-clipuri").addEventListener("change", async (e) => {
    const rol = e.target.dataset.rol;
    if (!rol) return;
    const c = S.proiect.clipuri.find((x) => x.id === rol);
    c.rol = e.target.value;
    await api(`/api/proiect/${S.proiect.id}`, { metoda: "PATCH", corp: { selectie: [{ id: c.id, ales: true, rol: c.rol }] } });
  });

  const campuriBrief = ["#b-format", "#b-ritm", "#b-incadrare", "#b-durata", "#b-sunet", "#b-pauze", "#b-muzica",
    "#b-acopera", "#b-benzi", "#b-miscare", "#b-oferta-proprie", "#b-public", "#b-problema", "#b-accent", "#b-cta",
    "#b-arata", "#b-evita"];
  const campuriSub = ["#b-sub-stil", "#b-sub-font", "#b-sub-animatie", "#b-sub-marime", "#b-sub-pozitie",
    "#b-sub-cuvinte", "#b-sub-contur", "#b-sub-culoare", "#b-sub-activ", "#b-sub-caps", "#b-sub-cuvant",
    "#b-sub-cutie", "#b-sub-activa"];
  for (const id of campuriBrief) {
    $(id).addEventListener("change", () => salveazaBrief(["#b-format", "#b-incadrare"].includes(id)));
    $(id).addEventListener("input", () => salveazaBrief(false));
  }
  for (const id of campuriSub) {
    $(id).addEventListener("change", () => salveazaBrief(true));
    $(id).addEventListener("input", () => {
      etichetezaSub();
      salveazaBrief(true);
    });
  }
  $("#b-sub-stil").addEventListener("change", async () => {
    // presetul rescrie toate reglajele, apoi le poți schimba una câte una
    const preset = S.config.stiluri_subtitrare.find((s) => s.cod === $("#b-sub-stil").value);
    if (!preset) return;
    $("#b-sub-font").value = preset.font;
    $("#b-sub-animatie").value = preset.animatie;
    $("#b-sub-contur").value = preset.contur;
    $("#b-sub-culoare").value = `#${preset.culoare}`;
    $("#b-sub-activ").value = `#${preset.activ}`;
    $("#b-sub-caps").checked = preset.caps;
    $("#b-sub-cutie").checked = preset.cutie;
    $("#b-sub-cuvinte").value = preset.cuvinte;
    salveazaBrief(true);
  });
  $("#b-previz").onclick = () => ceraPreviz();

  $("#narative").addEventListener("click", (e) => {
    const b = e.target.closest(".card");
    if (!b) return;
    $$("#narative .card").forEach((x) => x.classList.toggle("ales", x === b));
    salveazaBrief();
  });
  $("#hookuri").addEventListener("click", (e) => {
    const b = e.target.closest(".pastila");
    if (!b) return;
    $$("#hookuri .pastila").forEach((x) => x.classList.toggle("aleasa", x === b));
    salveazaBrief();
  });
  $("#oferte").addEventListener("click", (e) => {
    const b = e.target.closest(".pastila");
    if (!b) return;
    b.classList.toggle("aleasa");
    salveazaBrief();
  });

  $("#b-script-auto").onclick = async () => {
    const r = await api(`/api/proiect/${S.proiect.id}/script`, { metoda: "POST", corp: { auto: true } });
    $("#script").value = (r.script?.linii ?? []).join("\n");
    araticaVerificare(r.script?.verificare);
  };
  $("#b-script-claude").onclick = () => {
    const p = S.proiect;
    const text = `Scrie scriptul pentru reclama din proiectul clipcraft ${p.id} (${p.produs?.nume ?? p.url}).` +
      ` Narativ: ${p.brief.narativ}. Hook: ${p.brief.hook}. Durata: ${p.brief.durata}s.` +
      ` Apoi: node cli.mjs script ${p.id} <fisier.txt>`;
    navigator.clipboard?.writeText(text);
    alert("Am pus în clipboard comanda pentru Claude:\n\n" + text);
  };
  $("#b-salveaza-script").onclick = async () => {
    const r = await api(`/api/proiect/${S.proiect.id}/script`, { metoda: "POST", corp: { text: $("#script").value, sursa: "sergiu" } });
    S.proiect.script = r.script;
    araticaVerificare(r.script?.verificare);
    marcheazaPasi();
  };

  $$("[data-filtru-voce]").forEach((b) => {
    b.onclick = () => {
      S.filtruVoce = b.dataset.filtruVoce;
      $$("[data-filtru-voce]").forEach((x) => x.classList.toggle("aleasa", x === b));
      deseneazaVoci();
    };
  });
  $("#b-reimprospateaza-voci").onclick = () => incarcaVoci(true);
  $("#voci").addEventListener("click", async (e) => {
    const asculta = e.target.closest("[data-asculta]");
    if (asculta) {
      const url = asculta.dataset.asculta;
      if (!url) return alert("Vocea asta nu are previzualizare în cont.");
      S.audio.pause();
      S.audio = new Audio(url);
      S.audio.play();
      return;
    }
    const alege = e.target.closest("[data-alege-voce]");
    if (!alege || !S.proiect) return;
    const v = S.voci.find((x) => x.voice_id === alege.dataset.alegeVoce);
    S.proiect.voce = { ...(S.proiect.voce ?? {}), voice_id: v.voice_id, nume: v.nume };
    deseneazaVoci();
  });
  for (const id of ["#v-stabilitate", "#v-asemanare", "#v-stil"]) $(id).addEventListener("input", etichetezaSlidere);

  $("#b-voce").onclick = async () => {
    if (!S.proiect?.voce?.voice_id) return alert("Alege o voce.");
    if (!$("#script").value.trim()) return alert("N-ai script. Pasul 4.");
    await api(`/api/proiect/${S.proiect.id}/script`, { metoda: "POST", corp: { text: $("#script").value } });
    $("#stare-voce").textContent = "Generez…";
    await api(`/api/proiect/${S.proiect.id}/voce`, {
      metoda: "POST",
      corp: {
        voice_id: S.proiect.voce.voice_id,
        model: $("#v-model").value,
        setari: {
          stability: Number($("#v-stabilitate").value) / 100,
          similarity_boost: Number($("#v-asemanare").value) / 100,
          style: Number($("#v-stil").value) / 100,
        },
      },
    });
    pornestePoll();
  };

  $("#b-descarca-clipuri").onclick = async () => {
    await api(`/api/proiect/${S.proiect.id}/descarca`, { metoda: "POST" });
    pornestePoll();
  };
  $("#b-monteaza").onclick = async () => {
    if (!S.proiect?.voce?.fisier) return alert("Fă întâi vocea, la pasul 5.");
    const neDescarcate = S.proiect.clipuri.filter((c) => c.ales && !c.fisier).length;
    if (neDescarcate) {
      await api(`/api/proiect/${S.proiect.id}/descarca`, { metoda: "POST" });
      pornestePoll();
      const asteapta = setInterval(async () => {
        const r = await api(`/api/proiect/${S.proiect.id}/jurnal`);
        if (!r.ocupat) {
          clearInterval(asteapta);
          await api(`/api/proiect/${S.proiect.id}/montaj`, { metoda: "POST" });
          pornestePoll();
        }
      }, 1500);
      return;
    }
    await api(`/api/proiect/${S.proiect.id}/montaj`, { metoda: "POST" });
    pornestePoll();
  };

  /* ---- feedback ---- */
  $("#b-fb-bun").onclick = async () => {
    await api(`/api/proiect/${S.proiect.id}/feedback`, { metoda: "POST", corp: { verdict: "bun", motive: [] } });
    $("#fb-stare").textContent = "";
    $("#b-fb-bun").textContent = "Mulțumesc, am notat";
    $("#fb-detalii").style.display = "none";
    $("#fb-cadre").style.display = "none";
  };
  $("#b-fb-cadru").onclick = () => {
    $("#fb-cadre").style.display = "";
    $("#fb-detalii").style.display = "";
    deseneazaCadrePentruFeedback();
  };
  $("#b-fb-tot").onclick = () => {
    $("#fb-cadre").style.display = "none";
    if (nivelIntrebari() >= 3) {
      $("#fb-detalii").style.display = "none";
      $("#fb-specific").style.display = "";
      $("#fb-specific").innerHTML =
        intrebariSpecifice() +
        '<div class="rand" style="margin-top:12px"><button class="buton rosu" id="b-fs-trimite">Trimite și refă</button>' +
        '<span class="mut" id="fs-stare"></span></div>';
      $("#fs-cadre").addEventListener("click", (e) => {
        const b = e.target.closest(".pastila");
        if (b) b.classList.toggle("aleasa");
      });
      $("#b-fs-trimite").onclick = () => trimiteFeedback("specific");
      return;
    }
    $("#fb-specific").style.display = "none";
    $("#fb-detalii").style.display = "";
    $("#fb-stare").textContent = "Spune-mi ce n-a mers și refac toată reclama, cu alte momente din aceleași clipuri.";
  };
  $("#fb-motive").addEventListener("click", (e) => {
    const b = e.target.closest(".pastila");
    if (b) b.classList.toggle("aleasa");
  });
  async function trimiteFeedback(sursa) {
    const stare = sursa === "specific" ? $("#fs-stare") : $("#fb-stare");
    let motive = [];
    let detalii = "";
    let cadreRele = [];
    if (sursa === "specific") {
      motive = ["#fs-ritm", "#fs-voce", "#fs-sub", "#fs-durata", "#fs-script", "#fs-sunet"]
        .map((id) => $(id)?.value)
        .filter(Boolean);
      cadreRele = $$("#fs-cadre .pastila.aleasa").map((b) => Number(b.dataset.cadruRau));
      if (cadreRele.length) motive.push("cadre-gresite");
      detalii = $("#fs-text").value.trim();
      if (!motive.length && !detalii) {
        stare.textContent = "Alege măcar ceva, altfel refac la fel.";
        return;
      }
    } else {
      motive = $$("#fb-motive .pastila.aleasa").map((b) => b.dataset.motiv);
      detalii = $("#fb-text").value.trim();
    }

    stare.textContent = "Am notat…";
    const r = await api(`/api/proiect/${S.proiect.id}/feedback`, {
      metoda: "POST",
      corp: { verdict: "slab", motive, detalii, cadre: cadreRele },
    });

    const noiReguli = (r.invatate ?? []).filter((x) => x.tocmaiDevenitRegula);
    if (noiReguli.length) {
      $("#fb-invatat").style.display = "";
      $("#fb-invatat").innerHTML =
        "<div class=\"cutie-buna\"><b>De acum nu mai greșesc asta.</b> " +
        `S-a repetat de trei ori, așa că am făcut regulă din: ${noiReguli.map((x) => esc(x.cod)).join(", ")}.</div>`;
    }

    if (r.escaladare) {
      await incarcaProiect(S.proiect.id);
      return;
    }

    stare.textContent = "Refac reclama…";
    await api(`/api/proiect/${S.proiect.id}/mai-incearca`, { metoda: "POST", corp: {} });
    pornestePoll();
  }

  $("#b-fb-trimite").onclick = () => trimiteFeedback("simplu");

  /* ---- depozit ---- */
  $("#b-veghe").onclick = async () => {
    const pornit = S.depozit?.activ;
    await api("/api/veghe", { metoda: "POST", corp: { actiune: pornit ? "opreste" : "porneste", pauza: Number($("#veghe-pauza").value) } });
    setTimeout(incarcaDepozit, 600);
  };
  $("#b-veghe-acum").onclick = async () => {
    $("#b-veghe-acum").textContent = "caut…";
    await api("/api/veghe", { metoda: "POST", corp: { actiune: "odata", tema: $("#dep-tema").value || undefined } });
    setTimeout(() => {
      $("#b-veghe-acum").textContent = "Caută o dată acum";
      incarcaDepozit();
    }, 6000);
  };
  $("#dep-tema").onchange = () => incarcaDepozit();
  $("#dep-noi").onchange = () => incarcaDepozit();
  $("#lista-depozit").addEventListener("click", (e) => {
    const b = e.target.closest("[data-dep-alege]");
    if (!b) return;
    const id = b.dataset.depAlege;
    S.depozitAlese.has(id) ? S.depozitAlese.delete(id) : S.depozitAlese.add(id);
    incarcaDepozit();
  });
  $("#b-dep-trimite").onclick = async () => {
    if (!S.proiect) return alert("Deschide întâi un proiect, la pasul 1.");
    if (!S.depozitAlese.size) return alert("Alege măcar un clip din depozit.");
    const r = await api(`/api/proiect/${S.proiect.id}/din-depozit`, { metoda: "POST", corp: { ids: [...S.depozitAlese] } });
    S.depozitAlese.clear();
    await incarcaProiect(S.proiect.id);
    incarcaDepozit();
    alert(`Am trimis ${r.adaugate} clipuri în proiect. Le găsești la pasul 3.`);
  };

  $("#b-inchide-dialog").onclick = () => $("#dialog").close();
}

function previzualizeaza(id) {
  const c = S.proiect.clipuri.find((x) => x.id === id);
  if (!c) return;
  $("#dialog-titlu").textContent = c.titlu?.slice(0, 80) ?? "Previzualizare";
  if (c.incorporare) {
    $("#dialog-corp").innerHTML = `<iframe src="${esc(c.incorporare)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  } else if (c.fisier) {
    $("#dialog-corp").innerHTML = `<video controls src="${url(`/fisier/${S.proiect.id}/clipuri/${esc(c.id.replace(/[^a-z0-9]+/gi, "_"))}.mp4`)}"></video>`;
  } else if (/\.mp4/i.test(c.url)) {
    $("#dialog-corp").innerHTML = `<video controls src="${esc(c.url)}"></video>`;
  } else {
    $("#dialog-corp").innerHTML = `<div style="padding:24px"><p>Sursa asta nu se poate reda aici.</p><p><a href="${esc(c.url)}" target="_blank" rel="noreferrer">Deschide clipul în browser →</a></p></div>`;
  }
  $("#dialog").showModal();
}

porneste();
