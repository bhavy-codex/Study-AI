/* =========================
   STUDY-AI
   JavaScript
   Version 0.5
========================= */

let studyMinutes =
    Number(localStorage.getItem("studyMinutes")) || 0;

const DAILY_GOAL = 120;

const goalText = document.getElementById("goalText");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const addTime = document.getElementById("addTime");
const quickStart = document.getElementById("quickStart");

function updateStudyGoal() {
    if (!goalText || !progressBar || !progressText) return;

    goalText.textContent = `${studyMinutes} min`;

    let percentage = (studyMinutes / DAILY_GOAL) * 100;

    if (percentage > 100) {
        percentage = 100;
    }

    progressBar.style.width = `${percentage}%`;

    progressText.textContent =
        `${Math.round(percentage)}% of your ${DAILY_GOAL} minute goal`;

    localStorage.setItem("studyMinutes", studyMinutes);
}

if (addTime) {
    addTime.addEventListener("click", () => {
        studyMinutes += 25;
        updateStudyGoal();
    });
}

if (quickStart) {
    quickStart.addEventListener("click", () => {
        studyMinutes += 25;
        updateStudyGoal();

        alert(
            "Study session started! You added 25 minutes to today's goal."
        );
    });
}

updateStudyGoal();


/* =========================
   AI STUDY ASSISTANT
========================= */

const question = document.getElementById("question");
const askButton = document.getElementById("askButton");
const answer = document.getElementById("answer");


function escapeHTML(text) {
    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


function formatAIResponse(text) {

    if (!text) {
        return "";
    }

    let html = escapeHTML(text);

    /* Bold */

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    /* Headings */

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
        "<h2>$1</h2>"
    );

    /* Bullet points */

    html = html.replace(
        /(?:^|\n)((?:[-•]\s.+(?:\n|$))+)/g,
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

    /* Numbered list */

    html = html.replace(
        /(?:^|\n)((?:\d+\.\s.+(?:\n|$))+)/g,
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

    /* Line breaks */

    html = html.replace(
        /\n/g,
        "<br>"
    );

    return `
        <div class="ai-response">
            ${html}
        </div>
    `;
}


/* =========================
   ASK AI
========================= */

async function askStudyAI() {

    if (!question || !askButton || !answer) {
        return;
    }

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


    /* Loading */

    answer.innerHTML = `
        <div class="answer-avatar">
            ✦
        </div>

        <div class="answer-content">

            <strong>Study-AI</strong>

            <p class="thinking">
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
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message:
                            userQuestion
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.error ||
                `AI request failed: ${response.status}`
            );

        }


        if (
            !data.answer ||
            typeof data.answer !== "string"
        ) {

            throw new Error(
                "Gemini returned no answer."
            );

        }


        answer.innerHTML = `
            <div class="answer-avatar">
                ✦
            </div>

            <div class="answer-content">

                <div class="answer-header">

                    <strong>
                        Study-AI
                    </strong>

                </div>

                ${formatAIResponse(
                    data.answer
                )}

            </div>
        `;


    } catch (error) {

        console.error(
            "Study-AI error:",
            error
        );


        answer.innerHTML = `
            <div class="answer-avatar">
                ⚠️
            </div>

            <div class="answer-content">

                <strong>
                    Study-AI
                </strong>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Unable to connect to AI."
                    )}
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

if (askButton) {

    askButton.addEventListener(
        "click",
        askStudyAI
    );

}


/* =========================
   ENTER KEY
========================= */

if (question) {

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

}


/* =========================
   QUICK PROMPTS
========================= */

const promptCards =
    document.querySelectorAll(
        ".prompt-card"
    );


promptCards.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                if (!question) {
                    return;
                }

                const text =
                    button.textContent
                        .replace("→", "")
                        .trim();


                if (
                    text.includes(
                        "Explain a topic"
                    )
                ) {

                    question.value =
                        "Explain a difficult topic in simple words.";

                }

                else if (
                    text.includes(
                        "Help with homework"
                    )
                ) {

                    question.value =
                        "Help me solve my homework step by step.";

                }

                else if (
                    text.includes(
                        "Create exam questions"
                    )
                ) {

                    question.value =
                        "Create important exam questions from this topic.";

                }


                question.focus();

            }
        );

    }
);


/* =========================
   DARK MODE
========================= */

const themeButton =
    document.getElementById(
        "themeButton"
    );

const savedTheme =
    localStorage.getItem(
        "theme"
    );


if (
    savedTheme === "dark"
) {

    document.body.classList.add(
        "dark"
    );

}


function updateThemeButton() {

    if (!themeButton) {
        return;
    }

    themeButton.textContent =
        document.body.classList.contains("dark")
            ? "☀️"
            : "🌙";

}


updateThemeButton();


if (themeButton) {

    themeButton.addEventListener(
        "click",
        function () {

            document.body.classList.toggle(
                "dark"
            );


            const darkMode =
                document.body.classList.contains(
                    "dark"
                );


            localStorage.setItem(
                "theme",
                darkMode
                    ? "dark"
                    : "light"
            );


            updateThemeButton();

        }
    );

}
