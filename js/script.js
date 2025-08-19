// PERFECT-PLATE – Frontend App (detailed recipes + rationale + grouped grocery)
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
  const fmt = (x) => (x == null || isNaN(Number(x))) ? "-" : Number(x).toFixed(0);
  const escapeHTML = (s) => String(s).replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));
  
  // Normalize title for comparison (to avoid duplicates)
  function normalizeTitle(s){
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }

  // Pretty quantity for grocery labels (e.g., 1.5 -> "1 1/2")
  function formatQty(n){
    if (n == null || isNaN(Number(n))) return "";
    const v = Number(n);
    const whole = Math.trunc(v);
    const frac = Math.abs(v - whole);
    const asFrac = (f) => {
      if (Math.abs(f - 0.25) < 0.02) return "1/4";
      if (Math.abs(f - 0.33) < 0.03 || Math.abs(f - 1/3) < 0.03) return "1/3";
      if (Math.abs(f - 0.5)  < 0.02) return "1/2";
      if (Math.abs(f - 0.66) < 0.03 || Math.abs(f - 2/3) < 0.03) return "2/3";
      if (Math.abs(f - 0.75) < 0.02) return "3/4";
      return null;
    };
    const f = asFrac(frac);
    if (whole === 0) return f ? f : v.toFixed(2).replace(/\.00$/, "");
    return f ? `${whole} ${f}` : v % 1 === 0 ? String(whole) : v.toFixed(2).replace(/\.00$/, "");
  }

  // -------- Parse arbitrary quantity representations to a Number ----------
  function parseQuantity(q) {
    if (q == null || (typeof q === "string" && q.trim() === "")) return null;
    if (typeof q === "number") return Number.isFinite(q) ? q : null;

    if (typeof q === "string") {
      let s = q.trim()
        .replace(/½/g, "1/2")
        .replace(/¼/g, "1/4")
        .replace(/¾/g, "3/4")
        .replace(/⅓/g, "1/3")
        .replace(/⅔/g, "2/3");

      // mixed fraction e.g. "1 1/2"
      let m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s+([0-9]+)\/([0-9]+)$/);
      if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);

      // simple fraction e.g. "3/4"
      m = s.match(/^([0-9]+)\/([0-9]+)$/);
      if (m) return Number(m[1]) / Number(m[2]);

      // decimal or integer
      m = s.match(/^([0-9]+(?:\.[0-9]+)?)$/);
      if (m) return Number(m[1]);
    }
    return null;
  }

  // ---------- App ----------
  ready(() => {
    initIcons();
    let lastInputs = null;
    let currentPlan = null;

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
    const loaderText      = $("loader-text");

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

    // ---------- Loader ----------
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
    function buildJsonPromptRange(i, daysArray, avoidTitles = []) {
      const profile = {
        age: i.age, gender: i.gender, ethnicity: i.ethnicity,
        goal: i.fitnessGoal, dietPrefs: i.dietaryPrefs, exclusions: i.exclusions,
        medicalConditions: i.medicalConditions
      };

      const daysList = daysArray.join(", ");
      const avoidList = avoidTitles.length ? avoidTitles.join(", ") : "none yet";

      return `Return STRICT JSON ONLY (no markdown) with this schema:

  {
    "planTitle": "string",
    "notes": "string",
    "days": [
      {
        "day": "Monday",
        "summary": "1-2 sentence overview tied to the user's goals/conditions/preferences",
        "totals": {"calories": 1800, "protein": 120, "carbs": 180, "fat": 60},
        "meals": [
          {
            "name": "Breakfast",
            "items": [
              {
                "title": "Oatmeal with Berries",
                "calories": 350, "protein": 20, "carbs": 55, "fat": 9,
                "rationale": "Why this fits the user's profile.",
                "tags": ["High-fiber"],
                "allergens": [],
                "substitutions": [],
                "prepTime": 5, "cookTime": 5,
                "ingredients": [
                  {"item":"Rolled oats","qty":0.75,"unit":"cup","category":"Grains"},
                  {"item":"Blueberries","qty":0.5,"unit":"cup","category":"Produce"}
                ],
                "steps": ["Simmer oats in milk.", "Top with berries."]
              }
            ]
          }
        ]
      }
    ]
  }

  Do NOT repeat any recipe titles across the week. Avoid exactly these titles: ${avoidList}.

  Rules:
  - Output ONLY these days (inclusive, in order): ${daysList}.
  - EVERY meal MUST have 1–2 items; each item MUST include ingredients[] and steps[].
  - Within a day, Breakfast, Lunch, and Dinner must all be different recipes.
  - Use integers for calories/protein/carbs/fat, prepTime, cookTime (round if needed).
  - Respect medical conditions: ${i.medicalConditions || 'None'}; exclusions: ${i.exclusions || 'None'}.
  - Cultural background: ${i.ethnicity}; goal: ${i.fitnessGoal}; diet prefs: ${(i.dietaryPrefs||[]).join(', ') || 'None'}; age ${i.age}; gender ${i.gender}.
  - Prefer common US grocery items; keep titles under 60 chars.

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

    function getFirstPartText(obj){
      try {
        const parts = obj?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (typeof p.text === "string" && p.text.trim()) return p.text;
        }
        return "";
      } catch { return ""; }
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

    // ---------- Totals helper (fallback if model omits day.totals) ----------
    function ensureDayTotals(plan){
      (plan.days || []).forEach(d => {
        if (!d || !Array.isArray(d.meals)) return;
        let c=0,p=0,cb=0,f=0;
        d.meals.forEach(m => (m.items||[]).forEach(it => { c+=+it.calories||0; p+=+it.protein||0; cb+=+it.carbs||0; f+=+it.fat||0; }));
        if (!d.totals) d.totals = { calories: Math.round(c), protein: Math.round(p), carbs: Math.round(cb), fat: Math.round(f) };
      });
    }

    // Pick unique items for each meal in a day
    function pickUniqueItemsForDay(day, usedTitles) {
      if (!day || !Array.isArray(day.meals)) { day.meals = []; }
      
      // Ensure we have the three standard meals
      const want = ["breakfast", "lunch", "dinner"];
      const byName = new Map();
      (day.meals || []).forEach(m => {
        const key = String(m?.name || "").toLowerCase().trim();
        if (!byName.has(key)) byName.set(key, m);
      });
      
      // For each meal type, select a unique item
      const result = [];
      const dayUsedTitles = new Set(); // Track titles used within this day
      
      // Process each meal type
      want.forEach(mealType => {
        const meal = byName.get(mealType);
        if (!meal || !Array.isArray(meal.items) || meal.items.length === 0) {
          // Create empty meal if missing
          result.push({ 
            name: mealType.charAt(0).toUpperCase() + mealType.slice(1), 
            items: [] 
          });
          return;
        }
        
        // Try to find an item whose title hasn't been used globally or within this day
        let selectedItem = null;
        for (const item of meal.items) {
          const title = item.title || "";
          const normalizedTitle = normalizeTitle(title);
          if (!normalizedTitle) continue;
          
          if (!usedTitles.has(normalizedTitle) && !dayUsedTitles.has(normalizedTitle)) {
            selectedItem = item;
            usedTitles.add(normalizedTitle);
            dayUsedTitles.add(normalizedTitle);
            break;
          }
        }
        
        // If all items are duplicates, just use the first one
        if (!selectedItem && meal.items.length > 0) {
          selectedItem = meal.items[0];
          const normalizedTitle = normalizeTitle(selectedItem.title || "");
          if (normalizedTitle) {
            usedTitles.add(normalizedTitle);
            dayUsedTitles.add(normalizedTitle);
          }
        }
        
        // Add the selected item to the result
        result.push({
          name: meal.name || (mealType.charAt(0).toUpperCase() + mealType.slice(1)),
          items: selectedItem ? [selectedItem] : []
        });
      });
      
      day.meals = result;
      return day;
    }

    // Enforce exactly Breakfast/Lunch/Dinner (one item each) per day
    function normalizeDayMeals(day){
      if (!day || !Array.isArray(day.meals)) { day.meals = []; }
      const want = ["breakfast","lunch","dinner"];
      const byName = new Map();
      (day.meals || []).forEach(m => {
        const key = String(m?.name || "").toLowerCase().trim();
        if (!byName.has(key)) byName.set(key, m);
      });

      const pickOneItem = (m) => {
        if (!m) return null;
        if (!Array.isArray(m.items) || m.items.length === 0) return null;
        // Don't modify if already has exactly one item
        if (m.items.length === 1) return m;
        m.items = [m.items[0]]; // exactly one item per meal
        return m;
      };

      const result = [];
      // Use existing meals if present
      want.forEach(w => {
        const m = byName.get(w);
        if (m) result.push(pickOneItem({ ...m, name: m.name || (w.charAt(0).toUpperCase()+w.slice(1)) }));
      });
      // If any missing, try to repurpose other meals (e.g., snacks) or duplicate breakfast item
      const others = (day.meals || []).filter(m => !want.includes(String(m?.name || "").toLowerCase()));
      while (result.length < 3) {
        const needed = want[result.length];
        let source = result[0] || others.shift();
        if (!source) break;
        const clone = JSON.parse(JSON.stringify(source));
        clone.name = needed.charAt(0).toUpperCase()+needed.slice(1);
        pickOneItem(clone);
        result.push(clone);
      }
      // Final fallback: create empty shells so UI remains consistent
      while (result.length < 3) {
        result.push({ name: (want[result.length].charAt(0).toUpperCase()+want[result.length].slice(1)), items: [] });
      }
      day.meals = result;
    }

    // ---------- Why-this-plan card ----------
    function buildWhyThisPlan(plan, inputs){
      const bullets = new Map();
      (plan.days||[]).forEach(d => (d.meals||[]).forEach(m => (m.items||[]).forEach(it => {
        const r = (it.rationale||"").trim();
        if (r) bullets.set(r, (bullets.get(r)||0)+1);
      })));
      const top = Array.from(bullets.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t])=>t);

      const bits = [];
      if (inputs.goal) bits.push(`goal of **${inputs.goal}**`);
      if (inputs.dietaryPrefs?.length) bits.push(`diet: **${inputs.dietaryPrefs.join(", ")}**`);
      if (inputs.exclusions) bits.push(`exclusions: **${inputs.exclusions}**`);
      if (inputs.medicalConditions) bits.push(`conditions: **${inputs.medicalConditions}**`);
      if (inputs.ethnicity) bits.push(`cultural cues: **${inputs.ethnicity}**`);

      const summary = `Built for your ${bits.join(" • ")}. Portions and macros are balanced across the day to support your profile.`;
      return { summary, bullets: top };
    }

    function renderWhyCard(plan, inputs){
      const card = $("why-card"), list = $("why-bullets"), sum = $("why-summary");
      if (!card || !list || !sum) return;
      const { summary, bullets } = buildWhyThisPlan(plan, inputs);
      sum.innerHTML = escapeHTML(summary).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      list.innerHTML = bullets.length ? bullets.map(b=>`<li>${escapeHTML(b)}</li>`).join("") : "<li>No special rationale provided.</li>";
      card.classList.remove("hidden");
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
      lastInputs = { age, gender, ethnicity, medicalConditions, fitnessGoal, exclusions, dietaryPrefs, goal: fitnessGoal };

      formContainer.style.display = "none";
      showLoader();

      try {
        // Generate each day individually to avoid long JSON truncation and make parsing more reliable
        const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
        const usedTitles = new Set(); // Track used titles across all days

        async function generateDay(dayName) {
          async function tryOnce(maxTokens, temperature, useSchema = true) {
            const prompt = buildJsonPromptRange(lastInputs, [dayName], Array.from(usedTitles).slice(0, 100));
            const body = {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
                response_mime_type: "application/json",
              }
            };
            if (useSchema) {
              body.generationConfig.response_schema = {
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
              };
            }

            const resp = await secureApiCall("generate-plan", {
              endpoint: "gemini-1.5-flash:generateContent",
              body
            });

            const text = getFirstPartText(resp);
            window.__lastPlanText = text || ""; // for debugging in console
            if (!text) {
              console.warn("Model returned no text for", dayName, "Full response:", resp);
              return null;
            }
            let partPlan = coercePlan(extractFirstJSON(text));
            if (!partPlan || !Array.isArray(partPlan.days)) {
              console.warn("Failed to parse JSON for", dayName, "Raw text (first 400 chars):", String(text).slice(0,400));
              return null;
            }
            if (needsRepair(partPlan)) {
              partPlan = await repairPlan(partPlan, lastInputs);
            }
            return partPlan;
          }

          // Try with schema + higher token budget, then retry with smaller budget, then without schema
          let planPart = await tryOnce(2200, 0.7, true);
          if (!planPart) planPart = await tryOnce(1600, 0.4, true);
          if (!planPart) planPart = await tryOnce(1400, 0.3, false);
          return planPart;
        }

        // Generate days sequentially to ensure stability and clearer error boundaries
        const daysOut = [];
        for (let i = 0; i < DAYS.length; i++) {
          const day = DAYS[i];
          if (loaderText) loaderText.textContent = `Creating your plan… ${i+1}/7 (${day})`;
          try {
            const part = await generateDay(day);
            if (part?.days?.[0]) {
              // Select unique items and track their titles
              const processedDay = pickUniqueItemsForDay(part.days[0], usedTitles);
              daysOut.push(processedDay);
            } else {
              console.warn("No valid plan for", day);
            }
          } catch (e) {
            console.warn("Error generating", day, e);
          }
        }

        if (!daysOut.length) {
          throw new Error("Plan format invalid.");
        }

        let plan = {
          planTitle: "Your 7-Day Plan",
          notes: "",
          days: daysOut
        };

        // We've already picked unique items, so normalizeDayMeals should just ensure structure
        // (it won't change items if there's already exactly one per meal)
        (plan.days || []).forEach(normalizeDayMeals);

        ensureDayTotals(plan);
        renderResults(plan, lastInputs);

        // Plan image: use Unsplash featured image related to cuisine/goal (no API key required)
        try {
          const cuisine = encodeURIComponent(ethnicity || "healthy");
          const theme = encodeURIComponent(fitnessGoal || "wellness");
          const url = `https://source.unsplash.com/featured/1200x800?food,healthy,${cuisine},${theme}`;
          if (mealPlanImage) mealPlanImage.src = url;
        } catch (imgErr) { console.warn("Image load failed:", imgErr); }

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
    function renderResults(plan, inputs) {
      // why card
      currentPlan = plan;
      renderWhyCard(plan, inputs);

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

      $("grocery-list-button")?.addEventListener("click", () => renderGroceryList(buildGroceryGroups(plan)));

      // Ensure a Download CSV button exists under the grocery button
      (function ensureCsvButton(){
        const glb = $("grocery-list-button");
        const existing = document.getElementById("grocery-csv-button");
        const attachHandler = (btn) => {
          btn.addEventListener("click", () => {
            const groups = buildGroceryGroups(currentPlan || plan);
            const csv = groupsToCSV(groups);
            downloadTextFile("grocery-list.csv", csv);
          });
        };
        if (glb && !existing) {
          const btn = document.createElement("button");
          btn.id = "grocery-csv-button";
          btn.type = "button";
          btn.className = "mt-3 w-full bg-white text-gray-800 font-semibold py-3 px-4 rounded-lg hover:bg-gray-100 border border-gray-300";
          btn.textContent = "Download CSV";
          glb.insertAdjacentElement("afterend", btn);
          attachHandler(btn);
        } else if (existing) {
          existing.onclick = null;
          attachHandler(existing);
        }
      })();

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

          const ing = (it.ingredients || []).map(ing => {
            if (typeof ing === "string") {
              return `<li>${escapeHTML(ing)}</li>`;
            } else {
              const item = ing?.item ?? "";
              const qty = ing?.qty ?? "-";
              const unit = ing?.unit || "";
              return `<li>${escapeHTML(item)} — ${qty} ${escapeHTML(unit)}</li>`;
            }
          }).join("");

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

    // Normalize ingredient entries that may be strings or objects
    function normalizeIngredient(ing){
      if (!ing) return null;
      if (typeof ing === "object" && ing.item) {
        return {
          item: String(ing.item),
          qty: parseQuantity(ing.qty),
          unit: ing.unit || "",
          category: ing.category || "Other"
        };
      }
      if (typeof ing === "string") {
        // Normalize unicode fractions
        let s = ing.trim()
          .replace(/½/g, "1/2")
          .replace(/¼/g, "1/4")
          .replace(/¾/g, "3/4")
          .replace(/⅓/g, "1/3")
          .replace(/⅔/g, "2/3")
          .replace(/\s+/g, " ");

        // mixed fraction: "1 1/2 cup oats"
        let m = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)\s*([a-zA-Z]+)?\s*(.*)$/);
        if (m) {
          const qty = Number(m[1]) + Number(m[2]) / Number(m[3]);
          return { item: (m[5] || "").trim() || (m[4] || ""), qty, unit: (m[4] || ""), category: "Other" };
        }
        // simple fraction: "1/2 cup oats"
        m = s.match(/^(\d+)\/(\d+)\s*([a-zA-Z]+)?\s*(.*)$/);
        if (m) {
          const qty = Number(m[1]) / Number(m[2]);
          return { item: (m[4] || "").trim() || (m[3] || ""), qty, unit: (m[3] || ""), category: "Other" };
        }
        // decimal or integer: "2 tbsp oil" or "0.5 cup milk"
        m = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
        if (m) {
          const qty = Number(m[1]);
          return { item: (m[3] || "").trim() || (m[2] || ""), qty, unit: (m[2] || ""), category: "Other" };
        }
        // fallback: just item name
        return { item: s, qty: null, unit: "", category: "Other" };
      }
      return null;
    }

    // ---------- Grocery (grouped by category) ----------
    function buildGroceryGroups(plan) {
      const byKey = new Map();
      const add = (item, qty, unit, category) => {
        const cat = (category || "Other").trim() || "Other";
        const key = `${cat}||${item.toLowerCase()}|${(unit||'').toLowerCase()}`;
        const prev = byKey.get(key) || { item, qty: null, unit: unit || "", category: cat };
        const num = (qty == null ? null : Number(qty));
        if (Number.isFinite(num)) {
          prev.qty = (prev.qty == null ? num : prev.qty + num);
        }
        byKey.set(key, prev);
      };

      let usedIngredients = false;

      (plan.days || []).forEach(d =>
        (d.meals || []).forEach(m =>
          (m.items || []).forEach(it => {
            if (Array.isArray(it.ingredients) && it.ingredients.length) {
              it.ingredients.forEach(ing => {
                const n = normalizeIngredient(ing);
                if (n && n.item) {
                  add(n.item, n.qty, n.unit, n.category);
                  usedIngredients = true;
                }
              });
            }
          })
        )
      );

      // If model gave no ingredients, fallback to titles in "Other"
      if (!usedIngredients) {
        (plan.days || []).forEach(d =>
          (d.meals || []).forEach(m =>
            (m.items || []).forEach(it => {
              const name = (it.title || "").trim();
              if (!name) return;
              add(name, 1, "", "Other");
            })
          )
        );
      }

      // Group by category
      const groupsMap = new Map();
      Array.from(byKey.values()).forEach(v => {
        const arr = groupsMap.get(v.category) || [];
        arr.push(v);
        groupsMap.set(v.category, arr);
      });

      // Sort categories in a friendly order
      const order = ["Produce","Protein","Grains","Dairy","Pantry","Frozen","Other"];
      const cats = Array.from(groupsMap.keys()).sort((a,b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      return cats.map(cat => {
        const items = groupsMap.get(cat).sort((a,b)=>a.item.localeCompare(b.item));
        return {
          category: cat,
          items: items.map(x => ({
            label: `${x.item}${(x.qty != null && x.qty > 0) ? ` — ${formatQty(x.qty)} ${x.unit}` : ""}`,
            item: x.item,
            qty: x.qty,
            unit: x.unit
          }))
        };
      });
    }

    function renderGroceryList(groups) {
      const box = $("grocery-list-container"); if (!box) return;
      box.innerHTML = "";
      if (!groups.length) { box.innerHTML = '<p class="text-sm text-gray-500">Generate a plan first.</p>'; return; }

      groups.forEach(group => {
        const wrap = document.createElement("div");
        const title = document.createElement("div");
        title.className = "grocery-category";
        title.textContent = group.category;
        wrap.appendChild(title);

        const ul = document.createElement("ul");
        ul.className = "space-y-2";
        group.items.forEach(({ label }) => {
          const li = document.createElement("li");
          li.className = "flex items-center gap-3";
          li.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
            <span class="flex-1">${escapeHTML(label)}</span>`;
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
        box.appendChild(wrap);
      });
    }

    // ---------- CSV helpers ----------
    function csvEscape(v){
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }
    function groupsToCSV(groups){
      const rows = [["Category","Item","Qty","Unit"]];
      groups.forEach(g => {
        (g.items || []).forEach(it => {
          rows.push([g.category || "", it.item || "", it.qty != null ? formatQty(it.qty) : "", it.unit || ""]);
        });
      });
      return rows.map(r => r.map(csvEscape).join(",")).join("\n");
    }
    function downloadTextFile(filename, text){
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
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
