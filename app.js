/**
 * Every Eval Ever — Form Submission UI
 * Pure frontend, GitHub Pages compatible.
 * Generates {uuid4}.json from the eval schema v0.2.2
 */

// ===================================================
// UUID v4 generator (RFC 4122 compliant, no deps)
// ===================================================
function uuidv4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ===================================================
// State
// ===================================================
let currentStep = 1;
const TOTAL_STEPS = 6;
let currentFileUUID = uuidv4();
let resultCount = 0;

// ===================================================
// Theme
// ===================================================
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('eee-theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('eee-theme', 'dark');
    }
}

// ===================================================
// Step Navigation
// ===================================================
function updateProgress() {
    const pct = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('step-counter').textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;

    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const ind = document.getElementById(`step-indicator-${i}`);
        ind.classList.remove('active', 'completed');
        if (i === currentStep) ind.classList.add('active');
        else if (i < currentStep) ind.classList.add('completed');
    }

    document.getElementById('btn-prev').disabled = currentStep === 1;
    const nextBtn = document.getElementById('btn-next');
    if (currentStep === TOTAL_STEPS) {
        nextBtn.style.display = 'none';
    } else {
        nextBtn.style.display = 'flex';
        nextBtn.textContent = '';
        nextBtn.innerHTML = 'Next <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';
    }
}

function showStep(n) {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${n}`).classList.add('active');
    currentStep = n;
    updateProgress();
    window.scrollTo({ top: document.getElementById('form-wizard').offsetTop - 80, behavior: 'smooth' });
}

function nextStep() {
    const errors = validateStep(currentStep);
    if (errors.length > 0) {
        showValidationErrors(errors);
        return;
    }
    if (currentStep < TOTAL_STEPS) {
        if (currentStep === TOTAL_STEPS - 1) {
            prepareReview();
        }
        showStep(currentStep + 1);
    }
}

function prevStep() {
    if (currentStep > 1) showStep(currentStep - 1);
}

// ===================================================
// Inline Validation Feedback
// ===================================================
function showValidationErrors(errors) {
    errors.forEach(e => {
        if (e.id) markError(e.id, e.msg);
    });
    showToast('\u26A0 Please fill in all required fields.', 'error');
}

function validateStep(step) {
    const errors = [];
    if (step === 1) {
        const evalId = v('evaluation_id');
        const ts = v('retrieved_timestamp');
        if (!evalId) errors.push({ id: 'evaluation_id', msg: 'Evaluation ID is required' });
        if (!ts) {
            errors.push({ id: 'retrieved_timestamp', msg: 'Retrieved Timestamp is required' });
        } else {
            const isUnix = /^-?\d+(\.\d+)?$/.test(ts) && parseFloat(ts) > 0;
            const isISO  = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(ts);
            if (!isUnix && !isISO) errors.push({ id: 'retrieved_timestamp', msg: 'Must be Unix epoch or ISO 8601' });
        }
        // Also validate optional evaluation_timestamp if filled
        const ets = v('evaluation_timestamp');
        if (ets) {
            const isUnix = /^-?\d+(\.\d+)?$/.test(ets) && parseFloat(ets) > 0;
            const isISO  = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(ets);
            if (!isUnix && !isISO) errors.push({ id: 'evaluation_timestamp', msg: 'Must be Unix epoch or ISO 8601' });
        }
    }
    if (step === 2) {
        if (!v('source_type')) errors.push({ id: 'source_type', msg: 'Source Type is required' });
        if (!v('source_organization_name')) errors.push({ id: 'source_organization_name', msg: 'Organization Name is required' });
        if (!v('evaluator_relationship')) errors.push({ id: 'evaluator_relationship', msg: 'Evaluator Relationship is required' });
    }
    if (step === 3) {
        if (!v('model_name')) errors.push({ id: 'model_name', msg: 'Model Name is required' });
        if (!v('model_id')) errors.push({ id: 'model_id', msg: 'Model ID is required' });
    }
    if (step === 4) {
        // Validate all library entry cards
        const libCards = document.querySelectorAll('.library-entry-card');
        libCards.forEach((card, i) => {
            const idx = card.dataset.libIdx;
            const nameEl = card.querySelector(`[id="lib_name_${idx}"]`);
            const verEl  = card.querySelector(`[id="lib_version_${idx}"]`);
            if (nameEl && !nameEl.value.trim()) errors.push({ id: nameEl.id, msg: 'Library Name is required' });
            if (verEl  && !verEl.value.trim())  errors.push({ id: verEl.id,  msg: 'Version is required' });
        });
        if (libCards.length === 0) {
            showToast('\u26A0 Add at least one evaluation library.', 'error');
            errors.push({ id: null, msg: 'At least one library required' });
        }
    }
    if (step === 5) {
        const cards = document.querySelectorAll('.result-card');
        if (cards.length === 0) {
            errors.push({ id: null, msg: 'At least one evaluation result is required' });
            showToast('\u26A0 Add at least one evaluation result.', 'error');
        }
        cards.forEach((card, i) => {
            const idx = card.dataset.resultIdx;
            const eName = card.querySelector(`[id="eval_name_${idx}"]`);
            const score = card.querySelector(`[id="score_${idx}"]`);
            const datasetName = card.querySelector(`[id="dataset_name_${idx}"]`);
            if (eName && !eName.value.trim()) errors.push({ id: eName.id, msg: 'Evaluation name required' });
            if (score && score.value === '') errors.push({ id: score.id, msg: 'Score required' });
            if (datasetName && !datasetName.value.trim()) errors.push({ id: datasetName.id, msg: 'Dataset name required' });
        });
    }
    return errors;
}

function v(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

// ===================================================
// Key-Value Pair management
// ===================================================
function addKVRow(containerId) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" placeholder="key" class="kv-key">
        <input type="text" placeholder="value" class="kv-val">
        <button type="button" class="kv-remove" title="Remove" onclick="this.parentElement.remove()">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>`;
    container.appendChild(row);
}

