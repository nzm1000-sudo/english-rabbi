const questionsByUnit = {
  3: [
    { topic: "GRAMMAR · PRESENT SIMPLE", sentence: "She <span>_____</span> to school by bus every morning.", answers: ["go", "goes", "going", "went"], correct: 1, explanation: "With “she” in the present simple, add -s: she goes." },
    { topic: "VOCABULARY · EVERYDAY WORDS", sentence: "I was very <span>_____</span> after the long walk, so I sat down.", answers: ["tired", "early", "empty", "quiet"], correct: 0, explanation: "“Tired” means needing to rest after effort." },
    { topic: "GRAMMAR · PAST SIMPLE", sentence: "We <span>_____</span> a movie together last night.", answers: ["watch", "watches", "watched", "watching"], correct: 2, explanation: "“Last night” tells us to use the past simple: watched." },
  ],
  4: [
    { topic: "GRAMMAR · CONDITIONALS", sentence: "If I <span>_____</span> more time, I would learn another language.", answers: ["have", "had", "will have", "am having"], correct: 1, explanation: "In the second conditional, use past simple after “if”: If I had more time, I would learn." },
    { topic: "VOCABULARY · CONTEXT CLUES", sentence: "The instructions were so <span>_____</span> that everyone understood them.", answers: ["clear", "clearly", "clarity", "clearing"], correct: 0, explanation: "We need an adjective after “were”: clear describes the instructions." },
    { topic: "GRAMMAR · REPORTED SPEECH", sentence: "Maya said that she <span>_____</span> the book the day before.", answers: ["finishes", "has finished", "had finished", "will finish"], correct: 2, explanation: "Reported speech usually shifts the past simple to past perfect: had finished." },
  ],
  5: [
    { topic: "GRAMMAR · INVERSION", sentence: "Rarely <span>_____</span> such a moving performance.", answers: ["I have seen", "have I seen", "I saw", "did I have seen"], correct: 1, explanation: "After the negative adverb “rarely,” use subject–auxiliary inversion: have I seen." },
    { topic: "VOCABULARY · WORD CHOICE", sentence: "The findings <span>_____</span> the need for further research.", answers: ["emphasize", "emphasizing", "emphasis", "emphasizedly"], correct: 0, explanation: "The plural subject “findings” takes the verb “emphasize.”" },
    { topic: "GRAMMAR · PARTICIPLE CLAUSES", sentence: "<span>_____</span> the evidence carefully, the team revised its conclusion.", answers: ["Having reviewed", "Have reviewed", "To reviewing", "Was reviewed"], correct: 0, explanation: "“Having reviewed” is a participle clause showing an action completed before the main one." },
  ],
};

const unitSelect = document.querySelector("#unit-select");
document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date()).toUpperCase();
const answerList = document.querySelector("#answer-list");
const questionText = document.querySelector("#question-text");
const questionTopic = document.querySelector("#question-topic");
const questionCount = document.querySelector("#question-count");
const feedback = document.querySelector("#feedback");
const checkButton = document.querySelector("#check-answer");
const storageKey = "english-rabbi-progress";

let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
} catch {
  saved = {};
}

let unit = ["3", "4", "5"].includes(String(saved.unit)) ? String(saved.unit) : "4";
let questionIndex = 0;
let selectedIndex = null;
let answered = false;
let correctAnswers = Number.isFinite(saved.correctAnswers) ? saved.correctAnswers : 0;
let completedQuestions = Number.isFinite(saved.completedQuestions) ? saved.completedQuestions : 0;
let weeklySessions = Math.min(5, Number.isFinite(saved.weeklySessions) ? saved.weeklySessions : 3);
unitSelect.value = unit;

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ unit, correctAnswers, completedQuestions, weeklySessions }));
  } catch {
    // The practice still works when browser storage is unavailable.
  }
}

function renderQuestion() {
  const questions = questionsByUnit[unit];
  const question = questions[questionIndex];
  selectedIndex = null;
  answered = false;
  feedback.hidden = true;
  feedback.classList.remove("incorrect-feedback");
  questionTopic.textContent = question.topic;
  questionCount.textContent = `QUESTION ${questionIndex + 1} OF ${questions.length}`;
  questionText.innerHTML = question.sentence;
  answerList.replaceChildren();
  question.answers.forEach((answer, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "answer-option";
    option.textContent = `${String.fromCharCode(65 + index)}.  ${answer}`;
    option.setAttribute("aria-pressed", "false");
    option.addEventListener("click", () => {
      if (answered) return;
      selectedIndex = index;
      answerList.querySelectorAll(".answer-option").forEach((button, buttonIndex) => {
        const selected = buttonIndex === index;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      checkButton.disabled = false;
    });
    answerList.append(option);
  });
  checkButton.textContent = "Check my answer →";
  checkButton.disabled = true;
}

unitSelect.addEventListener("change", () => {
  unit = unitSelect.value;
  questionIndex = 0;
  saveProgress();
  renderQuestion();
});

checkButton.addEventListener("click", () => {
  if (answered) {
    questionIndex = (questionIndex + 1) % questionsByUnit[unit].length;
    renderQuestion();
    return;
  }
  if (selectedIndex === null) return;

  answered = true;
  completedQuestions += 1;
  const question = questionsByUnit[unit][questionIndex];
  const options = answerList.querySelectorAll(".answer-option");
  const isCorrect = selectedIndex === question.correct;
  options.forEach((option, index) => {
    option.disabled = true;
    if (index === question.correct) option.classList.add("correct");
    else if (index === selectedIndex) option.classList.add("incorrect");
  });
  if (isCorrect) {
    correctAnswers += 1;
    feedback.textContent = `Exactly right! ${question.explanation}`;
    feedback.classList.remove("incorrect-feedback");
  } else {
    feedback.textContent = `Not quite. ${question.explanation}`;
    feedback.classList.add("incorrect-feedback");
  }
  feedback.hidden = false;
  checkButton.disabled = false;
  checkButton.textContent = questionIndex === questionsByUnit[unit].length - 1 ? "Finish this round →" : "Next question →";
  document.querySelector("#score-count").textContent = completedQuestions
    ? Math.round((correctAnswers / completedQuestions) * 100)
    : "82";
  weeklySessions = Math.min(5, weeklySessions + (completedQuestions % 3 === 0 ? 1 : 0));
  updateWeeklyGoal();
  saveProgress();
});

function updateWeeklyGoal() {
  document.querySelector("#weekly-count").textContent = weeklySessions;
  document.querySelector("#goal-completed").textContent = `${weeklySessions} of 5`;
  document.querySelector("#goal-progress").style.width = `${(weeklySessions / 5) * 100}%`;
  document.querySelector(".goal-track").setAttribute("aria-valuenow", String(weeklySessions));
}

if (completedQuestions > 0) {
  document.querySelector("#score-count").textContent = String(Math.round((correctAnswers / completedQuestions) * 100));
}
updateWeeklyGoal();
renderQuestion();

document.querySelectorAll(".lesson-start").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#lesson-message").textContent = button.dataset.message;
  });
});

document.querySelector("#exam-button").addEventListener("click", () => {
  document.querySelector("#exam-message").textContent = `Your ${unit}-unit exam practice plan is ready. Start with reading comprehension, then tackle writing.`;
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".main-nav a").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});
