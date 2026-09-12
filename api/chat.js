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
        error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

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

    let pdfContext = "";

    if (typeof pdfText === "string" && pdfText.trim()) {
      const MAX_PDF_CHARS = 50000;

      let cleanPDF = pdfText.trim();

      if (cleanPDF.length > MAX_PDF_CHARS) {
        cleanPDF =
          cleanPDF.slice(0, MAX_PDF_CHARS) +
          "\n\n[Later PDF pages were not included because of the context limit.]";
      }

      pdfContext =
        "\n\n===== UPLOADED PDF =====\n" +
        `File: ${pdfFileName || "Study PDF"}\n\n` +
        cleanPDF +
        "\n===== END PDF =====\n";
    }

    const inputText =
      "You are Study-AI, a friendly school teacher.\n\n" +
      "Help the student learn clearly and simply.\n\n" +
      "RULES:\n" +
      "- Use simple English unless another language is requested.\n" +
      "- Answer in Gujarati when the student asks in Gujarati.\n" +
      "- For school questions, give exam-friendly answers.\n" +
      "- Use step-by-step explanations for problems.\n" +
      "- If an image is provided, carefully analyze it.\n" +
      "- If the image contains a question, solve it.\n" +
      "- If handwriting is unclear, say so instead of guessing.\n" +
      "- Never claim to see something that is not visible.\n" +
      "- If a PDF is provided, use it as the main source for PDF questions.\n" +
      "- Do not invent information from the PDF.\n\n" +

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

    /*
      Interactions API input.
      Text is always included.
    */
    const interactionInput = [
      {
        type: "text",
        text: inputText
      }
    ];

    /*
      Add image when supplied.

      IMPORTANT:
      Gemini expects data + mime_type directly.
    */
    if (
      typeof imageBase64 === "string" &&
      imageBase64.startsWith("data:image/")
    ) {
      const commaIndex = imageBase64.indexOf(",");

      if (commaIndex === -1) {
        return res.status(400).json({
          error: "Invalid image data."
        });
      }

      const base64Data =
        imageBase64.slice(commaIndex + 1);

      const detectedMime =
        imageBase64.slice(
          5,
          imageBase64.indexOf(";")
        );

      const mimeType =
        imageMimeType || detectedMime;

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];

      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({
          error:
            "Unsupported image type. Use JPG, PNG, WEBP, or GIF."
        });
      }

      interactionInput.push({
        type: "image",
        data: base64Data,
        mime_type: mimeType
      });
    }

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
          input: interactionInput
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          `Gemini API error (${response.status})`
      });
    }

    let answer = "";

    if (typeof data?.output_text === "string") {
      answer = data.output_text;
    }

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
      console.error(
        "Unexpected Gemini response:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error: "Gemini returned no text answer."
      });
    }

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
