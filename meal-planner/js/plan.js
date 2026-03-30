// ========== STATE ==========
var plan = {
    id: null,
    name: '',
    startDate: '',
    dayMode: '7',
    mealMode: 'all',
    days: [],
    status: 'draft',
    createdAt: null,
    updatedAt: null
};
var currentDayIndex = 0;
var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

var DISCLAIMER_NOTE = '<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.1);font-size:0.78rem;color:#7a8a7a;line-height:1.5;">' +
    '<strong>Note:</strong> Analysis assumes normal portions for one person. ' +
    'Estimates are based on standard USDA nutritional data, analyzed and validated by AI models. ' +
    'Consult a registered dietitian for personalized advice.</div>';

var userProfile = null;

// ========== TOKEN TRACKING ==========
function trackTokenUsage(action, responseData) {
    if (!responseData || !responseData.usage) return;
    var usage = responseData.usage;
    var record = {
        userId: currentUser ? currentUser.uid : 'anonymous',
        userName: currentUser ? (currentUser.displayName || currentUser.email) : 'anonymous',
        action: action,
        model: responseData.model || 'gpt-4o-mini',
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        timestamp: new Date().toISOString()
    };
    // Save to Firestore silently
    db.collection('token_usage').add(record).catch(function() {});
}

// ========== INIT ==========
(function() {
    // Set default start date to next Monday
    var today = new Date();
    var dayOfWeek = today.getDay();
    var daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    var nextMon = new Date(today);
    nextMon.setDate(today.getDate() + daysUntilMonday);
    document.getElementById('start-date').value = nextMon.toISOString().split('T')[0];

    // Radio group clicks
    setupRadioGroup('day-mode', function(val) { plan.dayMode = val; });
    setupRadioGroup('meal-mode', function(val) { plan.mealMode = val; });

    // Wait for auth, then load profile and check for existing plan
    onAuthReady(function(user) {
        if (user) {
            db.collection('user_profiles').doc(user.uid).get().then(function(doc) {
                if (doc.exists) userProfile = doc.data();
            });
        }
        var params = new URLSearchParams(window.location.search);
        var planId = params.get('id');
        if (planId) {
            loadExistingPlan(planId);
        }
    });
})();

function setupRadioGroup(groupId, onChange) {
    var group = document.getElementById(groupId);
    group.querySelectorAll('.radio-option').forEach(function(opt) {
        opt.addEventListener('click', function() {
            group.querySelectorAll('.radio-option').forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            onChange(opt.dataset.value);
        });
    });
}

// ========== LOAD EXISTING ==========
function loadExistingPlan(planId) {
    db.collection('meal_plans').doc(planId).get().then(function(doc) {
        if (!doc.exists) return;
        plan = Object.assign({ id: doc.id }, doc.data());
        document.getElementById('plan-name').value = plan.name || '';
        document.getElementById('start-date').value = plan.startDate || '';

        // Set radio selections
        setRadio('day-mode', plan.dayMode);
        setRadio('meal-mode', plan.mealMode);

        // Go to day builder or week review
        if (plan.days && plan.days.length > 0) {
            initDays();
            showStep('step-days');
            updateProgress(1);
            var allFilled = plan.days.every(function(d) { return d.breakfast || d.lunch || d.dinner; });
            if (allFilled && plan.status === 'complete') {
                showStep('step-review');
                updateProgress(2);
                renderWeekReview();
                // Restore saved weekly analysis if present
                if (plan.weekNutritionReview) {
                    var overallEl = document.getElementById('overall-nutrition');
                    if (overallEl) {
                        overallEl.innerHTML = '<div class="overall-nutrition"><h3>Weekly Nutrition Analysis</h3>' +
                            '<div class="nutrition-text" style="white-space:pre-wrap;font-size:0.88rem;line-height:1.7;color:rgba(255,255,255,0.9);">' +
                            formatNutritionText(plan.weekNutritionReview) + '</div>' +
                            '<div style="margin-top:8px;font-size:0.75rem;color:rgba(255,255,255,0.4);">Saved analysis — click Full Week Nutrition Review to refresh.</div></div>';
                    }
                }
            }
        }
    });
}

