const scene = document.getElementById("scene");
const caption = document.getElementById("caption");
const panels = {
  step: {
    observed: "Foot sinks",
    predicted: "Unload the next step",
    caption: caption.textContent
  },
  push: {
    observed: "Object shifts",
    predicted: "Try a shorter push",
    caption: "A brief push moves the object farther than expected. A world model could use that displacement to predict where a shorter push would leave it before the robot commits."
  }
};

function draw(kind) {
  const data = panels[kind];
  const halves = [0, 1].map((future) => {
    const color = future ? "#b6e78b" : "#f2f2d9";
    const depth = future ? 125 : 143;
    const shape = kind === "step"
      ? '<path d="M12 118 Q48 116 62 118 T93 '+depth+' T127 118 H203" fill="none" stroke="#89aaa0" stroke-width="3"/><path d="M50 51 L107 72 L87 '+(depth-5)+' h18" fill="none" stroke="'+color+'" stroke-linejoin="round" stroke-width="7"/><circle cx="107" cy="72" r="5" fill="#152f31" stroke="'+color+'" stroke-width="2"/>'
      : '<path d="M12 130 H202 M32 100 H74" fill="none" stroke="#89aaa0" stroke-width="3"/><rect x="76" y="78" width="48" height="50" fill="none" stroke="#89aaa0" stroke-dasharray="4 4"/><rect x="'+(future?93:122)+'" y="78" width="48" height="50" fill="#244344" stroke="'+color+'" stroke-width="3"/>';
    return '<g transform="translate('+ (future*230) +' 0)"><text x="12" y="24" fill="'+color+'" font-family="monospace" font-size="13">'+(future?"PREDICTED":"OBSERVED")+'</text>'+shape+'<text x="12" y="177" fill="'+color+'" font-family="sans-serif" font-size="16">'+(future?data.predicted:data.observed)+'</text></g>';
  });
  scene.innerHTML = halves.join("");
  caption.textContent = data.caption;
}

document.querySelectorAll('input[name="scene"]').forEach(input => {
  input.addEventListener("change", () => draw(input.value));
});
draw(document.querySelector('input[name="scene"]:checked').value);
