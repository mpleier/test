const SIZE = 8;
const MAX_DAYS = 35;
const SAVE_KEY = "barbarian-prince-save";
const terrains = ["plains", "forest", "mountain", "swamp", "ruin"];

const classBonuses = {
  warrior: { combat: 3, scout: 0, supplies: 0 },
  scout: { combat: 0, scout: 2, supplies: 0 },
  chieftain: { combat: 1, scout: 0, supplies: 2 },
};

let state;

function rand(max) {
  return Math.floor(Math.random() * max);
}

function chance(value) {
  return Math.random() < value;
}

function createWorld() {
  const world = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => terrains[rand(terrains.length)])
  );
  world[0][0] = "capital";
  world[SIZE - 2][SIZE - 2] = "ruin";
  world[SIZE - 1][SIZE - 1] = "fortress";
  return world;
}

function freshState() {
  return {
    x: 0,
    y: 0,
    day: 1,
    health: 16,
    maxHealth: 16,
    gold: 10,
    food: 10,
    fame: 0,
    className: "warrior",
    princessFound: false,
    usurperDefeated: false,
    gameOver: false,
    world: createWorld(),
    seen: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
  };
}

function initGame(fromSave = false) {
  state = fromSave ? loadState() : freshState();
  if (!state) {
    state = freshState();
  }
  reveal(state.x, state.y, true);
  if (!fromSave) {
    log("Exile ends here. Gather strength, rescue the captive royal, and crush the usurper.");
  } else {
    log("Campaign restored from war records.", "good");
  }
  render();
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  log("Campaign saved.", "good");
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function log(text, tone = "") {
  const logEl = document.getElementById("log");
  const p = document.createElement("p");
  p.textContent = text;
  if (tone) {
    p.className = tone;
  }
  logEl.prepend(p);
}

function reveal(x, y, wide = false) {
  const radius = wide ? 2 : 1 + classBonuses[state.className].scout;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(SIZE - 1, y + radius); yy += 1) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(SIZE - 1, x + radius); xx += 1) {
      state.seen[yy][xx] = true;
    }
  }
}

function objectives() {
  return [
    `${state.princessFound ? "✅" : "⬜"} Rescue captive royal in eastern ruins`,
    `${state.usurperDefeated ? "✅" : "⬜"} Defeat usurper in southern fortress`,
    `${state.princessFound && state.usurperDefeated && state.x === 0 && state.y === 0 ? "✅" : "⬜"} Return to capital alive`,
  ];
}

function render() {
  const bonus = classBonuses[state.className];
  const stats = [
    ["Day", `${state.day}/${MAX_DAYS}`],
    ["Health", `${state.health}/${state.maxHealth}`],
    ["Food", state.food],
    ["Gold", state.gold],
    ["Fame", state.fame],
    ["Path", `${state.className} (C+${bonus.combat}, S+${bonus.scout}, R+${bonus.supplies})`],
  ];

  document.getElementById("stats").innerHTML = stats
    .map(([k, v]) => `<div class="stat"><strong>${k}:</strong> ${v}</div>`)
    .join("");

  document.getElementById("objectives").innerHTML = objectives().map((x) => `<li>${x}</li>`).join("");
  document.getElementById("classSelect").value = state.className;

  const map = document.getElementById("map");
  map.innerHTML = "";
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const tile = document.createElement("div");
      const seen = state.seen[y][x];
      tile.className = `tile ${seen ? state.world[y][x] : "unknown"}`;
      tile.textContent = seen ? state.world[y][x][0].toUpperCase() : "?";
      if (x === state.x && y === state.y) {
        tile.classList.add("player");
        tile.textContent = "⚔";
      }
      map.appendChild(tile);
    }
  }

  const controls = document.querySelectorAll("button[data-dir], #restBtn, #huntBtn, #scoutBtn, #saveBtn, #applyClassBtn");
  controls.forEach((btn) => {
    btn.disabled = state.gameOver;
  });
}

function consumeDailySupplies() {
  const relief = classBonuses[state.className].supplies;
  const consumption = Math.max(0, 1 - relief);
  if (state.food >= consumption) {
    state.food -= consumption;
  } else {
    state.food = 0;
    state.health -= 2;
    log("The host starves; hunger costs 2 health.", "bad");
  }
}

