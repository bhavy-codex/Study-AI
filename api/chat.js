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

    // Gemini Interactions API
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
            "You are Study-AI, a friendly school teacher.\n\n" +
            "IMPORTANT:\n" +
            "- Use very simple English.\n" +
            "- Keep answers short and easy to understand.\n" +
            "- Avoid unnecessary technical words.\n" +
            "- Explain difficult words in simple language.\n" +
            "- Use bullet points when helpful.\n" +
            "- Give a simple example when useful.\n" +
            "- For school questions, make answers exam-friendly.\n" +
            "- Do not write long introductions.\n" +
            "- Do not repeat the question.\n" +
            "- Usually keep answers around 100–150 words unless the student asks for detail.\n\n" +
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
