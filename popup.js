document.getElementById("checkButton").addEventListener("click", async () => {
  const resultElement = document.getElementById("result");
  resultElement.textContent = "Checking...";

  try {
    const result = await chrome.runtime.sendMessage({
      action: "checkWorkflow",
    });
    const commitsList = result.message.split("\n").map((line) => {
      const p = document.createElement("p");
      if (line.startsWith("❌")) {
        p.innerHTML = `❌ ${line.substring(2)}`;
      } else if (line.startsWith("✅")) {
        p.innerHTML = `✅ ${line.substring(2)}`;
      } else {
        p.textContent = line;
      }
      return p;
    });

    resultElement.innerHTML = "";
    commitsList.forEach((commitElement) => {
      resultElement.appendChild(commitElement);
    });
  } catch (error) {
    resultElement.textContent = "Error: " + error.message;
  }
});