function collectKV(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const rows = container.querySelectorAll('.kv-row');
    const obj = {};
    rows.forEach(row => {
        const key = row.querySelector('.kv-key')?.value.trim();
        const val = row.querySelector('.kv-val')?.value.trim();
        if (key) obj[key] = val || '';
    });
    return Object.keys(obj).length > 0 ? obj : undefined;
}

// ===================================================
// Results Management
// ===================================================
function addResult() {
    resultCount++;
    const idx = resultCount;
    const container = document.getElementById('results-container');
    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.resultIdx = idx;
    card.innerHTML = buildResultCard(idx);
    container.appendChild(card);
    // Trigger source tab logic
    selectSourceTab(idx, 'hf');
    // Trigger score type logic
    updateScoreType(idx);
}

function buildResultCard(idx) {
    return `
    <div class="result-card-header">
        <span class="result-card-title">Result #${idx}</span>
        <button type="button" class="btn-remove-result" onclick="removeResult(this)">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            Remove
        </button>
    </div>

    <div class="form-grid">
        <div class="form-group">
            <label for="eval_result_id_${idx}">Result ID</label>
            <input type="text" id="eval_result_id_${idx}" class="form-input" placeholder="e.g. mmlu_pro_cot_correct">
            <span class="field-hint">Stable identifier for this metric result (optional).</span>
        </div>
        <div class="form-group">
            <label for="eval_name_${idx}">Evaluation Name <span class="required">*</span></label>
            <input type="text" id="eval_name_${idx}" class="form-input" placeholder="e.g. MMLU-Pro - COT correct" oninput="clearError(this)" onblur="validateFilled(this)">
        </div>
        <div class="form-group">
            <label for="eval_timestamp_${idx}">Evaluation Timestamp</label>
            <div class="ts-field-wrap">
                <input type="text" id="eval_timestamp_${idx}" class="form-input" placeholder="Unix epoch or ISO 8601" oninput="validateTimestamp(this)" onblur="validateTimestamp(this)">
                <div class="ts-btn-group">
                    <button type="button" class="ts-btn" onclick="setTimestampNow('eval_timestamp_${idx}','unix')">Now (Unix)</button>
                    <button type="button" class="ts-btn" onclick="setTimestampNow('eval_timestamp_${idx}','iso')">Now (ISO)</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Source Data -->
    <div class="subsection-label">Source Data <span class="required">*</span></div>
    <div class="source-data-tabs" id="source-tabs-${idx}">
        <button type="button" class="source-tab active" id="tab-hf-${idx}" onclick="selectSourceTab(${idx}, 'hf')">HuggingFace</button>
        <button type="button" class="source-tab" id="tab-url-${idx}" onclick="selectSourceTab(${idx}, 'url')">URL</button>
        <button type="button" class="source-tab" id="tab-private-${idx}" onclick="selectSourceTab(${idx}, 'private')">Other</button>
    </div>

    <!-- HF Panel -->
    <div class="source-tab-panel active form-grid" id="src-hf-${idx}">
        <div class="form-group">
            <label for="dataset_name_${idx}">Dataset Name <span class="required">*</span></label>
            <input type="text" id="dataset_name_${idx}" class="form-input" placeholder="e.g. MMLU-Pro">
        </div>
        <div class="form-group">
            <label for="hf_repo_${idx}">HF Repository</label>
            <input type="text" id="hf_repo_${idx}" class="form-input" placeholder="e.g. TIGER-Lab/MMLU-Pro">
        </div>
        <div class="form-group">
            <label for="hf_split_${idx}">Split</label>
            <select id="hf_split_${idx}" class="form-select">
                <option value="">Select split…</option>
                <option value="train">train</option>
                <option value="val">val</option>
                <option value="test">test</option>
            </select>
        </div>
        <div class="form-group">
            <label for="samples_number_${idx}">Samples Count</label>
            <input type="number" id="samples_number_${idx}" class="form-input" placeholder="e.g. 12032" min="0">
        </div>
    </div>

    <!-- URL Panel -->
    <div class="source-tab-panel form-grid" id="src-url-${idx}">
        <div class="form-group">
            <label for="dataset_name_url_${idx}">Dataset Name <span class="required">*</span></label>
            <input type="text" id="dataset_name_url_${idx}" class="form-input" placeholder="e.g. GSM8K">
        </div>
        <div class="form-group full-width">
            <label for="url_list_${idx}">URL(s) — one per line <span class="required">*</span></label>
            <textarea id="url_list_${idx}" class="form-input form-textarea" rows="3" placeholder="https://example.com/dataset.json&#10;https://..."></textarea>
        </div>
    </div>

    <!-- Private Panel -->
    <div class="source-tab-panel form-grid" id="src-private-${idx}">
        <div class="form-group">
            <label for="dataset_name_priv_${idx}">Dataset Name <span class="required">*</span></label>
            <input type="text" id="dataset_name_priv_${idx}" class="form-input" placeholder="e.g. Internal Benchmark">
        </div>
    </div>

    <!-- Metric Config -->
    <div class="subsection-label">Metric Configuration <span class="required">*</span></div>
    <div class="form-grid">
        <div class="form-group">
            <label for="metric_id_${idx}">Metric ID</label>
            <input type="text" id="metric_id_${idx}" class="form-input" placeholder="e.g. accuracy, f1_macro, pass_at_k">
        </div>
        <div class="form-group">
            <label for="metric_name_${idx}">Metric Name</label>
            <input type="text" id="metric_name_${idx}" class="form-input" placeholder="e.g. Accuracy, F1-macro, pass@1">
        </div>
        <div class="form-group">
            <label for="metric_kind_${idx}">Metric Kind</label>
            <input type="text" id="metric_kind_${idx}" class="form-input" placeholder="e.g. accuracy, f1, auroc, elo">
        </div>
        <div class="form-group">
            <label for="metric_unit_${idx}">Metric Unit</label>
            <input type="text" id="metric_unit_${idx}" class="form-input" placeholder="e.g. proportion, percent, points">
        </div>
        <div class="form-group">
            <label for="eval_description_${idx}">Evaluation Description</label>
            <input type="text" id="eval_description_${idx}" class="form-input" placeholder="Brief description of what is measured">
        </div>
        <div class="form-group">
            <label for="score_type_${idx}">Score Type</label>
            <select id="score_type_${idx}" class="form-select" onchange="updateScoreType(${idx})">
                <option value="">Not specified</option>
                <option value="continuous">continuous</option>
                <option value="binary">binary</option>
                <option value="levels">levels</option>
            </select>
        </div>

        <!-- Continuous fields -->
        <div class="form-group" id="min-score-group-${idx}">
            <label for="min_score_${idx}">Min Score <span class="required">*</span></label>
            <input type="number" id="min_score_${idx}" class="form-input" placeholder="e.g. 0" step="any">
        </div>
        <div class="form-group" id="max-score-group-${idx}">
            <label for="max_score_${idx}">Max Score <span class="required">*</span></label>
            <input type="number" id="max_score_${idx}" class="form-input" placeholder="e.g. 1" step="any">
        </div>

        <!-- Levels fields -->
        <div class="form-group full-width" id="level-names-group-${idx}" style="display:none;">
            <label for="level_names_${idx}">Level Names <span class="required">*</span> <span class="optional-tag">comma-separated</span></label>
            <input type="text" id="level_names_${idx}" class="form-input" placeholder="e.g. Poor, Fair, Good, Excellent">
        </div>
        <div class="form-group full-width" id="level-meta-group-${idx}" style="display:none;">
            <label for="level_metadata_${idx}">Level Metadata <span class="optional-tag">comma-separated</span></label>
            <input type="text" id="level_metadata_${idx}" class="form-input" placeholder="e.g. Score 0-25, Score 26-50, Score 51-75, Score 76-100">
        </div>
        <div class="form-group" id="has-unknown-group-${idx}" style="display:none;">
            <label>&nbsp;</label>
            <div class="checkbox-group">
                <input type="checkbox" id="has_unknown_level_${idx}">
                <label for="has_unknown_level_${idx}">Has Unknown Level (score=-1 treated as unknown)</label>
            </div>
        </div>

        <div class="form-group full-width">
            <div class="checkbox-group">
                <input type="checkbox" id="lower_is_better_${idx}">
                <label for="lower_is_better_${idx}">Lower is Better</label>
            </div>
        </div>
    </div>

    <!-- Score Details -->
    <div class="subsection-label">Score Details <span class="required">*</span></div>
    <div class="form-grid">
        <div class="form-group">
            <label for="score_${idx}">Score <span class="required">*</span></label>
            <input type="number" id="score_${idx}" class="form-input" placeholder="e.g. 0.819" step="any">
        </div>
        <div class="form-group full-width">
            <label>Score Details <span class="optional-tag">key→value pairs</span></label>
            <div id="score-details-kv-${idx}" class="kv-container"></div>
            <button type="button" class="btn-add-kv" onclick="addKVRow('score-details-kv-${idx}')">+ Add detail</button>
        </div>
    </div>

    <!-- Uncertainty (optional) -->
    <details class="subsection-details" style="margin-top:1rem;">
        <summary class="subsection-label" style="cursor:pointer; list-style:none; display:flex; align-items:center; gap:0.4rem; margin:0;">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            Uncertainty <span class="optional-tag">optional</span>
        </summary>
        <div class="form-grid" style="margin-top:0.75rem;">
            <div class="form-group">
                <label for="se_value_${idx}">Standard Error</label>
                <input type="number" id="se_value_${idx}" class="form-input" placeholder="e.g. 0.003" step="any">
            </div>
            <div class="form-group">
                <label for="se_method_${idx}">SE Method</label>
                <input type="text" id="se_method_${idx}" class="form-input" placeholder="e.g. analytic, bootstrap">
            </div>
            <div class="form-group">
                <label for="ci_lower_${idx}">CI Lower</label>
                <input type="number" id="ci_lower_${idx}" class="form-input" placeholder="e.g. 0.813" step="any">
            </div>
            <div class="form-group">
                <label for="ci_upper_${idx}">CI Upper</label>
                <input type="number" id="ci_upper_${idx}" class="form-input" placeholder="e.g. 0.825" step="any">
            </div>
            <div class="form-group">
                <label for="ci_level_${idx}">Confidence Level</label>
                <input type="number" id="ci_level_${idx}" class="form-input" placeholder="e.g. 0.95" min="0" max="1" step="0.01">
            </div>
            <div class="form-group">
                <label for="std_dev_${idx}">Standard Deviation</label>
                <input type="number" id="std_dev_${idx}" class="form-input" placeholder="e.g. 0.035" step="any">
            </div>
            <div class="form-group">
                <label for="num_samples_${idx}">Num Samples</label>
                <input type="number" id="num_samples_${idx}" class="form-input" placeholder="e.g. 12032" min="0">
            </div>
        </div>
    </details>

    <!-- Generation Config (optional) -->
    <details class="subsection-details" style="margin-top:1rem;">
        <summary class="subsection-label" style="cursor:pointer; list-style:none; display:flex; align-items:center; gap:0.4rem; margin:0;">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            Generation Config <span class="optional-tag">optional</span>
        </summary>
        <div class="form-grid" style="margin-top:0.75rem;">
            <div class="form-group">
                <label for="temperature_${idx}">Temperature</label>
                <input type="number" id="temperature_${idx}" class="form-input" placeholder="e.g. 0.0" step="any">
            </div>
            <div class="form-group">
                <label for="top_p_${idx}">Top P</label>
                <input type="number" id="top_p_${idx}" class="form-input" placeholder="e.g. 1.0" step="any">
            </div>
            <div class="form-group">
                <label for="top_k_${idx}">Top K</label>
                <input type="number" id="top_k_${idx}" class="form-input" placeholder="e.g. -1" step="any">
            </div>
            <div class="form-group">
                <label for="max_tokens_${idx}">Max Tokens</label>
                <input type="number" id="max_tokens_${idx}" class="form-input" placeholder="e.g. 2048" min="1">
            </div>
            <div class="form-group">
                <label for="execution_command_${idx}">Execution Command</label>
                <input type="text" id="execution_command_${idx}" class="form-input" placeholder="e.g. lm_eval --model hf ...">
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <div class="checkbox-group">
                    <input type="checkbox" id="reasoning_${idx}">
                    <label for="reasoning_${idx}">Reasoning / Chain-of-Thought used</label>
                </div>
            </div>
            <div class="form-group full-width">
                <label>Additional Generation Details <span class="optional-tag">key→value pairs</span></label>
                <div id="gen-details-kv-${idx}" class="kv-container"></div>
                <button type="button" class="btn-add-kv" onclick="addKVRow('gen-details-kv-${idx}')">+ Add detail</button>
            </div>
        </div>
    </details>
    `;
}

