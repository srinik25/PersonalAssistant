// ========== FINANCE TRACKER CORE ==========

function esc(str) {
    var el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getAccountTypeLabel(type) {
    var labels = {
        brokerage: 'Brokerage',
        ira: 'IRA',
        roth_ira: 'Roth IRA',
        '401k': '401(k)',
        '529': '529 Plan',
        annuity: 'Annuity',
        cd: 'CD',
        crypto: 'Crypto',
        mma: 'Money Market',
        savings: 'Savings',
        checking: 'Checking',
        other: 'Other'
    };
    return labels[type] || type;
}

function getAccountTypeIcon(type) {
    var icons = {
        brokerage: '&#128200;',
        ira: '&#127974;',
        roth_ira: '&#127974;',
        '401k': '&#127974;',
        '529': '&#127891;',
        annuity: '&#128176;',
        cd: '&#128179;',
        crypto: '&#9939;',
        mma: '&#128178;',
        savings: '&#127974;',
        checking: '&#128179;',
        other: '&#128181;'
    };
    return icons[type] || '&#128181;';
}

function calculateGainLoss(amount, costBasis) {
    if (!costBasis || costBasis === 0) return null;
    var gain = amount - costBasis;
    var pct = ((gain / costBasis) * 100);
    return { value: gain, percentage: pct, isGain: gain >= 0 };
}

function sumFunds(funds) {
    if (!funds || !funds.length) return 0;
    return funds.reduce(function(sum, f) { return sum + (Number(f.amount) || 0); }, 0);
}

// ========== FIRESTORE CRUD ==========

function loadAccounts() {
    return db.collection('finance_accounts')
        .where('userId', '==', currentUser.uid)
        .get()
        .then(function(snap) {
            var accounts = [];
            snap.forEach(function(doc) {
                accounts.push(Object.assign({ id: doc.id }, doc.data()));
            });
            accounts.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
            return accounts;
        });
}

function loadAccount(accountId) {
    return db.collection('finance_accounts').doc(accountId).get().then(function(doc) {
        if (!doc.exists) return null;
        return Object.assign({ id: doc.id }, doc.data());
    });
}

function saveAccount(accountData) {
    accountData.updatedAt = new Date().toISOString();
    if (!accountData.createdAt) accountData.createdAt = accountData.updatedAt;
    accountData.userId = currentUser.uid;

    var data = JSON.parse(JSON.stringify(accountData));
    var id = data.id;
    delete data.id;

    if (id) {
        return db.collection('finance_accounts').doc(id).update(data).then(function() {
            return id;
        });
    } else {
        return db.collection('finance_accounts').add(data).then(function(ref) {
            return ref.id;
        });
    }
}

function deleteAccount(accountId) {
    return db.collection('finance_accounts').doc(accountId).delete();
}

function loadProfile() {
    return db.collection('finance_profiles').doc(currentUser.uid).get().then(function(doc) {
        if (!doc.exists) return {};
        return doc.data();
    });
}

function saveProfile(profileData) {
    profileData.userId = currentUser.uid;
    profileData.updatedAt = new Date().toISOString();
    return db.collection('finance_profiles').doc(currentUser.uid).set(profileData, { merge: true });
}

function saveSnapshot(accountId, totalValue, breakdown) {
    return db.collection('finance_snapshots').add({
        userId: currentUser.uid,
        accountId: accountId,
        totalValue: totalValue,
        date: new Date().toISOString(),
        breakdown: breakdown || null
    });
}

function loadSnapshots(accountId, limit) {
    return db.collection('finance_snapshots')
        .where('userId', '==', currentUser.uid)
        .where('accountId', '==', accountId)
        .get()
        .then(function(snap) {
            var snapshots = [];
            snap.forEach(function(doc) { snapshots.push(doc.data()); });
            snapshots.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
            return snapshots.slice(0, limit || 10);
        });
}

// ========== LLM ANALYSIS ==========

function trackTokenUsage(action, responseData) {
    if (!responseData || !responseData.usage) return;
    var usage = responseData.usage;
    db.collection('token_usage').add({
        userId: currentUser ? currentUser.uid : 'anonymous',
        userName: currentUser ? (currentUser.displayName || currentUser.email) : 'anonymous',
        action: action,
        model: responseData.model || 'gpt-4o-mini',
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        timestamp: new Date().toISOString()
    }).catch(function() {});
}

function callFinanceLLM(systemPrompt, userPrompt, action, maxTokens) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: maxTokens || 800
        })
    }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) throw new Error(data.error.message);
        trackTokenUsage(action || 'finance_analysis', data);
        // Lesson 3: validate content non-empty before returning
        var content = data.choices && data.choices[0] && data.choices[0].message.content;
        if (!content || !content.trim()) throw new Error('LLM returned empty analysis');
        return content;
    });
}

