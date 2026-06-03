const STORAGE_KEY = "bio-simulations-v1";
const GALLERY_LAYOUT_KEY = "bio-gallery-layout-v1";
const THEME_KEY = "bio-page-theme-v1";
const FALLBACK_ADMIN_USERNAME = "**********";
const FALLBACK_ADMIN_PASSWORD = "**********";

const supabaseConfig = window.SUPABASE_CONFIG || {};
const isSupabaseConfigured =
  Boolean(window.supabase?.createClient) &&
  Boolean(supabaseConfig.url) &&
  Boolean(supabaseConfig.anonKey) &&
  !supabaseConfig.url.includes("YOUR_PROJECT_ID") &&
  !supabaseConfig.anonKey.includes("YOUR_SUPABASE_ANON_KEY");
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

const placeholderImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%231c8c62'/%3E%3Cstop offset='.56' stop-color='%232478a8'/%3E%3Cstop offset='1' stop-color='%23f06b4f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1280' height='720' fill='url(%23g)'/%3E%3Cg fill='none' stroke='%23fff' stroke-opacity='.35' stroke-width='24'%3E%3Ccircle cx='910' cy='292' r='132'/%3E%3Ccircle cx='1042' cy='444' r='88'/%3E%3Cpath d='M154 480c170-180 354-180 524 0M154 546c170-180 354-180 524 0'/%3E%3C/g%3E%3Cg fill='%23fff' fill-opacity='.42'%3E%3Crect x='234' y='444' width='20' height='96'/%3E%3Crect x='330' y='404' width='20' height='128'/%3E%3Crect x='426' y='398' width='20' height='118'/%3E%3Crect x='522' y='432' width='20' height='96'/%3E%3C/g%3E%3Ctext x='72' y='132' fill='%23fff' font-family='Arial' font-size='62' font-weight='700'%3EInteractive biology%3C/text%3E%3C/svg%3E";

const starterSimulations = [
  {
    id: crypto.randomUUID(),
    title: "Mutation Lab",
    image: placeholderImage,
    simulationUrl: "https://saberprepararte-commits.github.io/biologia-simuladores/mutation-lab/",
    guideUrl: "https://www.teacherspayteachers.com/Product/Mutation-Lab-Simulation-with-guide-16543653",
    description:
      "Explore how mutations can modify genetic sequences and affect the biological interpretation of an organism. Ideal for connecting DNA, variation, and scientific argumentation in class.",
  },
];

let simulations = [];
let activeSearch = "";
let activeGalleryLayout = localStorage.getItem(GALLERY_LAYOUT_KEY) || "mosaic";
let activeTheme = localStorage.getItem(THEME_KEY) || "forest";

const gallery = document.querySelector("#gallery");
const adminList = document.querySelector("#adminList");
const form = document.querySelector("#simulationForm");
const searchInput = document.querySelector("#searchInput");
const dialog = document.querySelector("#detailDialog");
const loginDialog = document.querySelector("#loginDialog");
const adminDialog = document.querySelector("#adminDialog");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const stylePanel = document.querySelector("#stylePanel");
const translatePanel = document.querySelector("#translatePanel");
const themeButtons = document.querySelectorAll("[data-theme]");
const translateButtons = document.querySelectorAll("[data-translate-lang]");
const layoutButtons = document.querySelectorAll("[data-gallery-layout]");
const detailTextButtons = document.querySelectorAll("[data-detail-text]");

function loadLocalSimulations() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterSimulations));
    return starterSimulations;
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? normalizeSimulations(parsed) : starterSimulations;
  } catch {
    return starterSimulations;
  }
}

async function loadSimulations() {
  if (!isSupabaseConfigured) {
    return loadLocalSimulations();
  }

  const { data, error } = await supabaseClient
    .from("simulations")
    .select("id,title,image_url,simulation_url,guide_url,description,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase load failed, using local data.", error);
    return loadLocalSimulations();
  }

  return data.map(fromSupabaseSimulation);
}