function removeResult(btn) {
    btn.closest('.result-card').remove();
}

function selectSourceTab(idx, type) {
    ['hf', 'url', 'private'].forEach(t => {
        const tab = document.getElementById(`tab-${t}-${idx}`);
        const panel = document.getElementById(`src-${t === 'hf' ? 'hf' : t === 'url' ? 'url' : 'private'}-${idx}`);
        if (tab && panel) {
            tab.classList.toggle('active', t === type);
            panel.classList.toggle('active', t === type);
        }
    });
}

function updateScoreType(idx) {
    const scoreType = document.getElementById(`score_type_${idx}`)?.value;
    const minGrp = document.getElementById(`min-score-group-${idx}`);
    const maxGrp = document.getElementById(`max-score-group-${idx}`);
    const levelNamesGrp = document.getElementById(`level-names-group-${idx}`);
    const levelMetaGrp = document.getElementById(`level-meta-group-${idx}`);
    const hasUnknownGrp = document.getElementById(`has-unknown-group-${idx}`);

    if (!minGrp) return;

    const isContinuous = scoreType === 'continuous';
    const isLevels = scoreType === 'levels';

    minGrp.style.display = isContinuous ? '' : 'none';
    maxGrp.style.display = isContinuous ? '' : 'none';
    if (levelNamesGrp) levelNamesGrp.style.display = isLevels ? '' : 'none';
    if (levelMetaGrp) levelMetaGrp.style.display = isLevels ? '' : 'none';
    if (hasUnknownGrp) hasUnknownGrp.style.display = isLevels ? '' : 'none';
}

