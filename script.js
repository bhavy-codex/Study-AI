/* =========================
   STUDY-AI
   JavaScript
   Version 0.2
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
            "🚀 Study session started! You added 25 minutes to today's goal."
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


function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


async function askStudyAI() {

    const userQuestion =
        question.value.trim();


    if (!userQuestion) {

        answer.innerHTML = `
            <div class="answer-icon">⚠️</div>

            <div>
                <strong>Study-AI</strong>

                <p>
                    Please type a study question first.
                </p>
            </div>
        `;

        return;
    }


    answer.innerHTML = `
        <div class="answer-icon">🤔</div>

        <div>
            <strong>Study-AI</strong>

            <p>
                Thinking about your question...
            </p>
        </div>
    `;


    try {

        const response =
            await fetch("/api/chat", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    message: userQuestion
                })

            });


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error || "AI request failed"
            );

        }


        const safeAnswer =
            escapeHTML(
                data.answer ||
                "No answer received."
            );


        answer.innerHTML = `
            <div class="answer-icon">🤖</div>

            <div>
                <strong>Study-AI</strong>

                <p>${safeAnswer}</p>
            </div>
        `;


    } catch (error) {

        console.error(
            "Study-AI error:",
            error
        );


        answer.innerHTML = `
            <div class="answer-icon">⚠️</div>

            <div>
                <strong>Study-AI</strong>

                <p>
                    Sorry, I couldn't connect to the AI right now.
                    Please try again.
                </p>
            </div>
        `;

    }

}


askButton.addEventListener(
    "click",
    askStudyAI
);


question.addEventListener(
    "keydown",
    function(event) {

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


if (savedTheme === "dark") {

    document.body.classList.add("dark");

    themeButton.textContent = "☀️";

}


themeButton.addEventListener(
    "click",
    function () {

        document.body.classList.toggle("dark");


        const darkMode =
            document.body.classList.contains("dark");


        if (darkMode) {

            themeButton.textContent = "☀️";

            localStorage.setItem(
                "theme",
                "dark"
            );

        } else {

            themeButton.textContent = "🌙";

            localStorage.setItem(
                "theme",
                "light"
            );

        }

    }
);
