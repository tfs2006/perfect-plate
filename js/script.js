// PERFECT-PLATE – Frontend App (detailed recipes + ingredient grocery list)
(function () {
  // ---------- Utilities ----------
  const $ = (id) => document.getElementById(id);
  const ready = (fn) =>
    (document.readyState === "complete" || document.readyState === "interactive")
      ? setTimeout(fn, 0)
      : document.addEventListener("DOMContentLoaded", fn);
  const initIcons = () => { if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch {} } };
  const getJsPDF = () => (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
  const debounce = (fn, wait) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };

  // ---------- App ----------
  ready(() => {
    initIcons();

    const API_BASE = (typeof window.API_BASE === "string" && window.API_BASE.trim())
      ? window.API_BASE.replace(/\/$/, "")
      : "";

    // DOM
    const form            = $("meal-plan-form");
    const formContainer   = $("form-container");
    const resultContainer = $("result-container");
    const loader          = $("loader");
    const messageBox      = $("message-box");
    const messageText     = $("message-text");
    const mealPlanImage   = $("meal-plan-image");

    if (!form || !formContainer || !resultContainer) {
      console.error("Core DOM nodes missing");
      return;
    }

    // ---------- Stepper ----------
    function goToStep(i) {
      [1, 2, 3].forEach((s) => {
        const panel = $(`step-${s}`);
        if (panel) panel.classList.toggle("active", s === i);

        const ind = $(`step-${s}-indicator`);
        if (ind) {
          ind.style.opacity = (s === i) ? "1" : ".5";
          const bubble = ind.querySelector("div");
          if (bubble) bubble.classList.toggle("bg-emerald-500", s === i);
        }
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Fallback for old inline handlers
    window.nextStep = (i) => goToStep(Number(i));
    window.prevStep = (i) => goToStep(Number(i));

    $("next-1")?.addEventListener("click", () => goToStep(2));
    $("back-2")?.addEventListener("click", () => goToStep(1));
    $("next-2")?.addEventListener("click", () => goToStep(3));
    $("back-3")?.addEventListener("click", () => goToStep(2));
    goToStep(1);

    // ---------- Toast ----------
    function showMessage(msg, ms = 4000) {
      if (!messageBox || !messageText) { alert(msg); return; }
      messageText.textContent = msg;
      messageBox.classList.remove("hidden");
      setTimeout(() => messageBox.classList.add("hidden"), ms);
    }

    // ---------- Loader helpers ----------
    const showLoader = () => { if (loader) { loader.classList.remove("hidden"); loader.style.display = "flex"; } };
    const hideLoader = () => { if (loader) loader.style.display = "none"; };

    // ---------- Persist inputs ----------
    const FIELDS = ["age", "gender", "ethnicity", "medical-conditions", "exclusions", "fitness-goal"];
    function saveState() {
      const d = {};
      FIELDS.forEach(id => d[id] = $(id)?.value ?? "");
      d.diet = Array.from(document.querySelectorAll('input[name="diet"]:checked')).map(x => x.value);
      try { localStorage.setItem("pp_state", JSON.stringify(d)); } catch {}
    }
    function loadState() {
      try {
        const raw = localStorage.getItem("pp_state"); if (!raw) return;
        const d = JSON.parse(raw);
        FIELDS.forEach(id => { if (d[id] != null && $(id)) $(id).value = d[id]; });
        if (Array.isArray(d.diet)) d.diet.forEach(v => { const el = document.querySelector(`input[name="diet"][value="${v}"]`); if (el) el.checked = true; });
      } catch {}
    }
    loadState();
    form.addEventListener("input", debounce(saveState, 300));

    // ---------- API ----------
    async function secureApiCall(path, payload) {
      const base = API_BASE || "";
      if (!base) throw new Error("No API_BASE configured. Set window.API_BASE in js/config.js to your Netlify Functions URL.");
      if (location.protocol === "https:" && /^http:\/\//i.test(base)) {
        throw new Error(`Mixed content blocked: page is HTTPS but API_BASE is HTTP ("${base}"). Use your HTTPS Netlify URL.`);
      }
      const url = (`${base}/${path}`).replace(/([^:]\/)\/+/g, "$1");
      console.log("[Perfect-Plate] POST", url, { origin: location.origin });

      try {
        const res = await fetch(url, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`API error (${res.status}): ${txt || res.statusText}`);
        }
        return res.json();
      } catch (err) {
        throw new Error(`Failed to reach ${url}. ${
          /Failed to fetch/i.test(String(err))
            ? "Possible CORS or wrong API_BASE. Check ALLOWED_ORIGIN on Netlify and the URL."
            : String(err)
        }`);
      }
    }

    // ---------- Prompt (detailed) ----------
    function buildJsonPrompt(i) {
      const profile = {
        age: i.age, gender: i.gender, ethnicity: i.ethnicity,
        goal: i.fitnessGoal, dietPrefs: i.dietaryPrefs, exclusions: i.exclusions,
        medicalConditions: i.medicalConditions
      };

      return `Return STRICT JSON ONLY (no markdown) that matches this shape exactly:

{
  "planTitle": "string",
  "notes": "string",
  "days": [
    {
      "day": "Monday",
      "summary": "1-2 sentence overview for the day referencing the user's goals/conditions/preferences",
      "totals": {"calories": 1800, "protein": 120, "carbs": 180, "fat": 60},
      "meals": [
        {
          "name": "Breakfast",
          "items": [
            {
              "title": "Oatmeal with Berries",
              "calories": 350, "protein": 20, "carbs": 55, "fat": 9,
              "rationale": "Why this fits the user's profile (goal, conditions, culture, exclusions).",
              "tags": ["High-fiber","Budget-friendly"],
              "allergens": ["gluten"],
              "substitutions": ["use gluten-free oats"],
              "prepTime": 5, "cookTime": 5,
              "ingredients": [
                {"item":"Rolled oats","qty":0.75,"unit":"cup","category":"Grains"},
                {"item":"Blueberries","qty":0.5,"unit":"cup","category":"Produce"},
                {"item":"Milk","qty":1,"unit":"cup","category":"Dairy"}
              ],
              "steps": [
                "Simmer oats in milk 5 min.",
                "Top with blueberries."
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Exactly 7 days: Monday..Sunday.
- EVERY meal MUST have 1–2 items; each item MUST include ingredients[] and steps[] with at least 1 entry.
- Use integers for calories/protein/carbs/fat, prepTime, cookTime (round if needed).
- Respect medical conditions: ${i.medicalConditions || 'None'}; exclusions: ${i.exclusions || 'None'}.
- Cultural background: ${i.ethnicity}; goal: ${i.fitnessGoal}; diet prefs: ${(i.dietaryPrefs||[]).join(', ') || 'None'}; age ${i.age}; gender ${i.gender}.
- Prefer common US grocery items; keep titles under 60 chars.
- Keep quantities small/realistic; ingredients categorized as one of: Produce, Protein, Grains, Dairy, Pantry, Frozen, Other.

User profile (for rationale): ${JSON.stringify(profile)}`;
    }

    // ---------- JSON helpers ----------
    function extractFirstJSON(text) {
      if (!text) return null;
      let cleaned = String(text).replace(/```(?:json)?/gi, "").trim();
      try { return JSON.parse(cleaned); } catch {}
      const start = cleaned.indexOf("{"); if (start === -1) return null;
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (inStr) {
          if (esc) { esc = false; }
          else if (ch === "\\") { esc = true; }
          else if (ch === '"') { inStr = false; }
        } else {
          if (ch === '"') inStr = true;
          else if (ch === "{") depth++;
          else if (ch === "}") { depth--; if (depth === 0) {
            const slice = cleaned.slice(start, i + 1);
            try { return JSON.parse(slice); } catch { return null; }
          }}
        }
      }
      return null;
    }

    function coercePlan(obj){
      if (!obj) return null;
      if (Array.isArray(obj.days)) return obj;
      if (Array.isArray(obj.plan?.days)) return obj.plan;
      if (Array.isArray(obj.weekPlan?.days)) return obj.weekPlan;
      if (Array.isArray(obj.week?.days)) return obj.week;
      if (Array.isArray(obj)) return { planTitle: "7-Day Plan", days: obj, notes: "" };
      return null;
    }

    function needsRepair(plan){
      let bad = false;
      (plan.days || []).forEach(d =>
        (d.meals || []).forEach(m => {
          if (!Array.isArray(m.items) || m.items.length === 0) bad = true;
          (m.items || []).forEach(it => {
            if (!Array.isArray(it.ingredients) || !it.ingredients.length) bad = true;
            if (!Array.isArray(it.steps) || !it.steps.length) bad = true;
          });
        })
      );
      return bad;
    }

    async function repairPlan(plan, inputs){
      const repairPrompt =
        `Fix this JSON so EVERY meal has at least 1 item with {title, calories, protein, carbs, fat} (integers), and each item has non-empty ingredients[] and steps[]. ` +
        `Keep the same days and meal names. Respect medical conditions/exclusions/culture/goal from context. ` +
        `Return JSON ONLY in the same schema.\n\nContext: ${JSON.stringify(inputs)}\n\nCurrent JSON:\n${JSON.stringify(plan)}`;

      const fixRes = await secureApiCall("generate-plan", {
        endpoint: "gemini-1.5-flash:generateContent",
        body: {
          contents: [{ parts: [{ text: repairPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        }
      });
      const raw = fixRes?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      let fixed = extractFirstJSON(raw);
      fixed = coercePlan(fixed);
      return fixed || plan;
    }

    // ---------- Submit ----------
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { showMessage("Please complete required fields."); return; }

      const age = $("age").value.trim();
      const gender = $("gender").value;
      const ethnicity = $("ethnicity").value.trim();
      const medicalConditions = $("medical-conditions").value.trim();
      const fitnessGoal = $("fitness-goal").value;
      const exclusions = $("exclusions").value.trim();
      const dietaryPrefs = Array.from(document.querySelectorAll('input[name="diet"]:checked')).map(el => el.value);

      const prompt = buildJsonPrompt({ age, gender, ethnicity, medicalConditions, fitnessGoal, exclusions, dietaryPrefs });

      formContainer.style.display = "none";
      showLoader();

      try {
        // Request STRICT JSON with schema
        const textResult = await secureApiCall("generate-plan", {
          endpoint: "gemini-1.5-flash:generateContent",
          body: {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: "application/json",
              response_schema: {
                type: "OBJECT",
                properties: {
                  planTitle: { type: "STRING" },
                  notes: { type: "STRING" },
                  days: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        day: { type: "STRING" },
                        summary: { type: "STRING" },
                        totals: {
                          type: "OBJECT",
                          properties: {
                            calories: { type: "NUMBER" },
                            protein:  { type: "NUMBER" },
                            carbs:    { type: "NUMBER" },
                            fat:      { type: "NUMBER" }
                          }
                        },
                        meals: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              name: { type: "STRING" },
                              items: {
                                type: "ARRAY",
                                items: {
                                  type: "OBJECT",
                                  properties: {
                                    title:   { type: "STRING" },
                                    calories:{ type: "NUMBER" },
                                    protein: { type: "NUMBER" },
                                    carbs:   { type: "NUMBER" },
                                    fat:     { type: "NUMBER" },
                                    rationale:{ type: "STRING" },
                                    tags:    { type: "ARRAY", items: { type: "STRING" } },
                                    allergens:{ type: "ARRAY", items: { type: "STRING" } },
                                    substitutions:{ type: "ARRAY", items: { type: "STRING" } },
                                    prepTime:{ type: "NUMBER" },
                                    cookTime:{ type: "NUMBER" },
                                    ingredients: {
                                      type: "ARRAY",
                                      items: {
                                        type: "OBJECT",
                                        properties: {
                                          item: { type: "STRING" },
                                          qty:  { type: "NUMBER" },
                                          unit: { type: "STRING" },
                                          category: { type: "STRING" }
                                        }
                                      }
                                    },
                                    steps: { type: "ARRAY", items: { type: "STRING" } }
                                  },
                                  required: ["title","calories","protein","carbs","fat","ingredients","steps"]
                                }
                              }
                            }
                          }
                        }
                      },
                      required: ["day","meals"]
                    }
                  }
                },
                required: ["days"]
              }
            }
          }
        });

        const rawText = textResult?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let plan = coercePlan(extractFirstJSON(rawText));
        if (!plan || !Array.isArray(plan.days)) {
          console.warn("Model raw response (first 400 chars):", String(rawText).slice(0, 400));
          throw new Error("Plan format invalid.");
        }

        if (needsRepair(plan)) {
          plan = await repairPlan(plan, { age, gender, ethnicity, medicalConditions, fitnessGoal, exclusions, dietaryPrefs });
        }

        renderResults(plan);

        // Optional image (best-effort; non-fatal)
        try {
          const imgPrompt = `Flat-lay, appetizing mixed dishes inspired by ${ethnicity} cuisine, vibrant healthy colors, natural light, wooden table; editorial food photography.`;
          const imageResult = await secureApiCall("generate-plan", {
            endpoint: "imagen-3.0-generate-002:predict",
            body: { instances: [{ prompt: imgPrompt }], parameters: { sampleCount: 1 } }
          });
          const b64 = imageResult?.predictions?.[0]?.bytesBase64Encoded;
          if (b64 && mealPlanImage) mealPlanImage.src = `data:image/png;base64,${b64}`;
        } catch (imgErr) { console.warn("Image generation failed:", imgErr); }

        hideLoader();
        resultContainer.style.display = "block";
      } catch (err) {
        console.error(err);
        hideLoader();
        formContainer.style.display = "block";
        showMessage(err.message || "Something went wrong.");
      }
    });

    // ---------- Rendering ----------
    function renderResults(plan) {
      const tabs = $("result-tabs");
      const content = $("tab-content");
      if (!plan || !Array.isArray(plan.days)) throw new Error("Plan format invalid.");
      if (tabs) tabs.innerHTML = "";
      if (content) content.innerHTML = "";

      plan.days.forEach((d, idx) => {
        const id = `tab-${idx}`;

        const a = document.createElement("a");
        a.href = "#"; a.dataset.tab = id;
        a.className = "result-tab whitespace-nowrap py-4 px-1 border-b-2 border-transparent text-sm font-semibold text-gray-600 hover:text-gray-800 hover:border-gray-300";
        a.textContent = d.day || `Day ${idx + 1}`;
        a.addEventListener("click", (e) => { e.preventDefault(); activateTab(id); });
        tabs?.appendChild(a);

        const panel = document.createElement("div");
        panel.id = id;
        panel.className = "tab-panel hidden";
        panel.innerHTML = renderDayHTML(d);
        content?.appendChild(panel);
      });

      if (plan.days.length) activateTab("tab-0");

      $("grocery-list-button")?.addEventListener("click", () => renderGroceryList(buildGroceryList(plan)));
      $("pdf-button")?.addEventListener("click", downloadPDF);
      $("refine-button")?.addEventListener("click", () => {
        resultContainer.style.display = "none";
        formContainer.style.display = "block";
        goToStep(1);
      });
    }

    function activateTab(id) {
      document.querySelectorAll(".result-tab").forEach(el => el.classList.remove("active", "text-emerald-600", "border-emerald-600"));
      document.querySelectorAll(".tab-panel").forEach(el => el.classList.add("hidden"));
      const link = Array.from(document.querySelectorAll(".result-tab")).find(a => a.dataset.tab === id);
      if (link) link.classList.add("active", "text-emerald-600", "border-emerald-600");
      const panel = $(id);
      if (panel) panel.classList.remove("hidden");
    }

    function renderDayHTML(day) {
      const meals = day.meals || [];
      const summary = day.summary ? `<p class="text-sm text-gray-600 mb-4">${escapeHTML(day.summary)}</p>` : "";
      const totals = day.totals
        ? `<p class="text-xs text-gray-500 mb-6">Daily totals: ${fmt(day.totals.calories)} kcal · P ${fmt(day.totals.protein)}g · C ${fmt(day.totals.carbs)}g · F ${fmt(day.totals.fat)}g</p>`
        : "";

      const blocks = meals.map(m => {
        const items = (m.items || []).map(it => {
          const tags = (it.tags || []).map(t => `<span class="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHTML(t)}</span>`).join(" ");
          const allergens = (it.allergens || []).length ? `<p class="text-xs text-rose-600 mt-2">Allergens: ${it.allergens.map(escapeHTML).join(", ")}</p>` : "";
          const subs = (it.substitutions || []).length ? `<p class="text-xs text-gray-500 mt-1">Substitutions: ${it.substitutions.map(escapeHTML).join("; ")}</p>` : "";

          const ing = (it.ingredients || []).map(ing =>
            `<li>${escapeHTML(ing.item)} — ${ing.qty ?? "-"} ${escapeHTML(ing.unit || "")}</li>`
          ).join("");

          const steps = (it.steps || []).map((s, idx) => `<li><span class="font-semibold mr-2">${idx+1}.</span>${escapeHTML(s)}</li>`).join("");

          return `
            <li class="space-y-2">
              <div class="flex justify-between flex-wrap gap-2">
                <span class="text-gray-800 font-medium">${escapeHTML(it.title || "")}</span>
                <span class="text-gray-500 text-sm">${fmt(it.calories)} kcal · P ${fmt(it.protein)}g · C ${fmt(it.carbs)}g · F ${fmt(it.fat)}g</span>
              </div>
              ${it.rationale ? `<p class="text-sm text-gray-600">${escapeHTML(it.rationale)}</p>` : ""}
              ${tags ? `<div class="flex flex-wrap gap-2">${tags}</div>` : ""}

              <details class="mt-2">
                <summary class="cursor-pointer text-sm text-emerald-700">Ingredients & Steps</summary>
                <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 class="font-semibold text-gray-900 mb-2">Ingredients</h5>
                    <ul class="list-disc pl-5 space-y-1 text-sm">${ing || "<li>—</li>"}</ul>
                  </div>
                  <div>
                    <h5 class="font-semibold text-gray-900 mb-2">Steps</h5>
                    <ol class="space-y-1 text-sm">${steps || "<li>—</li>"}</ol>
                    <p class="text-xs text-gray-500 mt-2">
                      Prep ${fmt(it.prepTime)} min · Cook ${fmt(it.cookTime)} min
                    </p>
                    ${subs}
                    ${allergens}
                  </div>
                </div>
              </details>
            </li>`;
        }).join("");

        return `<div class="mb-8">
          <h4 class="font-semibold text-gray-900 mb-3">${escapeHTML(m.name || "Meal")}</h4>
          <ul class="space-y-4">${items}</ul>
        </div>`;
      }).join("");

      return `<div>
        <h3 class="text-2xl font-bold text-gray-900 mb-2">${escapeHTML(day.day || "")}</h3>
        ${summary}
        ${totals}
        ${blocks}
        ${day.notes ? `<p class="text-sm text-gray-500 mt-4">${escapeHTML(day.notes)}</p>` : ""}
      </div>`;
    }

    const fmt = (x) => (x == null || isNaN(Number(x))) ? "-" : Number(x).toFixed(0);
    const escapeHTML = (s) => String(s).replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));

    // ---------- Grocery list from ingredients (with quantity merge) ----------
    function buildGroceryList(plan) {
      const byKey = new Map();
      const add = (item, qty, unit, category) => {
        const key = `${item.toLowerCase()}|${(unit||'').toLowerCase()}`;
        const prev = byKey.get(key) || { item, qty: 0, unit: unit || "", category: category || "Other" };
        prev.qty += (Number(qty) || 0);
        byKey.set(key, prev);
      };

      let usedIngredients = false;

      (plan.days || []).forEach(d =>
        (d.meals || []).forEach(m =>
          (m.items || []).forEach(it => {
            if (Array.isArray(it.ingredients) && it.ingredients.length) {
              usedIngredients = true;
              it.ingredients.forEach(ing => { if (ing?.item) add(ing.item, ing.qty, ing.unit, ing.category); });
            }
          })
        )
      );

      if (usedIngredients) {
        return Array.from(byKey.values())
          .sort((a, b) => a.item.localeCompare(b.item))
          .map(x => ({ item: `${x.item}${x.qty ? ` — ${fmt(x.qty)} ${x.unit}` : ""}`, count: 1, category: x.category }));
      }

      // Fallback: titles
      const f = new Map();
      (plan.days || []).forEach(d =>
        (d.meals || []).forEach(m =>
          (m.items || []).forEach(it => {
            const name = (it.title || "").toLowerCase();
            if (!name) return;
            const key = name.split(/[,+()\-\u2013]/)[0].trim();
            if (!key) return;
            f.set(key, (f.get(key) || 0) + 1);
          })
        )
      );
      return Array.from(f.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([item, count]) => ({ item, count }));
    }

    function renderGroceryList(list) {
      const box = $("grocery-list-container"); if (!box) return;
      box.innerHTML = "";
      if (!list.length) { box.innerHTML = '<p class="text-sm text-gray-500">Generate a plan first.</p>'; return; }
      const ul = document.createElement("ul"); ul.className = "space-y-2";
      list.forEach(({ item, count }) => {
        const li = document.createElement("li"); li.className = "flex items-center gap-3";
        li.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
          <span class="flex-1">${escapeHTML(item)}</span>
          <span class="text-xs text-gray-500">${count > 1 ? `x${count}` : ""}</span>`;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }

    // ---------- PDF ----------
    async function downloadPDF() {
      const JSPDF = getJsPDF();
      if (!JSPDF) { showMessage("PDF engine not loaded yet."); return; }
      const doc = new JSPDF({ unit: "pt", format: "a4" });
      const node = document.querySelector(".lg\\:col-span-2"); if (!node) return showMessage("Nothing to export.");
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      const r = Math.min(W / canvas.width, H / canvas.height);
      const w = canvas.width * r, h = canvas.height * r;
      doc.addImage(img, "PNG", (W - w) / 2, 24, w, h);
      doc.save("perfect-plate-plan.pdf");
    }
  });
})();