function advanceDay() {
  state.day += 1;
  consumeDailySupplies();
  if (state.health <= 0) {
    endGame(false, "Your warband perishes on the road.");
  } else if (state.day > MAX_DAYS) {
    endGame(false, "Winter ends your campaign before the throne is reclaimed.");
  }
}

function terrainEvent(terrain) {
  if (terrain === "forest" && chance(0.35)) {
    const herbs = 1 + rand(3);
    state.food += herbs;
    log(`Foragers return with ${herbs} food.`, "good");
  }

  if (terrain === "swamp" && chance(0.3)) {
    state.health -= 2;
    log("Bog-fever spreads in camp. Lose 2 health.", "bad");
  }

  if (terrain === "mountain" && chance(0.35)) {
    const find = 3 + rand(7);
    state.gold += find;
    log(`You discover hidden tribute caches: +${find} gold.`, "good");
  }

  if (terrain === "ruin" && !state.princessFound) {
    triggerRescueEvent();
    return;
  }

  if (terrain === "fortress" && state.princessFound && !state.usurperDefeated) {
    triggerUsurperBattle();
    return;
  }

  if (chance(0.28)) {
    triggerBanditEncounter();
  }
}

function triggerBanditEncounter() {
  const power = 6 + rand(8);
  const choices = document.getElementById("eventChoices");
  choices.innerHTML = "";
  log(`Raiders strike (${power} strength).`, "bad");

  const fight = document.createElement("button");
  fight.textContent = "Fight";
  fight.onclick = () => {
    choices.innerHTML = "";
    const combat = state.health + rand(8) + state.fame + classBonuses[state.className].combat;
    if (combat >= power) {
      const reward = 4 + rand(8);
      state.gold += reward;
      state.fame += 2;
      log(`Raiders crushed. +${reward} gold, +2 fame.`, "good");
    } else {
      state.health -= 3;
      state.gold = Math.max(0, state.gold - 4);
      log("Heavy losses. -3 health, -4 gold.", "bad");
    }
    render();
  };

  const bribe = document.createElement("button");
  bribe.textContent = "Bribe (5 gold)";
  bribe.onclick = () => {
    choices.innerHTML = "";
    if (state.gold >= 5) {
      state.gold -= 5;
      log("Gold buys safe passage.");
    } else {
      state.health -= 2;
      log("You cannot pay the demand. Lose 2 health.", "bad");
    }
    render();
  };

  choices.append(fight, bribe);
}

function triggerRescueEvent() {
  const choices = document.getElementById("eventChoices");
  choices.innerHTML = "";
  log("In a shattered shrine, you find the captive royal chained by sellswords.");

  const charge = document.createElement("button");
  charge.textContent = "Charge";
  charge.onclick = () => {
    choices.innerHTML = "";
    const roll = rand(12) + state.health + classBonuses[state.className].combat;
    if (roll >= 16) {
      state.princessFound = true;
      state.fame += 4;
      log("The chains are broken; the royal rides with your host. +4 fame.", "good");
    } else {
      state.health -= 4;
      log("The rescue fails, and you withdraw bleeding. -4 health.", "bad");
    }
    render();
  };

  const stealth = document.createElement("button");
  stealth.textContent = "Stealth";
  stealth.onclick = () => {
    choices.innerHTML = "";
    if (chance(0.55)) {
      state.princessFound = true;
      state.fame += 2;
      log("A quiet rescue succeeds under moonlight. +2 fame.", "good");
    } else {
      state.health -= 2;
      log("A guard raises the alarm. Lose 2 health.", "bad");
    }
    render();
  };

  choices.append(charge, stealth);
}