// ===================================================
// Library Entry Management (multi-entry, like results)
// ===================================================
let libCount = 0;

function addLibraryEntry() {
    libCount++;
    const idx = libCount;
    const container = document.getElementById('library-entries-container');
    const card = document.createElement('div');
    card.className = 'library-entry-card';
    card.dataset.libIdx = idx;
    card.innerHTML = `
    <div class="library-entry-header">
        <span class="library-entry-num">
            <img src="assets/library.svg" alt="" style="width:14px;height:14px;opacity:0.7;">
            Library #${idx}
        </span>
        ${idx > 1 ? `<button type="button" class="btn-remove-result" onclick="this.closest('.library-entry-card').remove()">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            Remove
        </button>` : ''}
    </div>
    <div class="form-grid">
        <div class="form-group">
            <label for="lib_name_${idx}">Library Name <span class="required">*</span></label>
            <input type="text" id="lib_name_${idx}" placeholder="e.g. lm-eval, inspect_ai, helm" class="form-input" oninput="clearError(this)">
            <span class="error-msg" id="err-lib_name_${idx}"></span>
        </div>
        <div class="form-group">
            <label for="lib_version_${idx}">Version <span class="required">*</span></label>
            <input type="text" id="lib_version_${idx}" placeholder="e.g. 0.4.11 or unknown" class="form-input" oninput="clearError(this)">
            <span class="error-msg" id="err-lib_version_${idx}"></span>
        </div>
        <div class="form-group full-width">
            <label>Additional Details <span class="optional-tag">optional key→value pairs</span></label>
            <div id="lib-kv-${idx}" class="kv-container"></div>
            <button type="button" class="btn-add-kv" onclick="addKVRow('lib-kv-${idx}')">+ Add field</button>
        </div>
    </div>`;
    container.appendChild(card);
}

