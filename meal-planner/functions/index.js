const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const https = require("https");

admin.initializeApp();
const db = admin.firestore();

// Secrets — set via: firebase functions:secrets:set <NAME>
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const notifyEmail = defineSecret("NOTIFY_EMAIL");
const openaiKey = defineSecret("OPENAI_API_KEY");

// ========== VALIDATION HELPERS ==========

/**
 * Lesson 3: Validate LLM-generated nutrition profile structure before use.
 * Returns { valid: true } or { valid: false, reason: string }
 */
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

// Exported for test harness
if (typeof module !== 'undefined') module.exports = module.exports || {};
if (typeof module !== 'undefined') module.exports.validateNutritionData = validateNutritionData;

// ========== IMAGE HELPERS ==========
const IMAGE_BAD_WORDS = [
    "illustration","drawing","botanical","diagram","map","coat","stamp",
    "logo","icon","tree","leaf","leaves","plant","flower","mill","brand","package",
    "bag","box","product","label","flour","powder","company","store","market","flag","svg",
    "pasta","pizza","soup","salad","dish","plate","bowl","sauce","cooked","recipe",
    "meal","cuisine","prepared","caprese","stew","curry","casserole","sandwich","bread",
    "cake","cookie","smoothie","juice","drink","cocktail","dessert","spread","dip",
    "ingredienti","busiate","anelletti","pesto",
    "hand","hands","held","holding","person","people","vendor","farmer","child",
    "field","farm","harvest","scene","market","stall","pile","basket","crowd","group"
];

function hasBadWord(str) {
    const s = str.toLowerCase();
    return IMAGE_BAD_WORDS.some(w => s.includes(w));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "NutritionApp/1.0" } }, res => {
            let body = "";
            res.on("data", chunk => { body += chunk; });
            res.on("end", () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        }).on("error", reject);
    });
}

function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "NutritionApp/1.0" } }, res => {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks)));
        }).on("error", reject);
    });
}

async function findWikimediaImage(foodName, client) {
    const query = encodeURIComponent(foodName + " food ingredient");
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${query}&gsrlimit=20&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;
    try {
        const data = await fetchJson(apiUrl);
        const pages = Object.values((data.query || {}).pages || {});
        const candidates = pages
            .filter(p => !hasBadWord(p.title || ""))
            .map(p => ({ title: p.title, info: (p.imageinfo || [{}])[0] }))
            .filter(({ info }) => ["image/jpeg", "image/jpg"].includes(info.mime || ""))
            .filter(({ info }) => !hasBadWord(info.url || ""))
            .filter(({ info }) => (info.width || 0) >= 400)
            .sort((a, b) => (b.info.width || 0) - (a.info.width || 0))
            .slice(0, 5);
        for (const { info } of candidates) {
            const valid = await validateImageWithGPT(info.url, foodName, client);
            if (valid) return info.url;
        }
    } catch (e) {
        console.warn("Image search failed:", e.message);
    }
    return null;
}

async function validateImageWithGPT(imageUrl, foodName, client) {
    try {
        const buffer = await fetchBuffer(imageUrl);
        const b64 = buffer.toString("base64");
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 50,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: `Does this image show ${foodName} clearly as a raw/whole food item or ingredient — close-up, filling most of the frame, not held in hands, not part of a larger scene, not a prepared dish, not packaged, not a plant illustration? Reply with only YES or NO.` },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }
                ]
            }]
        });
        return response.choices[0].message.content.trim().toUpperCase().startsWith("YES");
    } catch (e) {
        console.warn("Image validation failed:", e.message);
        return false;
    }
}