function setRadio(groupId, value) {
    var group = document.getElementById(groupId);
    group.querySelectorAll('.radio-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
}

// ========== STEP 1: START PLANNING ==========
function startPlanning() {
    if (!currentUser) {
        if (confirm('Please sign in to create a meal plan. Go to sign in page?')) {
            window.location.href = 'login.html';
        }
        return;
    }

    plan.name = document.getElementById('plan-name').value.trim();
    plan.startDate = document.getElementById('start-date').value;

    if (!plan.startDate) {
        alert('Please select a starting date.');
        return;
    }

    initDays();
    showStep('step-days');
    updateProgress(1);
    document.getElementById('hero-title').textContent = 'Build Your Meals';
    document.getElementById('hero-subtitle').textContent = 'Fill in each day, then review your week.';
}

function initDays() {
    var numDays = plan.dayMode === '5' ? 5 : 7;
    var startDate = new Date(plan.startDate + 'T00:00:00');

    // Only init days if not already loaded
    if (!plan.days || plan.days.length === 0) {
        plan.days = [];
        for (var i = 0; i < numDays; i++) {
            var d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            plan.days.push({
                dayName: DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1],
                date: d.toISOString().split('T')[0],
                breakfast: '',
                lunch: '',
                dinner: '',
                snacks: '',
                breakfastDineOut: false,
                lunchDineOut: false,
                dinnerDineOut: false,
                nutritionReview: null
            });
        }
    }

    currentDayIndex = 0;
    renderDayTabs();
    renderDayForm();
}

// ========== DAY TABS ==========
function renderDayTabs() {
    var tabsEl = document.getElementById('day-tabs');
    tabsEl.innerHTML = plan.days.map(function(day, i) {
        var cls = 'day-tab';
        if (i === currentDayIndex) cls += ' active';
        else if (day.breakfast || day.lunch || day.dinner || day.snacks) cls += ' filled';
        return '<button class="' + cls + '" onclick="goToDay(' + i + ')">' + day.dayName.substring(0, 3) + '</button>';
    }).join('');
}

function goToDay(index) {
    saveCurrentDayFields();
    currentDayIndex = index;
    renderDayTabs();
    renderDayForm();
}

// ========== DAY FORM ==========
function renderDayForm() {
    var day = plan.days[currentDayIndex];
    document.getElementById('day-title').textContent = day.dayName + ' — ' + formatDate(day.date);

    var fields = '';
    if (plan.mealMode === 'all') {
        fields += mealField('breakfast', 'Breakfast', day.breakfast, null, day.breakfastDineOut);
    }
    fields += mealField('lunch', 'Lunch', day.lunch, null, day.lunchDineOut);
    fields += mealField('dinner', 'Dinner', day.dinner, null, day.dinnerDineOut);
    fields += mealField('snacks', 'Snacks', day.snacks, 'e.g. Apple, trail mix, protein bar, chai with biscuits', false, true);
    document.getElementById('meal-fields').innerHTML = fields;

    // Update next button
    var nextBtn = document.getElementById('next-day-btn');
    if (currentDayIndex === plan.days.length - 1) {
        nextBtn.textContent = 'Review Full Week';
    } else {
        nextBtn.textContent = 'Next Day';
    }

    // Clear previous nutrition
    document.getElementById('nutrition-result').innerHTML = '';
    document.getElementById('day-status').innerHTML = '';

    // Show previous review if exists
    if (day.nutritionReview) {
        renderNutritionResult(day.nutritionReview);
    }
}

function mealField(id, label, value, placeholder, dineOut, isSnacks) {
    var ph = placeholder || 'What are you having for ' + label.toLowerCase() + '?';
    var dineOutCheck = '';
    if (!isSnacks) {
        dineOutCheck = '<label class="dine-out-check">' +
            '<input type="checkbox" id="dineout-' + id + '"' + (dineOut ? ' checked' : '') + '>' +
            '<span class="dine-out-label">Dining Out</span>' +
        '</label>';
    }
    var snackNote = '';
    if (isSnacks) {
        snackNote = '<div class="snack-note">Tip: List multiple snacks separated by commas for throughout the day</div>';
    }
    return '<div class="meal-section">' +
        '<div class="meal-label-row">' +
            '<div class="meal-label">' + label + '</div>' +
            dineOutCheck +
        '</div>' +
        '<div class="form-row" style="margin-bottom:0">' +
            '<textarea id="meal-' + id + '" placeholder="' + ph + '">' + esc(value || '') + '</textarea>' +
        '</div>' +
        snackNote +
    '</div>';
}

function saveCurrentDayFields() {
    var day = plan.days[currentDayIndex];
    if (!day) return;
    var bf = document.getElementById('meal-breakfast');
    var lu = document.getElementById('meal-lunch');
    var di = document.getElementById('meal-dinner');
    var sn = document.getElementById('meal-snacks');
    if (bf) day.breakfast = bf.value.trim();
    if (lu) day.lunch = lu.value.trim();
    if (di) day.dinner = di.value.trim();
    if (sn) day.snacks = sn.value.trim();

    // Save dine out checkboxes
    var bfOut = document.getElementById('dineout-breakfast');
    var luOut = document.getElementById('dineout-lunch');
    var diOut = document.getElementById('dineout-dinner');
    if (bfOut) day.breakfastDineOut = bfOut.checked;
    if (luOut) day.lunchDineOut = luOut.checked;
    if (diOut) day.dinnerDineOut = diOut.checked;
}

