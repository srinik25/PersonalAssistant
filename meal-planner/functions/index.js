const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();

// Secrets — set via: firebase functions:secrets:set <NAME>
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const notifyEmail = defineSecret("NOTIFY_EMAIL");
const openaiKey = defineSecret("OPENAI_API_KEY");

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
    { secrets: [openaiKey], timeoutSeconds: 60, memory: "256MiB", cors: true },
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
            "Prefer Indian, Middle Eastern, or Asian-style recipes (e.g., dal, biryani, curry, stir-fry, chai).",
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
