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


    if (
      !message ||
      typeof message !== "string"
    ) {

      return res.status(400).json({
        error: "Message is required."
      });

    }


    const apiKey =
      process.env.GEMINI_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });

    }


    /* =====================================================
       CHAT MEMORY
       ===================================================== */

    const safeHistory =
      Array.isArray(history)
        ? history
            .slice(-12)
            .filter(
              item =>
                item &&
                (
                  item.role === "user" ||
                  item.role === "model"
                ) &&
                Array.isArray(item.parts) &&
                typeof item.parts[0]?.text === "string"
            )
        : [];


    const previousConversation =
      safeHistory
        .map(item => {

          const speaker =
            item.role === "user"
              ? "Student"
              : "Study-AI";

          return (
            `${speaker}: ${item.parts[0].text}`
          );

        })
        .join("\n");


    /* =====================================================
       PDF CONTEXT
       ===================================================== */

    let pdfContext = "";


    if (
      typeof pdfText === "string" &&
      pdfText.trim()
    ) {

      const MAX_PDF_CHARS =
        50000;


      let cleanPDF =
        pdfText.trim();


      if (
        cleanPDF.length >
        MAX_PDF_CHARS
      ) {

        cleanPDF =
          cleanPDF.slice(
            0,
            MAX_PDF_CHARS
          ) +
          "\n\n[Later PDF pages were not included because of the context limit.]";

      }


      pdfContext =
        "\n\n===== UPLOADED PDF =====\n" +
        `File: ${pdfFileName || "Study PDF"}\n\n` +
        cleanPDF +
        "\n===== END PDF =====\n";

    }


    /* =====================================================
       SYSTEM INSTRUCTIONS
       ===================================================== */

    const instructions =

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

      "- Use previous conversation to understand words such as it, this, that, and they.\n" +

      "- If a PDF is provided, use the PDF as the main source for questions about that PDF.\n" +

      "- Do not invent information and claim it came from the PDF.\n" +

      "- If the requested information is not in the PDF, say so clearly.\n" +

      "- If an image is provided, carefully analyze the image.\n" +

      "- If the image contains a question, solve it step by step.\n" +

      "- If the image contains handwriting, try to read it carefully.\n" +

      "- If some part of the image is unclear, say which part is unclear instead of guessing.\n" +

      "- Never claim to see something that is not visible.\n";


    /* =====================================================
       BUILD INPUT
       ===================================================== */

    let input =

      instructions +


      (
        previousConversation
          ? "\n\n===== PREVIOUS CONVERSATION =====\n" +
            previousConversation +
            "\n===== END PREVIOUS CONVERSATION =====\n"
          : ""
      ) +


      pdfContext +


      "\n\n===== CURRENT QUESTION =====\n" +

      message;


    /* =====================================================
       IMAGE
       ===================================================== */

    let imagePart = null;


    if (
      typeof imageBase64 === "string" &&
      imageBase64.startsWith("data:image/")
    ) {

      const commaIndex =
        imageBase64.indexOf(",");


      if (commaIndex === -1) {

        return res.status(400).json({
          error: "Invalid image data."
        });

      }


      const base64Data =
        imageBase64.slice(
          commaIndex + 1
        );


      const mimeType =
        imageMimeType ||
        imageBase64
          .slice(
            5,
            imageBase64.indexOf(";")
          );


      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
      ];


      if (
        !allowedTypes.includes(mimeType)
      ) {

        return res.status(400).json({
          error:
            "Unsupported image type. Please use JPG, PNG, WEBP, or GIF."
        });

      }


      /*
        Gemini Interactions API input
        contains text + image content.
      */

      imagePart = {

        type: "image",

        image: {
          mime_type: mimeType,
          data: base64Data
        }

      };

    }


    /* =====================================================
       GEMINI INPUT
       ===================================================== */

    const interactionInput = [];


    interactionInput.push({

      type: "text",

      text: input

    });


    if (imagePart) {

      interactionInput.push(
        imagePart
      );

    }


    /* =====================================================
       GEMINI REQUEST
       ===================================================== */

    const response =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-goog-api-key":
              apiKey

          },

          body: JSON.stringify({

            model:
              "gemini-3.8-flash",

            input:
              interactionInput

          })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      console.error(
        "Gemini API error:",
        data
      );


      return res.status(
        response.status
      ).json({

        error:
          data?.error?.message ||
          data?.message ||
          `Gemini API error (${response.status})`

      });

    }


    /* =====================================================
       EXTRACT ANSWER
       ===================================================== */

    let answer = "";


    if (
      typeof data?.output_text ===
      "string"
    ) {

      answer =
        data.output_text;

    }


    if (
      !answer &&
      Array.isArray(data?.steps)
    ) {

      for (
        const step of data.steps
      ) {

        if (
          !Array.isArray(
            step?.content
          )
        ) continue;


        for (
          const item of step.content
        ) {

          if (
            item?.type === "text" &&
            typeof item?.text === "string"
          ) {

            answer +=
              item.text;

          }

        }

      }

    }


    if (
      !answer &&
      Array.isArray(data?.output)
    ) {

      for (
        const item of data.output
      ) {

        if (
          typeof item?.text ===
          "string"
        ) {

          answer +=
            item.text;

        }


        if (
          Array.isArray(
            item?.content
          )
        ) {

          for (
            const content of item.content
          ) {

            if (
              typeof content?.text ===
              "string"
            ) {

              answer +=
                content.text;

            }

          }

        }

      }

    }


    answer =
      answer.trim();


    if (!answer) {

      console.error(
        "Unexpected Gemini response:",
        data
      );


      return res.status(502).json({

        error:
          "Gemini returned no text answer."

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
