// Health Tracker - Core Application Logic

var CATEGORIES = {
    vitals: { label: 'Vitals', icon: '', hint: 'BP, heart rate, temperature, weight, BMI...' },
    vaccines: { label: 'Vaccines', icon: '', hint: 'Flu, COVID, Tdap, travel vaccines...' },
    cardio: { label: 'Cardio', icon: '', hint: 'ECG, stress test, echo, cholesterol...' },
    lipid: { label: 'Lipid Panel', icon: '', hint: 'Total cholesterol, LDL, HDL, triglycerides...' },
    gastro: { label: 'Gastro', icon: '', hint: 'Colonoscopy, endoscopy, liver panel...' },
    physio: { label: 'Physio', icon: '', hint: 'Physical therapy, bone density, flexibility...' },
    teeth: { label: 'Teeth', icon: '', hint: 'Dental exams, cleanings, X-rays, procedures...' },
    eyes: { label: 'Eyes', icon: '', hint: 'Vision exams, prescriptions, retina scans...' },
    ears: { label: 'Ears', icon: '', hint: 'Hearing tests, audiogram, ear exams...' },
    sleep: { label: 'Sleep', icon: '', hint: 'Sleep study, hours, quality, apnea...' },
    other: { label: 'Other', icon: '', hint: 'Any other health records or notes...' }
};

// ---- PII Stripping ----
function stripPII(text) {
    if (!text) return text;
    var result = text;
    PII_NAMES.forEach(function(name) {
        var regex = new RegExp(name, 'gi');
        result = result.replace(regex, '[PERSON]');
    });
    return result;
}

// ---- HTML escaping ----
function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ---- Health Entries CRUD ----
function loadEntries(category) {
    return db.collection('health_entries')
        .where('userId', '==', currentUser.uid)
        .where('category', '==', category)
        .get()
        .then(function(snap) {
            var entries = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                d.id = doc.id;
                entries.push(d);
            });
            // Sort client-side (newest first)
            entries.sort(function(a, b) {
                return (b.date || '').localeCompare(a.date || '');
            });
            return entries;
        });
}

function saveEntry(entry) {
    var data = {
        userId: currentUser.uid,
        category: entry.category,
        date: entry.date,
        values: entry.values || '',
        notes: entry.notes || '',
        createdAt: Date.now()
    };
    if (entry.id) {
        return db.collection('health_entries').doc(entry.id).update(data);
    } else {
        return db.collection('health_entries').add(data);
    }
}

function deleteEntry(entryId) {
    return db.collection('health_entries').doc(entryId).delete();
}

// ---- All entries across categories ----
function loadAllEntries() {
    return db.collection('health_entries')
        .where('userId', '==', currentUser.uid)
        .get()
        .then(function(snap) {
            var entries = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                d.id = doc.id;
                entries.push(d);
            });
            entries.sort(function(a, b) {
                return (b.date || '').localeCompare(a.date || '');
            });
            return entries;
        });
}

// ---- Health Profile CRUD ----
function loadProfile() {
    return db.collection('health_profiles')
        .where('userId', '==', currentUser.uid)
        .get()
        .then(function(snap) {
            var profile = null;
            snap.forEach(function(doc) {
                profile = doc.data();
                profile.id = doc.id;
            });
            return profile;
        });
}

function saveProfile(profile) {
    var data = {
        userId: currentUser.uid,
        age: profile.age || '',
        sex: profile.sex || '',
        height: profile.height || '',
        weight: profile.weight || '',
        bloodType: profile.bloodType || '',
        allergies: profile.allergies || '',
        familyHistory: profile.familyHistory || '',
        medications: profile.medications || '',
        goalsSummary: profile.goalsSummary || '',
        updatedAt: Date.now()
    };
    if (profile.id) {
        return db.collection('health_profiles').doc(profile.id).update(data);
    } else {
        return db.collection('health_profiles').add(data);
    }
}

// ---- Health Analyses CRUD ----
function loadAnalysis(scope) {
    return db.collection('health_analyses')
        .where('userId', '==', currentUser.uid)
        .where('scope', '==', scope)
        .get()
        .then(function(snap) {
            var analysis = null;
            snap.forEach(function(doc) {
                var d = doc.data();
                d.id = doc.id;
                // Keep most recent
                if (!analysis || (d.generatedAt || 0) > (analysis.generatedAt || 0)) {
                    analysis = d;
                }
            });
            return analysis;
        });
}

