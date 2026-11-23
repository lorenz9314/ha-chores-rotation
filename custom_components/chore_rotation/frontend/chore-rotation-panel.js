const FREQUENCIES = [
  ["daily", "Daily"],
  ["twice_weekly", "Twice weekly"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaultSchedule = (freq) => {
  if (freq === "daily") return { interval: 1 };
  if (freq === "twice_weekly") return { interval: 1, weekdays: [0, 3], anchor: "2026-11-16" };
  if (freq === "weekly") return { interval: 1, weekdays: [0], anchor: "2026-11-16" };
  if (freq === "monthly") return { interval: 1, day: 1, anchor: "2026-11-01" };
  return { interval: 3, day: 1, anchor: "2026-10-01" };
};
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
    this.active = window.location.hash === "#today" ? "today" : "chores";
    this.onHashChange = () => {
      const tab = window.location.hash.slice(1);
      this.active = ["chores", "people", "today"].includes(tab) ? tab : "chores";
      this.render();
    };
  }

  set hass(value) {
    this._hass = value;
    if (!this.loaded && !this.busy) this.load();
  }

  connectedCallback() {
    window.addEventListener("hashchange", this.onHashChange);
    this.onHashChange();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.onHashChange);
  }

  async load() {
    if (!this._hass) return;
    this.busy = true;
    try {
      const result = await this._hass.callWS({ type: "chore_rotation/get" });
      this.people = result.people;
      this.chores = result.chores.map(t => ({...t, schedule: t.schedule || defaultSchedule(t.frequency)}));
      this.loaded = true;
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = `Could not load configuration: ${e.message || e}`;
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
      this.error = "At least one named person is required.";
      this.render();
      return;
    }
    if (new Set(this.people.map(p => p.name.trim())).size !== this.people.length) {
      this.error = "Person names must be unique.";
      this.render();
      return;
    }
    if (this.chores.some(t => !t.name.trim() || !t.cycle.length)) {
      this.error = "Every chore needs a name and at least one assignment.";
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
      this.notice = "Changes saved. The sensor has been updated.";
    } catch (e) {
      this.error = `Could not save changes: ${e.message || e}`;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  personName(id) {
    return this.people.find(p => p.id === id)?.name || "Unknown";
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
        .schedule { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px; }
        .schedule label { font-size:12px; color:var(--secondary-text-color); display:flex; gap:5px; align-items:center; }
        .schedule input, .schedule select { width:auto; max-width:150px; }
        .weekdays { display:flex; gap:4px; flex-wrap:wrap; }
        .weekdays button.selected { background:var(--primary-color); color:var(--text-primary-color,#fff); }
        .task-controls { display:flex; gap:4px; justify-content:flex-end; }
        .task-name { font-weight:550; }
        .share-grid { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; }
        .share { display:flex; align-items:center; gap:5px; }
        .share label { font-size:13px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .count { min-width:22px; text-align:center; font-weight:600; font-variant-numeric:tabular-nums; }
        .cycle { display:flex; flex-wrap:wrap; gap:4px; margin-top:10px; align-items:center; }
        .slot { border:1px solid var(--divider-color,#ddd); background:var(--secondary-background-color,#f1f1f1); font-size:12px; min-width:26px; padding:5px; }
        .weekday-assignments { margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(135px,1fr)); gap:8px; }
        .weekday-assignments label { font-size:12px; display:flex; flex-direction:column; gap:5px; }
        .weekday-assignments select { width:100%; }
        .assignment-method { margin-top:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px; }
        .assignment-method select { width:auto; max-width:260px; }
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
          <div><h1>Chores</h1><div class="muted">Manage chore schedules and recurring assignments</div></div>
          <div class="actions"><span class="muted">${chores.length} chores · ${people.length} people</span></div>
        </header>
        ${this.error ? `<div class="message error" role="alert">${escapeHtml(this.error)}</div>` : ""}
        ${this.notice ? `<div class="message">${escapeHtml(this.notice)}</div>` : ""}
        ${!ready ? `<div class="card">${this.busy ? "Loading configuration…" : "Configuration unavailable."}</div>` : `
          <div class="tabs">
            <button data-action="tab" data-tab="chores" class="${this.active === "chores" ? "active" : ""}">Chores & assignments</button>
            <button data-action="tab" data-tab="people" class="${this.active === "people" ? "active" : ""}">People</button>
            <button data-action="tab" data-tab="today" class="${this.active === "today" ? "active" : ""}">Today's chores</button>
          </div>
          ${this.active === "chores" ? this.renderChores() : this.active === "people" ? this.renderPeople() : this.renderToday()}
          <div class="footer"><span class="muted">${this.dirty ? "Unsaved changes" : "All changes saved"}</span><button data-action="discard" ${!this.dirty || this.busy ? "disabled" : ""}>Discard</button><button class="primary" data-action="save" ${!this.dirty || this.busy ? "disabled" : ""}>${this.busy ? "Saving…" : "Save all changes"}</button></div>
        `}
      </div>`;
    this.shadowRoot.querySelectorAll("button[data-action]").forEach(b => b.addEventListener("click", () => this.handle(b.dataset)));
    this.shadowRoot.querySelectorAll("input[data-field]").forEach(input => input.addEventListener("change", () => this.editField(input.dataset, input.value)));
    this.shadowRoot.querySelectorAll("select[data-field]").forEach(input => input.addEventListener("change", () => this.editField(input.dataset, input.value)));
  }

  renderChores() {
    return FREQUENCIES.map(([freq, label]) => {
      const tasks = this.groupTasks(freq);
      return `<section class="card"><div class="card-head"><h2>${label} <span class="muted">(${tasks.length})</span></h2><button class="small" data-action="add-task" data-frequency="${freq}">+ Add chore</button></div>
        ${tasks.length ? tasks.map((task, index) => this.renderTask(task, index, tasks.length)).join("") : '<div class="empty">No chores in this group.</div>'}
      </section>`;
    }).join("");
  }

  renderTask(task, index, total) {
    const counts = Object.fromEntries(this.people.map(p => [p.id, task.cycle.filter(v => v === p.id).length]));
    const shares = this.people.map(p => `<div class="share"><label title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</label><button class="small icon" data-action="minus" data-id="${task.id}" data-person="${p.id}" aria-label="Decrease share for ${escapeHtml(p.name)}">−</button><span class="count">${counts[p.id]}</span><button class="small icon" data-action="plus" data-id="${task.id}" data-person="${p.id}" aria-label="Increase share for ${escapeHtml(p.name)}">+</button></div>`).join("");
    const cycle = task.cycle.map((id, position) => `<button class="slot" data-action="cycle" data-id="${task.id}" data-position="${position}" title="Change assigned person">${escapeHtml(this.personName(id))}</button>`).join("");
    const mode = task.assignment_mode || "cycle";
    const weekdayAssignments = task.weekday_assignments || {};
    const methodEditor = `<div class="assignment-method"><label for="method-${task.id}">Assignment method</label><select id="method-${task.id}" data-field="assignment-mode" data-id="${task.id}">
      <option value="cycle" ${mode === "cycle" ? "selected" : ""}>Repeating sequence</option>
      <option value="weekday" ${mode === "weekday" ? "selected" : ""}>Fixed weekdays</option>
      <option value="override" ${mode === "override" ? "selected" : ""}>Sequence with weekday overrides</option>
    </select></div>`;
    const weekdayEditor = mode === "cycle" ? "" : `<div class="weekday-assignments">${WEEKDAYS.map((day, index) => {
      const assigned = weekdayAssignments[String(index)];
      return `<label>${day}<select data-field="assignment-weekday" data-id="${task.id}" data-day="${index}">
        ${mode === "override" ? `<option value="">Use sequence</option>` : ""}
        ${this.people.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === assigned ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select></label>`;
    }).join("")}</div>`;
    const percentages = this.people.filter(p => counts[p.id]).map(p => `${escapeHtml(p.name)} ${Math.round(100 * counts[p.id] / task.cycle.length)} %`).join(" · ");
    return `<div class="task">
      <div><input aria-label="Chore name" class="task-name" data-field="task-name" data-id="${task.id}" value="${escapeHtml(task.name)}"/><div class="muted" style="margin-top:7px">${index + 1} of ${total}</div>${this.renderSchedule(task)}</div>
      <div><div class="share-grid">${shares}</div><div class="cycle" title="Click a slot to change its assigned person">${cycle}</div><div class="percentage">${percentages || "No assignments"} · Click slots to change assignment order</div>${methodEditor}${weekdayEditor}</div>
      <div class="task-controls"><button class="small icon" data-action="up" data-id="${task.id}" ${index === 0 ? "disabled" : ""} title="Move up">↑</button><button class="small icon" data-action="down" data-id="${task.id}" ${index === total - 1 ? "disabled" : ""} title="Move down">↓</button><button class="small danger" data-action="delete-task" data-id="${task.id}">Delete</button></div>
    </div>`;
  }

  renderSchedule(task) {
    const s = task.schedule;
    const frequency = `<label>Recurrence <select data-field="task-frequency" data-id="${task.id}">${FREQUENCIES.map(([id, title]) => `<option value="${id}" ${task.frequency === id ? "selected" : ""}>${title}</option>`).join("")}</select></label>`;
    const interval = `<label>Every <input aria-label="Recurrence interval" type="number" min="1" max="120" data-field="schedule-interval" data-id="${task.id}" value="${s.interval}" style="width:65px"/> ${task.frequency === "daily" ? "days" : ["weekly", "twice_weekly"].includes(task.frequency) ? "weeks" : "months"}</label>`;
    let details = "";
    if (["weekly", "twice_weekly"].includes(task.frequency)) {
      details = `<div class="weekdays">${WEEKDAYS.map((label, index) => `<button class="small ${s.weekdays.includes(index) ? "selected" : ""}" data-action="weekday" data-id="${task.id}" data-position="${index}" title="${label}">${label}</button>`).join("")}</div>`;
    } else if (["monthly", "quarterly"].includes(task.frequency)) {
      details = `<label>On day <input type="number" min="1" max="31" data-field="schedule-day" data-id="${task.id}" value="${s.day}" style="width:65px"/> of the month</label>`;
    }
    if (task.frequency !== "daily") details += `<label>Reference date <input type="date" data-field="schedule-anchor" data-id="${task.id}" value="${escapeHtml(s.anchor)}"/></label>`;
    return `<div class="schedule">${frequency}${interval}${details}</div>`;
  }

  renderPeople() {
    return `<section class="card"><div class="card-head"><h2>People</h2><button data-action="add-person">+ Add person</button></div>
      ${this.people.map(p => `<div class="people-row"><input data-field="person-name" data-id="${p.id}" aria-label="Person name" value="${escapeHtml(p.name)}"/><button class="danger" data-action="delete-person" data-id="${p.id}" ${this.people.length === 1 ? "disabled" : ""}>Remove</button></div>`).join("")}
      <p class="muted">Removing a person removes their assignments from all chores. Chores assigned only to that person are reassigned to the first remaining person.</p>
    </section>`;
  }

  renderToday() {
    const value = this._hass?.states?.["sensor.chore_rotation_today"]?.attributes;
    const assignments = value?.assignments || {};
    return `<section class="card"><div class="card-head"><h2>Today's chores</h2><span class="muted">${escapeHtml(value?.date || "")}</span></div>
      <div class="preview">${this.people.map(p => `<div class="preview-person"><h3>${escapeHtml(p.name)}</h3><ul>${(assignments[p.name] || []).map(t => `<li>${escapeHtml(t)}</li>`).join("") || '<li class="muted">No chores</li>'}</ul></div>`).join("")}</div>
      <p class="muted">These are the most recently published sensor values. Unsaved changes appear only after saving.</p>
    </section>`;
  }

  editField({ field, id, day }, value) {
    if (field === "task-name") this.chores.find(t => t.id === id).name = value;
    if (field === "person-name") this.people.find(p => p.id === id).name = value;
    const task = this.chores.find(t => t.id === id);
    if (task && field === "task-frequency") {
      task.frequency = value;
      task.schedule = defaultSchedule(value);
      this.chores = FREQUENCIES.flatMap(([freq]) => this.chores.filter(t => t.frequency === freq));
    }
    if (task && field === "assignment-mode") {
      task.assignment_mode = value;
      task.weekday_assignments ||= {};
      if (value === "weekday") {
        for (let d = 0; d < 7; d++) {
          task.weekday_assignments[String(d)] ||= task.cycle[0];
        }
      }
    }
    if (task && field === "assignment-weekday") {
      task.weekday_assignments ||= {};
      if (value) task.weekday_assignments[String(day)] = value;
      else delete task.weekday_assignments[String(day)];
    }
    if (task && field === "schedule-interval") task.schedule.interval = Math.max(1, Math.min(120, Number(value) || 1));
    if (task && field === "schedule-day") task.schedule.day = Math.max(1, Math.min(31, Number(value) || 1));
    if (task && field === "schedule-anchor" && /^\d{4}-\d{2}-\d{2}$/.test(value)) task.schedule.anchor = value;
    this.changed();
  }

  handle({ action, id, person, position, frequency, tab }) {
    if (action === "tab") {
      this.active = tab;
      window.location.hash = tab;
      this.render();
      return;
    }
    if (action === "save") { this.save(); return; }
    if (action === "discard") { this.load(); return; }
    if (action === "add-person") { this.people.push({ id: uid(), name: `Person ${this.people.length + 1}` }); this.changed(); return; }
    if (action === "delete-person") {
      const remaining = this.people.filter(p => p.id !== id);
      if (!remaining.length) return;
      this.people = remaining;
      for (const task of this.chores) {
        task.cycle = task.cycle.filter(pid => pid !== id);
        if (task.weekday_assignments) {
          for (const [day, pid] of Object.entries(task.weekday_assignments)) {
            if (pid === id) {
              if (task.assignment_mode === "weekday") task.weekday_assignments[day] = remaining[0].id;
              else delete task.weekday_assignments[day];
            }
          }
        }
        if (!task.cycle.length) task.cycle = [remaining[0].id];
      }
      this.changed(); return;
    }
    if (action === "add-task") {
      const task = { id: uid(), name: "New chore", frequency, schedule: defaultSchedule(frequency), cycle: [this.people[0].id], assignment_mode: "cycle", weekday_assignments: {} };
      const last = this.chores.map(t => t.frequency).lastIndexOf(frequency);
      this.chores.splice(last === -1 ? this.chores.length : last + 1, 0, task);
      this.changed(); return;
    }
    if (action === "delete-task") { this.chores = this.chores.filter(t => t.id !== id); this.changed(); return; }
    const task = this.chores.find(t => t.id === id);
    if (!task) return;
    if (action === "weekday") {
      const day = Number(position);
      const weekdays = task.schedule.weekdays;
      if (weekdays.includes(day)) {
        if (weekdays.length <= (task.frequency === "twice_weekly" ? 2 : 1)) return;
        task.schedule.weekdays = weekdays.filter(x => x !== day);
      } else {
        if (task.frequency === "twice_weekly" && weekdays.length >= 2) task.schedule.weekdays = [weekdays[1], day].sort((a,b) => a-b);
        else task.schedule.weekdays = [...weekdays, day].sort((a,b) => a-b);
      }
    } else if (action === "plus") {
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
