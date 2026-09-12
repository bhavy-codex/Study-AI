/* =========================
   STUDY-AI
   JavaScript
   Version 0.4
========================= */


/* =========================
   STUDY GOAL
========================= */

let studyMinutes =
    Number(localStorage.getItem("studyMinutes")) || 0;

const DAILY_GOAL = 120;

const goalText =
    document.getElementById("goalText");

const progressBar =
    document.getElementById("progressBar");

const progressText =
    document.getElementById("progressText");

const addTime =
    document.getElementById("addTime");

const quickStart =
    document.getElementById("quickStart");


function updateStudyGoal() {

    goalText.textContent =
        `${studyMinutes} min`;

    let percentage =
        (studyMinutes / DAILY_GOAL) * 100;

    if (percentage > 100) {
        percentage = 100;
    }

    progressBar.style.width =
        `${percentage}%`;

    progressText.textContent =
        `${Math.round(percentage)}% of your ${DAILY_GOAL} minute goal`;

    localStorage.setItem(
        "studyMinutes",
        studyMinutes
    );
}


addTime.addEventListener(
    "click",
    function () {

        studyMinutes += 25;

        updateStudyGoal();

    }
);


quickStart.addEventListener(
    "click",
    function () {

        studyMinutes += 25;

        updateStudyGoal();

        alert(
            "Study session started! You added 25 minutes to today's goal."
        );

    }
);


updateStudyGoal();


/* =========================
   AI STUDY ASSISTANT
========================= */

const question =
    document.getElementById("question");

const askButton =
    document.getElementById("askButton");

const answer =
    document.getElementById("answer");


/* =========================
   MARKDOWN RENDERER
========================= */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


function formatAIResponse(text) {

    if (!text) {
        return "";
    }

    let html = escapeHTML(text);

    /*
       Code blocks
       ```code```
    */

    html = html.replace(
        /```([\s\S]*?)```/g,
        function (_, code) {

            return `
                <pre class="ai-code">
                    <code>${code.trim()}</code>
                </pre>
            `;

        }
    );


    /*
       Headings
       ### Heading
       ## Heading
       # Heading
    */

    html = html.replace(
        /^### (.*)$/gm,
        "<h4>$1</h4>"
    );

    html = html.replace(
        /^## (.*)$/gm,
        "<h3>$1</h3>"
    );

    html = html.replace(
        /^# (.*)$/gm,
        "<h3>$1</h3>"
    );


    /*
       Bold
       **text**
    */

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );


    /*
       Italic
       *text*
    */

    html = html.replace(
        /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
    );


    /*
       Numbered lists
       1. Item
       2. Item
    */

    html = html.replace(
        /(?:^|\n)((?:\d+\.\s.+\n?)+)/g,
        function (_, list) {

            const items =
                list
                    .trim()
                    .split("\n")
                    .map(item =>
                        item.replace(
                            /^\d+\.\s+/,
                            ""
                        )
                    )
                    .map(item =>
                        `<li>${item}</li>`
                    )
                    .join("");

            return `
                <ol class="ai-list">
                    ${items}
                </ol>
            `;

        }
    );


    /*
       Bullet lists
       - Item
       * Item
    */

    html = html.replace(
        /(?:^|\n)((?:[-•]\s.+\n?)+)/g,
        function (_, list) {

            const items =
                list
                    .trim()
                    .split("\n")
                    .map(item =>
                        item.replace(
                            /^[-•]\s+/,
                            ""
                        )
                    )
                    .map(item =>
                        `<li>${item}</li>`
                    )
                    .join("");

            return `
                <ul class="ai-list">
                    ${items}
                </ul>
            `;

        }
    );


    /*
       Line breaks
    */

    html = html.replace(
        /\n{2,}/g,
        "</p><p>"
    );

    html = html.replace(
        /\n/g,
        "<br>"
    );


    /*
       Wrap normal text in paragraphs
    */

    html =
        `<div class="ai-response">${html}</div>`;


    return html;
}


/* =========================
   ASK AI
========================= */

async function askStudyAI() {

    const userQuestion =
        question.value.trim();


    if (!userQuestion) {

        answer.innerHTML = `
            <div class="answer-avatar">
                ⚠️
            </div>

            <div class="answer-content">

                <strong>Study-AI</strong>

                <p>
                    Please type a study question first.
                </p>

            </div>
        `;

        return;
    }


    /* Loading state */

    answer.innerHTML = `
        <div class="answer-avatar">
            ✦
        </div>

        <div class="answer-content">

            <strong>Study-AI</strong>

            <p>
                Thinking...
            </p>

        </div>
    `;


    askButton.disabled = true;


    try {

        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        message: userQuestion
                    })
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                `Server returned ${response.status} but not valid JSON.`
            );

        }


        if (!response.ok) {

            throw new Error(
                data?.error ||
                `AI request failed with status ${response.status}`
            );

        }


        const aiAnswer =
            data?.answer ||
            "No answer received from Gemini.";


        /* Professional AI response */

        answer.innerHTML = `
            <div class="answer-avatar">
                ✦
            </div>

            <div class="answer-content">

                <strong>Study-AI</strong>

                ${formatAIResponse(aiAnswer)}

            </div>
        `;


    } catch (error) {

        console.error(
            "Study-AI error:",
            error
        );


        const errorMessage =
            escapeHTML(
                error?.message ||
                "Unknown error"
            );


        answer.innerHTML = `
            <div class="answer-avatar">
                ⚠️
            </div>

            <div class="answer-content">

                <strong>Study-AI</strong>

                <p>
                    ${errorMessage}
                </p>

            </div>
        `;

    } finally {

        askButton.disabled = false;

    }

}


/* =========================
   ASK BUTTON
========================= */

askButton.addEventListener(
    "click",
    askStudyAI
);


/* =========================
   ENTER KEY
========================= */

question.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            askStudyAI();

        }

    }
);


/* =========================
   DARK MODE
========================= */

const themeButton =
    document.getElementById("themeButton");

const savedTheme =
    localStorage.getItem("theme");


if (