function stripPII(text) {
    if (!text) return text;
    // Remove common name patterns - names stored in profile
    var names = (typeof PII_NAMES !== 'undefined') ? PII_NAMES : [];
    names.forEach(function(name) {
        text = text.replace(new RegExp('\\b' + name + '\\b', 'gi'), 'Person');
    });
    // Remove email addresses
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');
    // Remove phone numbers
    text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');
    return text;
}

function buildProfileContext(profile) {
    var parts = [];
    if (profile.age) parts.push('Age: ' + profile.age);
    // Use pre-summarized goals (generated on profile save) — never send full goals to LLM
    var goals = profile.goalsSummary || profile.goals;
    if (goals) parts.push('Financial goals: ' + stripPII(goals));
    if (profile.riskTolerance) parts.push('Risk tolerance: ' + profile.riskTolerance);
    if (profile.retirementAge) parts.push('Target retirement age: ' + profile.retirementAge);
    return parts.length ? parts.join('\n') : 'No profile information provided.';
}

function generateAccountAnalysis(account, profile) {
    var systemPrompt = 'You are a CFP providing brief educational portfolio analysis. ' +
        'No buy/sell recommendations. Be concise — use bullet points, not paragraphs. ' +
        'No personally identifiable information in your response.';

    var holdingsText = '';
    if (account.funds && account.funds.length) {
        holdingsText = account.funds.map(function(f) {
            var line = '- ' + f.name + ': ' + formatCurrency(f.amount);
            if (f.costBasis) {
                var gl = calculateGainLoss(f.amount, f.costBasis);
                line += ' (cost basis: ' + formatCurrency(f.costBasis) + ', ' +
                    (gl.isGain ? 'gain' : 'loss') + ': ' + formatCurrency(Math.abs(gl.value)) +
                    ' / ' + gl.percentage.toFixed(1) + '%)';
            }
            return line;
        }).join('\n');
    } else {
        holdingsText = 'No holdings listed.';
    }

    var userPrompt = 'Analyze this investment account:\n\n' +
        'Account type: ' + getAccountTypeLabel(account.type) + '\n' +
        'Total value: ' + formatCurrency(sumFunds(account.funds)) + '\n\n' +
        'Holdings:\n' + holdingsText + '\n\n' +
        'User profile:\n' + buildProfileContext(profile) + '\n\n' +
        (account.notes ? 'Account notes/plans: ' + stripPII(account.notes) + '\n\n' : '') +
        'Current date: ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '\n\n' +
        'Provide:\n' +
        '1. ACCOUNT HEALTH SCORE: 1-10\n' +
        '2. DIVERSIFICATION: How diversified within this account?\n' +
        '3. ALIGNMENT: How well does this align with goals and risk tolerance?\n' +
        '4. STRENGTHS: What is working well\n' +
        '5. CONCERNS: Any issues or imbalances\n' +
        '6. SUGGESTIONS: Actionable improvements (general, not specific security recommendations)\n\n' +
        'Format with clear headers. Be specific and honest.';

    return callFinanceLLM(systemPrompt, userPrompt, 'account_analysis', 800);
}