// ========== 0. NUTRITION PROFILE GENERATOR (Nourish & Know app) ==========
const NUTRITION_SYSTEM_PROMPT = {
    role: "Nutrition Expert",
    guidelines: {
        accuracy: "Only provide verified, evidence-based nutritional information",
        no_fabrication: "Never make up or guess at nutritional data",
        verification: "Double and triple check all data before presenting",
        statistics: "Verify all stats and numbers for accuracy",
        sources: "Reference authentic, credible sources"
    }
};
const NUTRITION_PROFILE = {
    demographics: { background: "Indian", gender: "female", age_range: "40s" },
    core_philosophy: "Food is medicine",
    dietary_preferences: { primary: ["vegetarian"], approach: "healthy, whole-food focused, natural foods" },
    fitness: { practices: ["yoga", "strength training"] }
};
const NUTRITION_OUTPUT_FIELDS = {
    name: "", history: "", native_country: "",
    nutrition_profile: { serving_size: "", calories: "", protein: "", fiber: "", fat: "", carbohydrates: "", key_vitamins: [], key_minerals: [], notable_properties: "" },
    daily_intake: { tsp: "", tbsp: "", cup: "" },
    best_time_to_eat: "",
    meal_incorporation: { can_be_added: true, suggestions: [], additional_notes: [] },
    recipe: { name: "", description: "", prep_time: "", cook_time: "", servings: "", ingredients: [], instructions: [] }
};

exports.generateNutritionProfile = onRequest(
    { secrets: [openaiKey], timeoutSeconds: 120, memory: "512MiB", cors: true },
    async (req, res) => {
        if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
        const food = (req.body.food || "").trim();
        if (!food || food.length < 2 || food.length > 80 || /[<>{};]/.test(food)) {
            res.status(400).json({ error: "Invalid food name" }); return;
        }
        const client = new OpenAI({ apiKey: openaiKey.value() });
        const systemMessage = [
            `You are a ${NUTRITION_SYSTEM_PROMPT.role}.`,
            `Guidelines: ${JSON.stringify(NUTRITION_SYSTEM_PROMPT.guidelines)}`,
            `User profile: ${JSON.stringify(NUTRITION_PROFILE)}`,
            `IMPORTANT: Respond ONLY with valid JSON matching this exact format:`,
            JSON.stringify(NUTRITION_OUTPUT_FIELDS, null, 2),
            "Fill in ALL fields with accurate, evidence-based data.",
            "Return ONLY the JSON object, no markdown fences or extra text."
        ].join("\n");
        const userMessage = [
            `Give me the complete nutritional profile for: ${food}`,
            "Include history, native country, full nutrition profile with serving size,",
            "daily intake, best time to eat, meal incorporation suggestions,",
            "and a vegetarian recipe using this food item.",
            "Choose a well-known, widely recognized recipe where this food is the star ingredient.",
            "The recipe MUST be a real, established dish that people actually cook — not an invented fusion or generic 'stir-fry'.",
            "For fruits: classic desserts, smoothies, or salads (e.g. strawberry shortcake, mango lassi).",
            "For grains and legumes: iconic dishes (e.g. dal tadka, chana masala, hummus, biryani).",
            "For spices and roots: traditional preparations where that spice is central.",
            "For vegetables: the most popular classic preparation (e.g. corn → elote or corn chowder, not invented tikka).",
            "Do NOT invent fusion dishes. Do NOT force Indian flavors onto foods where they do not belong.",
            "The recipe should be something a home cook would recognize by name and find in a cookbook.",
            "Vegetarian means dairy like ghee, yogurt, milk, and paneer are fine — do NOT restrict to vegan.",
            "Tailor everything for a vegetarian diet.",
            "CRITICAL for daily_intake: tsp, tbsp, and cup values MUST be equivalent conversions of the SAME amount.",
            "For the recipe: include name, description, prep_time, cook_time, servings, ingredients list, and step-by-step instructions.",
            "For meal_incorporation, include an 'additional_notes' array with 2-3 practical, evidence-based tips."
        ].join("\n");
        const callOpenAI = async (temperature) => {
            const response = await client.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "system", content: systemMessage }, { role: "user", content: userMessage }],
                temperature
            });
            let content = response.choices[0].message.content.trim();
            if (content.startsWith("```")) content = content.split("\n").slice(1).join("\n").split("```")[0].trim();
            return JSON.parse(content);
        };
        try {
            let data;
            try { data = await callOpenAI(0.3); } catch { data = await callOpenAI(0.1); }

            // Lesson 3: Validate LLM output structure before using it
            const validation = validateNutritionData(data);
            if (!validation.valid) {
                console.error("LLM returned incomplete nutrition data:", validation.reason);
                res.status(422).json({ error: "Incomplete nutrition data from AI", detail: validation.reason });
                return;
            }

            // Lesson 10: Fallback chain — Wikimedia → DALL-E → hard abort
            let imageUrl = await findWikimediaImage(food, client);
            if (!imageUrl) {
                try {
                    const imageResponse = await client.images.generate({
                        model: "dall-e-3",
                        prompt: `Professional food photography of ${food} as a raw whole ingredient on a white background. No text, no labels, no packaging.`,
                        size: "1024x1024",
                        n: 1
                    });
                    imageUrl = imageResponse.data[0].url;
                } catch (e) {
                    console.warn("DALL-E fallback failed:", e.message);
                }
            }
            // Lesson 1: No image after all tiers = 422, don't publish incomplete record
            if (!imageUrl) {
                console.error("No valid image found for:", food, "(Wikimedia + DALL-E both failed)");
                res.status(422).json({ error: "No valid image found", detail: "Both Wikimedia and DALL-E image sources failed" });
                return;
            }
            data.image_url = imageUrl;
            res.status(200).json(data);
        } catch (err) {
            console.error("generateNutritionProfile error:", err);
            res.status(500).json({ error: "Failed to generate profile" });
        }
    }
);

