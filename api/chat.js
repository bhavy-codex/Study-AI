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
      pdfFileName = "",
      imageBase64 = "",
      imageMimeType = ""
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    // -----------------------------
    // SAFE CHAT HISTORY
    // -----------------------------
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

    // -----------------------------
    // PDF CONTEXT
    // -----------------------------
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

    // -----------------------------
    // BUILD GEMINI INPUT
    // -----------------------------
    const inputParts = [];

    // Main Study-AI instructions
    inputParts.push({
      type: "text",
      text:
        `You are Study-AI, a smart, friendly AI study assistant.

Your job is to help students understand and solve questions clearly.

RESPONSE STYLE:
- Be concise, natural, and useful.
- Match the answer length to the difficulty of the question.
- Do NOT give a long textbook-style answer to a very simple question.
- For very simple calculations such as "2+3", "10-4", or "5×6", give the answer directly.
- For simple questions, avoid unnecessary headings.
- Do not add unnecessary examples, stories, fun facts, emojis, or motivational messages.
- Do not repeat the student's question unless necessary.
- Do not say "Hello!" or "Great job!" unless it naturally fits the conversation.
- Do not add a "Final Answer" section for extremely simple questions.
- Only give detailed step-by-step explanations when the problem is difficult or the student asks for step-by-step.
- If the student explicitly says "step by step", explain the solution clearly in steps.
- For school questions, make answers clear and exam-friendly.
- Use simple English unless the student asks for another language.
- If the student asks in Gujarati, answer in Gujarati.
- If the student asks in another language, respond in that language when possible.
- Use bullet points when they genuinely improve readability.
- Use mathematical notation only when it makes the answer clearer.
- Never unnecessarily turn a short answer into a long explanation.

MATHEMATICS:
- Calculate carefully.
- Give the correct answer.
- For easy arithmetic, keep the response extremely short.
- For harder calculations, show useful steps.
- If the student asks only for the answer, give only the answer.

CONVERSATION:
- Use previous conversation to understand references such as "it", "this", "that", and "they".
- Do not repeat information unnecessarily.
- Remember the conversation context provided below.

PDF:
- If a PDF is provided, use the PDF as the main source for questions about that PDF.
- Do not invent information and claim it came from the PDF.
- If the requested information is not present in the PDF, say so clearly.

IMAGE:
- If an image is provided, carefully examine it.
- Answer questions about the image based on what is actually visible.
- If the image contains a question, solve it.
- If text in the image is unclear, say that it is unclear rather than guessing.

IMPORTANT:
- Accuracy is more important than length.
- Do not over-explain simple questions.
- Give the student exactly the amount of explanation that is useful.

`
    });

    // -----------------------------
    // PREVIOUS CONVERSATION
    // -----------------------------
    if (previousConversation) {
      inputParts.push({
        type: "text",
        text:
          "\n===== PREVIOUS CONVERSATION =====\n" +
          previousConversation +
          "\n===== END PREVIOUS CONVERSATION =====\n"
      });
    }

    // -----------------------------
    // PDF
    // -----------------------------
    if (pdfContext) {
      inputParts.push({
        type: "text",
        text: pdfContext
      });
    }

    // -----------------------------
    // IMAGE / VISION
    // -----------------------------
    if (
      typeof imageBase64 === "string" &&
      imageBase64.trim() &&
      typeof imageMimeType === "string" &&
      imageMimeType.trim()
    ) {
      let base64Data = imageBase64.trim();

      // Remove data URL prefix if frontend sends:
      // data:image/jpeg;base64,...
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      inputParts.push({
        type: "image",
        data: base64Data,
        mime_type: imageMimeType
      });
    }

    // -----------------------------
    // CURRENT QUESTION
    // -----------------------------
    inputParts.push({
      type: "text",
      text:
        "\n===== CURRENT QUESTION =====\n" +
        message
    });

    // -----------------------------
    // GEMINI INTERACTIONS API
    // -----------------------------
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20"
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: inputParts
        })
      }
    );

    const data = await response.json();

    // -----------------------------
    // API ERROR
    // -----------------------------
    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          `Gemini API error (${response.status})`
      });
    }

    // -----------------------------
    // EXTRACT ANSWER
    // -----------------------------
    let answer = "";

    // New/common output_text format
    if (typeof data?.output_text === "string") {
      answer = data.output_text;
    }

    // Steps format
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

    // Output format
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

    // -----------------------------
    // EMPTY RESPONSE
    // -----------------------------
    if (!answer) {
      console.error(
        "Unexpected Gemini response:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error: "Gemini returned no text answer."
      });
    }

    // -----------------------------
    // RETURN ANSWER
    // -----------------------------
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