// ===================================================
// Timestamp helpers
// ===================================================

/**
 * Insert the current time into a timestamp field.
 * @param {string} fieldId  - The input element ID
 * @param {'unix'|'iso'}  fmt - Format to use
 */
function setTimestampNow(fieldId, fmt) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    if (fmt === 'unix') {
        el.value = (Date.now() / 1000).toFixed(5);
    } else {
        el.value = new Date().toISOString();
    }
    // Trigger validation display
    validateTimestamp(el);
    clearError(el);
}

// Legacy alias kept in case anything calls setNow()
function setNow() { setTimestampNow('retrieved_timestamp', 'unix'); }

// ===================================================
// Inline Validation Helpers
// ===================================================

/**
 * Validate that a field value is a valid timestamp:
 *   - Unix epoch: a positive number (integer or float)
 *   - ISO 8601: roughly matches the pattern
 * Shows green/red border and error message.
 */
function validateTimestamp(el) {
    const val = el.value.trim();
    const errId = 'err-' + el.id;
    const errEl = document.getElementById(errId);
    if (!val) {
        // Empty is OK unless it's required (checked separately on submit)
        el.classList.remove('input-error', 'input-valid');
        if (errEl) errEl.textContent = '';
        return;
    }
    const isUnix = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(val) && parseFloat(val) > 0;
    // ISO 8601 basic pattern
    const isISO  = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(val);
    if (isUnix || isISO) {
        el.classList.remove('input-error');
        el.classList.add('input-valid');
        if (errEl) errEl.textContent = '';
    } else {
        el.classList.remove('input-valid');
        el.classList.add('input-error');
        if (errEl) errEl.textContent = 'Must be Unix epoch (e.g. 1764204739.5) or ISO 8601 (e.g. 2025-01-15T10:30:00Z)';
    }
}

/**
 * Validate a URL field on blur — show error if non-empty and not a valid URL.
 */
function validateUrl(el) {
    const val = el.value.trim();
    const errId = 'err-' + el.id;
    const errEl = document.getElementById(errId);
    if (!val) {
        el.classList.remove('input-error', 'input-valid');
        if (errEl) errEl.textContent = '';
        return;
    }
    try {
        const u = new URL(val);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
            el.classList.remove('input-error');
            el.classList.add('input-valid');
            if (errEl) errEl.textContent = '';
        } else {
            throw new Error('bad protocol');
        }
    } catch {
        el.classList.remove('input-valid');
        el.classList.add('input-error');
        if (errEl) errEl.textContent = 'Enter a valid URL starting with https://';
    }
}

/**
 * Remove the error state from a field (called on input so it clears as user types).
 * Also shows a green border if the field is non-empty.
 */
function clearError(el) {
    el.classList.remove('input-error');
    const errId = 'err-' + el.id;
    const errEl = document.getElementById(errId);
    if (errEl) errEl.textContent = '';
    // Show green if non-empty
    if (el.value.trim()) {
        el.classList.add('input-valid');
    } else {
        el.classList.remove('input-valid');
    }
}

/**
 * Validate a required plain-text/select field on blur:
 * green = has value, red = empty (only if it was previously touched).
 */
function validateFilled(el) {
    if (el.value.trim()) {
        el.classList.remove('input-error');
        el.classList.add('input-valid');
        const errEl = document.getElementById('err-' + el.id);
        if (errEl) errEl.textContent = '';
    } else {
        el.classList.remove('input-valid');
        // Don't mark red on blur unless user already got an error from step navigation
        // — that's handled by markError. So just strip green silently.
    }
}

/**
 * Mark a field as having an error.
 */
function markError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('input-error');
    el.style.borderColor = '';
    const errEl = document.getElementById('err-' + id);
    if (errEl) errEl.textContent = msg || 'This field is required.';
}

