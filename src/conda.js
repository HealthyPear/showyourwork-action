// Imports
const core = require("@actions/core");
const cache = require("@actions/cache");
const shell = require("shelljs");
const constants = require("./constants.js");
const { exec } = require("./utils");

// Exports
module.exports = { setupConda };

// Cache settings
const CONDA_CACHE_NUMBER = core.getInput("conda-cache-number");
const SHOWYOUWORK_SPEC = core.getInput("showyourwork-spec");
const CONDA_PREFIX = core.getInput("conda-installation-path");
const RUNNER_OS = shell.env["RUNNER_OS"];
const conda_key = `conda-${constants.conda_cache_version}-${RUNNER_OS}-${CONDA_CACHE_NUMBER}`;
const conda_restoreKeys = [];
let conda_paths = ["~/.conda", "~/.condarc", "~/conda_pkgs_dir"];

// We'll cache the article unless the user set the cache number to `null` (or empty).
const CACHE_CONDA = (
  !(CONDA_CACHE_NUMBER == null || CONDA_CACHE_NUMBER == "")
);

/**
 * Setup a conda distribution or restore it from cache.
 *
 */
async function setupConda() {

  const isSelfHosted = process.env.RUNNER_GROUP === 'self-hosted';
  const runnerName = process.env.RUNNER_NAME || 'Unknown Runner';

  console.log(`Runner Name: ${runnerName}`);
  console.log(`Self-hosted: ${isSelfHosted}`);


  if (typeof CONDA_PREFIX === "string" && CONDA_PREFIX.length > 0) {
    exec("eval '$(${CONDA_PREFIX}/bin/conda shell.bash hook 2> /dev/null)'");
    exec("conda create --name showyourwork_at_$RUNNER_NAME_from_$GITHUB_REF_NAME python=3.10 pip")
    exec("conda activate showyourwork_at_$RUNNER_NAME_from_$GITHUB_REF_NAME")
  }
  else {
    exec("echo 'INFO: conda-installation-path undefined or not a non-empty string.'")
  }

  if (CACHE_CONDA) {
    if (typeof CONDA_PREFIX === "string" && CONDA_PREFIX.length > 0) {
      conda_paths.push(CONDA_PREFIX);
    }
    // Restore conda cache
    core.startGroup("Restore conda cache");
    const conda_cacheKey = await cache.restoreCache(
      conda_paths,
      conda_key,
      conda_restoreKeys
    );
    core.endGroup();
  }

  // Download and setup conda
  if (CONDA_PREFIX.length === 0 && !shell.test("-d", "~/.conda")) {
    exec(
      "wget --no-verbose https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ./conda.sh", 
      "Download conda"
    );
    exec("bash ./conda.sh -b -p ~/.conda && rm -f ./conda.sh", "Install conda");
    core.startGroup("Configure conda");
    exec("conda config --add pkgs_dirs ~/conda_pkgs_dir");
    exec("conda install -y pip");
    core.endGroup();
  }
  else {
    exec("echo INFO: found conda installation at $CONDA_PREFIX.");
  }

  // Install showyourwork
  exec(`which conda`, "Check if conda is available and from where");
  exec(`conda info -e`, "List of vailable conda envs");
  exec(`which python`, "Check which Python we are using");
  // exec(`which mamba`, "Check if mamba is available and from where");
  exec(`which pip`, "Check which pip installation we are using");
  // exec(`pip install -U ${SHOWYOUWORK_SPEC}`, "Install showyourwork");

  // Display some info
  exec("conda info", "Conda info");

  // Save conda cache (failure OK)
  if (CACHE_CONDA) {
    if (typeof CONDA_PREFIX === "string" && CONDA_PREFIX.length > 0) {
      conda_paths.push(CONDA_PREFIX);
    }
    try {
      core.startGroup("Update conda cache");
      const conda_cacheId = await cache.saveCache(conda_paths, conda_key);
      core.endGroup();
    } catch (error) {
      shell.echo(`WARNING: ${error.message}`);
    }
  }

}
