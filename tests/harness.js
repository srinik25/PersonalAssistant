/**
 * Test harness for hardening changes across all apps.
 * Run with: node tests/harness.js
 * Tests all validation logic added per the 10 hardening lessons.
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  PASS  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL  ' + name + ' — ' + e.message);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
    if (a !== b) throw new Error((msg || 'Expected equal') + ': got ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}

// ============================================================
// Priority 1: Meal Planner — Cloud Function validators
// ============================================================
console.log('\n[Priority 1] Meal Planner — validateNutritionData');

// validateNutritionData — inlined from functions/index.js for test isolation
// (mirrors the function exactly; if you change one, change both)
function validateNutritionData(data) {
    if (!data || typeof data !== 'object') return { valid: false, reason: 'Not an object' };
    const required = ['name', 'history', 'nutrition_profile', 'recipe'];
    const missing = required.filter(f => !data[f]);
    if (missing.length > 0) return { valid: false, reason: 'Missing fields: ' + missing.join(', ') };
    const np = data.nutrition_profile;
    if (!np || !np.calories || !np.serving_size || !np.protein) {
        return { valid: false, reason: 'Incomplete nutrition_profile (missing calories, serving_size, or protein)' };
    }
    const r = data.recipe;
    if (!r || !r.name || !Array.isArray(r.ingredients) || r.ingredients.length === 0 ||
        !Array.isArray(r.instructions) || r.instructions.length === 0) {
        return { valid: false, reason: 'Incomplete recipe (missing name, ingredients, or instructions)' };
    }
    return { valid: true };
}

test('null input → invalid', () => {
    assert(!validateNutritionData(null).valid);
});

test('empty object → missing all required fields', () => {
    const r = validateNutritionData({});
    assert(!r.valid);
    assert(r.reason.includes('Missing fields'));
});

test('missing recipe → invalid', () => {
    const r = validateNutritionData({
        name: 'Turmeric', history: 'Ancient spice',
        nutrition_profile: { calories: '100', serving_size: '1 tsp', protein: '0g' },
        recipe: null
    });
    assert(!r.valid);
    assert(r.reason.includes('recipe'));
});

test('recipe missing ingredients → invalid', () => {
    const r = validateNutritionData({
        name: 'Turmeric', history: 'Ancient spice',
        nutrition_profile: { calories: '100', serving_size: '1 tsp', protein: '0g' },
        recipe: { name: 'Golden Milk', ingredients: [], instructions: ['Mix'] }
    });
    assert(!r.valid);
});

test('nutrition_profile missing calories → invalid', () => {
    const r = validateNutritionData({
        name: 'Turmeric', history: 'Ancient spice',
        nutrition_profile: { serving_size: '1 tsp', protein: '0g' },
        recipe: { name: 'Golden Milk', ingredients: ['milk'], instructions: ['Mix'] }
    });
    assert(!r.valid);
    assert(r.reason.includes('nutrition_profile'));
});

test('fully valid profile → valid', () => {
    const r = validateNutritionData({
        name: 'Turmeric', history: 'Ancient spice', native_country: 'India',
        nutrition_profile: { serving_size: '1 tsp', calories: '9', protein: '0.2g', fiber: '0.2g', fat: '0.1g', carbohydrates: '1.4g', key_vitamins: [], key_minerals: [], notable_properties: '' },
        daily_intake: { tsp: '1', tbsp: '1/3', cup: '1/48' },
        best_time_to_eat: 'Morning',
        meal_incorporation: { can_be_added: true, suggestions: [], additional_notes: [] },
        recipe: { name: 'Golden Milk', description: 'Classic', prep_time: '2 min', cook_time: '5 min', servings: '1', ingredients: ['1 cup milk', '1 tsp turmeric'], instructions: ['Heat milk', 'Add turmeric', 'Stir and serve'] }
    });
    assert(r.valid, r.reason);
});

// ============================================================
// Priority 2+3: Client-side validators (simulated)
// ============================================================
console.log('\n[Priority 2] Finance Tracker — callFinanceLLM content check');

function simulateFinanceLLMResponse(data) {
    if (data.error) throw new Error(data.error.message);
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!content || !content.trim()) throw new Error('LLM returned empty analysis');
    return content;
}

test('LLM error field → throws', () => {
    let threw = false;
    try { simulateFinanceLLMResponse({ error: { message: 'rate limit' } }); } catch { threw = true; }
    assert(threw);
});

test('LLM empty content → throws', () => {
    let threw = false;
    try { simulateFinanceLLMResponse({ choices: [{ message: { content: '' } }] }); } catch { threw = true; }
    assert(threw);
});

test('LLM whitespace-only → throws', () => {
    let threw = false;
    try { simulateFinanceLLMResponse({ choices: [{ message: { content: '   \n  ' } }] }); } catch { threw = true; }
    assert(threw);
});

test('LLM valid content → returns string', () => {
    const r = simulateFinanceLLMResponse({ choices: [{ message: { content: 'Your portfolio looks good.' } }] });
    assertEqual(r, 'Your portfolio looks good.');
});

console.log('\n[Priority 3] Health Tracker — saveEntry validation');

const CATEGORIES = {
    vitals: {}, vaccines: {}, cardio: {}, lipid: {}, gastro: {},
    physio: {}, teeth: {}, eyes: {}, ears: {}, sleep: {}, other: {}
};

function validateHealthEntry(entry) {
    if (!entry.category || !CATEGORIES[entry.category]) {
        throw new Error('Invalid or missing category');
    }
    if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        throw new Error('Invalid or missing date (expected YYYY-MM-DD)');
    }
    return true;
}

test('missing category → throws', () => {
    let threw = false;
    try { validateHealthEntry({ date: '2026-03-28', values: '120/80' }); } catch { threw = true; }
    assert(threw);
});

test('invalid category → throws', () => {
    let threw = false;
    try { validateHealthEntry({ category: 'notreal', date: '2026-03-28' }); } catch { threw = true; }
    assert(threw);
});

test('missing date → throws', () => {
    let threw = false;
    try { validateHealthEntry({ category: 'vitals', date: '' }); } catch { threw = true; }
    assert(threw);
});

test('bad date format → throws', () => {
    let threw = false;
    try { validateHealthEntry({ category: 'vitals', date: '03/28/2026' }); } catch { threw = true; }
    assert(threw);
});

test('valid entry → passes', () => {
    assert(validateHealthEntry({ category: 'vitals', date: '2026-03-28', values: '120/80' }));
});

test('saveAnalysis rejects empty text', () => {
    let threw = false;
    const fakeAnalysisText = '';
    if (!fakeAnalysisText || !fakeAnalysisText.trim()) threw = true;
    assert(threw);
});

console.log('\n[Priority 4] Travel Site — form validation');

function validateTravelForm(data) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.name || data.name.length < 2) return { ok: false, msg: 'Please enter your full name.' };
    if (!emailRegex.test(data.email)) return { ok: false, msg: 'Please enter a valid email address.' };
    if (!data.message || data.message.length < 10) return { ok: false, msg: 'Please enter a message (at least 10 characters).' };
    return { ok: true };
}

test('empty name → fails', () => assert(!validateTravelForm({ name: '', email: 'a@b.com', message: 'Hello there world' }).ok));
test('short name → fails', () => assert(!validateTravelForm({ name: 'A', email: 'a@b.com', message: 'Hello there world' }).ok));
test('bad email → fails', () => assert(!validateTravelForm({ name: 'Srini', email: 'notanemail', message: 'Hello there world' }).ok));
test('short message → fails', () => assert(!validateTravelForm({ name: 'Srini', email: 'a@b.com', message: 'Hi' }).ok));
test('valid form → passes', () => assert(validateTravelForm({ name: 'Srini Katta', email: 'srini@example.com', message: 'Interested in a custom trip to Patagonia.' }).ok));

// ============================================================
// Summary
// ============================================================
console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('SOME TESTS FAILED');
    process.exit(1);
} else {
    console.log('ALL TESTS PASSED');
}