// ===================================================
// Build JSON from form
// ===================================================
function buildJSON() {
    const data = {};

    // Schema version
    data.schema_version = '0.2.2';

    // Evaluation ID
    const evalId = v('evaluation_id');
    if (evalId) data.evaluation_id = evalId;

    // Timestamps
    const evalTs = v('evaluation_timestamp');
    if (evalTs) data.evaluation_timestamp = evalTs;

    const retTs = v('retrieved_timestamp');
    if (retTs) data.retrieved_timestamp = retTs;

    // Source Metadata
    const sourceMeta = {
        source_type: v('source_type'),
        source_organization_name: v('source_organization_name'),
        evaluator_relationship: v('evaluator_relationship'),
    };
    const sourceName = v('source_name');
    if (sourceName) sourceMeta.source_name = sourceName;
    const sourceOrgUrl = v('source_organization_url');
    if (sourceOrgUrl) sourceMeta.source_organization_url = sourceOrgUrl;
    const sourceLogoUrl = v('source_organization_logo_url');
    if (sourceLogoUrl) sourceMeta.source_organization_logo_url = sourceLogoUrl;
    const sourceKV = collectKV('source-additional-details');
    if (sourceKV) sourceMeta.additional_details = sourceKV;
    data.source_metadata = sourceMeta;

    // Model Info
    const modelInfo = {
        name: v('model_name'),
        id: v('model_id'),
    };
    const developer = v('model_developer');
    if (developer) modelInfo.developer = developer;
    const infPlatform = v('inference_platform');
    if (infPlatform) modelInfo.inference_platform = infPlatform;
    const engName = v('inference_engine_name');
    const engVer = v('inference_engine_version');
    if (engName || engVer) {
        modelInfo.inference_engine = {};
        if (engName) modelInfo.inference_engine.name = engName;
        if (engVer) modelInfo.inference_engine.version = engVer;
    }
    const modelKV = collectKV('model-additional-details');
    if (modelKV) modelInfo.additional_details = modelKV;
    data.model_info = modelInfo;

    // Eval Library — collect ALL library entry cards
    // The schema field is a single object, so if there are multiple libraries
    // we store the first as the primary and extras inside additional_details.
    const libCards = document.querySelectorAll('.library-entry-card');
    if (libCards.length === 1) {
        const idx = libCards[0].dataset.libIdx;
        const evalLib = {
            name: v(`lib_name_${idx}`),
            version: v(`lib_version_${idx}`),
        };
        const libKV = collectKV(`lib-kv-${idx}`);
        if (libKV) evalLib.additional_details = libKV;
        data.eval_library = evalLib;
    } else if (libCards.length > 1) {
        // Primary library = first card
        const firstIdx = libCards[0].dataset.libIdx;
        const evalLib = {
            name: v(`lib_name_${firstIdx}`),
            version: v(`lib_version_${firstIdx}`),
        };
        const firstKV = collectKV(`lib-kv-${firstIdx}`);
        if (firstKV) evalLib.additional_details = firstKV;

        // Store extra libraries in additional_details as encoded strings
        const extras = {};
        for (let i = 1; i < libCards.length; i++) {
            const idx = libCards[i].dataset.libIdx;
            const name = v(`lib_name_${idx}`);
            const version = v(`lib_version_${idx}`);
            const kv = collectKV(`lib-kv-${idx}`);
            extras[`library_${i + 1}_name`] = name;
            extras[`library_${i + 1}_version`] = version;
            if (kv) {
                Object.entries(kv).forEach(([k, val]) => {
                    extras[`library_${i + 1}_${k}`] = val;
                });
            }
        }
        if (!evalLib.additional_details) evalLib.additional_details = {};
        Object.assign(evalLib.additional_details, extras);
        data.eval_library = evalLib;
    }

    // Evaluation Results
    const resultCards = document.querySelectorAll('.result-card');
    data.evaluation_results = [];

    resultCards.forEach(card => {
        const idx = card.dataset.resultIdx;
        const result = {};

        const evalResultId = v(`eval_result_id_${idx}`);
        if (evalResultId) result.evaluation_result_id = evalResultId;

        result.evaluation_name = v(`eval_name_${idx}`);

        const ets = v(`eval_timestamp_${idx}`);
        if (ets) result.evaluation_timestamp = ets;

        // Source Data
        const activeTab = card.querySelector('.source-tab.active');
        const tabType = activeTab ? activeTab.id.replace(`tab-`, '').replace(`-${idx}`, '') : 'hf';
        if (tabType === 'hf') {
            const sd = { source_type: 'hf_dataset', dataset_name: v(`dataset_name_${idx}`) };
            const hfRepo = v(`hf_repo_${idx}`);
            if (hfRepo) sd.hf_repo = hfRepo;
            const hfSplit = v(`hf_split_${idx}`);
            if (hfSplit) sd.hf_split = hfSplit;
            const sn = document.getElementById(`samples_number_${idx}`)?.value;
            if (sn !== '' && sn != null) sd.samples_number = parseInt(sn);
            result.source_data = sd;
        } else if (tabType === 'url') {
            const urls = (document.getElementById(`url_list_${idx}`)?.value || '')
                .split('\n').map(s => s.trim()).filter(Boolean);
            result.source_data = {
                source_type: 'url',
                dataset_name: v(`dataset_name_url_${idx}`),
                url: urls,
            };
        } else {
            result.source_data = {
                source_type: 'other',
                dataset_name: v(`dataset_name_priv_${idx}`),
            };
        }

        // Metric Config
        const scoreType = v(`score_type_${idx}`);
        const metricConfig = {
            lower_is_better: document.getElementById(`lower_is_better_${idx}`)?.checked || false,
        };

        const evalDesc = v(`eval_description_${idx}`);
        if (evalDesc) metricConfig.evaluation_description = evalDesc;
        const metricId = v(`metric_id_${idx}`);
        if (metricId) metricConfig.metric_id = metricId;
        const metricName = v(`metric_name_${idx}`);
        if (metricName) metricConfig.metric_name = metricName;
        const metricKind = v(`metric_kind_${idx}`);
        if (metricKind) metricConfig.metric_kind = metricKind;
        const metricUnit = v(`metric_unit_${idx}`);
        if (metricUnit) metricConfig.metric_unit = metricUnit;
        if (scoreType) metricConfig.score_type = scoreType;

        if (scoreType === 'continuous') {
            const minScoreEl = document.getElementById(`min_score_${idx}`);
            const maxScoreEl = document.getElementById(`max_score_${idx}`);
            if (minScoreEl?.value !== '') metricConfig.min_score = parseFloat(minScoreEl.value);
            if (maxScoreEl?.value !== '') metricConfig.max_score = parseFloat(maxScoreEl.value);
        }
        if (scoreType === 'levels') {
            const levelNamesStr = v(`level_names_${idx}`);
            if (levelNamesStr) metricConfig.level_names = levelNamesStr.split(',').map(s => s.trim()).filter(Boolean);
            const levelMetaStr = v(`level_metadata_${idx}`);
            if (levelMetaStr) metricConfig.level_metadata = levelMetaStr.split(',').map(s => s.trim()).filter(Boolean);
            metricConfig.has_unknown_level = document.getElementById(`has_unknown_level_${idx}`)?.checked || false;
        }

        result.metric_config = metricConfig;

        // Score Details
        const scoreEl = document.getElementById(`score_${idx}`);
        const scoreDetails = { score: parseFloat(scoreEl?.value || 0) };
        const scoreKV = collectKV(`score-details-kv-${idx}`);
        if (scoreKV) scoreDetails.details = scoreKV;

        // Uncertainty
        const seVal = document.getElementById(`se_value_${idx}`)?.value;
        const seMethod = v(`se_method_${idx}`);
        const ciLower = document.getElementById(`ci_lower_${idx}`)?.value;
        const ciUpper = document.getElementById(`ci_upper_${idx}`)?.value;
        const ciLevel = document.getElementById(`ci_level_${idx}`)?.value;
        const stdDev = document.getElementById(`std_dev_${idx}`)?.value;
        const numSamples = document.getElementById(`num_samples_${idx}`)?.value;

        const hasUncertainty = seVal || ciLower || ciUpper || stdDev || numSamples;
        if (hasUncertainty) {
            const unc = {};
            if (seVal !== '' && seVal != null) {
                unc.standard_error = { value: parseFloat(seVal) };
                if (seMethod) unc.standard_error.method = seMethod;
            }
            if (ciLower !== '' && ciUpper !== '' && ciLower != null && ciUpper != null) {
                unc.confidence_interval = { lower: parseFloat(ciLower), upper: parseFloat(ciUpper) };
                if (ciLevel !== '' && ciLevel != null) unc.confidence_interval.confidence_level = parseFloat(ciLevel);
            }
            if (stdDev !== '' && stdDev != null) unc.standard_deviation = parseFloat(stdDev);
            if (numSamples !== '' && numSamples != null) unc.num_samples = parseInt(numSamples);
            scoreDetails.uncertainty = unc;
        }

        result.score_details = scoreDetails;

        // Generation Config
        const tempEl = document.getElementById(`temperature_${idx}`)?.value;
        const topPEl = document.getElementById(`top_p_${idx}`)?.value;
        const topKEl = document.getElementById(`top_k_${idx}`)?.value;
        const maxTokEl = document.getElementById(`max_tokens_${idx}`)?.value;
        const execCmd = v(`execution_command_${idx}`);
        const reasoning = document.getElementById(`reasoning_${idx}`)?.checked;
        const genKV = collectKV(`gen-details-kv-${idx}`);

        const hasGenConfig = tempEl || topPEl || topKEl || maxTokEl || execCmd || reasoning || genKV;
        if (hasGenConfig) {
            const genArgs = {};
            if (tempEl !== '' && tempEl != null) genArgs.temperature = parseFloat(tempEl);
            if (topPEl !== '' && topPEl != null) genArgs.top_p = parseFloat(topPEl);
            if (topKEl !== '' && topKEl != null) genArgs.top_k = parseFloat(topKEl);
            if (maxTokEl !== '' && maxTokEl != null) genArgs.max_tokens = parseInt(maxTokEl);
            if (execCmd) genArgs.execution_command = execCmd;
            if (reasoning) genArgs.reasoning = true;

            const genConfig = { generation_args: genArgs };
            if (genKV) genConfig.additional_details = genKV;
            result.generation_config = genConfig;
        }

        data.evaluation_results.push(result);
    });

    // Detailed Evaluation Results (optional)
    const detFormat = v('detailed_format');
    if (detFormat) {
        const det = { format: detFormat };
        const fp = v('detailed_file_path');
        if (fp) det.file_path = fp;
        const ha = v('detailed_hash_algorithm');
        if (ha) det.hash_algorithm = ha;
        const ck = v('detailed_checksum');
        if (ck) det.checksum = ck;
        const tr = document.getElementById('detailed_total_rows')?.value;
        if (tr !== '' && tr != null) det.total_rows = parseInt(tr);
        data.detailed_evaluation_results = det;
    }

    return data;
}