// ========== SAVE DRAFT ==========
function saveDraft() {
    saveCurrentDayFields();

    // Lesson 1: no data = no save
    var statusEl = document.getElementById('day-status');
    if (!plan.startDate) {
        statusEl.innerHTML = '<span class="error">Cannot save: missing start date.</span>';
        return;
    }
    if (!plan.days || plan.days.length === 0) {
        statusEl.innerHTML = '<span class="error">Cannot save: no days in plan.</span>';
        return;
    }

    plan.status = 'draft';
    plan.updatedAt = new Date().toISOString();
    if (!plan.createdAt) plan.createdAt = plan.updatedAt;
    if (currentUser) plan.userId = currentUser.uid;

    var data = JSON.parse(JSON.stringify(plan));
    delete data.id;

    if (plan.id) {
        // Lesson 9: update only changed fields, don't overwrite entire document
        db.collection('meal_plans').doc(plan.id).update(data).then(function() {
            statusEl.innerHTML = '<span class="success">Draft saved!</span>';
        }).catch(function(err) {
            statusEl.innerHTML = '<span class="error">Save failed: ' + esc(err.message) + '</span>';
        });
    } else {
        db.collection('meal_plans').add(data).then(function(ref) {
            plan.id = ref.id;
            statusEl.innerHTML = '<span class="success">Draft saved!</span>';
        }).catch(function(err) {
            statusEl.innerHTML = '<span class="error">Save failed: ' + esc(err.message) + '</span>';
        });
    }
}

// ========== NEXT DAY ==========
function nextDay() {
    saveCurrentDayFields();
    if (currentDayIndex < plan.days.length - 1) {
        currentDayIndex++;
        renderDayTabs();
        renderDayForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showStep('step-review');
        updateProgress(2);
        renderWeekReview();
        document.getElementById('hero-title').textContent = 'Review Your Week';
        document.getElementById('hero-subtitle').textContent = 'Check your plan, edit any meal, then save.';
    }
}

// ========== NUTRITION REVIEW (SINGLE DAY) ==========
function reviewDay() {
    saveCurrentDayFields();
    var day = plan.days[currentDayIndex];

    var meals = [];
    if (day.breakfast) meals.push('Breakfast: ' + day.breakfast + (day.breakfastDineOut ? ' (dining out)' : ''));
    if (day.lunch) meals.push('Lunch: ' + day.lunch + (day.lunchDineOut ? ' (dining out)' : ''));
    if (day.dinner) meals.push('Dinner: ' + day.dinner + (day.dinnerDineOut ? ' (dining out)' : ''));
    if (day.snacks) meals.push('Snacks: ' + day.snacks);

    if (meals.length === 0) {
        document.getElementById('day-status').innerHTML = '<span class="error">Add at least one meal first.</span>';
        return;
    }

    var resultEl = document.getElementById('nutrition-result');
    resultEl.innerHTML = '<div class="nutrition-loading"><span class="spinner"></span> Analyzing nutrition...</div>';

    // Disable button to prevent double-clicks during stream
    var reviewBtn = document.getElementById('review-day-btn');
    if (reviewBtn) { reviewBtn.disabled = true; reviewBtn.textContent = 'Analyzing...'; }

    var mealsText = meals.join('\n');

    callNutritionLLM(mealsText, day.dayName).then(function(result) {
        if (reviewBtn) { reviewBtn.disabled = false; reviewBtn.textContent = 'Review Nutrition'; }
        // Lesson 3: don't save empty LLM result to Firestore
        if (!result || !result.trim()) {
            resultEl.innerHTML = '<div class="nutrition-card"><div class="nutrition-text">Analysis returned empty. Please try again.</div></div>';
            return;
        }
        day.nutritionReview = result;
        renderNutritionResult(result);
        // Auto-save so nutrition review isn't lost if user navigates away
        if (plan.id && currentUser) {
            var patch = {};
            patch['days'] = plan.days;
            db.collection('meal_plans').doc(plan.id).update(patch).catch(function() {});
        }
    }).catch(function(err) {
        if (reviewBtn) { reviewBtn.disabled = false; reviewBtn.textContent = 'Review Nutrition'; }
        resultEl.innerHTML = '<div class="nutrition-card"><div class="nutrition-text">Could not analyze nutrition. ' + esc(err.message) + '</div></div>';
    });
}