function generateOverallAnalysis(accounts, profile, snapshots) {
    var systemPrompt = 'You are a CFP providing a portfolio review across all accounts. ' +
        'No buy/sell recommendations. Be concise — use bullet points, not paragraphs. ' +
        'No personally identifiable information in your response.';

    // Group accounts by type (strip PII - no account names)
    var byType = {};
    var totalPortfolio = 0;
    accounts.forEach(function(acct, i) {
        var type = getAccountTypeLabel(acct.type);
        var label = type + ' Account ' + (i + 1);
        var total = sumFunds(acct.funds);
        totalPortfolio += total;
        if (!byType[type]) byType[type] = { total: 0, accounts: [] };
        byType[type].total += total;
        byType[type].accounts.push({
            label: label,
            total: total,
            funds: (acct.funds || []).map(function(f) {
                var line = f.name + ': ' + formatCurrency(f.amount);
                if (f.costBasis) {
                    var gl = calculateGainLoss(f.amount, f.costBasis);
                    line += ' (' + (gl.isGain ? '+' : '') + gl.percentage.toFixed(1) + '%)';
                }
                return line;
            })
        });
    });

    var portfolioText = 'Total portfolio value: ' + formatCurrency(totalPortfolio) + '\n\n';
    portfolioText += 'Allocation by account type:\n';
    for (var type in byType) {
        var pct = totalPortfolio > 0 ? ((byType[type].total / totalPortfolio) * 100).toFixed(1) : 0;
        portfolioText += '- ' + type + ': ' + formatCurrency(byType[type].total) + ' (' + pct + '%)\n';
        byType[type].accounts.forEach(function(a) {
            portfolioText += '  ' + a.label + ': ' + formatCurrency(a.total) + '\n';
            a.funds.forEach(function(f) { portfolioText += '    - ' + f + '\n'; });
        });
    }

    // Add trend data if available
    var trendText = '';
    if (snapshots && snapshots.length > 1) {
        trendText = '\nPortfolio trend (recent snapshots):\n';
        snapshots.slice(0, 5).forEach(function(s) {
            trendText += '- ' + new Date(s.date).toLocaleDateString('en-US') + ': ' + formatCurrency(s.totalValue) + '\n';
        });
    }

    var userPrompt = 'Review this complete financial portfolio:\n\n' +
        portfolioText + trendText + '\n' +
        'User profile:\n' + buildProfileContext(profile) + '\n\n' +
        'Current date: ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '\n\n' +
        'Provide a comprehensive analysis:\n' +
        '1. PORTFOLIO HEALTH SCORE: 1-10\n' +
        '2. ASSET ALLOCATION: Assessment of current allocation across account types\n' +
        '3. DIVERSIFICATION: Cross-portfolio diversification analysis\n' +
        '4. RISK ASSESSMENT: How does risk level match stated tolerance?\n' +
        '5. TAX STRATEGY: Tax-advantaged vs taxable account usage\n' +
        '6. STRENGTHS: What is working well\n' +
        '7. GAPS & CONCERNS: Missing pieces or imbalances\n' +
        '8. TOP 5 RECOMMENDATIONS: Most impactful changes, ranked by priority\n\n' +
        (trendText ? '9. TREND ANALYSIS: Comment on portfolio trajectory\n\n' : '') +
        'Format with clear headers. Be specific, honest, and actionable.';

    return callFinanceLLM(systemPrompt, userPrompt, 'overall_analysis', 1200);
}

function formatAnalysisText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^### (.+)$/gm, '<strong style="display:block;margin-top:12px;margin-bottom:4px;">$1</strong>')
        .replace(/^## (.+)$/gm, '<strong style="display:block;margin-top:12px;margin-bottom:4px;">$1</strong>')
        .replace(/^# (.+)$/gm, '<strong style="display:block;margin-top:12px;margin-bottom:4px;">$1</strong>')
        .replace(/^[•\-\*] (.+)$/gm, '<span style="display:block;padding-left:16px;">&#8226; $1</span>')
        .replace(/\n{2,}/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

var FINANCE_DISCLAIMER = '<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.1);font-size:0.78rem;color:#6a7a8e;line-height:1.5;">' +
    '<strong>Disclaimer:</strong> This is AI-generated educational analysis, NOT financial advice. ' +
    'No personally identifiable information is sent to AI models. ' +
    'Consult a certified financial planner for personalized investment advice.</div>';
