const functions = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiKey = defineSecret("OPENAI_API_KEY");

const SYSTEM_PROMPT = {
  role: "Nutrition Expert",
  guidelines: {
    accuracy: "Only provide verified, evidence-based nutritional information",
    no_fabrication: "Never make up or guess at nutritional data",
    verification: "Double and triple check all data before presenting",
    statistics: "Verify all stats and numbers for accuracy",
    sources: "Reference authentic, credible sources"
  }
};

const PROFILE = {
  demographics: { background: "Indian", gender: "female", age_range: "40s" },
  core_philosophy: "Food is medicine",
  dietary_preferences: {
    primary: ["vegetarian"],
    approach: "healthy, whole-food focused, natural foods"
  },
  fitness: { practices: ["yoga", "strength training"] }
};

const OUTPUT_FIELDS = {
  name: "", history: "", native_country: "",
  nutrition_profile: {
    serving_size: "", calories: "", protein: "", fiber: "", fat: "",
    carbohydrates: "", key_vitamins: [], key_minerals: [], notable_properties: ""
  },
  daily_intake: { tsp: "", tbsp: "", cup: "" },
  best_time_to_eat: "",
  meal_incorporation: { can_be_added: true, suggestions: [], additional_notes: [] },
  recipe: {
    name: "", description: "", prep_time: "", cook_time: "",
    servings: "", ingredients: [], instructions: []
  }
};

exports.generateNutritionProfile = functions.https.onRequest(
  { secrets: [openaiKey], timeoutSeconds: 60, memory: "256MiB", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const food = (req.body.food || "").trim();
    if (!food || food.length < 2 || food.length > 80 || /[<>{};]/.test(food)) {
      return res.status(400).json({ error: "Invalid food name" });
    }

    const client = new OpenAI({ apiKey: openaiKey.value() });

    const systemMessage = [
      `You are a ${SYSTEM_PROMPT.role}.`,
      `Guidelines: ${JSON.stringify(SYSTEM_PROMPT.guidelines)}`,
      `User profile: ${JSON.stringify(PROFILE)}`,
      `IMPORTANT: Respond ONLY with valid JSON matching this exact format:`,
      JSON.stringify(OUTPUT_FIELDS, null, 2),
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
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        temperature
      });
      let content = response.choices[0].message.content.trim();
      if (content.startsWith("```")) {
        content = content.split("\n").slice(1).join("\n").split("```")[0].trim();
      }
      return JSON.parse(content);
    };

    try {
      let data;
      try {
        data = await callOpenAI(0.3);
      } catch {
        data = await callOpenAI(0.1); // retry on parse failure
      }
      return res.status(200).json(data);
    } catch (err) {
      console.error("generateNutritionProfile error:", err);
      return res.status(500).json({ error: "Failed to generate profile" });
    }
  }
);