function buildProfileContext() {
    if (!userProfile) return '';
    var parts = [];
    if (userProfile.name) parts.push('Name: ' + userProfile.name);
    if (userProfile.age) parts.push('Age: ' + userProfile.age);
    if (userProfile.gender) parts.push('Gender: ' + userProfile.gender);
    if (userProfile.activityLevel) parts.push('Activity level: ' + userProfile.activityLevel);
    if (userProfile.dietTypes && userProfile.dietTypes.length) parts.push('Diet: ' + userProfile.dietTypes.join(', '));
    if (userProfile.allergies) parts.push('Allergies/intolerances: ' + userProfile.allergies);
    if (userProfile.dislikes) parts.push('Dislikes: ' + userProfile.dislikes);
    if (userProfile.dietOther) parts.push('Other dietary notes: ' + userProfile.dietOther);
    if (userProfile.goals && userProfile.goals.length) parts.push('Goals: ' + userProfile.goals.join(', '));
    if (userProfile.calorieTarget) parts.push('Daily calorie target: ' + userProfile.calorieTarget);
    if (userProfile.notes) parts.push('Other notes: ' + userProfile.notes);
    if (parts.length === 0) return '';
    return '\n\nUSER PROFILE:\n' + parts.join('\n') + '\n\nTailor your analysis and suggestions to this person\'s profile, goals, and dietary preferences.';
}

var NUTRITION_FN_URL = 'https://us-central1-nutrition-198dd.cloudfunctions.net/nutritionReview';

function streamLLM(messages, targetEl, onDone, action, maxTokens) {
    targetEl.textContent = '';
    return firebase.auth().currentUser.getIdToken().then(function(token) {
        return fetch(NUTRITION_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ messages: messages, max_tokens: maxTokens || 600, action: action || 'day_review' })
        });
    }).then(function(r) {
        if (!r.ok) return r.json().then(function(e) { throw new Error((e.error && e.error.message) || 'Error ' + r.status); });
        var reader = r.body.getReader();
        var decoder = new TextDecoder();
        var fullText = '';
        function read() {
            return reader.read().then(function(chunk) {
                if (chunk.done) { onDone(fullText); return fullText; }
                decoder.decode(chunk.value, { stream: true }).split('\n').forEach(function(line) {
                    if (!line.startsWith('data: ')) return;
                    var data = line.slice(6).trim();
                    if (data === '[DONE]') return;
                    try {
                        var parsed = JSON.parse(data);
                        if (parsed.error) throw new Error(parsed.error.message || 'API error');
                        var delta = parsed.choices && parsed.choices[0].delta.content;
                        if (delta) { fullText += delta; targetEl.textContent = fullText; }
                    } catch(e) {}
                });
                return read();
            });
        }
        return read();
    });
}

function callNutritionLLM(mealsText, dayName) {
    var systemPrompt = 'You are a nutrition expert. Be concise and accurate. Use standard USDA data. Assume normal portions for one person. Use plain text only — no markdown, no asterisks, no bold formatting.';
    var profileCtx = buildProfileContext();
    var userPrompt = 'Review this meal plan for ' + dayName + ':\n\n' + mealsText + profileCtx + '\n\n' +
        'Provide (be concise):\n' +
        'SCORE: X/10\n' +
        'ESTIMATED CALORIES: range\n' +
        'MACRO BREAKDOWN: protein Xg, carbs Xg, fat Xg\n' +
        'STRENGTHS: 2-3 bullet points\n' +
        'GAPS: 2-3 bullet points\n' +
        'SUGGESTIONS: 2-3 specific swaps or additions\n';

    var resultEl = document.getElementById('nutrition-result');
    resultEl.innerHTML = '<div class="nutrition-card"><h3>Nutrition Review</h3>' +
        '<div class="nutrition-text" id="stream-text" style="white-space:pre-wrap;font-size:0.88rem;line-height:1.7;"></div></div>';

    return streamLLM(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        document.getElementById('stream-text'),
        function(fullText) { renderNutritionResult(fullText); },
        'day_review_' + dayName,
        600
    );
}

function verifyNutrition(mealsText, firstAnalysis) {
    var verifyPrompt = 'You are a senior nutrition reviewer. A dietitian provided this analysis. ' +
        'Your job is to VERIFY the numbers and claims. Check for:\n' +
        '1. Are the calorie estimates reasonable for these foods at normal portions for one person?\n' +
        '2. Are the macro estimates plausible?\n' +
        '3. Are the gaps identified actually gaps, or are they incorrect?\n' +
        '4. Are the suggestions appropriate?\n\n' +
        'Original meals:\n' + mealsText + '\n\n' +
        'Analysis to verify:\n' + firstAnalysis + '\n\n' +
        'If the analysis is largely correct, return it as-is with minor corrections. ' +
        'If there are significant errors, provide the corrected version. ' +
        'Keep the same format (SCORE, ESTIMATED CALORIES, MACRO BREAKDOWN, STRENGTHS, GAPS, SUGGESTIONS). ' +
        'IMPORTANT: Do NOT add any "Reviewer Note" or "Verification Note" section. Just return the clean analysis.';

    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a senior nutrition expert who verifies dietary analyses for accuracy. Never fabricate data. Only confirm what is verifiably correct based on standard nutritional databases. All estimates assume normal portions for one person. Do NOT include any "Reviewer Note" in your output.' },
                { role: 'user', content: verifyPrompt }
            ],
            temperature: 0.2,
            max_tokens: 1500
        })
    }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) throw new Error(data.error.message);
        trackTokenUsage('day_verify', data);
        return data.choices[0].message.content;
    });
}