function normalizeSimulations(items) {
  return items.map((item) => {
    const isStarterMutationLab =
      item.title === "Mutation Lab" &&
      item.simulationUrl === starterSimulations[0].simulationUrl &&
      item.guideUrl === starterSimulations[0].guideUrl;

    if (!isStarterMutationLab) return item;

    return {
      ...item,
      description: starterSimulations[0].description,
      image: item.image?.startsWith("data:image/svg+xml") ? placeholderImage : item.image,
    };
  });
}

function fromSupabaseSimulation(row) {
  return {
    id: row.id,
    title: row.title,
    image: row.image_url,
    simulationUrl: row.simulation_url,
    guideUrl: row.guide_url,
    description: row.description,
  };
}

function toSupabaseSimulation(simulation) {
  return {
    id: simulation.id,
    title: simulation.title,
    image_url: simulation.image,
    simulation_url: simulation.simulationUrl,
    guide_url: simulation.guideUrl,
    description: simulation.description,
  };
}

function getImageSource(imageUrl) {
  const driveId = getGoogleDriveFileId(imageUrl);
  if (!driveId) return imageUrl;

  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
}

function getGoogleDriveFileId(value) {
  if (!value) return "";

  const patterns = [
    /drive\.google\.com\/file\/d\/([^/]+)/i,
    /drive\.google\.com\/open\?id=([^&]+)/i,
    /drive\.google\.com\/uc\?[^#]*id=([^&]+)/i,
    /drive\.google\.com\/thumbnail\?[^#]*id=([^&]+)/i,
    /docs\.google\.com\/(?:document|presentation|spreadsheets|drawings)\/d\/([^/]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  try {
    const url = new URL(value);
    return url.hostname.includes("drive.google.com") ? url.searchParams.get("id") || "" : "";
  } catch {
    return "";
  }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulations));
}

async function saveSimulation(simulation) {
  if (!isSupabaseConfigured) {
    const existingIndex = simulations.findIndex((item) => item.id === simulation.id);
    if (existingIndex >= 0) {
      simulations[existingIndex] = simulation;
    } else {
      simulations = [simulation, ...simulations];
    }
    persistLocal();
    return simulation;
  }

  const { data, error } = await supabaseClient
    .from("simulations")
    .upsert(toSupabaseSimulation(simulation), { onConflict: "id" })
    .select("id,title,image_url,simulation_url,guide_url,description,created_at")
    .single();

  if (error) throw error;
  return fromSupabaseSimulation(data);
}

async function deleteSimulation(id) {
  if (!isSupabaseConfigured) {
    simulations = simulations.filter((item) => item.id !== id);
    persistLocal();
    return;
  }

  const { error } = await supabaseClient.from("simulations").delete().eq("id", id);
  if (error) throw error;
}

function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

function render() {
  const query = activeSearch.trim().toLowerCase();
  const visible = simulations.filter((simulation) => {
    return `${simulation.title} ${simulation.description}`.toLowerCase().includes(query);
  });

  gallery.innerHTML = visible.length
    ? visible.map(renderCard).join("")
    : `<div class="empty-state"><h3>No simulations to show</h3><p>Add one from administration or change your search.</p></div>`;

  adminList.innerHTML = simulations.map(renderAdminRow).join("");
  applyGalleryLayout(activeGalleryLayout);
  refreshIcons();
}

function applyGalleryLayout(layout) {
  const allowedLayouts = ["mosaic", "list"];
  activeGalleryLayout = allowedLayouts.includes(layout) ? layout : "mosaic";
  gallery.dataset.layout = activeGalleryLayout;
  localStorage.setItem(GALLERY_LAYOUT_KEY, activeGalleryLayout);

  layoutButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.galleryLayout === activeGalleryLayout));
  });
}

function applyTheme(theme) {
  const allowedThemes = ["forest", "ocean", "coral", "orchid"];
  activeTheme = allowedThemes.includes(theme) ? theme : "forest";
  document.body.dataset.theme = activeTheme;
  localStorage.setItem(THEME_KEY, activeTheme);

  themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.theme === activeTheme));
  });
}

