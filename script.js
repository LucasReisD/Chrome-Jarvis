document.addEventListener("DOMContentLoaded", () => {
  const defaultData = {
    tasks: [
      { id: 1, text: "Configurar extensão JARVIS", completed: true },
      { id: 2, text: "Verificar pendências do dia", completed: false },
      { id: 3, text: "Revisar código do projeto", completed: false }
    ],
    notes: [
      { id: 1, title: "Nota rápida", body: "Seu assistente pessoal está pronto." }
    ],
    links: [
      { id: 1, title: "GitHub", url: "https://github.com" },
      { id: 2, title: "ChatGPT", url: "https://chatgpt.com" },
      { id: 3, title: "Gmail", url: "https://mail.google.com" },
      { id: 4, title: "YouTube", url: "https://youtube.com" }
    ]
  };

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function getSafeHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function createEmptyState(message, tagName = "li") {
    const empty = document.createElement(tagName);
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
  }

  function updateGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById("greeting-text");
    let period = "BOM DIA";

    if (hour >= 12 && hour < 18) {
      period = "BOA TARDE";
    } else if (hour >= 18 || hour < 5) {
      period = "BOA NOITE";
    }

    greetingEl.textContent = `${period}.`;
    document.getElementById("date-caption").textContent = new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    }).format(new Date()).toUpperCase();
  }

  function loadData(callback) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["jarvisData"], (result) => {
        const data = result.jarvisData;
        if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.notes) || !Array.isArray(data.links)) {
          chrome.storage.local.set({ jarvisData: defaultData }, () => {
            callback(defaultData);
          });
        } else {
          callback(data);
        }
      });
    } else {
      try {
        const savedData = JSON.parse(localStorage.getItem("jarvisData") || "null");
        callback(savedData && Array.isArray(savedData.tasks) && Array.isArray(savedData.notes) && Array.isArray(savedData.links)
          ? savedData
          : defaultData);
      } catch {
        callback(defaultData);
      }
    }
  }

  function saveData(data, callback) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ jarvisData: data }, () => {
        if (callback) callback();
      });
      return;
    }

    try {
      localStorage.setItem("jarvisData", JSON.stringify(data));
    } catch {
      document.getElementById("status-banner").textContent = "Não foi possível salvar neste navegador.";
    }
    if (callback) callback();
  }

  const views = document.querySelectorAll(".view");
  
  function navigateTo(targetViewId) {
    views.forEach(v => v.classList.remove("active"));
    const target = document.getElementById(`view-${targetViewId}`);
    if (target) {
      target.classList.add("active");
    }
  }

  document.querySelectorAll(".card").forEach(card => {
    const openCard = () => {
      const viewName = card.id.replace("card-", "");
      navigateTo(viewName);
    };
    card.addEventListener("click", openCard);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCard();
      }
    });
  });

  document.querySelectorAll(".btn-back").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      navigateTo(target);
      renderDashboard();
    });
  });

  function renderDashboard() {
    loadData((data) => {
      const pendingTasks = data.tasks.filter(t => !t.completed).length;
      const countEl = document.getElementById("dash-task-count");
      countEl.textContent = String(pendingTasks).padStart(2, "0");
      countEl.classList.toggle("warning", pendingTasks > 0);
    });
  }

  function renderTasks() {
    loadData((data) => {
      const listEl = document.getElementById("task-list");
      listEl.innerHTML = "";

      if (!data.tasks.length) {
        listEl.appendChild(createEmptyState("Nenhuma tarefa por aqui."));
        return;
      }

      data.tasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = `list-item ${task.completed ? "completed" : ""}`;
        li.innerHTML = `
          <span>${escapeHTML(task.text)}</span>
          <div class="item-actions">
            <button class="btn-icon btn-toggle" data-id="${escapeHTML(task.id)}" aria-label="${task.completed ? "Reabrir tarefa" : "Concluir tarefa"}">${task.completed ? "✓" : "○"}</button>
            <button class="btn-icon btn-del" data-id="${escapeHTML(task.id)}" aria-label="Excluir tarefa">✕</button>
          </div>
        `;
        listEl.appendChild(li);
      });

      listEl.querySelectorAll(".btn-toggle").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = Number(e.target.getAttribute("data-id"));
          data.tasks = data.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
          saveData(data, () => {
            renderTasks();
            renderDashboard();
          });
        });
      });

      listEl.querySelectorAll(".btn-del").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = Number(e.target.getAttribute("data-id"));
          data.tasks = data.tasks.filter(t => t.id !== id);
          saveData(data, () => {
            renderTasks();
            renderDashboard();
          });
        });
      });
    });
  }

  document.getElementById("btn-add-task").addEventListener("click", () => {
    const input = document.getElementById("task-input");
    const text = input.value.trim();
    if (!text) return;

    loadData((data) => {
      const newTask = { id: Date.now(), text, completed: false };
      data.tasks.push(newTask);
      saveData(data, () => {
        input.value = "";
        renderTasks();
        renderDashboard();
      });
    });
  });

  function renderNotes() {
    loadData((data) => {
      const listEl = document.getElementById("note-list");
      listEl.innerHTML = "";

      if (!data.notes.length) {
        listEl.appendChild(createEmptyState("Suas anotações aparecem aqui.", "p"));
        return;
      }

      data.notes.forEach((note) => {
        const div = document.createElement("div");
        div.className = "list-item";
        div.style.flexDirection = "column";
        div.style.alignItems = "flex-start";
        div.style.gap = "4px";

        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <strong style="color:var(--accent-gold);">${escapeHTML(note.title || "Sem título")}</strong>
            <button class="btn-icon btn-del-note" data-id="${escapeHTML(note.id)}" aria-label="Excluir anotação">✕</button>
          </div>
          <p style="color:var(--text-sub); font-size:10px; word-break:break-word;">${escapeHTML(note.body)}</p>
        `;
        listEl.appendChild(div);
      });

      listEl.querySelectorAll(".btn-del-note").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = Number(e.target.getAttribute("data-id"));
          data.notes = data.notes.filter(n => n.id !== id);
          saveData(data, renderNotes);
        });
      });
    });
  }

  document.getElementById("btn-add-note").addEventListener("click", () => {
    const titleEl = document.getElementById("note-title");
    const bodyEl = document.getElementById("note-body");

    const title = titleEl.value.trim();
    const body = bodyEl.value.trim();

    if (!body) return;

    loadData((data) => {
      const newNote = { id: Date.now(), title, body };
      data.notes.push(newNote);
      saveData(data, () => {
        titleEl.value = "";
        bodyEl.value = "";
        renderNotes();
      });
    });
  });

  function renderLinks() {
    loadData((data) => {
      const listEl = document.getElementById("link-list");
      listEl.innerHTML = "";

      if (!data.links.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Adicione seus links mais usados.";
        listEl.appendChild(empty);
        return;
      }

      data.links.forEach((link) => {
        const div = document.createElement("div");
        div.className = "link-card";
        const safeUrl = getSafeHttpUrl(link.url);
        div.innerHTML = `
          ${safeUrl ? `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.title)}</a>` : `<span>${escapeHTML(link.title)}</span>`}
          <button class="btn-icon btn-del-link" data-id="${escapeHTML(link.id)}" aria-label="Excluir link">✕</button>
        `;
        listEl.appendChild(div);
      });

      listEl.querySelectorAll(".btn-del-link").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = Number(e.target.getAttribute("data-id"));
          data.links = data.links.filter(l => l.id !== id);
          saveData(data, renderLinks);
        });
      });
    });
  }

  document.getElementById("btn-add-link").addEventListener("click", () => {
    const titleEl = document.getElementById("link-title");
    const urlEl = document.getElementById("link-url");

    const title = titleEl.value.trim();
    let url = urlEl.value.trim();

    if (!title || !url) return;

    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    if (!getSafeHttpUrl(url)) return;

    loadData((data) => {
      const newLink = { id: Date.now(), title, url };
      data.links.push(newLink);
      saveData(data, () => {
        titleEl.value = "";
        urlEl.value = "";
        renderLinks();
      });
    });
  });

  function captureItem() {
    const input = document.getElementById("capture-input");
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    loadData((data) => {
      if (document.getElementById("capture-type").value === "note") {
        data.notes.push({ id: Date.now(), title: "", body: text });
        saveData(data, renderNotes);
      } else {
        data.tasks.push({ id: Date.now(), text, completed: false });
        saveData(data, () => {
          renderTasks();
          renderDashboard();
        });
      }
      input.value = "";
      input.focus();
    });
  }

  document.getElementById("btn-capture").addEventListener("click", captureItem);
  document.getElementById("capture-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") captureItem();
  });

  const toolInput = document.getElementById("tool-input");
  const toolResult = document.getElementById("tool-result");
  const toolStatus = document.getElementById("tool-status");
  const base64Mode = document.getElementById("base64-mode");
  const passwordOptions = document.getElementById("password-options");
  const toolInputLabel = document.getElementById("tool-input-label");
  const toolButton = document.getElementById("btn-run-tool");
  let activeTool = "json";

  function setActiveTool(toolName) {
    activeTool = toolName;
    document.querySelectorAll(".tool-tab").forEach((tab) => {
      const isActive = tab.dataset.tool === toolName;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    const isPassword = toolName === "password";
    toolInput.hidden = isPassword;
    toolInputLabel.hidden = isPassword;
    passwordOptions.hidden = !isPassword;
    base64Mode.hidden = toolName !== "base64";
    toolResult.value = "";
    toolStatus.textContent = "";
    toolStatus.classList.remove("error");
    document.getElementById("btn-copy-output").disabled = true;

    const settings = {
      json: ["JSON DE ENTRADA", 'Cole um JSON, por exemplo: {"status":"ok"}', "FORMATAR JSON"],
      base64: ["TEXTO DE ENTRADA", "Digite ou cole o texto aqui.", "EXECUTAR"],
      timestamp: ["DATA OU TIMESTAMP", "Ex.: 1790899200 ou 2026-10-01T12:00:00Z", "CONVERTER"],
      password: ["", "", "GERAR SENHA"]
    }[toolName];

    toolInputLabel.textContent = settings[0];
    toolInput.placeholder = settings[1];
    toolButton.textContent = settings[2];
    if (toolName === "password") {
      toolResult.placeholder = "Gere uma senha para visualizar o resultado.";
    } else {
      toolResult.placeholder = "O resultado aparece aqui.";
      toolInput.focus();
    }
  }

  function randomIndex(maximum) {
    const range = 0x100000000;
    const limit = Math.floor(range / maximum) * maximum;
    const value = new Uint32Array(1);
    do {
      crypto.getRandomValues(value);
    } while (value[0] >= limit);
    return value[0] % maximum;
  }

  function generatePassword() {
    const selectedSets = {
      lower: "abcdefghijklmnopqrstuvwxyz",
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      number: "0123456789",
      symbol: "!@#$%^&*()-_=+[]{}?"
    };
    const selected = [...document.querySelectorAll("[data-char-set]:checked")]
      .map(input => selectedSets[input.dataset.charSet]);
    if (!selected.length) throw new Error("Selecione ao menos um grupo de caracteres.");

    const length = Number(document.getElementById("password-length").value);
    const allCharacters = selected.join("");
    const characters = selected.map(set => set[randomIndex(set.length)]);
    while (characters.length < length) {
      characters.push(allCharacters[randomIndex(allCharacters.length)]);
    }
    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }
    return characters.join("");
  }

  function runTool() {
    toolStatus.classList.remove("error");
    toolStatus.textContent = "";
    toolResult.value = "";
    try {
      if (activeTool === "json") {
        toolResult.value = JSON.stringify(JSON.parse(toolInput.value), null, 2);
        toolStatus.textContent = "JSON válido.";
      } else if (activeTool === "base64") {
        if (base64Mode.value === "encode") {
          const bytes = new TextEncoder().encode(toolInput.value);
          let binary = "";
          bytes.forEach(byte => { binary += String.fromCharCode(byte); });
          toolResult.value = btoa(binary);
        } else {
          const binary = atob(toolInput.value.trim());
          const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
          toolResult.value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        toolStatus.textContent = base64Mode.value === "encode" ? "Texto codificado." : "Texto decodificado.";
      } else if (activeTool === "timestamp") {
        const input = toolInput.value.trim();
        if (!input) throw new Error("Informe uma data ou timestamp.");
        const timestamp = /^-?\d+(?:\.\d+)?$/.test(input)
          ? Number(input) * (Math.abs(Number(input)) < 100000000000 ? 1000 : 1)
          : Date.parse(input);
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) throw new Error("Data ou timestamp inválido.");
        toolResult.value = [
          `Local: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "long" }).format(date)}`,
          `ISO: ${date.toISOString()}`,
          `Unix (s): ${Math.floor(date.getTime() / 1000)}`,
          `Unix (ms): ${date.getTime()}`
        ].join("\n");
        toolStatus.textContent = "Conversão concluída.";
      } else {
        toolResult.value = generatePassword();
        toolStatus.textContent = "Gerada com aleatoriedade criptográfica.";
      }
      document.getElementById("btn-copy-output").disabled = !toolResult.value;
    } catch (error) {
      toolStatus.textContent = error.message || "Não foi possível processar essa entrada.";
      toolStatus.classList.add("error");
    }
  }

  document.querySelectorAll(".tool-tab").forEach((tab) => {
    tab.addEventListener("click", () => setActiveTool(tab.dataset.tool));
  });
  toolButton.addEventListener("click", runTool);
  toolInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) runTool();
  });
  document.getElementById("password-length").addEventListener("input", (event) => {
    document.getElementById("password-length-value").value = event.target.value;
  });
  document.getElementById("btn-copy-output").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(toolResult.value);
      toolStatus.textContent = "Resultado copiado.";
    } catch {
      toolResult.focus();
      toolResult.select();
      toolStatus.textContent = "Selecione e copie o resultado.";
    }
  });

  updateGreeting();
  renderDashboard();
  renderTasks();
  renderNotes();
  renderLinks();
});
