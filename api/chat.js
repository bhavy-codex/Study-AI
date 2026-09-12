export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const { message, history = [] } = req.body || {};

    // Validate message
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Check API key
    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    /*
     * Keep only the latest 12 messages.
     * This prevents the conversation from becoming too large.
     */
    const safeHistory = Array.isArray(history)
      ? history
          .slice(-12)
          .filter(
            item =>
              item &&
              (item.role === "user" || item.role === "model") &&
              Array.isArray(item.parts) &&
              typeof item.parts[0]?.text === "string"
          )
      : [];

    /*
     * Convert chat history into a simple conversation.
     */
    const previousConversation = safeHistory
      .map(item => {
        const speaker =
          item.role === "user"
            ? "Student"
            : "Study-AI";

        return `${speaker}: ${item.parts[0].text}`;
      })
      .join("\n");

    /*
     * Create the prompt for Gemini.
     */
    const input =
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
      "- Usually keep answers around 100–150 words unless the student asks for detail.\n" +
      "- Use the previous conversation to understand words like 'it', 'this', 'that', or 'he/she'.\n" +
      "- Do not forget the context of the current conversation.\n\n" +

      (
        previousConversation
          ? "Previous conversation:\n" +
            previousConversation +
            "\n\n"
          : ""
      ) +

      "Student's new question:\n" +
      message;

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
          input
        })
      }
    );

    const data = await response.json();

    // Gemini API error
    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error (${response.status})`
      });
    }

    // Find generated text
    let answer = "";

    if (typeof data?.output_text === "string") {
      answer = data.output_text;
    }

    // Fallback: steps
    if (!answer && Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        if (!Array.isArray(step?.content)) continue;

        for (const item of step.content) {
          if (
            item?.type === "text" &&
            typeof item?.text === "string"
          ) {
            answer += item.text;
          }
        }
      }
    }

    // Fallback: output
    if (!answer && Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (typeof item?.text === "string") {
          answer += item.text;
        }

        if (Array.isArray(item?.content)) {
          for (const content of item.content) {
            if (typeof content?.text === "string") {
              answer += content.text;
            }
          }
        }
      }
    }

    answer = answer.trim();

    // No answer
    if (!answer) {
      console.error(
        "Unexpected Gemini response:",
        data
      );

      return res.status(502).json({
        error: "Gemini returned no text answer."
      });
    }

    // Send answer to frontend
    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error(
      "Study-AI backend error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Unexpected server error."
    });
  }
}