function renderCard(simulation) {
  const imageSource = getImageSource(simulation.image);

  return `
    <article class="sim-card">
      <img src="${escapeAttribute(imageSource)}" alt="Preview of ${escapeAttribute(simulation.title)}" loading="lazy" onerror="this.src='${placeholderImage}'" />
      <div class="sim-card-body">
        <h3>${escapeHtml(simulation.title)}</h3>
        <p>${escapeHtml(simulation.description)}</p>
      </div>
      <div class="card-actions">
        <a class="button primary" href="${escapeAttribute(simulation.simulationUrl)}" target="_blank" rel="noopener">${icon("external-link")}Open</a>
        <a class="button purchase" href="${escapeAttribute(simulation.guideUrl)}" target="_blank" rel="noopener">${icon("shopping-bag")}Guide</a>
        <button class="button subtle" type="button" data-detail="${simulation.id}">${icon("panel-top-open")}Details</button>
      </div>
    </article>
  `;
}

function renderAdminRow(simulation) {
  const imageSource = getImageSource(simulation.image);

  return `
    <div class="admin-row">
      <img src="${escapeAttribute(imageSource)}" alt="" onerror="this.src='${placeholderImage}'" />
      <div>
        <strong>${escapeHtml(simulation.title)}</strong>
        <small>${escapeHtml(simulation.simulationUrl)}</small>
      </div>
      <div class="row-actions">
        <button class="icon-button" type="button" title="Edit" aria-label="Edit ${escapeAttribute(simulation.title)}" data-edit="${simulation.id}">${icon("pencil")}</button>
        <button class="icon-button danger" type="button" title="Delete" aria-label="Delete ${escapeAttribute(simulation.title)}" data-delete="${simulation.id}">${icon("trash-2")}</button>
      </div>
    </div>
  `;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function readForm() {
  return {
    id: document.querySelector("#simulationId").value || crypto.randomUUID(),
    title: document.querySelector("#title").value.trim(),
    image: document.querySelector("#image").value.trim(),
    simulationUrl: document.querySelector("#simulationUrl").value.trim(),
    guideUrl: document.querySelector("#guideUrl").value.trim(),
    description: document.querySelector("#description").value.trim(),
  };
}

function fillForm(simulation) {
  document.querySelector("#simulationId").value = simulation.id;
  document.querySelector("#title").value = simulation.title;
  document.querySelector("#image").value = simulation.image;
  document.querySelector("#simulationUrl").value = simulation.simulationUrl;
  document.querySelector("#guideUrl").value = simulation.guideUrl;
  document.querySelector("#description").value = simulation.description;
  if (!adminDialog.open) {
    adminDialog.showModal();
  }
  document.querySelector("#title").focus();
}

function resetForm() {
  form.reset();
  document.querySelector("#simulationId").value = "";
}

function openDetail(id) {
  const simulation = simulations.find((item) => item.id === id);
  if (!simulation) return;

  document.querySelector("#detailTitle").textContent = simulation.title;
  document.querySelector("#detailDescription").textContent = simulation.description;
  document.querySelector("#detailImage").src = getImageSource(simulation.image);
  document.querySelector("#detailImage").alt = `Large preview of ${simulation.title}`;
  document.querySelector("#detailSimulation").href = simulation.simulationUrl;
  document.querySelector("#detailGuide").href = simulation.guideUrl;
  applyDetailTextMode("full");
  dialog.showModal();
  refreshIcons();
}

function exportData() {
  const data = JSON.stringify(simulations, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "biology-simulations.json";
  link.click();
  URL.revokeObjectURL(url);
}

function applyDetailTextMode(mode) {
  const nextMode = mode === "five" ? "five" : "full";
  dialog.dataset.text = nextMode;

  detailTextButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.detailText === nextMode));
  });
}

async function openAdminAccess() {
  loginError.textContent = "";

  if (isSupabaseConfigured) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      adminDialog.showModal();
      refreshIcons();
      return;
    }
  }

  loginForm.reset();
  loginDialog.showModal();
  document.querySelector("#adminUser").focus();
  refreshIcons();
}

