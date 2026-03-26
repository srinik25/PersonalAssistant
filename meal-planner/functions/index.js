const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Secrets — set via: firebase functions:secrets:set GMAIL_EMAIL / GMAIL_APP_PASSWORD / NOTIFY_EMAIL
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const notifyEmail = defineSecret("NOTIFY_EMAIL");

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

// ========== 2. WEEKLY TOKEN USAGE REPORT (Every Monday 8am ET) ==========
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
