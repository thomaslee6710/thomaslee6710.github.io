const push = document.querySelector("#push");
const command = document.querySelector("#command");
const outcome = document.querySelector("#outcome");
const tabletop = document.querySelector("#tabletop");
const surface = tabletop.querySelector(".surface");

// Infer travel per centimeter of push from the single illustrated observation.
const travelPerPush = 3 / 2;
const goalDistance = 6;
function predict() {
  const length = Number(push.value);
  const distance = length * travelPerPush;
  const result = distance === goalDistance ? "on target" :
    distance < goalDistance ? "short of target" : "past target";
  command.textContent = length + " cm";
  outcome.textContent = distance + " cm forward · " + result;
  surface.style.setProperty("--stop", (28 + distance * 6) + "%");
  tabletop.setAttribute("aria-label", "A test push moved the crate 3 cm. Predicted travel: " + outcome.textContent);
}
push.addEventListener("input", predict);
predict();
