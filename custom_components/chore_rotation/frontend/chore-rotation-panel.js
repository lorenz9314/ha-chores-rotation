const FREQUENCIES = [
  ["daily", "Täglich"],
  ["twice_weekly", "Zweimal wöchentlich"],
  ["weekly", "Wöchentlich"],
  ["monthly", "Monatlich"],
  ["quarterly", "Vierteljährlich"],
];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random()}`);

class ChoreRotationPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.loaded = false;
    this.busy = false;
    this.dirty = false;
    this.error = "";
    this.notice = "";
    this.active = "chores";
  }

  set hass(value) {
    this._hass = value;
    if (!this.loaded && !this.busy) this.load();
  }

  connectedCallback() {
    this.render();
  }

  async load() {
    if (!this._hass) return;
    this.busy = true;
    try {
      const result = await this._hass.callWS({ type: "chore_rotation/get" });
      this.people = result.people;
      this.chores = result.chores;
      this.loaded = true;
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = `Konfiguration konnte nicht geladen werden: ${e.message || e}`;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  changed() {
    this.dirty = true;
    this.error = "";
    this.notice = "";
    this.render();
  }

  async save() {
    if (this.busy) return;
    if (!this.people.length || this.people.some(p => !p.name.trim())) {
      this.error = "Mindestens eine Person mit Namen ist erforderlich.";
      this.render();
      return;
    }
    if (new Set(this.people.map(p => p.name.trim())).size !== this.people.length) {
      this.error = "Personennamen müssen eindeutig sein.";
      this.render();
      return;
    }
    if (this.chores.some(t => !t.name.trim() || !t.cycle.length)) {
      this.error = "Jede Aufgabe benötigt einen Namen und mindestens eine Zuweisung.";
      this.render();
      return;
    }
    this.busy = true;
    this.render();
    try {
      await this._hass.callWS({
        type: "chore_rotation/save",
        people: this.people,
        chores: this.chores,
      });
      this.dirty = false;
      this.notice = "Änderungen gespeichert. Der Sensor wurde aktualisiert.";
    } catch (e) {
      this.error = `Speichern fehlgeschlagen: ${e.message || e}`;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  personName(id) {
    return this.people.find(p => p.id === id)?.name || "Unbekannt";
  }

  groupTasks(freq) {
    return this.chores.filter(t => t.frequency === freq);
  }

  render() {
    if (!this.shadowRoot) return;
    const ready = this.loaded && this.people;
    const people = ready ? this.people : [];
    const chores = ready ? this.chores : [];
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family,Arial,sans-serif); }
        * { box-sizing:border-box; }
        button,input,select { font:inherit; }
        button { cursor:pointer; border-radius:9px; border:1px solid var(--divider-color,#ddd); color:var(--primary-text-color); background:var(--card-background-color,#fff); padding:8px 12px; }
        button:hover:not(:disabled) { background:var(--secondary-background-color,#eee); }
        button:disabled { opacity:.38; cursor:not-allowed; }
        button.primary { background:var(--primary-color,#03a9f4); border-color:var(--primary-color,#03a9f4); color:var(--text-primary-color,#fff); font-weight:600; }
        button.danger { color:var(--error-color,#d32f2f); }
        button.small { padding:5px 9px; font-size:13px; }
        button.icon { min-width:30px; padding:5px 8px; }
        input,select { width:100%; min-width:0; padding:8px 10px; border-radius:8px; border:1px solid var(--divider-color,#ccc); background:var(--card-background-color,#fff); color:var(--primary-text-color); }
        input:focus, select:focus { outline:2px solid var(--primary-color); outline-offset:1px; }
        .wrap { max-width:1180px; margin:auto; padding:22px 22px 90px; }
        header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
        h1 { margin:0; font-size:26px; font-weight:650; }
        h2 { margin:0; font-size:19px; font-weight:650; }
        h3 { margin:0; font-size:15px; font-weight:600; }
        .muted { color:var(--secondary-text-color,#777); font-size:13px; }
        .actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .tabs { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
        .tabs button { padding:9px 15px; }
        .tabs .active { border-color:var(--primary-color); color:var(--primary-color); font-weight:650; }
        .card { background:var(--card-background-color,#fff); border:1px solid var(--divider-color,#ddd); border-radius:14px; padding:17px; margin-bottom:14px; }
        .card-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
        .task { display:grid; grid-template-columns:minmax(165px,2fr) minmax(190px,3fr) auto; align-items:start; gap:14px; padding:14px 0; border-top:1px solid var(--divider-color,#ddd); }
        .task:first-of-type { border-top:0; }
        .task-title { display:flex; gap:8px; align-items:center; }
        .task-controls { display:flex; gap:4px; justify-content:flex-end; }
        .task-name { font-weight:550; }
        .share-grid { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; }
        .share { display:flex; align-items:center; gap:5px; }
        .share label { font-size:13px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .count { min-width:22px; text-align:center; font-weight:600; font-variant-numeric:tabular-nums; }
        .cycle { display:flex; flex-wrap:wrap; gap:4px; margin-top:10px; align-items:center; }
        .slot { border:1px solid var(--divider-color,#ddd); background:var(--secondary-background-color,#f1f1f1); font-size:12px; min-width:26px; padding:5px; }
        .percentage { font-size:12px; color:var(--secondary-text-color); margin-top:6px; }
        .people-row { display:grid; grid-template-columns:minmax(150px,1fr) auto; gap:10px; align-items:center; padding:10px 0; border-top:1px solid var(--divider-color,#ddd); }
        .people-row:first-child { border-top:0; }
        .empty { padding:18px; color:var(--secondary-text-color,#777); }
        .message { padding:12px; border-radius:9px; margin:12px 0; background:var(--secondary-background-color,#eee); }
        .error { color:var(--error-color,#d32f2f); }
        .preview { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px; }
        .preview-person { border:1px solid var(--divider-color,#ddd); border-radius:10px; padding:12px; }
        .preview ul { padding-left:19px; margin:9px 0 0; }
        .preview li { margin:6px 0; font-size:14px; }
        .footer { position:sticky; bottom:0; background:var(--card-background-color); border-top:1px solid var(--divider-color); padding:13px 20px; display:flex; justify-content:flex-end; gap:10px; align-items:center; margin:18px -22px -90px; }
        @media(max-width:760px) { .wrap { padding:16px 12px 84px; } .task { grid-template-columns:1fr; gap:10px; } .task-controls { justify-content:flex-start; } .footer { margin-left:-12px; margin-right:-12px; } }
      </style>
      <div class="wrap">
        <header>
          <div><h1>Hausarbeiten</h1><div class="muted">Aufgaben und wiederkehrende Verteilung verwalten</div></div>
          <div class="actions"><span class="muted">${chores.length} Aufgaben · ${people.length} Personen</span></div>
        </header>
        ${this.error ? `<div class="message error" role="alert">${escapeHtml(this.error)}</div>` : ""}
        ${this.notice ? `<div class="message">${escapeHtml(this.notice)}</div>` : ""}
        ${!ready ? `<div class="card">${this.busy ? "Konfiguration wird geladen …" : "Konfiguration nicht verfügbar."}</div>` : `
          <div class="tabs">
            <button data-action="tab" data-tab="chores" class="${this.active === "chores" ? "active" : ""}">Aufgaben & Verteilung</button>
            <button data-action="tab" data-tab="people" class="${this.active === "people" ? "active" : ""}">Personen</button>
            <button data-action="tab" data-tab="today" class="${this.active === "today" ? "active" : ""}">Heutige Aufgaben</button>
          </div>
          ${this.active === "chores" ? this.renderChores() : this.active === "people" ? this.renderPeople() : this.renderToday()}
          <div class="footer"><span class="muted">${this.dirty ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert"}</span><button data-action="discard" ${!this.dirty || this.busy ? "disabled" : ""}>Verwerfen</button><button class="primary" data-action="save" ${!this.dirty || this.busy ? "disabled" : ""}>${this.busy ? "Speichern …" : "Alle Änderungen speichern"}</button></div>
        `}
      </div>`;
    this.shadowRoot.querySelectorAll("button[data-action]").forEach(b => b.addEventListener("click", () => this.handle(b.dataset)));
    this.shadowRoot.querySelectorAll("input[data-field]").forEach(input => input.addEventListener("change", () => this.editField(input.dataset, input.value)));
    this.shadowRoot.querySelectorAll("select[data-field]").forEach(input => input.addEventListener("change", () => this.editField(input.dataset, input.value)));
  }

  renderChores() {
    return FREQUENCIES.map(([freq, label]) => {
      const tasks = this.groupTasks(freq);
      return `<section class="card"><div class="card-head"><h2>${label} <span class="muted">(${tasks.length})</span></h2><button class="small" data-action="add-task" data-frequency="${freq}">+ Aufgabe hinzufügen</button></div>
        ${tasks.length ? tasks.map((task, index) => this.renderTask(task, index, tasks.length)).join("") : '<div class="empty">Keine Aufgaben in dieser Gruppe.</div>'}
      </section>`;
    }).join("");
  }

  renderTask(task, index, total) {
    const counts = Object.fromEntries(this.people.map(p => [p.id, task.cycle.filter(v => v === p.id).length]));
    const shares = this.people.map(p => `<div class="share"><label title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</label><button class="small icon" data-action="minus" data-id="${task.id}" data-person="${p.id}" aria-label="Anteil verringern: ${escapeHtml(p.name)}">−</button><span class="count">${counts[p.id]}</span><button class="small icon" data-action="plus" data-id="${task.id}" data-person="${p.id}" aria-label="Anteil erhöhen: ${escapeHtml(p.name)}">+</button></div>`).join("");
    const cycle = task.cycle.map((id, position) => `<button class="slot" data-action="cycle" data-id="${task.id}" data-position="${position}" title="Person wechseln">${escapeHtml(this.personName(id))}</button>`).join("");
    const percentages = this.people.filter(p => counts[p.id]).map(p => `${escapeHtml(p.name)} ${Math.round(100 * counts[p.id] / task.cycle.length)} %`).join(" · ");
    return `<div class="task">
      <div><input aria-label="Aufgabenname" class="task-name" data-field="task-name" data-id="${task.id}" value="${escapeHtml(task.name)}"/><div class="muted" style="margin-top:7px">${index + 1} von ${total} · ${escapeHtml(task.frequency)}</div></div>
      <div><div class="share-grid">${shares}</div><div class="cycle" title="Auf ein Feld klicken, um die zugewiesene Person an dieser Position zu wechseln">${cycle}</div><div class="percentage">${percentages || "Keine Zuweisungen"} · Reihenfolge durch Anklicken der Felder ändern</div></div>
      <div class="task-controls"><button class="small icon" data-action="up" data-id="${task.id}" ${index === 0 ? "disabled" : ""} title="Nach oben">↑</button><button class="small icon" data-action="down" data-id="${task.id}" ${index === total - 1 ? "disabled" : ""} title="Nach unten">↓</button><button class="small danger" data-action="delete-task" data-id="${task.id}">Löschen</button></div>
    </div>`;
  }

  renderPeople() {
    return `<section class="card"><div class="card-head"><h2>Personen</h2><button data-action="add-person">+ Person hinzufügen</button></div>
      ${this.people.map(p => `<div class="people-row"><input data-field="person-name" data-id="${p.id}" aria-label="Personenname" value="${escapeHtml(p.name)}"/><button class="danger" data-action="delete-person" data-id="${p.id}" ${this.people.length === 1 ? "disabled" : ""}>Entfernen</button></div>`).join("")}
      <p class="muted">Beim Entfernen einer Person werden deren Zuweisungen aus allen Aufgaben entfernt. Aufgaben mit ausschließlich dieser Person werden der ersten verbleibenden Person zugewiesen.</p>
    </section>`;
  }

  renderToday() {
    const value = this._hass?.states?.["sensor.chore_rotation_today"]?.attributes;
    const assignments = value?.assignments || {};
    return `<section class="card"><div class="card-head"><h2>Heutige Aufgaben</h2><span class="muted">${escapeHtml(value?.date || "")}</span></div>
      <div class="preview">${this.people.map(p => `<div class="preview-person"><h3>${escapeHtml(p.name)}</h3><ul>${(assignments[p.name] || []).map(t => `<li>${escapeHtml(t)}</li>`).join("") || '<li class="muted">Keine Aufgaben</li>'}</ul></div>`).join("")}</div>
      <p class="muted">Dies sind die zuletzt veröffentlichten Sensorwerte. Ungespeicherte Änderungen erscheinen erst nach dem Speichern.</p>
    </section>`;
  }

  editField({ field, id }, value) {
    if (field === "task-name") this.chores.find(t => t.id === id).name = value;
    if (field === "person-name") this.people.find(p => p.id === id).name = value;
    this.changed();
  }

  handle({ action, id, person, position, frequency, tab }) {
    if (action === "tab") { this.active = tab; this.render(); return; }
    if (action === "save") { this.save(); return; }
    if (action === "discard") { this.load(); return; }
    if (action === "add-person") { this.people.push({ id: uid(), name: `Person ${this.people.length + 1}` }); this.changed(); return; }
    if (action === "delete-person") {
      const remaining = this.people.filter(p => p.id !== id);
      if (!remaining.length) return;
      this.people = remaining;
      for (const task of this.chores) {
        task.cycle = task.cycle.filter(pid => pid !== id);
        if (!task.cycle.length) task.cycle = [remaining[0].id];
      }
      this.changed(); return;
    }
    if (action === "add-task") {
      const task = { id: uid(), name: "Neue Aufgabe", frequency, cycle: [this.people[0].id] };
      const last = this.chores.map(t => t.frequency).lastIndexOf(frequency);
      this.chores.splice(last === -1 ? this.chores.length : last + 1, 0, task);
      this.changed(); return;
    }
    if (action === "delete-task") { this.chores = this.chores.filter(t => t.id !== id); this.changed(); return; }
    const task = this.chores.find(t => t.id === id);
    if (!task) return;
    if (action === "plus") {
      const last = task.cycle.lastIndexOf(person);
      task.cycle.splice(last < 0 ? task.cycle.length : last + 1, 0, person);
    } else if (action === "minus") {
      const pos = task.cycle.lastIndexOf(person);
      if (pos >= 0 && task.cycle.length > 1) task.cycle.splice(pos, 1);
      else return;
    } else if (action === "cycle") {
      const pos = Number(position);
      const current = this.people.findIndex(p => p.id === task.cycle[pos]);
      task.cycle[pos] = this.people[(current + 1) % this.people.length].id;
    } else if (action === "up" || action === "down") {
      const original = this.chores.indexOf(task);
      const group = this.groupTasks(task.frequency);
      const index = group.indexOf(task);
      const other = group[index + (action === "up" ? -1 : 1)];
      if (!other) return;
      const target = this.chores.indexOf(other);
      [this.chores[original], this.chores[target]] = [this.chores[target], this.chores[original]];
    } else return;
    this.changed();
  }
}

customElements.define("chore-rotation-panel", ChoreRotationPanel);
