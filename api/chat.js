export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const {
      message,
      history = [],
      pdfText = "",
      pdfFileName = ""
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    // Keep recent chat memory
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

    const previousConversation = safeHistory
      .map(item => {
        const speaker =
          item.role === "user" ? "Student" : "Study-AI";

        return `${speaker}: ${item.parts[0].text}`;
      })
      .join("\n");

    // PDF context
    let pdfContext = "";

    if (typeof pdfText === "string" && pdfText.trim()) {
      const MAX_PDF_CHARS = 50000;

      let cleanPDF = pdfText.trim();

      if (cleanPDF.length > MAX_PDF_CHARS) {
        cleanPDF =
          cleanPDF.slice(0, MAX_PDF_CHARS) +
          "\n\n[The PDF is longer than the current context limit. Some later pages were not included.]";
      }

      pdfContext =
        "\n\n===== UPLOADED PDF =====\n" +
        `File: ${pdfFileName || "Study PDF"}\n\n` +
        cleanPDF +
        "\n===== END PDF =====\n";
    }

    // Study-AI instructions
    const input =
      "You are Study-AI, a friendly school teacher.\n\n" +

      "Your job is to help students learn clearly.\n\n" +

      "IMPORTANT RULES:\n" +
      "- Use very simple English unless the student asks for another language.\n" +
      "- You can answer in Gujarati if the student asks in Gujarati.\n" +
      "- Keep normal answers around 100–150 words unless the student asks for more detail.\n" +
      "- Use simple examples when useful.\n" +
      "- Use bullet points for lists.\n" +
      "- For school questions, make answers exam-friendly.\n" +
      "- Avoid unnecessary technical words.\n" +
      "- Explain difficult words simply.\n" +
      "- Do not write long introductions.\n" +
      "- Do not repeat the student's question.\n" +
      "- Use previous conversation to understand words such as 'it', 'this', 'that', and 'they'.\n" +
      "- If a PDF is provided, use the PDF as the main source for questions about that PDF.\n" +
      "- Do not invent information and claim it came from the PDF.\n" +
      "- If the requested information is not in the PDF, say so clearly.\n\n" +

      (
        previousConversation
          ? "===== PREVIOUS CONVERSATION =====\n" +
            previousConversation +
            "\n===== END PREVIOUS CONVERSATION =====\n\n"
          : ""
      ) +

      pdfContext +

      "\n===== CURRENT QUESTION =====\n" +
      message;

    // Gemini API
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

    // Gemini error
    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          `Gemini API error (${response.status})`
      });
    }

    // Find AI answer
    let answer = "";

    if (typeof data?.output_text === "string") {
      answer = data.output_text;
    }

    // Steps fallback
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

    // Output fallback
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

    if (!answer) {
      console.error("Unexpected Gemini response:", data);

      return res.status(502).json({
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
