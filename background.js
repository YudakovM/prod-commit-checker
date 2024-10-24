const GITHUB_TOKEN = "";

// Получает данные из текущего URL
function parseGitHubUrl(url) {
  const urlPattern =
    /^https:\/\/github\.com\/([^\/]+\/[^\/]+)\/actions\/workflows\/([^\/]+)$/;
  const match = url.match(urlPattern);
  if (match) {
    return {
      repo: match[1], // "comp/repo"
      workflowId: match[2], // "pipeline-publish-to-prod.yml"
    };
  } else {
    throw new Error("URL не соответствует ожидаемому формату GitHub.");
  }
}

async function getLastCommits(repo) {
  const commitsUrl = `https://api.github.com/repos/${repo}/commits?sha=master&per_page=15`;
  const response = await fetch(commitsUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN.trim()}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  return response.json();
}

async function getLastWorkflowRun(repo, workflowId) {
  const workflowRunsUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/runs?per_page=1`;
  const response = await fetch(workflowRunsUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN.trim()}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  const data = await response.json();
  return data.workflow_runs[0];
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkWorkflow") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0].url; // Получаем URL текущей вкладки
      checkLastWorkflowCommit(currentUrl)
        .then((result) => {
          sendResponse({ message: result });
        })
        .catch((error) => {
          sendResponse({ message: error.message });
        });
    });
    return true;
  }
});

async function checkLastWorkflowCommit(url) {
  try {
    const { repo, workflowId } = parseGitHubUrl(url);
    const commits = await getLastCommits(repo);
    if (commits.length < 2) {
      throw new Error("Недостаточно коммитов в ветке мастер для проверки.");
    }

    const lastWorkflowRun = await getLastWorkflowRun(repo, workflowId);
    const workflowCommitSha = lastWorkflowRun.head_sha;

    let commitsBehindProd = [];
    let prodCommit = null;

    // Определяем список коммитов, которых нет на проде
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      if (commit.sha === workflowCommitSha) {
        prodCommit = commit;
        break;
      }
      commitsBehindProd.push(commit);
    }

    if (commitsBehindProd.length === 0) {
      return "Все коммиты на проде. Нет коммитов, которые не на проде. ✅";
    } else {
      let resultMessage = `На проде нет ${commitsBehindProd.length} коммитов:\n`;

      commitsBehindProd.forEach((commit) => {
        resultMessage += `❌ ${commit.commit.message} - ${commit.commit.author.name}\n`;
      });

      // Добавляем последний коммит, который есть на проде
      resultMessage += `✅ ${prodCommit.commit.message} - ${prodCommit.commit.author.name}`;

      return resultMessage;
    }
  } catch (error) {
    throw new Error("Ошибка при проверке: " + error.message);
  }
}
