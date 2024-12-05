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
const RUNNER_OS = shell.env["RUNNER_OS"];
const RUNNER_NAME = shell.env["RUNNER_NAME"];
const WORK_DIR = shell.env["RUNNER_WORKSPACE"];
console.log(`RUNNER GROUP: ${shell.env["RUNNER_GROUP"]}`);
console.log(`Type of RUNNER_GROUP:`, typeof shell.env["RUNNER_GROUP"]);
const isSelfHosted = (shell.env["RUNNER_GROUP"] === "self-hosted" || shell.env["RUNNER_GROUP"] === "undefined");
console.log(`Is this runner a self-hosted runner?: ${isSelfHosted}`);
console.log(`Working from: ${process.cwd()}`);
const showYourWorkCondaDir = isSelfHosted
  ? `${WORK_DIR}/showyourwork_conda_installation`
  : "~/";

const conda_key = `conda-${constants.conda_cache_version}-${RUNNER_OS}-${CONDA_CACHE_NUMBER}`;
const conda_restoreKeys = [];
const conda_paths = [`${showYourWorkCondaDir}/.conda`, `${showYourWorkCondaDir}/condarc`, `${showYourWorkCondaDir}/conda_pkgs_dir`];

// We'll cache the article unless the user set the cache number to `null` (or empty).
const CACHE_CONDA = !(CONDA_CACHE_NUMBER == null || CONDA_CACHE_NUMBER == "");

/**
 * Setup a conda distribution or restore it from cache.
 */
async function setupConda() {
  if (CACHE_CONDA) {
    // Restore conda cache
    core.startGroup("Restore conda cache");
    const conda_cacheKey = await cache.restoreCache(
      conda_paths,
      conda_key,
      conda_restoreKeys
    );
    core.endGroup();
  }

  // Conda installation directory
  const condaInstallDir = `${showYourWorkCondaDir}/.conda`;

  // Download and setup conda
  if (!shell.test("-d", condaInstallDir)) {
    core.info(`Installing Conda to ${condaInstallDir}`);
    const condaInstaller = `${process.cwd()}/conda.sh`;
    exec(
      `wget --no-verbose https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ${condaInstaller}`,
      "Download conda"
    );
    exec(
      `bash ${condaInstaller} -b -p ${condaInstallDir} && rm -f ${condaInstaller}`,
      "Install conda"
    );
    core.startGroup("Configure conda");
    exec(`conda config --add pkgs_dirs ${condaInstallDir}/conda_pkgs_dir`);
    exec(`${condaInstallDir}/bin/conda install -y python<3.11 pip`, "Install pip");
    core.endGroup();
  }

  // Ensure pip from Conda is used
  const pipPath = `${condaInstallDir}/bin/pip`;

  // Install showyourwork
  exec(`${pipPath} install -U ${SHOWYOUWORK_SPEC}`, "Install showyourwork");

  // Display some info
  exec(`${condaInstallDir}/bin/conda info`, "Conda info");

  // Save conda cache (failure OK)
  if (CACHE_CONDA) {
    try {
      core.startGroup("Update conda cache");
      const conda_cacheId = await cache.saveCache(conda_paths, conda_key);
      core.endGroup();
    } catch (error) {
      shell.echo(`WARNING: ${error.message}`);
    }
  }
}