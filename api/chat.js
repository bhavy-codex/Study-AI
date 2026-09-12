export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const { message } = req.body || {};

    // Validate message
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Check environment variable
    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    // Current Gemini Interactions API
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          model: "gemini-3.8-flash",

          input:
            "You are Study-AI, a helpful study assistant for students. " +
            "Explain concepts clearly, accurately, and in simple language. " +
            "When useful, explain step-by-step.\n\n" +
            "Student question:\n" +
            message
        })
      }
    );

    const data = await response.json();

    // Gemini API returned an error
    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error (${response.status})`
      });
    }

    // Find Gemini's generated text
    let answer = "";

    if (typeof data?.output_text === "string") {
      answer = data.output_text;
    }

    if (!answer && Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        if (Array.isArray(step?.content)) {
          for (const item of step.content) {
            if (item?.type === "text" && item?.text) {
              answer += item.text;
            }
          }
        }
      }
    }

    if (!answer) {
      return res.status(500).json({
        error: "Gemini returned no text answer."
      });
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error("Study-AI backend error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Unexpected server error."
    });
  }
}