// ========== 0a. PARSE ITEM PROXY (What's Happening site) ==========
// No auth required — this is a public community site. Key is kept server-side.
exports.parseItem = onRequest(
    { secrets: [openaiKey], cors: true },
    async (req, res) => {
        if (req.method === "OPTIONS") { res.status(204).send(""); return; }

        const { prompt } = req.body;
        if (!prompt) { res.status(400).json({ error: "Missing prompt" }); return; }

        try {
            const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openaiKey.value()}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.2,
                    max_tokens: 4000
                })
            });
            const data = await oaiRes.json();
            res.json(data);
        } catch (e) {
            console.error("parseItem error:", e);
            res.status(500).json({ error: e.message });
        }
    }
);

// ========== 0b. NUTRITION REVIEW PROXY ==========
// Keeps OpenAI key server-side. Verifies Firebase auth, proxies to OpenAI with streaming.
exports.nutritionReview = onRequest(
    { secrets: [openaiKey], cors: true },
    async (req, res) => {
        if (req.method === "OPTIONS") { res.status(204).send(""); return; }

        let userId = "anonymous", userName = "anonymous";
        try {
            const token = (req.headers.authorization || "").replace("Bearer ", "");
            const decoded = await admin.auth().verifyIdToken(token);
            userId = decoded.uid;
            userName = decoded.name || decoded.email || "user";
        } catch (e) {
            res.status(401).json({ error: "Unauthorized" }); return;
        }

        const { messages, max_tokens = 600, action = "day_review" } = req.body;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");

        try {
            const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openaiKey.value()}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", messages, temperature: 0.3, max_tokens,
                    stream: true, stream_options: { include_usage: true }
                })
            });

            if (!oaiRes.ok) {
                const err = await oaiRes.json();
                res.write(`data: ${JSON.stringify({ error: err.error })}\n\n`);
                res.end(); return;
            }

            const reader = oaiRes.body.getReader();
            const decoder = new TextDecoder();
            let usage = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                for (const line of text.split("\n")) {
                    if (line.startsWith("data: ") && line !== "data: [DONE]") {
                        try { const p = JSON.parse(line.slice(6)); if (p.usage) usage = p.usage; } catch (e) {}
                    }
                }
                res.write(text);
            }

            if (usage) {
                await db.collection("token_usage").add({
                    userId, userName, action, model: "gpt-4o-mini",
                    promptTokens: usage.prompt_tokens || 0,
                    completionTokens: usage.completion_tokens || 0,
                    totalTokens: usage.total_tokens || 0,
                    timestamp: new Date().toISOString()
                });
            }

            res.end();
        } catch (e) {
            console.error("nutritionReview error:", e);
            if (!res.headersSent) res.status(500).json({ error: e.message });
            else res.end();
        }
    }
);

function createTransporter(email, password) {
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user: email, pass: password }
    });
}