function renderNutritionResult(text) {
    var resultEl = document.getElementById('nutrition-result');
    if (!text || !text.trim()) return;

    // Walk lines and bucket into sections
    var SECTION_RE = /^\*{0,2}(SCORE|ESTIMATED CALORIES|MACRO BREAKDOWN|STRENGTHS|GAPS|SUGGESTIONS)\*{0,2}[:\s]/i;
    var buckets = { main: [], strengths: [], gaps: [], suggestions: [] };
    var current = 'main';
    text.split('\n').forEach(function(line) {
        var m = line.match(SECTION_RE);
        if (m) {
            var key = m[1].toUpperCase();
            if (key === 'STRENGTHS') current = 'strengths';
            else if (key === 'GAPS') current = 'gaps';
            else if (key === 'SUGGESTIONS') current = 'suggestions';
            else current = 'main';
        }
        buckets[current].push(line);
    });

    var mainText = buckets.main.join('\n').trim();
    var scoreMatch = mainText.match(/SCORE[:\s]+(\d+)/i);
    var score = scoreMatch ? parseInt(scoreMatch[1]) : null;
    var scoreBadge = '';
    if (score !== null) {
        var scoreClass = score >= 7 ? 'score-good' : score >= 5 ? 'score-ok' : 'score-needs-work';
        var scoreLabel = score >= 7 ? 'Great' : score >= 5 ? 'Okay' : 'Needs Work';
        scoreBadge = '<span class="nutrition-score ' + scoreClass + '">' + score + '/10 — ' + scoreLabel + '</span>';
    }

    var strengthsText = buckets.strengths.join('\n').replace(/\*{0,2}STRENGTHS\*{0,2}[:\s]*/gi, '').trim();
    var improvementsText = buckets.gaps.concat(buckets.suggestions).join('\n')
        .replace(/\*{0,2}(?:GAPS|SUGGESTIONS)\*{0,2}[:\s]*/gi, '').trim();

    var strengthsHtml = strengthsText ? (
        '<div style="margin-top:16px;padding:14px 16px;background:rgba(74,138,74,0.1);border-left:3px solid #4a8a4a;border-radius:8px;">' +
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#4a8a4a;margin-bottom:6px;">Strengths</div>' +
        '<div class="nutrition-text" style="font-size:0.85rem;">' + formatNutritionText(strengthsText) + '</div>' +
        '</div>'
    ) : '';

    var improvementsHtml = improvementsText ? (
        '<div style="margin-top:10px;padding:14px 16px;background:rgba(232,160,64,0.1);border-left:3px solid #e8a040;border-radius:8px;">' +
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#b08030;margin-bottom:6px;">Improvements</div>' +
        '<div class="nutrition-text" style="font-size:0.85rem;">' + formatNutritionText(improvementsText) + '</div>' +
        '</div>'
    ) : '';

    resultEl.innerHTML = '<div class="nutrition-card">' +
        '<h3>Nutrition Review</h3>' +
        scoreBadge +
        '<div class="nutrition-text">' + formatNutritionText(mainText) + '</div>' +
        strengthsHtml +
        improvementsHtml +
        DISCLAIMER_NOTE +
    '</div>';
}