function triggerUsurperBattle() {
  const choices = document.getElementById("eventChoices");
  choices.innerHTML = "";
  log("The usurper stands in black armor upon the fortress gate.", "bad");

  const duel = document.createElement("button");
  duel.textContent = "Challenge to duel";
  duel.onclick = () => {
    choices.innerHTML = "";
    const duelPower = rand(14) + state.health + state.fame + classBonuses[state.className].combat;
    if (duelPower >= 20) {
      state.usurperDefeated = true;
      state.fame += 5;
      log("You slay the usurper before both armies. +5 fame.", "good");
    } else {
      state.health -= 5;
      log("You are repelled from the gate. -5 health.", "bad");
    }
    render();
  };

  const siege = document.createElement("button");
  siege.textContent = "Launch siege (6 gold)";
  siege.onclick = () => {
    choices.innerHTML = "";
    if (state.gold < 6) {
      state.health -= 2;
      log("Without enough coin to feed siege lines, morale collapses. -2 health.", "bad");
    } else {
      state.gold -= 6;
      if (chance(0.65)) {
        state.usurperDefeated = true;
        state.fame += 3;
        log("The fortress falls after a brutal siege. +3 fame.", "good");
      } else {
        state.health -= 3;
        log("The assault fails. -3 health.", "bad");
      }
    }
    render();
  };

  choices.append(duel, siege);
}

function move(dir) {
  if (state.gameOver) {
    return;
  }
  const next = { x: state.x, y: state.y };
  if (dir === "north") next.y -= 1;
  if (dir === "south") next.y += 1;
  if (dir === "west") next.x -= 1;
  if (dir === "east") next.x += 1;

  if (next.x < 0 || next.y < 0 || next.x >= SIZE || next.y >= SIZE) {
    log("Beyond this edge lie impassable wastes.");
    return;
  }

  state.x = next.x;
  state.y = next.y;
  reveal(state.x, state.y);

  const terrain = state.world[state.y][state.x];
  log(`Day ${state.day}: you march into ${terrain}.`);
  terrainEvent(terrain);

  if (state.princessFound && state.usurperDefeated && state.x === 0 && state.y === 0) {
    endGame(true, "You return triumphant. The throne is yours once more.");
    return;
  }

  advanceDay();
  render();
}

function rest() {
  if (state.gameOver) return;
  if (state.food <= 0) {
    log("No rations remain; rest is impossible.", "bad");
    return;
  }
  state.food -= 1;
  state.health = Math.min(state.maxHealth, state.health + 4);
  log("Campfires burn through the night. +4 health.", "good");
  advanceDay();
  render();
}

function hunt() {
  if (state.gameOver) return;
  const gain = 2 + rand(4) + classBonuses[state.className].supplies;
  state.food += gain;
  if (chance(0.3)) {
    state.health -= 1;
    log(`The hunt yields ${gain} food, but the wild bites back. -1 health.`, "bad");
  } else {
    log(`The hunt succeeds: +${gain} food.`, "good");
  }
  advanceDay();
  render();
}

function scout() {
  if (state.gameOver) return;
  reveal(state.x, state.y, true);
  state.fame += 1;
  log("Scouts map distant roads and hidden valleys. +1 fame.", "good");
  advanceDay();
  render();
}

function applyClass() {
  if (state.gameOver) return;
  const chosen = document.getElementById("classSelect").value;
  state.className = chosen;
  log(`You adopt the ${chosen} path.`, "good");
  render();
}

function endGame(win, message) {
  state.gameOver = true;
  log(message, win ? "good" : "bad");
  log(win ? "Victory! Begin a new campaign to write another legend." : "Defeat. Rally your strength and try again.");
  render();
}

function bindControls() {
  document.querySelectorAll("button[data-dir]").forEach((button) => {
    button.addEventListener("click", () => move(button.dataset.dir));
  });

  document.getElementById("restBtn").addEventListener("click", rest);
  document.getElementById("huntBtn").addEventListener("click", hunt);
  document.getElementById("scoutBtn").addEventListener("click", scout);
  document.getElementById("saveBtn").addEventListener("click", saveState);
  document.getElementById("applyClassBtn").addEventListener("click", applyClass);
  document.getElementById("restartBtn").addEventListener("click", () => {
    document.getElementById("log").innerHTML = "";
    document.getElementById("eventChoices").innerHTML = "";
    initGame(false);
  });
}

bindControls();
initGame(Boolean(loadState()));