// ========== 1. CONTACT FORM EMAIL NOTIFICATION ==========
exports.onContactCreated = onDocumentCreated(
    {
        document: "contact_messages/{docId}",
        secrets: [gmailEmail, gmailAppPassword, notifyEmail]
    },
    async (event) => {
        const data = event.data.data();
        const transporter = createTransporter(gmailEmail.value(), gmailAppPassword.value());

        const mailOptions = {
            from: `"Meal Planner" <${gmailEmail.value()}>`,
            to: notifyEmail.value(),
            subject: `[Meal Planner] New ${data.type || "message"} from ${data.name || "Anonymous"}`,
            html: `
                <h2>New Contact Message</h2>
                <table style="border-collapse:collapse;font-family:sans-serif;">
                    <tr><td style="padding:6px 12px;font-weight:bold;">From:</td><td style="padding:6px 12px;">${data.name || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Email:</td><td style="padding:6px 12px;">${data.email || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Topic:</td><td style="padding:6px 12px;">${data.type || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Date:</td><td style="padding:6px 12px;">${data.createdAt || new Date().toISOString()}</td></tr>
                </table>
                <div style="margin-top:16px;padding:16px;background:#f4f7f4;border-radius:8px;font-family:sans-serif;line-height:1.6;">
                    ${(data.message || "").replace(/\n/g, "<br>")}
                </div>
                <p style="margin-top:16px;font-size:12px;color:#999;">This is an automated notification from Meal Planner.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log("Contact notification sent for:", event.params.docId);
    }
);

// ========== 2. TRAVEL INQUIRY EMAIL NOTIFICATION ==========
exports.onTravelInquiry = onDocumentCreated(
    {
        document: "travel_inquiries/{docId}",
        secrets: [gmailEmail, gmailAppPassword, notifyEmail]
    },
    async (event) => {
        const data = event.data.data();
        const transporter = createTransporter(gmailEmail.value(), gmailAppPassword.value());

        const mailOptions = {
            from: `"Travel Planner" <${gmailEmail.value()}>`,
            to: notifyEmail.value(),
            subject: `[Travel] New inquiry from ${data.name || "Anonymous"} — ${data.tripType || "Trip"}`,
            html: `
                <h2>New Travel Inquiry</h2>
                <table style="border-collapse:collapse;font-family:sans-serif;">
                    <tr><td style="padding:6px 12px;font-weight:bold;">Name:</td><td style="padding:6px 12px;">${data.name || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Email:</td><td style="padding:6px 12px;">${data.email || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Trip Type:</td><td style="padding:6px 12px;">${data.tripType || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Group Size:</td><td style="padding:6px 12px;">${data.groupSize || "N/A"}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Dates:</td><td style="padding:6px 12px;">${data.dates || "N/A"}</td></tr>
                </table>
                <div style="margin-top:16px;padding:16px;background:#f5f3f0;border-radius:8px;font-family:sans-serif;line-height:1.6;">
                    ${(data.message || "").replace(/\n/g, "<br>")}
                </div>
                <p style="margin-top:16px;font-size:12px;color:#999;">Automated notification from Travel Planner.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log("Travel inquiry notification sent for:", event.params.docId);
    }
);

// ========== 3. WEEKLY TOKEN USAGE REPORT (Every Monday 8am ET) ==========
exports.weeklyTokenReport = onSchedule(
    {
        schedule: "every monday 08:00",
        timeZone: "America/New_York",
        secrets: [gmailEmail, gmailAppPassword, notifyEmail]
    },
    async () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const snap = await db.collection("token_usage")
            .where("timestamp", ">=", oneWeekAgo.toISOString())
            .get();

        if (snap.empty) {
            console.log("No token usage in the past week.");
            return;
        }

        // Aggregate by user
        const byUser = {};
        let grandTotal = { prompt: 0, completion: 0, total: 0, calls: 0 };

        snap.forEach((doc) => {
            const d = doc.data();
            const key = d.userName || d.userId || "anonymous";
            if (!byUser[key]) {
                byUser[key] = { userId: d.userId, prompt: 0, completion: 0, total: 0, calls: 0, actions: {} };
            }
            byUser[key].prompt += d.promptTokens || 0;
            byUser[key].completion += d.completionTokens || 0;
            byUser[key].total += d.totalTokens || 0;
            byUser[key].calls++;
            const action = d.action || "unknown";
            byUser[key].actions[action] = (byUser[key].actions[action] || 0) + 1;

            grandTotal.prompt += d.promptTokens || 0;
            grandTotal.completion += d.completionTokens || 0;
            grandTotal.total += d.totalTokens || 0;
            grandTotal.calls++;
        });

        // Estimate cost (gpt-4o-mini: ~$0.15/1M input, ~$0.60/1M output)
        const estCost = ((grandTotal.prompt * 0.15 + grandTotal.completion * 0.60) / 1000000).toFixed(4);

        // Build email
        let userRows = "";
        for (const [name, stats] of Object.entries(byUser)) {
            const actionList = Object.entries(stats.actions).map(([a, c]) => `${a}: ${c}`).join(", ");
            userRows += `
                <tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;">${name}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;">${stats.userId || "N/A"}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${stats.calls}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${stats.prompt.toLocaleString()}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${stats.completion.toLocaleString()}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${stats.total.toLocaleString()}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;">${actionList}</td>
                </tr>`;
        }

        const weekEnd = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const weekStart = oneWeekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        const transporter = createTransporter(gmailEmail.value(), gmailAppPassword.value());

        await transporter.sendMail({
            from: `"Meal Planner" <${gmailEmail.value()}>`,
            to: notifyEmail.value(),
            subject: `[Meal Planner] Weekly Token Usage Report (${weekStart} - ${weekEnd})`,
            html: `
                <h2 style="font-family:Georgia,serif;color:#2d4a3e;">Weekly LLM Token Usage Report</h2>
                <p style="color:#666;font-family:sans-serif;">${weekStart} — ${weekEnd}</p>

                <div style="background:#f4f7f4;padding:16px 20px;border-radius:10px;margin:16px 0;font-family:sans-serif;">
                    <strong style="font-size:18px;color:#2d4a3e;">Totals:</strong><br>
                    API Calls: <strong>${grandTotal.calls}</strong> |
                    Prompt Tokens: <strong>${grandTotal.prompt.toLocaleString()}</strong> |
                    Completion Tokens: <strong>${grandTotal.completion.toLocaleString()}</strong> |
                    Total Tokens: <strong>${grandTotal.total.toLocaleString()}</strong><br>
                    Estimated Cost (gpt-4o-mini): <strong>$${estCost}</strong>
                </div>

                <h3 style="font-family:sans-serif;color:#2d4a3e;margin-top:24px;">Usage by User</h3>
                <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%;">
                    <tr style="background:#2d4a3e;color:#a3d49a;">
                        <th style="padding:8px 12px;text-align:left;">User</th>
                        <th style="padding:8px 12px;text-align:left;">User ID</th>
                        <th style="padding:8px 12px;text-align:right;">Calls</th>
                        <th style="padding:8px 12px;text-align:right;">Prompt</th>
                        <th style="padding:8px 12px;text-align:right;">Completion</th>
                        <th style="padding:8px 12px;text-align:right;">Total</th>
                        <th style="padding:8px 12px;text-align:left;">Actions</th>
                    </tr>
                    ${userRows}
                </table>

                <p style="margin-top:20px;font-size:12px;color:#999;font-family:sans-serif;">
                    Automated report from Meal Planner. Cost estimate based on gpt-4o-mini pricing ($0.15/1M input, $0.60/1M output).
                </p>
            `
        });

        console.log("Weekly token report sent. Total calls:", grandTotal.calls);
    }
);

// ========== READING LIST — CLASSIFY ARTICLE ==========
// Proxies OpenAI classification so the API key never reaches the browser.
exports.classifyArticle = onRequest(
    { secrets: [openaiKey], timeoutSeconds: 30, memory: "256MiB", cors: true },
    async (req, res) => {
        if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
        let url = (req.body.url || "").trim();
        if (!url) { res.status(400).json({ error: "url required" }); return; }

        // Auto-convert known paywalled domains to archive.ph links
        const PAYWALL_DOMAINS = [
            "ft.com", "newyorker.com", "nytimes.com", "theatlantic.com",
            "nautil.us", "wsj.com", "economist.com", "bloomberg.com",
            "lrb.co.uk", "hbr.org", "washingtonpost.com", "harpers.org", "theverge.com"
        ];
        const isPaywalled = PAYWALL_DOMAINS.some(d => url.includes(d));
        if (isPaywalled && !url.startsWith("https://archive.ph")) {
            url = "https://archive.ph/newest/" + url;
        }

        const client = new OpenAI({ apiKey: openaiKey.value() });

        // Best-effort: fetch page title from URL
        let fetchedTitle = "", fetchedDesc = "";
        const SKIP_FETCH = /^https?:\/\/(archive\.ph|archive\.is|archive\.today|web\.archive\.org)/i;
        try {
            if (SKIP_FETCH.test(url)) throw new Error("skip");
            const fetchPage = new Promise((resolve, reject) => {
                const mod = url.startsWith("https") ? require("https") : require("http");
                const req = mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
                    let body = "";
                    res.on("data", c => { body += c; if (body.length > 20000) res.destroy(); });
                    res.on("end", () => resolve(body));
                });
                req.on("error", reject);
                req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
                req.setTimeout(5000);
            });
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000));
            const pageHtml = await Promise.race([fetchPage, timeout]);
            const titleM = pageHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            const descM  = pageHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,})/i)
                        || pageHtml.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+name=["']description/i);
            if (titleM) fetchedTitle = titleM[1].trim().replace(/\s+/g, " ").slice(0, 200);
            if (descM)  fetchedDesc  = descM[1].trim().slice(0, 400);
        } catch (_) {}

        const CATEGORIES = [
            "physics_cosmos", "biology_life", "technology",
            "artificial_intelligence", "human_stories",
            "health_wellness", "exercises", "philosophy", "personal_growth",
            "economics_society", "travel", "personal_finance", "links", "other"
        ];

        const prompt = `Categorize this article for a personal reading list.\n` +
            `URL: ${url}\n` +
            (fetchedTitle ? `Page title: ${fetchedTitle}\n` : "") +
            (fetchedDesc  ? `Description: ${fetchedDesc}\n`  : "") +
            `\nCategories:\n` +
            `- physics_cosmos: physics, quantum, space, black holes, time, energy, climate, solar\n` +
            `- biology_life: biology, microbiome, cells, evolution, aging, fungi, genetics, nature\n` +
            `- technology: internet infrastructure, chips, batteries, EVs, cables, manufacturing\n` +
            `- artificial_intelligence: AI, machine learning, ChatGPT, LLMs, automation\n` +
            `- human_stories: personal essays, biography, longform journalism, death, relationships\n` +
            `- health_wellness: health, medicine, wellness, nutrition, supplements, disease prevention\n` +
            `- exercises: workout routines, fitness programs, strength training, yoga, running, mobility\n` +
            `- philosophy: philosophy, cognition, thinking, stoicism, consciousness, meaning\n` +
            `- economics_society: economics, finance, society, politics, culture\n` +
            `- travel: travel destinations, trip guides, travel essays, exploring places\n` +
            `- personal_growth: self-improvement, habits, mindset, productivity, life lessons\n` +
            `- personal_finance: budgeting, investing, retirement, saving, money management\n` +
            `- links: useful tools, reference pages, resources, directories\n` +
            `- other: anything that doesn't fit the above categories\n` +
            `\nReturn JSON: {"title": "clean title", "description": "1-2 sentence summary", "category": "one_of_above"}`;

        try {
            const completion = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.2,
            });
            const parsed = JSON.parse(completion.choices[0].message.content);
            const category = CATEGORIES.includes(parsed.category) ? parsed.category : "economics_society";
            res.status(200).json({
                title:       parsed.title       || fetchedTitle || url,
                description: parsed.description || fetchedDesc  || "",
                category,
                url,  // returns archive.ph version for paywalled domains
            });
        } catch (err) {
            console.error("classifyArticle error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);