function saveAnalysis(scope, analysisText) {
    var data = {
        userId: currentUser.uid,
        scope: scope,
        analysis: analysisText,
        generatedAt: Date.now()
    };
    // Check for existing
    return db.collection('health_analyses')
        .where('userId', '==', currentUser.uid)
        .where('scope', '==', scope)
        .get()
        .then(function(snap) {
            var existingId = null;
            snap.forEach(function(doc) { existingId = doc.id; });
            if (existingId) {
                return db.collection('health_analyses').doc(existingId).update(data);
            } else {
                return db.collection('health_analyses').add(data);
            }
        });
}

// ---- Profile Context Builder ----
function buildProfileContext() {
    return loadProfile().then(function(profile) {
        if (!profile) return '';
        var parts = [];
        if (profile.age) parts.push('Age: ' + profile.age);
        if (profile.sex) parts.push('Sex: ' + profile.sex);
        if (profile.height) parts.push('Height: ' + profile.height);
        if (profile.weight) parts.push('Weight: ' + profile.weight);
        if (profile.bloodType) parts.push('Blood type: ' + profile.bloodType);
        if (profile.allergies) parts.push('Allergies: ' + stripPII(profile.allergies));
        if (profile.goalsSummary) parts.push('Health goals: ' + stripPII(profile.goalsSummary));
        return parts.length > 0 ? 'Patient context: ' + parts.join(', ') + '.' : '';
    });
}

// ---- LLM Calls ----
function callHealthLLM(prompt, maxTokens) {
    var systemMsg = 'You are a concise health data summarizer. Be concise, use bullet points. No personally identifiable information in your response. Do not include names of people.';
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OPENAI_API_KEY
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: maxTokens || 800,
            messages: [
                { role: 'system', content: systemMsg },
                { role: 'user', content: prompt }
            ]
        })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
        if (data.usage) {
            trackTokenUsage('health-tracker', data.usage);
        }
        if (data.choices && data.choices[0]) {
            return data.choices[0].message.content;
        }
        if (data.error) {
            throw new Error(data.error.message || 'LLM error');
        }
        return '';
    });
}

// ---- Token Usage Tracking ----
function trackTokenUsage(source, usage) {
    try {
        db.collection('token_usage').add({
            userId: currentUser.uid,
            source: source,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
            timestamp: Date.now()
        });
    } catch (e) {
        console.warn('Token tracking failed:', e);
    }
}

// ---- Format Analysis Text ----
function formatAnalysisText(text) {
    if (!text) return '';
    // Convert markdown-style to HTML
    var html = esc(text);
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    // Fix multiple ul wrapping - wrap consecutive li's
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, function(match) {
        return match;
    });
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    // Remove double <ul>
    html = html.replace(/<ul><ul>/g, '<ul>');
    html = html.replace(/<\/ul><\/ul>/g, '</ul>');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<[hul])/g, '$1');
    html = html.replace(/(<\/[hul][^>]*>)\s*<\/p>/g, '$1');
    return html;
}

// ---- PDF Generation ----
function downloadPDF(title, content) {
    var win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>' + esc(title) + '</title>');
    win.document.write('<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a4a4a;line-height:1.7;}');
    win.document.write('h1{color:#1a4a4a;border-bottom:2px solid #4a9a8a;padding-bottom:8px;}');
    win.document.write('h3,h4{color:#2a6b6b;margin-top:16px;}');
    win.document.write('ul{margin:8px 0;padding-left:24px;}li{margin:4px 0;}');
    win.document.write('.meta{color:#666;font-size:0.85em;margin-bottom:20px;}</style></head><body>');
    win.document.write('<h1>' + esc(title) + '</h1>');
    win.document.write('<div class="meta">Generated: ' + new Date().toLocaleDateString() + '</div>');
    win.document.write(content);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(function() { win.print(); }, 500);
}

// ---- Category Helpers ----
function getCategoryLabel(cat) {
    return CATEGORIES[cat] ? CATEGORIES[cat].label : cat;
}

function getCategoryIcon(cat) {
    return CATEGORIES[cat] ? CATEGORIES[cat].icon : '\uD83D\uDCCB';
}

function getCategoryHint(cat) {
    return CATEGORIES[cat] ? CATEGORIES[cat].hint : '';
}