// ===================================================
// Validation
// ===================================================
function validateFullJSON(data) {
    const errors = [];
    if (!data.schema_version) errors.push('schema_version is missing');
    if (!data.evaluation_id) errors.push('evaluation_id is required');
    if (!data.retrieved_timestamp) errors.push('retrieved_timestamp is required');
    if (!data.source_metadata?.source_type) errors.push('source_metadata.source_type is required');
    if (!data.source_metadata?.source_organization_name) errors.push('source_metadata.source_organization_name is required');
    if (!data.source_metadata?.evaluator_relationship) errors.push('source_metadata.evaluator_relationship is required');
    if (!data.model_info?.name) errors.push('model_info.name is required');
    if (!data.model_info?.id) errors.push('model_info.id is required');
    if (!data.eval_library?.name) errors.push('eval_library.name is required');
    if (!data.eval_library?.version) errors.push('eval_library.version is required');
    if (!data.evaluation_results || data.evaluation_results.length === 0) errors.push('At least one evaluation result is required');

    data.evaluation_results?.forEach((r, i) => {
        if (!r.evaluation_name) errors.push(`evaluation_results[${i}].evaluation_name is required`);
        if (!r.source_data?.dataset_name) errors.push(`evaluation_results[${i}].source_data.dataset_name is required`);
        if (r.score_details?.score === undefined || isNaN(r.score_details?.score)) errors.push(`evaluation_results[${i}].score_details.score is required`);
        if (r.metric_config?.lower_is_better === undefined) errors.push(`evaluation_results[${i}].metric_config.lower_is_better is required`);
        if (r.source_data?.source_type === 'url' && (!r.source_data?.url || r.source_data.url.length === 0)) {
            errors.push(`evaluation_results[${i}].source_data.url must have at least one entry`);
        }
    });

    return errors;
}

