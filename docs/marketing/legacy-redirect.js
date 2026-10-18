(() => {
  const legacyVercelHosts = new Set([
    "lead-command-center-phi.vercel.app",
    "blackglovemarketing.vercel.app",
    "black-glove-marketing-admin.vercel.app",
  ]);
  const githubHost = "calina-miguel.github.io";
  const legacyPrefix = "/lead-command-center";
  const isGithubPages = location.hostname === githubHost && location.pathname.startsWith(`${legacyPrefix}/`);
  if (!isGithubPages && !legacyVercelHosts.has(location.hostname)) return;

  const path = isGithubPages ? location.pathname.slice(legacyPrefix.length) : location.pathname;
  location.replace(`https://black-glove-systems.vercel.app${path}${location.search}${location.hash}`);
})();