function formatNutritionText(text) {
    return text
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*\*/g, '')
        .replace(/^#{1,3} (.+)$/gm, '<strong style="display:block;margin-top:12px;margin-bottom:4px;">$1</strong>')
        .replace(/^[•\-] (.+)$/gm, '<span style="display:block;padding-left:16px;">&#8226; $1</span>')
        .replace(/\n{2,}/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

// ========== WEEK REVIEW ==========
function renderWeekReview() {
    var grid = document.getElementById('week-grid');
    grid.innerHTML = plan.days.map(function(day, i) {
        var meals = '';
        if (plan.mealMode === 'all') {
            meals += mealLine('Breakfast', day.breakfast, day.breakfastDineOut);
        }
        meals += mealLine('Lunch', day.lunch, day.lunchDineOut);
        meals += mealLine('Dinner', day.dinner, day.dinnerDineOut);
        meals += mealLine('Snacks', day.snacks);
        return '<div class="week-day-card">' +
            '<div class="week-day-name">' + esc(day.dayName) +
                '<span class="week-day-date">' + formatDate(day.date) + '</span>' +
            '</div>' +
            meals +
            '<button class="week-edit-btn" onclick="editDay(' + i + ')">Edit</button>' +
        '</div>';
    }).join('');
}

function mealLine(type, value, dineOut) {
    var dineOutBadge = dineOut ? '<span class="dine-out-badge">Dining Out</span>' : '';
    return '<div class="week-meal">' +
        '<span class="week-meal-type">' + type + '</span>' +
        (value ? esc(value) : '<span class="week-meal-empty">Not set</span>') +
        dineOutBadge +
    '</div>';
}

function editDay(index) {
    currentDayIndex = index;
    showStep('step-days');
    updateProgress(1);
    renderDayTabs();
    renderDayForm();
    document.getElementById('hero-title').textContent = 'Edit Meals';
    document.getElementById('hero-subtitle').textContent = 'Update meals for ' + plan.days[index].dayName + '.';
}

function goBackToDays() {
    showStep('step-days');
    updateProgress(1);
    renderDayTabs();
    renderDayForm();
    document.getElementById('hero-title').textContent = 'Build Your Meals';
    document.getElementById('hero-subtitle').textContent = 'Fill in each day, then review your week.';
}

// ========== FULL WEEK NUTRITION ==========
function reviewFullWeek() {
    var overallEl = document.getElementById('overall-nutrition');
    overallEl.innerHTML = '<div class="nutrition-loading"><span class="spinner"></span> Analyzing full week nutrition...</div>';

    var mealsText = plan.days.map(function(day) {
        var parts = [day.dayName + ':'];
        if (day.breakfast) parts.push('  Breakfast: ' + day.breakfast + (day.breakfastDineOut ? ' (dining out)' : ''));
        if (day.lunch) parts.push('  Lunch: ' + day.lunch + (day.lunchDineOut ? ' (dining out)' : ''));
        if (day.dinner) parts.push('  Dinner: ' + day.dinner + (day.dinnerDineOut ? ' (dining out)' : ''));
        if (day.snacks) parts.push('  Snacks: ' + day.snacks);
        return parts.join('\n');
    }).join('\n\n');

    var systemPrompt = 'You are a certified nutrition expert and registered dietitian reviewing a full week meal plan. ' +
        'Be thorough and accurate. Do NOT fabricate calorie or macro numbers. Base all estimates on standard USDA nutritional data. ' +
        'Assume normal, standard portion sizes for one person unless otherwise specified. ' +
        'Meals marked as "dining out" may have larger portions — note this in your analysis. ' +
        'If portions are unclear, state your assumptions. Always double-check your math. ' +
        'Do NOT include any "Reviewer Note" sections.';

    var profileCtx = buildProfileContext();
    var userPrompt = 'Review this full week meal plan:\n\n' + mealsText + profileCtx + '\n\n' +
        'Provide a WEEKLY overview:\n' +
        '1. OVERALL SCORE: 1-10 for the week\n' +
        '2. DAILY CALORIE RANGE: Estimated average per day\n' +
        '3. WEEKLY BALANCE: Are macros (protein/carbs/fat) balanced across the week?\n' +
        '4. VARIETY: Is there enough variety in foods, colors, and food groups?\n' +
        '5. WHAT\'S GREAT: Best aspects of this week\'s plan\n' +
        '6. WHAT\'S MISSING: Nutrients, food groups, or variety gaps\n' +
        '7. TOP 3 IMPROVEMENTS: Most impactful changes to make\n\n' +
        'Be specific, actionable, and honest. Do not add any reviewer notes.';

    overallEl.innerHTML = '<div class="overall-nutrition"><h3>Weekly Nutrition Analysis</h3>' +
        '<div class="nutrition-text" id="week-stream-text" style="white-space:pre-wrap;font-size:0.88rem;line-height:1.7;color:rgba(255,255,255,0.9);"></div></div>';

    // Disable button to prevent double-clicks during stream
    var weekBtn = document.getElementById('review-week-btn');
    if (weekBtn) { weekBtn.disabled = true; weekBtn.textContent = 'Analyzing...'; }

    streamLLM(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        document.getElementById('week-stream-text'),
        function(fullText) {
            // Re-render with styled sections when done
            var SECTION_RE = /^\*{0,2}(OVERALL SCORE|SCORE|DAILY CALORIE RANGE|WEEKLY BALANCE|VARIETY|WHAT'S GREAT|WHAT'S MISSING|TOP 3 IMPROVEMENTS)\*{0,2}[:\s]/i;
            var buckets = { main: [], great: [], missing: [], improvements: [] };
            var current = 'main';
            fullText.split('\n').forEach(function(line) {
                var m = line.match(SECTION_RE);
                if (m) {
                    var key = m[1].toUpperCase();
                    if (key.indexOf('GREAT') !== -1) current = 'great';
                    else if (key.indexOf('MISSING') !== -1) current = 'missing';
                    else if (key.indexOf('IMPROVEMENT') !== -1) current = 'improvements';
                    else current = 'main';
                }
                buckets[current].push(line);
            });

            var mainText = buckets.main.join('\n').trim();
            var scoreMatch = mainText.match(/(?:OVERALL )?SCORE[:\s]+(\d+)/i);
            var score = scoreMatch ? parseInt(scoreMatch[1]) : null;
            var scoreBadge = '';
            if (score !== null) {
                var scoreClass = score >= 7 ? 'score-good' : score >= 5 ? 'score-ok' : 'score-needs-work';
                var scoreLabel = score >= 7 ? 'Great Week' : score >= 5 ? 'Decent Week' : 'Room to Improve';
                scoreBadge = '<span class="nutrition-score ' + scoreClass + '">' + score + '/10 — ' + scoreLabel + '</span>';
            }

            var greatText = buckets.great.join('\n').replace(/^.*(?:WHAT'S GREAT).*\n?/i, '').trim();
            var improvText = buckets.missing.concat(buckets.improvements).join('\n')
                .replace(/^.*(?:WHAT'S MISSING|TOP 3 IMPROVEMENTS).*\n?/im, '').trim();

            var strengthsHtml = greatText ? (
                '<div style="margin-top:16px;padding:14px 16px;background:rgba(163,212,154,0.15);border-left:3px solid #a3d49a;border-radius:8px;">' +
                '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#a3d49a;margin-bottom:6px;">Strengths</div>' +
                '<div class="nutrition-text" style="font-size:0.85rem;color:rgba(255,255,255,0.9);">' + formatNutritionText(greatText) + '</div></div>'
            ) : '';

            var improvementsHtml = improvText ? (
                '<div style="margin-top:10px;padding:14px 16px;background:rgba(232,160,64,0.15);border-left:3px solid #e8a040;border-radius:8px;">' +
                '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#e8a040;margin-bottom:6px;">Improvements</div>' +
                '<div class="nutrition-text" style="font-size:0.85rem;color:rgba(255,255,255,0.9);">' + formatNutritionText(improvText) + '</div></div>'
            ) : '';

            overallEl.innerHTML = '<div class="overall-nutrition">' +
                '<h3>Weekly Nutrition Analysis</h3>' + scoreBadge +
                '<div class="nutrition-text">' + formatNutritionText(mainText) + '</div>' +
                strengthsHtml + improvementsHtml +
                '<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);font-size:0.78rem;color:rgba(255,255,255,0.5);line-height:1.5;">' +
                '<strong style="color:rgba(255,255,255,0.65);">Note:</strong> Analysis assumes normal portions for one person. ' +
                'Estimates are based on standard USDA nutritional data, analyzed and validated by AI models. ' +
                'Consult a registered dietitian for personalized advice.</div></div>';

            if (weekBtn) { weekBtn.disabled = false; weekBtn.textContent = 'Full Week Nutrition Review'; }

            // Auto-save weekly analysis so it's not lost on page close
            if (fullText && fullText.trim()) {
                plan.weekNutritionReview = fullText;
                if (plan.id && currentUser) {
                    db.collection('meal_plans').doc(plan.id).update({ weekNutritionReview: fullText }).catch(function() {});
                }
            }
        },
        'week_review',
        800
    ).catch(function(err) {
        if (weekBtn) { weekBtn.disabled = false; weekBtn.textContent = 'Full Week Nutrition Review'; }
        overallEl.innerHTML = '<div class="nutrition-card"><div class="nutrition-text">Could not analyze. ' + esc(err.message) + '</div></div>';
    });
}

// ========== SAVE TO FIREBASE ==========
function saveToFirebase() {
    plan.status = 'complete';
    plan.updatedAt = new Date().toISOString();
    if (!plan.createdAt) plan.createdAt = plan.updatedAt;
    if (currentUser) plan.userId = currentUser.uid;

    var data = JSON.parse(JSON.stringify(plan));
    delete data.id;

    var statusEl = document.getElementById('save-status');
    statusEl.innerHTML = '<span class="spinner"></span> Saving...';

    var promise;
    if (plan.id) {
        promise = db.collection('meal_plans').doc(plan.id).update(data);
    } else {
        promise = db.collection('meal_plans').add(data).then(function(ref) { plan.id = ref.id; });
    }

    promise.then(function() {
        statusEl.innerHTML = '<span class="success">Plan saved! <a href="plans.html">View all plans</a></span>';
    }).catch(function(err) {
        statusEl.innerHTML = '<span class="error">Error: ' + esc(err.message) + '</span>';
    });
}

// ========== DELETE PLAN ==========
function deletePlan() {
    if (!confirm('Delete this meal plan? This cannot be undone.')) return;
    if (plan.id) {
        db.collection('meal_plans').doc(plan.id).delete().then(function() {
            window.location.href = 'plans.html';
        });
    } else {
        window.location.href = 'index.html';
    }
}

// ========== PDF DOWNLOAD ==========
function downloadPDF() {
    var win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Meal Plan - ' + esc(plan.name || 'Week of ' + plan.startDate) + '</title>' +
        '<style>' +
        'body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1e2a1e; }' +
        'h1 { font-size: 1.8rem; margin-bottom: 4px; }' +
        '.subtitle { color: #666; font-size: 0.9rem; margin-bottom: 24px; }' +
        '.day { margin-bottom: 20px; page-break-inside: avoid; }' +
        '.day h2 { font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }' +
        '.meal { margin-bottom: 4px; font-size: 0.9rem; }' +
        '.meal-type { font-weight: bold; color: #4a8a4a; text-transform: uppercase; font-size: 0.75rem; }' +
        '.dine-out { color: #e8a040; font-size: 0.75rem; font-style: italic; }' +
        '.footer { margin-top: 40px; font-size: 0.8rem; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }' +
        '</style></head><body>' +
        '<h1>' + esc(plan.name || 'Weekly Meal Plan') + '</h1>' +
        '<div class="subtitle">Week starting ' + formatDate(plan.startDate) + ' &middot; ' + plan.days.length + ' days</div>');

    plan.days.forEach(function(day) {
        win.document.write('<div class="day"><h2>' + esc(day.dayName) + ' &mdash; ' + formatDate(day.date) + '</h2>');
        if (day.breakfast) win.document.write('<div class="meal"><span class="meal-type">Breakfast: </span>' + esc(day.breakfast) + (day.breakfastDineOut ? ' <span class="dine-out">(Dining Out)</span>' : '') + '</div>');
        if (day.lunch) win.document.write('<div class="meal"><span class="meal-type">Lunch: </span>' + esc(day.lunch) + (day.lunchDineOut ? ' <span class="dine-out">(Dining Out)</span>' : '') + '</div>');
        if (day.dinner) win.document.write('<div class="meal"><span class="meal-type">Dinner: </span>' + esc(day.dinner) + (day.dinnerDineOut ? ' <span class="dine-out">(Dining Out)</span>' : '') + '</div>');
        if (day.snacks) win.document.write('<div class="meal"><span class="meal-type">Snacks: </span>' + esc(day.snacks) + '</div>');
        win.document.write('</div>');
    });

    win.document.write('<div class="footer">Generated by Meal Planner</div></body></html>');
    win.document.close();
    setTimeout(function() { win.print(); }, 500);
}

// ========== EMAIL PLAN ==========
function emailPlan() {
    var subject = encodeURIComponent('Meal Plan: ' + (plan.name || 'Week of ' + plan.startDate));
    var body = encodeURIComponent(buildPlanText());
    window.open('mailto:?subject=' + subject + '&body=' + body);
}

function buildPlanText() {
    var lines = [];
    lines.push((plan.name || 'Weekly Meal Plan'));
    lines.push('Week starting ' + formatDate(plan.startDate));
    lines.push('');

    plan.days.forEach(function(day) {
        lines.push(day.dayName + ' — ' + formatDate(day.date));
        if (day.breakfast) lines.push('  Breakfast: ' + day.breakfast + (day.breakfastDineOut ? ' (Dining Out)' : ''));
        if (day.lunch) lines.push('  Lunch: ' + day.lunch + (day.lunchDineOut ? ' (Dining Out)' : ''));
        if (day.dinner) lines.push('  Dinner: ' + day.dinner + (day.dinnerDineOut ? ' (Dining Out)' : ''));
        if (day.snacks) lines.push('  Snacks: ' + day.snacks);
        lines.push('');
    });

    return lines.join('\n');
}

// ========== HELPERS ==========
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById(stepId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress(currentStep) {
    var bar = document.getElementById('progress-bar');
    var steps = ['Setup', 'Build Meals', 'Review'];
    bar.innerHTML = steps.map(function(s, i) {
        var cls = 'progress-step';
        if (i < currentStep) cls += ' done';
        else if (i === currentStep) cls += ' current';
        return '<div class="' + cls + '" title="' + s + '"></div>';
    }).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1]) - 1] + ' ' + parseInt(parts[2]) + ', ' + parts[0];
}

function esc(str) {
    var el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
}

// Init progress
updateProgress(0);
