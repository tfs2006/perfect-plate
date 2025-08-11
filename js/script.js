// PERFECT‑PLATE – Robust Frontend (safe init + DOMContentLoaded + stepper working)
(function () {
  // ---------- Utilities ----------
  function $(id) { return document.getElementById(id); }
  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }
  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (_) { /* ignore */ }
    }
  }
  function getJsPDF() { return (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null; }
  function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

  // ---------- Main ----------
  ready(function () {
    initIcons();

    // Resolve serverless base (safe for GitHub Pages + Netlify). Empty means "not configured".
    const API_BASE = (typeof window.API_BASE === 'string' && window.API_BASE.trim())
      ? window.API_BASE.replace(/\/$/, '')
      : (location.hostname.endsWith('.netlify.app') ? '/.netlify/functions' : '');

    // DOM nodes
    const form = $('meal-plan-form');
    const formContainer = $('form-container');
    const resultContainer = $('result-container');
    const loader = $('loader');
    const messageBox = $('message-box');
    const messageText = $('message-text');
    const mealPlanImage = $('meal-plan-image');

    // Guard: if critical nodes are missing, bail
    if (!form || !formContainer || !resultContainer) {
      console.error('Core DOM nodes not found; check index.html ids');
      return;
    }

    // ---------- Stepper ----------
    function goToStep(i) {
      [1, 2, 3].forEach(s => {
        const panel = $(`step-${s}`);
        if (panel) panel.classList.toggle('active', s === i);

        const ind = $(`step-${s}-indicator`);
        if (ind) {
          ind.style.opacity = (s === i) ? '1' : '.5';
          const bubble = ind.querySelector('div');
          if (bubble) bubble.classList.toggle('bg-emerald-500', s === i);
        }
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    $('next-1')?.addEventListener('click', () => goToStep(2));
    $('back-2')?.addEventListener('click', () => goToStep(1));
    $('next-2')?.addEventListener('click', () => goToStep(3));
    $('back-3')?.addEventListener('click', () => goToStep(2));

    // ---------- Toast helper ----------
    function showMessage(msg, timeout = 3000) {
      if (!messageBox || !messageText) { alert(msg); return; }
      messageText.textContent = msg;
      messageBox.classList.remove('hidden');
      setTimeout(() => messageBox.classList.add('hidden'), timeout);
    }

    // ---------- Local storage (remember inputs) ----------
    const FIELDS = ['age', 'gender', 'ethnicity', 'medical-conditions', 'exclusions', 'fitness-goal'];
    function saveState() {
      const data = {};
      FIELDS.forEach(id => data[id] = $(id)?.value ?? '');
      data['diet'] = Array.from(document.querySelectorAll('input[name="diet"]:checked')).map(x => x.value);
      try { localStorage.setItem('pp_state', JSON.stringify(data)); } catch (_) {}
    }
    function loadState() {
      try {
        const raw = localStorage.getItem('pp_state');
        if (!raw) return;
        const data = JSON.parse(raw);
        FIELDS.forEach(id => { if (data[id] != null && $(id)) $(id).value = data[id]; });
        if (Array.isArray(data.diet)) {
          data.diet.forEach(v => { const el = document.querySelector(`input[name="diet"][value="${v}"]`); if (el) el.checked = true; });
        }
      } catch (_) { }
    }
    loadState();
    form.addEventListener('input', debounce(saveState, 300));

    // ---------- API helpers ----------
    async function secureApiCall(path, payload) {
      const base = API_BASE || '';
      if (!base) throw new Error('No API_BASE configured. Set window.API_BASE in js/config.js to your Netlify Functions URL.');
      const url = `${base}/${path}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(`API error (${res.status}): ${txt || res.statusText}`); }
      return res.json();
    }

    function buildJsonPrompt(inputs) {
      return `You are a dietitian. Return STRICT JSON ONLY that matches this schema (no markdown):\n{\n  "planTitle": "string",\n  "days": [\n    {\n      "day": "Monday|Tuesday|...",\n      "meals": [\n        {"name":"Breakfast","items":[{"title":"Greek yogurt with berries","calories": number, "protein": number, "carbs": number, "fat": number}]},\n        {"name":"Lunch","items":[...]},\n        {"name":"Snack","items":[...]},\n        {"name":"Dinner","items":[...]}\n      ]\n    }\n  ],\n  "notes": "string with general advice"\n}\nConstraints:\n- Exactly 7 days.\n- Foods must respect: medical conditions: ${inputs.medicalConditions || 'None'}, exclusions: ${inputs.exclusions || 'None'}.\n- Cultural background: ${inputs.ethnicity}. Goal: ${inputs.fitnessGoal}. Diet prefs: ${(inputs.dietaryPrefs || []).join(', ') || 'None'}.\n- Age ${inputs.age}, gender ${inputs.gender}.\n- Include approximate macros per item (protein/carbs/fat) and calories.\n- Keep titles short and realistic foods available at US grocery stores.`;
    }

    // ---------- Submit ----------
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) { showMessage('Please complete required fields.'); return; }

      // If API not configured yet, show a helpful message (so local testing still works)
      if (!API_BASE) { showMessage('API not configured. Set window.API_BASE in js/config.js to your Netlify site\'s /.netlify/functions URL.'); return; }

      const age = $('age').value.trim();
      const gender = $('gender').value;
      const ethnicity = $('ethnicity').value.trim();
      const medicalConditions = $('medical-conditions').value.trim();
      const fitnessGoal = $('fitness-goal').value;
      const exclusions = $('exclusions').value.trim();
      const dietaryPrefs = Array.from(document.querySelectorAll('input[name="diet"]:checked')).map(el => el.value);

      const prompt = buildJsonPrompt({ age, gender, ethnicity, medicalConditions, fitnessGoal, exclusions, dietaryPrefs });

      // Show loader only when we actually call the API
      formContainer.style.display = 'none';
      if (loader) loader.style.display = 'flex';

      try {
        const textResult = await secureApiCall('generate-plan', {
          endpoint: 'gemini-2.0-flash:generateContent',
          body: { contents: [{ parts: [{ text: prompt }] }] }
        });

        const text = textResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = text.trim().replace(/^```json\s*|```$/g, '').trim();
        const plan = JSON.parse(cleaned);
        renderResults(plan);

        // Optional image generation (non‑fatal)
        try {
          const imagePrompt = `Flat‑lay, appetizing mixed dishes inspired by ${ethnicity} cuisine, vibrant healthy colors, natural light, wooden table; editorial food photography.`;
          const imageResult = await secureApiCall('generate-plan', {
            endpoint: 'imagen-3.0-generate-002:predict',
            body: { instances: [{ prompt: imagePrompt }], parameters: { sampleCount: 1 } }
          });
          const b64 = imageResult?.predictions?.[0]?.bytesBase64Encoded;
          if (b64 && mealPlanImage) mealPlanImage.src = `data:image/png;base64,${b64}`;
        } catch (imgErr) {
          console.warn('Image generation failed:', imgErr);
        }

        if (loader) loader.style.display = 'none';
        resultContainer.style.display = 'block';
      } catch (err) {
        console.error(err);
        if (loader) loader.style.display = 'none';
        formContainer.style.display = 'block';
        showMessage(err.message || 'Something went wrong.');
      }
    });

    // ---------- Rendering ----------
    function renderResults(plan) {
      if (!plan || !Array.isArray(plan.days)) throw new Error('Plan format invalid.');
      const tabs = $('result-tabs');
      const content = $('tab-content');
      if (tabs) tabs.innerHTML = '';
      if (content) content.innerHTML = '';

      plan.days.forEach((d, idx) => {
        const id = `tab-${idx}`;
        const a = document.createElement('a');
        a.href = '#'; a.dataset.tab = id;
        a.className = 'result-tab whitespace-nowrap py-4 px-1 border-b-2 border-transparent text-sm font-semibold text-gray-600 hover:text-gray-800 hover:border-gray-300';
        a.textContent = d.day || `Day ${idx + 1}`;
        a.addEventListener('click', (e) => { e.preventDefault(); activateTab(id); });
        if (tabs) tabs.appendChild(a);

        const panel = document.createElement('div');
        panel.id = id; panel.className = 'tab-panel hidden';
        panel.innerHTML = renderDayHTML(d);
        if (content) content.appendChild(panel);
      });

      if (plan.days.length) activateTab('tab-0');

      const glBtn = $('grocery-list-button');
      if (glBtn) glBtn.onclick = () => { renderGroceryList(buildGroceryList(plan)); };

      const pdfBtn = $('pdf-button');
      if (pdfBtn) pdfBtn.onclick = downloadPDF;

      const refBtn = $('refine-button');
      if (refBtn) refBtn.onclick = () => { resultContainer.style.display = 'none'; formContainer.style.display = 'block'; goToStep(1); };
    }

    function activateTab(id) {
      document.querySelectorAll('.result-tab').forEach(el => el.classList.remove('active', 'text-emerald-600', 'border-emerald-600'));
      document.querySelectorAll('.tab-panel').forEach(el => el.classList.add('hidden'));
      const link = Array.from(document.querySelectorAll('.result-tab')).find(a => a.dataset.tab === id);
      if (link) link.classList.add('active', 'text-emerald-600', 'border-emerald-600');
      const panel = $(id);
      if (panel) panel.classList.remove('hidden');
    }

    function renderDayHTML(day) {
      const meals = day.meals || [];
      const blocks = meals.map(m => {
        const items = (m.items || []).map(it => `
      <li class="flex justify-between gap-4">
        <span class="text-gray-800">${escapeHTML(it.title || '')}</span>
        <span class="text-gray-500 text-sm">${fmt(it.calories)} kcal · P ${fmt(it.protein)}g · C ${fmt(it.carbs)}g · F ${fmt(it.fat)}g</span>
      </li>`).join('');
        return `
    <div class="mb-6">
      <h4 class="font-semibold text-gray-900 mb-2">${escapeHTML(m.name || 'Meal')}</h4>
      <ul class="space-y-2">${items}</ul>
    </div>`;
      }).join('');

      return `<div>
    <h3 class="text-2xl font-bold text-gray-900 mb-4">${escapeHTML(day.day || '')}</h3>
    ${blocks}
    ${day.notes ? `<p class="text-sm text-gray-500 mt-4">${escapeHTML(day.notes)}</p>` : ''}
  </div>`;
    }

    function fmt(x) { return (x == null || isNaN(Number(x))) ? '-' : Number(x).toFixed(0); }
    function escapeHTML(s) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(s).replace(/[&<>"']/g, c => map[c] || c); }

    function buildGroceryList(plan) {
      const freq = new Map();
      (plan.days || []).forEach(d => (d.meals || []).forEach(m => (m.items || []).forEach(it => {
        const name = (it.title || '').toLowerCase();
        if (!name) return;
        const key = name.split(/[,+()\-]/)[0].trim();
        if (!key) return;
        freq.set(key, (freq.get(key) || 0) + 1);
      })));
      return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).map(([item, count]) => ({ item, count }));
    }

    function renderGroceryList(list) {
      const box = $('grocery-list-container');
      if (!box) return;
      box.innerHTML = '';
      if (!list.length) { box.innerHTML = '<p class="text-sm text-gray-500">Generate a plan first.</p>'; return; }
      const ul = document.createElement('ul'); ul.className = 'space-y-2';
      list.forEach(({ item, count }) => {
        const li = document.createElement('li'); li.className = 'flex items-center gap-3';
        li.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
      <span class="flex-1 capitalize">${escapeHTML(item)}</span>
      <span class="text-xs text-gray-500">x${count}</span>`;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }

    async function downloadPDF() {
      const JSPDF = getJsPDF();
      if (!JSPDF) { showMessage('PDF engine not loaded yet. Try again in a second.'); return; }
      const doc = new JSPDF({ unit: 'pt', format: 'a4' });
      const node = document.querySelector('.lg\\:col-span-2');
      if (!node) return showMessage('Nothing to export.');
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      doc.addImage(imgData, 'PNG', (pageWidth - w) / 2, 24, w, h);
      doc.save('perfect-plate-plan.pdf');
    }

    // Expose for quick debugging from console
    window.__PP__ = { goToStep };
  });
})();