async function signInAdmin(emailOrUser, password) {
  if (!isSupabaseConfigured) {
    if (emailOrUser === FALLBACK_ADMIN_USERNAME && password === FALLBACK_ADMIN_PASSWORD) {
      return;
    }
    throw new Error("Incorrect username or password.");
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailOrUser,
    password,
  });

  if (error) throw error;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextSimulation = readForm();

  try {
    const savedSimulation = await saveSimulation(nextSimulation);
    const existingIndex = simulations.findIndex((item) => item.id === savedSimulation.id);
    if (existingIndex >= 0) {
      simulations[existingIndex] = savedSimulation;
    } else {
      simulations = [savedSimulation, ...simulations];
    }
    resetForm();
    render();
  } catch (error) {
    alert(`Could not save the simulation: ${error.message}`);
  }
});

document.querySelector("#resetButton").addEventListener("click", resetForm);
document.querySelector("#exportButton").addEventListener("click", exportData);
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#closeLogin").addEventListener("click", () => loginDialog.close());
document.querySelector("#closeAdmin").addEventListener("click", () => adminDialog.close());
document.querySelector("#styleToggle").addEventListener("click", () => {
  translatePanel.classList.remove("is-open");
  document.querySelector("#translateToggle").setAttribute("aria-expanded", "false");
  const isOpen = stylePanel.classList.toggle("is-open");
  document.querySelector("#styleToggle").setAttribute("aria-expanded", String(isOpen));
});
document.querySelector("#translateToggle").addEventListener("click", () => {
  stylePanel.classList.remove("is-open");
  document.querySelector("#styleToggle").setAttribute("aria-expanded", "false");
  const isOpen = translatePanel.classList.toggle("is-open");
  document.querySelector("#translateToggle").setAttribute("aria-expanded", String(isOpen));
});
themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
  });
});
translateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const language = button.dataset.translateLang;
    const currentUrl = window.location.href;

    if (language === "en") {
      window.location.href = currentUrl;
      return;
    }

    const translatedUrl =
      "https://translate.google.com/translate?sl=en&tl=" +
      encodeURIComponent(language) +
      "&u=" +
      encodeURIComponent(currentUrl);
    window.open(translatedUrl, "_blank", "noopener");
  });
});
layoutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyGalleryLayout(button.dataset.galleryLayout);
  });
});
detailTextButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyDetailTextMode(button.dataset.detailText);
  });
});
document.querySelector("#openAdminLogin").addEventListener("click", openAdminAccess);

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = document.querySelector("#adminUser").value;
  const password = document.querySelector("#adminPassword").value;

  try {
    await signInAdmin(user, password);
    loginDialog.close();
    adminDialog.showModal();
    refreshIcons();
  } catch (error) {
    loginError.textContent = isSupabaseConfigured ? error.message : "Incorrect username or password.";
  }
});

searchInput.addEventListener("input", (event) => {
  activeSearch = event.target.value;
  render();
});

document.addEventListener("click", async (event) => {
  const detailButton = event.target.closest("[data-detail]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (detailButton) {
    openDetail(detailButton.dataset.detail);
  }

  if (editButton) {
    const simulation = simulations.find((item) => item.id === editButton.dataset.edit);
    if (simulation) fillForm(simulation);
  }

  if (deleteButton) {
    const simulation = simulations.find((item) => item.id === deleteButton.dataset.delete);
    const confirmed = simulation && confirm(`Delete "${simulation.title}" from the gallery?`);
    if (confirmed) {
      try {
        await deleteSimulation(deleteButton.dataset.delete);
        simulations = simulations.filter((item) => item.id !== deleteButton.dataset.delete);
        render();
      } catch (error) {
        alert(`Could not delete the simulation: ${error.message}`);
      }
    }
  }
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

loginDialog.addEventListener("click", (event) => {
  if (event.target === loginDialog) {
    loginDialog.close();
  }
});

adminDialog.addEventListener("click", (event) => {
  if (event.target === adminDialog) {
    adminDialog.close();
  }
});

async function init() {
  applyTheme(activeTheme);
  simulations = await loadSimulations();
  render();
}

init();
