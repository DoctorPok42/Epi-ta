const baseUrl = "https://api.epitest.eu/me/";
const types = {
  YEAR: "year",
  MODULE: "module",
  PROJECT: "project",
  DETAILS: "details",
  UNKNOWN: "unknown"
}
let type = null;
let showLogs = false;

let fetchData = async (url) => {
  let data;
  try {
    const result = fetch(url, {
      method: "GET",
      headers: {
        'Content-Type': 'applications/json',
        'Authorization': 'Bearer ' + localStorage.getItem("argos-api.oidc-token").replace(/"/g, "")
      }
    });
    data = (await result).json();
  } catch (e) {
    throw "Request error " + url;
  }
  return data;
}

const getType = () => {
  let windowUrl = window.location.href;
  if (windowUrl.includes("#y"))
    return types.YEAR;
  else if (windowUrl.includes("#m"))
    return types.MODULE;
  else if (windowUrl.includes("#p"))
    return types.PROJECT;
  else if (windowUrl.includes("#d"))
    return types.DETAILS;
  return types.UNKNOWN;
}

/**
 * Get the type schema
 * @returns {string}
 */
const getTypeSchema = () => {
  let windowUrl = window.location.href;
  switch (type) {
    case "year":
      return windowUrl.split("#y/")[1];
    case "module":
      return windowUrl.split("#m/")[1].slice(0, 4);
    case "project":
      return windowUrl.split("#p/")[1];
    case "details":
      let splitted = windowUrl.split("/");
      return "details/" + splitted[splitted.length - 1];
  }
}

/**
 * Retrieve the json from the api (filtered or not)
 * @returns {Promise<*>}
 */
const retrieveData = async () => {
  let typeSchema = getTypeSchema();
  let projects = await fetchData(baseUrl + typeSchema);
  return projects;
}

const checkGrid = () => {
  return document.querySelectorAll("main > div.mdl-grid").length === 1;
}

const checkNoResult = () => {
  let mainGrid = document.querySelector("#elm-mdl-layout-main > div:nth-child(2) > div");
  if (mainGrid === undefined || mainGrid === null)
    return false;
  return mainGrid?.innerHTML === "No results";
}

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const displayData = async (projects, type) => {
  let mdlGridSelector = document.querySelectorAll("main > div.mdl-grid");
  if (mdlGridSelector.length === 0) {
    console.log("No grid found");
    return;
  }

  let mdlGrid = mdlGridSelector[0];
  if (mdlGrid.childNodes.length !== projects.length && type !== types.DETAILS) {
    console.log("Number of projects doesn't match");
    return;
  }

  if (type === types.DETAILS) {
    let mdlColorText = mdlGrid.querySelectorAll("div[class^='mdl-color-text']");
    if (mdlColorText.length === 0) return;

    let mdlColorTextElement = mdlColorText[0];
    let project = projects[projects.length - 1];

    let div = document.createElement("div");
    div.innerText = "Number of skills met - " + project.success + "/" + project.total;
    div.style.marginTop = "1rem";
    mdlColorTextElement.appendChild(div);
  } else {
    for (let i = 0; i < mdlGrid.childNodes.length; i++) {
      let mdlColorText = mdlGrid.childNodes[i].querySelectorAll("div[class^='mdl-color-text']");
      if (mdlColorText.length === 0) return;

      let mdlColorTextElement = mdlColorText[0];
      let project = projects[i];

      let div = document.createElement("div");
      div.innerText = "Number of skills met - " + project.scucesfull + "/" + project.skillsLength;
      // mdlColorTextElement.innerText = null;
      div.style.marginTop = "1rem";
      mdlColorTextElement.appendChild(div);
    }
  }
}

const getFileredData = (projects) => {
  let filteredProjects = [];

  projects.forEach((project) => {
    const projectId = project.results.testRunId;
    const skills = project.results.skills;
    let skillsScucesfull = [];
    let partialSkills = [];

    for (const key in skills) {
      if (skills.hasOwnProperty(key)) {
        const passed = skills[key].passed;
        const count = skills[key].count;

        if (passed === count)
          skillsScucesfull.push(skills[key]);
        else if (passed > 0)
          partialSkills.push(skills[key]);
      }
    }

    filteredProjects.push({
      projectId: projectId,
      scucesfull: skillsScucesfull.length,
      partial: partialSkills.length,
      skillsLength: Object.keys(skills).length
    });
  })

  return filteredProjects;
}

const getScucesfullSkills = (skills) => {
  let scucesfullSkills = [];
  for (const key in skills) {
    let skill = skills[key];
    let tests = skill.FullSkillReport?.tests || skill.BreakdownSkillReport?.breakdown;
    let scucesfull = 0;
    let partial = 0;
    let failed = 0;

    if (!Array.isArray(tests)) {
      tests = [tests];
    }

    tests.forEach((test) => {
      if (test.passed)
        scucesfull++;
      else if (test.passed === false)
        failed++;
      else
        partial++;
    });

    scucesfullSkills.push({
      name: skill.FullSkillReport?.name || skill.BreakdownSkillReport?.name,
      scucesfull: scucesfull,
      partial: partial,
      failed: failed,
      total: tests.length
    });

  }
  if (scucesfullSkills.length > 0) {
    scucesfullSkills.push({
      success: scucesfullSkills.filter((skill) => skill.scucesfull === skill.total).length,
      total: Object.keys(skills).length
    });
  }
  return scucesfullSkills;
}

// Generate diff logs
function generateDiffAnnotatedLogs(testLogs, expectedLogs) {
  const result = [];
  let i = 0, j = 0;

  while (i < testLogs.length || j < expectedLogs.length) {
    const testLine = testLogs[i];
    const expectedLine = expectedLogs[j];

    if (testLine === expectedLine) {
      // Same line
      result.push(`[nothing]${testLine}`);
      i++;
      j++;
    } else if (expectedLine && calculateSimilarity(testLine, expectedLine) > 0.5) {
      // Partial diff
      let diffLine = generatePartialDiff(testLine, expectedLine);
      result.push(`[diff]${diffLine}`);
      i++;
      j++;
    } else if (expectedLine && !testLogs.includes(expectedLine, i)) {
      // Missing line
      result.push(`[line]${expectedLine}`);
      j++;
    } else if (testLine && !expectedLogs.includes(testLine, j)) {
      // Extra line
      i++;
    }
  }

  return result;
}

// Calculate similarity between two lines
function calculateSimilarity(testLine, expectedLine) {
  if (!testLine || !expectedLine) return 0;
  try {
    const testWords = new Set(testLine.split(""));
    const expectedWords = new Set(expectedLine.split(""));
    const commonWords = [...testWords].filter(word => expectedWords.has(word));
    return commonWords.length / Math.max(testWords.size, expectedWords.size);
  } catch (e) {
    console.error(e);
    return 0;
  }
}

// Generate partial diff between two lines ([word###word])
function generatePartialDiff(testLine, expectedLine) {
  const testWords = testLine.split(" ");
  const expectedWords = expectedLine.split(" ");
  let diff = "";

  for (let k = 0; k < Math.max(testWords.length, expectedWords.length); k++) {
    if (testWords[k] === expectedWords[k]) {
      diff += `${testWords[k]} `;
    } else {
      diff += `[${testWords[k] || ""}###${expectedWords[k] || ""}] `;
    }
  }

  return diff.trim();
}

const getLogs = (project) => {
  logs = project.externalItems[0].comment

  const start = logs.indexOf("# Got");
  const end = logs.indexOf("# Test failed");

  if (start === -1 || end === -1)
    return [];

  const log = logs.slice(start + 7, end);

  const separatedLogs = log.split("# But expected:");
  const myLog = separatedLogs[0].split("\n").slice(0, -1);
  const taLog = separatedLogs[1].split("\n").slice(1, -1);

  console.log(myLog, taLog);

  return generateDiffAnnotatedLogs(myLog, taLog);
}

const displayLogs = (logs) => {
  // // create a log button
  let mdlGridSelector = document.querySelectorAll("main > div.mdl-grid");
  if (mdlGridSelector.length === 0) {
    console.log("No grid found");
    // setInterval(main, 1000);
    return;
  }

  let mdlGrid = mdlGridSelector[0];
  let mdlColorText = mdlGrid.querySelectorAll("div[class^='mdl-cell--4-col-phone']");
  if (mdlColorText.length === 0) return;

  let mdlColorTextElement = mdlColorText[1];
  let button = document.createElement("button");
  button.innerText = showLogs ? "Hide Diff" : "Show Diff";
  button.style = `width: 88%; background-color: #6b8afd; border: none; border-radius: 8px; color: white; padding: .6rem 0 ; text-align: center; text-decoration: none; display: inline-block; font-size: 16px; font-weight: bold; margin-left: 1rem; cursor: pointer;`;

  mdlColorTextElement.appendChild(button);

  // create a log div
  const placement = document.querySelectorAll("div[class^='mdl-cell--4-col']");
  let logDiv = document.createElement("div");
  logDiv.style = "display: none; margin-top: 1rem;";
  logDiv.className = "tab";
  logDiv.id = "logDiv";
  placement[0].appendChild(logDiv);

  // // display logs
  logs.forEach((log, index) => {
    let p = document.createElement("p");
    switch (log.substring(1, 5)) {
      case "diff":
        p.style = "background-color: #f0f0f2;";
        break;
      case "line":
        p.style = "background-color: #d8ece7;";
        break;
      case "noth":
        p.style = "";
        break;
    }

    p.innerHTML = "<span class='indexTag'>" + (index + 1) + "</span> ";

    if (log.substring(1, 5) === "diff") {
      let myDiff = "";
      let taDiff = "";

      log.split("[diff]")[1].split("###").forEach((diff) => {
        const words = diff.split(" ");
        words.forEach((word) => {
          if (word.includes("[") && word.length > 1) {
            myDiff += `<span style="background-color: #f39e9f;">${word.replace("[", "")}</span>`;
          } else if (!word.includes("]")) {
            myDiff += `${word} `;
          }
        });
      });

      log.split("[diff]")[1].split("###").forEach((diff) => {
        const words = diff.split(" ");
        words.forEach((word) => {
          if (word.includes("]")) {
            if (word.length > 1)
              taDiff += `<span style="background-color: #89e3c5;">${word.replace("]", "")}</span>`;
            else
              word.replace("]", "");
          } else if (!word.includes("[")) {
            taDiff += `${word} `;
          }
        });
      });

      p.innerHTML += myDiff + "<br> <span class='indexTag'> " + (index + 1) + "</span>" + taDiff + "<br>";
    } else if (log.substring(1, 5) === "line") {
      p.style = "background-color: #d8ece7;";
      p.innerText += log.split("]")[1];
    } else {
      p.innerText += log.split("]")[1];
    }

    logDiv.appendChild(p);
    if (log.substring(1, 5) === "diff")
      logDiv.appendChild(
        document.createElement("br")
      );
  });

  // show logs
  if (showLogs)
    logDiv.style.display = "block";

  button.onclick = () => {
    showLogs = !showLogs;
    button.style.backgroundColor = showLogs ? "#2b47d4" : "#6b8afd";
    button.innerText = showLogs ? "Hide Diff" : "Show Diff";
    logDiv.style.display = showLogs ? "block" : "none";
  }
}

const findMyEpitech = async () => {
  while (!checkGrid()) {
    if (checkNoResult()) {
      epiLog("No results found !");
      return;
    }
    await sleep(150);
  }

  type = getType();
  try {
    if (type !== types.YEAR && type !== types.DETAILS) return;
    let projects = await retrieveData();
    let results = [];
    if (type === types.YEAR) {
      projects.reverse();
      results = getFileredData(projects);
    } else {
      results = getScucesfullSkills(projects.skills);
    }

    if (results.length > 0) {
      console.log(results);
      displayData(results, type);
      console.log("Data displayed");
      // sleep(10000);

      if (type === types.DETAILS) {
        let logs = getLogs(projects);
        console.log(logs);
        if (logs.length > 0)
          displayLogs(logs);
      }
    }

  } catch (error) {
    console.error(error);
  }
}

const main = async () => {
  if (window.location.href.includes("#")) {
    await findMyEpitech();
  }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.message === "refresh") {
    await findMyEpitech();
  }
})

window.onload = main()
