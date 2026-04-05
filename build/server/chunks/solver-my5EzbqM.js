function solutionTeamKey(solution) {
  return solution.assignments.map((assignment) => assignment.team.team_key ?? "").sort().join("|");
}
function preferredAbyssSlot(team) {
  return (team.usage_rate_top ?? 0) >= (team.usage_rate_bottom ?? 0) ? "top" : "bottom";
}
function preferredStygianSlot(team) {
  const t = team.usage_rate_top ?? 0;
  const m = team.usage_rate_middle ?? 0;
  const b = team.usage_rate_bottom ?? 0;
  if (t >= m && t >= b) return "top";
  if (m >= t && m >= b) return "middle";
  return "bottom";
}
const MIN_SLOT_RATE = 10;
function slotRate(team, slot) {
  const key = `usage_rate_${slot}`;
  return team[key] ?? 0;
}
function greedyPass(teams, allSlots, getPreferredSlot, forcedFirst) {
  const usedCharacters = /* @__PURE__ */ new Set();
  const filledSlots = /* @__PURE__ */ new Set();
  const assignments = [];
  const assign = (team) => {
    const preferred = getPreferredSlot(team);
    const viableSlots = allSlots.filter(
      (s) => !filledSlots.has(s) && slotRate(team, s) >= MIN_SLOT_RATE
    );
    const slot = viableSlots.includes(preferred) ? preferred : viableSlots[0];
    if (!slot) return false;
    assignments.push({ team, slot });
    filledSlots.add(slot);
    team.members?.forEach((m) => usedCharacters.add(m));
    return true;
  };
  if (forcedFirst) assign(forcedFirst);
  for (const team of teams) {
    if (filledSlots.size === allSlots.length) break;
    if (team === forcedFirst) continue;
    if (team.members?.some((m) => usedCharacters.has(m))) continue;
    assign(team);
  }
  return {
    assignments,
    score: (() => {
      if (assignments.length === 0) return 0;
      const weighted = assignments.map(
        (a) => (a.team.usage_total ?? 0) * slotAffinityRate(a.team, a.slot)
      );
      const min = Math.min(...weighted);
      const mean = weighted.reduce((s, v) => s + v, 0) / weighted.length;
      return 0.6 * min + 0.4 * mean;
    })(),
    unfilled: allSlots.filter((s) => !filledSlots.has(s)),
    isFallback: false,
    neededCharacters: []
  };
}
function deduplicateSolutions(solutions) {
  const seen = /* @__PURE__ */ new Set();
  return solutions.filter((sol) => {
    const key = sol.assignments.map((a) => a.team.team_key ?? "").sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function slotAffinityRate(team, slot) {
  const t = team.usage_rate_top ?? 0;
  const b = team.usage_rate_bottom ?? 0;
  const m = typeof team.usage_rate_middle === "number" ? team.usage_rate_middle : 0;
  const total = t + b + m;
  if (total === 0) return 1;
  if (slot === "top") return t / total;
  if (slot === "bottom") return b / total;
  if (slot === "middle") return m / total;
  return 1;
}
function optimizeSlots(assignments, getPreferredSlot) {
  const result = assignments.map((a) => ({ ...a }));
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const aPref = getPreferredSlot(a.team);
        const bPref = getPreferredSlot(b.team);
        if (aPref === b.slot && bPref === a.slot && slotRate(a.team, b.slot) >= MIN_SLOT_RATE && slotRate(b.team, a.slot) >= MIN_SLOT_RATE) {
          result[i] = { ...a, slot: b.slot };
          result[j] = { ...b, slot: a.slot };
          swapped = true;
        }
      }
    }
  }
  return result;
}
const CANDIDATE_DEPTH = 20;
const ABYSS_SLOT_ORDER = ["top", "bottom"];
const STYGIAN_SLOT_ORDER = ["top", "middle", "bottom"];
const MIN_ABYSS_USAGE_TOTAL = 1e-3;
function sortAssignments(assignments, slotOrder) {
  return [...assignments].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );
}
function solveAbyss(teams, count = 3) {
  const validTeams = teams.filter(
    (t) => (t.members ?? []).length === 4 && (t.usage_total ?? 0) >= MIN_ABYSS_USAGE_TOTAL
  );
  const allSlots = ABYSS_SLOT_ORDER;
  const candidates = validTeams.slice(0, CANDIDATE_DEPTH);
  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(
      validTeams,
      allSlots,
      preferredAbyssSlot,
      forcedFirst
    );
    const optimized = optimizeSlots(sol.assignments, preferredAbyssSlot);
    return {
      ...sol,
      assignments: sortAssignments(optimized, allSlots).map((a) => ({
        ...a,
        missingCharacters: []
      }))
    };
  });
  return sortSolutionsByMissingThenScore(deduplicateSolutions(solutions)).slice(
    0,
    count
  );
}
function solveStygian(teams, count = 3) {
  const validTeams = teams.filter((t) => (t.members ?? []).length === 4);
  const allSlots = STYGIAN_SLOT_ORDER;
  const candidates = validTeams.slice(0, CANDIDATE_DEPTH);
  const solutions = candidates.map((forcedFirst) => {
    const sol = greedyPass(
      validTeams,
      allSlots,
      preferredStygianSlot,
      forcedFirst
    );
    const optimized = optimizeSlots(sol.assignments, preferredStygianSlot);
    return {
      ...sol,
      assignments: sortAssignments(optimized, allSlots).map((a) => ({
        ...a,
        missingCharacters: []
      }))
    };
  });
  return sortSolutionsByMissingThenScore(deduplicateSolutions(solutions)).slice(
    0,
    count
  );
}
function solveAbyssWithFallback(ownedTeams, allTeams, ownedNames, count = 3) {
  const owned = solveAbyss(ownedTeams, count).map((solution) => ({
    ...solution,
    isFallback: false
  }));
  const completeOwned = owned.filter(
    (solution) => solution.unfilled.length === 0
  );
  if (completeOwned.length === 0) {
    return buildMinMissingAbyssSolutions(allTeams, ownedNames, count);
  }
  if (completeOwned.length >= count) {
    return completeOwned.slice(0, count);
  }
  const fallbackSolutions = buildMinMissingAbyssSolutions(
    allTeams,
    ownedNames,
    count
  ).filter((solution) => solution.unfilled.length === 0);
  const seen = new Set(
    completeOwned.map((solution) => solutionTeamKey(solution))
  );
  const supplemental = fallbackSolutions.filter((solution) => {
    const key = solutionTeamKey(solution);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...completeOwned, ...supplemental].slice(0, count);
}
function solveStygianWithFallback(ownedTeams, allTeams, ownedNames, count = 3) {
  const owned = solveStygian(ownedTeams, count).map((solution) => ({
    ...solution,
    isFallback: false
  }));
  const completeOwned = owned.filter(
    (solution) => solution.unfilled.length === 0
  );
  if (completeOwned.length === 0) {
    return buildMinMissingStygianSolutions(allTeams, ownedNames, count);
  }
  if (completeOwned.length >= count) {
    return completeOwned.slice(0, count);
  }
  const fallbackSolutions = buildMinMissingStygianSolutions(
    allTeams,
    ownedNames,
    count
  ).filter((solution) => solution.unfilled.length === 0);
  const seen = new Set(
    completeOwned.map((solution) => solutionTeamKey(solution))
  );
  const supplemental = fallbackSolutions.filter((solution) => {
    const key = solutionTeamKey(solution);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...completeOwned, ...supplemental].slice(0, count);
}
function getMissingForTeam(team, ownedNames) {
  return (team.members ?? []).filter((member) => !ownedNames.has(member));
}
function annotateSolutionMissing(solution, ownedNames) {
  const assignments = solution.assignments.map((assignment) => ({
    ...assignment,
    missingCharacters: getMissingForTeam(assignment.team, ownedNames)
  }));
  return {
    ...solution,
    assignments,
    neededCharacters: [
      ...new Set(
        assignments.flatMap((assignment) => assignment.missingCharacters)
      )
    ]
  };
}
function totalMissingCount(assignments) {
  return assignments.reduce(
    (sum, assignment) => sum + assignment.missingCharacters.length,
    0
  );
}
function sortSolutionsByMissingThenScore(solutions) {
  return [...solutions].sort((a, b) => {
    const aTotalMissing = totalMissingCount(a.assignments);
    const bTotalMissing = totalMissingCount(b.assignments);
    if (aTotalMissing !== bTotalMissing) return aTotalMissing - bTotalMissing;
    const aUniqueMissing = a.neededCharacters.length;
    const bUniqueMissing = b.neededCharacters.length;
    if (aUniqueMissing !== bUniqueMissing)
      return aUniqueMissing - bUniqueMissing;
    return b.score - a.score;
  });
}
function buildMinMissingAbyssSolutions(allTeams, ownedNames, count) {
  const teamsWithMissing = allTeams.map((team) => ({
    team,
    missing: getMissingForTeam(team, ownedNames)
  }));
  for (let budget = 0; budget <= 4; budget++) {
    const pool = teamsWithMissing.filter((entry) => entry.missing.length <= budget).sort(
      (a, b) => a.missing.length - b.missing.length || (b.team.usage_total ?? 0) - (a.team.usage_total ?? 0)
    ).map((entry) => entry.team);
    const solutions = solveAbyss(pool, count);
    if (solutions.length > 0 && solutions[0].unfilled.length === 0) {
      return sortSolutionsByMissingThenScore(
        solutions.map(
          (solution) => annotateSolutionMissing(
            { ...solution, isFallback: true },
            ownedNames
          )
        )
      );
    }
  }
  return sortSolutionsByMissingThenScore(
    solveAbyss(allTeams, count).map(
      (solution) => annotateSolutionMissing({ ...solution, isFallback: true }, ownedNames)
    )
  );
}
function buildMinMissingStygianSolutions(allTeams, ownedNames, count) {
  const teamsWithMissing = allTeams.map((team) => ({
    team,
    missing: getMissingForTeam(team, ownedNames)
  }));
  for (let budget = 0; budget <= 4; budget++) {
    const pool = teamsWithMissing.filter((entry) => entry.missing.length <= budget).sort(
      (a, b) => a.missing.length - b.missing.length || (b.team.usage_total ?? 0) - (a.team.usage_total ?? 0)
    ).map((entry) => entry.team);
    const solutions = solveStygian(pool, count);
    if (solutions.length > 0 && solutions[0].unfilled.length === 0) {
      return sortSolutionsByMissingThenScore(
        solutions.map(
          (solution) => annotateSolutionMissing(
            { ...solution, isFallback: true },
            ownedNames
          )
        )
      );
    }
  }
  return sortSolutionsByMissingThenScore(
    solveStygian(allTeams, count).map(
      (solution) => annotateSolutionMissing({ ...solution, isFallback: true }, ownedNames)
    )
  );
}

export { solveStygianWithFallback as a, solveAbyssWithFallback as s };
//# sourceMappingURL=solver-my5EzbqM.js.map