// ===================================================
// Syntax-highlighted JSON
// ===================================================
function highlightJSON(json) {
    return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'j-num';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'j-key';
                } else {
                    cls = 'j-str';
                }
            } else if (/true|false/.test(match)) {
                cls = 'j-bool';
            } else if (/null/.test(match)) {
                cls = 'j-null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
}

// ===================================================
// Review preparation
// ===================================================
function prepareReview() {
    currentFileUUID = uuidv4();
    const filename = `${currentFileUUID}.json`;
    document.getElementById('preview-filename').textContent = filename;

    const data = buildJSON();
    const jsonStr = JSON.stringify(data, null, 2);

    // Highlighted preview
    document.getElementById('json-preview').innerHTML = highlightJSON(jsonStr);

    // Validation
    const errors = validateFullJSON(data);
    const validBox = document.getElementById('validation-status');
    if (errors.length === 0) {
        validBox.className = 'validation-box valid';
        validBox.innerHTML = `
            <div class="validation-title">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Schema valid — ready to download!
            </div>
            <div style="font-size:0.8rem; opacity:0.8;">Filename: <code style="background:rgba(0,0,0,0.08); padding:0.1em 0.3em; border-radius:3px;">${filename}</code></div>`;
        document.getElementById('download-btn').disabled = false;
    } else {
        validBox.className = 'validation-box invalid';
        validBox.innerHTML = `
            <div class="validation-title">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01"/></svg>
                ${errors.length} validation error${errors.length > 1 ? 's' : ''} found
            </div>
            <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        document.getElementById('download-btn').disabled = false; // Still allow download but warn
    }
}

// ===================================================
// Download
// ===================================================
function downloadJSON() {
    const data = buildJSON();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFileUUID}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Downloaded ' + currentFileUUID.substring(0, 8) + '….json', 'success');
}

// ===================================================
// Copy JSON
// ===================================================
function copyJSON() {
    const data = buildJSON();
    const jsonStr = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('✓ JSON copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Could not copy — please copy manually.', 'error');
    });
}

// ===================================================
// Reset
// ===================================================
function resetForm() {
    if (!confirm('Reset the form and start over? All entered data will be lost.')) return;
    // Clear all inputs
    document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
        if (!el.readOnly) el.value = '';
    });
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    document.querySelectorAll('.kv-container').forEach(c => c.innerHTML = '');
    document.querySelectorAll('.input-error, .input-valid').forEach(el => el.classList.remove('input-error','input-valid'));
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    document.getElementById('results-container').innerHTML = '';
    document.getElementById('library-entries-container').innerHTML = '';
    resultCount = 0;
    libCount = 0;
    currentFileUUID = uuidv4();
    addLibraryEntry(); // restore first library entry
    showStep(1);
}

// ===================================================
// Toast
// ===================================================
function showToast(msg, type = 'success') {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#ef4444' : 'var(--fg)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===================================================
// Init
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
    // Set schema_version readonly
    document.getElementById('schema_version').value = '0.2.2';

    // Auto-fill retrieved_timestamp with now (Unix)
    setTimestampNow('retrieved_timestamp', 'unix');

    // Initialize progress bar
    updateProgress();

    // Add one default library entry
    addLibraryEntry();

    // Add one default result
    addResult();
});
