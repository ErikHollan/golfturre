import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

export default function RoundInfo({
    activeRoundIndex,
    setActiveRoundIndex,
    rounds,
    players,
    activeRound,
    tournament,
    setTournament,
}) {
    const [teamScores, setTeamScores] = useState([]);

    const mode = activeRound.modes?.[0] || "Unknown";
    const isScramble = mode.toLowerCase().includes("scramble");
    const pairingIsPosition = activeRound.scrambleOptions?.pairing === "position";
    const [showInfo, setShowInfo] = useState(false);
    const [teamHandicaps, setTeamHandicaps] = useState({});
    const isHandicapAdjusted = mode.toLowerCase().includes("handicap");
    const isScrambleWithHandicap = isScramble && activeRound.scrambleOptions?.scrambleWithHandicap;
    const isIndividualWithHandicap = !isScramble && isHandicapAdjusted;
    const [hasManuallyChangedRound, setHasManuallyChangedRound] = useState(false);


    useEffect(() => {
        if (!players || players.length === 0 || !rounds || rounds.length === 0) return;
        if (hasManuallyChangedRound) return; // ⛔️ Hoppa om användaren själv bläddrat

        let targetIndex = 0;

        for (let i = 0; i < rounds.length; i++) {
            const hasScores = players.some(
                (p) => typeof p.scores?.[i] === "number" && p.scores[i] > 0
            );
            if (hasScores) targetIndex = i + 1;
        }

        if (targetIndex >= rounds.length) {
            targetIndex = rounds.length - 1;
        }

        setActiveRoundIndex(targetIndex);
    }, [players, rounds, hasManuallyChangedRound, setActiveRoundIndex]);


    const generatedTeams = useMemo(() => {
        const pairingType = activeRound.scrambleOptions?.pairing || "position";
        const customPairs = activeRound.scrambleOptions?.customTeams || {};

        // 🟡 1. CUSTOM pairing – bygg teams direkt från customTeams
        if (pairingType === "custom" && Object.keys(customPairs).length > 0) {
            const used = new Set();
            const teams = [];

            for (const [p1, p2] of Object.entries(customPairs)) {
                if (!used.has(p1) && !used.has(p2)) {
                    teams.push([p1, p2]);
                    used.add(p1);
                    used.add(p2);
                }
            }

            return teams;
        }

        // 🟢 2. POSITION pairing – returnera befintliga teams om de finns
        if (pairingType === "position") {
            if (!isScramble || activeRoundIndex === 0) {
                return activeRound.teams || [];
            }
        }

        // 🔵 3. SCORE-based pairing (default)
        const thisRoundHasScores = players.some(
            (p) => typeof p.scores?.[activeRoundIndex] === "number" && p.scores[activeRoundIndex] > 0
        );

        if (thisRoundHasScores && activeRound.teams?.length > 0) {
            return activeRound.teams;
        }

        const hasTeamAssignments = tournament.team_data?.assignments &&
            Object.keys(tournament.team_data.assignments).length > 0;

        const pairBy = (group, key = "total") => {
            const sorted = [...group].sort((a, b) => {
                const aVal = a[key] ?? Infinity;
                const bVal = b[key] ?? Infinity;
                return aVal - bVal;
            });

            const teams = [];
            let left = 0;
            let right = sorted.length - 1;

            while (left < right) {
                teams.push([sorted[left++].id, sorted[right--].id]);
            }

            if (left === right) {
                teams.push([sorted[left].id]); // ensam spelare
            }

            return teams;
        };


        let grouped = [];

        if (hasTeamAssignments) {
            const teamAssignments = tournament.team_data.assignments;
            const red = [];
            const green = [];

            players.forEach((p) => {
                const playerData = {
                    ...p,
                    total: p.scores.slice(0, activeRoundIndex).reduce((sum, s) => sum + (s || 0), 0),
                };

                const team = teamAssignments[p.id];
                if (team === "red") red.push(playerData);
                else if (team === "green") green.push(playerData);
            });

            grouped = [
                ...pairBy(red, pairingType === "handicap" ? "handicap" : "total"),
                ...pairBy(green, pairingType === "handicap" ? "handicap" : "total"),
            ];
        } else {
            const withData = players.map((p) => ({
                ...p,
                total: p.scores.slice(0, activeRoundIndex).reduce((sum, s) => sum + (s || 0), 0),
                handicap: typeof p.handicap === "number" ? p.handicap : 999, // fallback
            }));

            grouped = pairBy(withData, pairingType === "handicap" ? "handicap" : "total");
        }

        return grouped;
    }, [
        isScramble,
        activeRoundIndex,
        players,
        activeRound.teams,
        tournament.team_data,
        activeRound.scrambleOptions,
    ]);



    useEffect(() => {
        if (!isScramble) return;

        const existing = activeRound.teams || [];
        const isDifferent = JSON.stringify(existing) !== JSON.stringify(generatedTeams);

        const thisRoundHasScores = players.some(
            (p) => typeof p.scores?.[activeRoundIndex] === "number" && p.scores[activeRoundIndex] > 0
        );

        if (isDifferent && !thisRoundHasScores) {
            // 1. Update local state
            const updatedTournament = { ...tournament };
            updatedTournament.rounds[activeRoundIndex].teams = generatedTeams;
            setTournament(updatedTournament);

            // 2. Update in Supabase (save to rounds table)
            const currentRound = tournament.rounds[activeRoundIndex];
            supabase
                .from("rounds")
                .update({ teams: generatedTeams })
                .eq("id", currentRound.id)
                .then(({ error }) => {
                    if (error) {
                        console.error("❌ Failed to save generated teams to Supabase", error);
                    }
                });
        }
    }, [
        generatedTeams,
        activeRound.teams,
        isScramble,
        pairingIsPosition,
        activeRoundIndex,
        players,
    ]);

    // Compute team scores
    useEffect(() => {
        if (!isScramble || generatedTeams.length === 0) return;

        const scores = [];
        const handicaps = {};

        for (const team of generatedTeams) {
            const [id1, id2] = team;
            const p1 = tournament.playerData.find((p) => p.id === id1);
            const p2 = tournament.playerData.find((p) => p.id === id2);

            // Score för tabellen
            const score = p1?.scores?.[activeRoundIndex] ?? 0;
            scores.push({ team, score });

            // Handicap-beräkning
            if (activeRound.scrambleOptions?.scrambleWithHandicap && p1 && p2) {
                const low = Math.min(p1.handicap, p2.handicap);
                const high = Math.max(p1.handicap, p2.handicap);

                const pctLow = activeRound.scrambleOptions.lowPct ?? 0;
                const pctHigh = activeRound.scrambleOptions.highPct ?? 0;

                const teamHcp = Math.round(low * (pctLow / 100) + high * (pctHigh / 100));
                handicaps[`${id1}-${id2}`] = teamHcp;
            }
        }

        setTeamScores(scores);
        setTeamHandicaps(handicaps);
    }, [generatedTeams, players, activeRoundIndex, isScramble, activeRound.scrambleOptions]);


    const handlePrev = () => {
        if (activeRoundIndex > 0) {
            setHasManuallyChangedRound(true); // 👈 nytt
            setActiveRoundIndex(activeRoundIndex - 1);
        }
    };

    const handleNext = () => {
        if (activeRoundIndex < rounds.length - 1) {
            setHasManuallyChangedRound(true); // 👈 nytt
            setActiveRoundIndex(activeRoundIndex + 1);
        }
    };

    const getTeamNames = (team) => {
        const names = team.map((id) => players.find((p) => p.id === id)?.name || "Unknown");

        return (
            <span className="flex flex-col sm:flex-row sm:items-center sm:gap-1 leading-tight">
                {/* Mobil: varje namn på egen rad */}
                <span className="sm:hidden flex flex-col text-[13px]">
                    {names.map((name, i) => (
                        <span key={i}>{name}</span>
                    ))}
                </span>

                {/* Desktop: med & */}
                <span className="hidden sm:inline">
                    {names.join(" & ")}
                </span>
            </span>
        );
    };

    return (
        <div className="bg-blue-900/60 rounded-lg p-6 shadow text-white relative">
            {/* Header & Navigation */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={handlePrev}
                    disabled={activeRoundIndex === 0}
                    className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-30"
                >
                    ◀
                </button>
                <h3 className="text-[11px] sm:text-lg font-bold text-yellow-300">
                    Runda {activeRoundIndex + 1}: {activeRound.name}
                </h3>
                <button
                    onClick={handleNext}
                    disabled={activeRoundIndex === rounds.length - 1}
                    className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-30"
                >
                    ▶
                </button>
            </div>

            <div className="text-[11px] sm:text-sm mb-4 space-y-1">
                {/* Game mode */}
                <div>
                    <span className="text-gray-300">Game Mode:</span>{" "}
                    <span className="italic">{mode}</span>
                    {activeRound.scrambleOptions?.scrambleWithHandicap && (
                        <span className="italic"> - hcp-justerat</span>
                    )}
                </div>

                {/* Lagindelning */}
                {isScramble && (
                    <div>
                        <span className="text-gray-300">Lagindelning:</span>{" "}
                        {activeRound.scrambleOptions.pairing === "custom" ? (
                            <span className="italic">Egen</span>
                        ) : (
                            <span className="italic">{activeRound.scrambleOptions.pairing}</span>
                        )}
                        {tournament.team_mode && (
                            <span className="italic"> - inom laget</span>
                        )}
                    </div>
                )}
            </div>


            {/* ✅ Round Score Table (always shown) */}
            <div className="mb-6">
                <h4 className="text-md font-semibold text-yellow-200 mb-2">
                    {isScramble ? "Lagresultat" : "Spelarresultat"}
                </h4>

                {/* 🏌️ Main Score Table */}
                <div className="overflow-x-auto mb-4">
                    <table className="min-w-full text-sm text-left text-white">
                        <thead className="uppercase text-xs text-gray-300 border-b border-gray-600">
                            <tr>
                                <th className="py-2 px-4">{isScramble ? "Team" : "Player"}</th>

                                {!isScramble &&
                                    tournament.miniGames?.map((mini, i) => (
                                        <th key={i} className="py-2 px-4 text-center">{mini.name}</th>
                                    ))}

                                {isScrambleWithHandicap && (
                                    <th className="py-2 px-4 text-center text-gray-300">Brutto</th>
                                )}
                                {isIndividualWithHandicap && (
                                    <th className="py-2 px-4 text-center text-gray-300">Brutto</th>
                                )}

                                <th className="py-2 px-4 text-yellow-300 text-right">
                                    Total
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {isScramble
                                ? [...teamScores].sort((a, b) => a.score - b.score).map((t, i) => (
                                    <tr key={i} className={i % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}>
                                        <td className="py-2 px-4 flex items-center gap-2 flex-nowrap">
                                            {getTeamNames(t.team)}
                                            {isScrambleWithHandicap && (
                                                <span className="ml-2 inline-flex items-center justify-center text-[10px] sm:text-sm font-bold bg-yellow-400 text-blue-900 rounded-full min-w-[1.5rem] aspect-square">
                                                    {teamHandicaps[`${t.team[0]}-${t.team[1]}`] ?? ""}
                                                </span>

                                            )}
                                        </td>

                                        {isScrambleWithHandicap && (
                                            t.score ? (
                                                <td className="py-2 px-4 text-center text-white/70">
                                                    {t.score + (teamHandicaps[`${t.team[0]}-${t.team[1]}`] ?? 0)}
                                                </td>
                                            ) : (
                                                <td className="py-2 px-4 text-center text-white/70">
                                                    0
                                                </td>
                                            )
                                        )}


                                        <td className="py-2 px-4 text-right text-yellow-300">{t.score}</td>
                                    </tr>
                                ))

                                : [...tournament.playerData]
                                    .sort((a, b) => (a.scores?.[activeRoundIndex] ?? Infinity) - (b.scores?.[activeRoundIndex] ?? Infinity))
                                    .map((player, i) => (
                                        <tr key={player.id} className={i % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}>
                                            <td className="py-2 px-4">{player.name}</td>

                                            {tournament.miniGames?.map((mini, idx) => {
                                                const val = player?.miniGameScores?.[String(activeRoundIndex)]?.[mini.name] ?? 0;
                                                return (
                                                    <td key={idx} className="py-2 px-4 text-center text-yellow-300">
                                                        {val > 0 ? "⭐".repeat(val) : "–"}
                                                    </td>
                                                );
                                            })}

                                            {isIndividualWithHandicap && (
                                                typeof player.scores?.[activeRoundIndex] === "number" && player.scores[activeRoundIndex] > 0 ? (
                                                    <td className="py-2 px-4 text-center text-white/70">
                                                        {player.scores[activeRoundIndex] + (player.handicap ?? 0)}
                                                    </td>
                                                ) : (
                                                    <td className="py-2 px-4 text-center text-white/70">
                                                        –
                                                    </td>
                                                )
                                            )}


                                            <td className="py-2 px-4 pr-6 text-right">
                                                {player.scores?.[activeRoundIndex] ?? "-"}
                                            </td>
                                        </tr>
                                    ))}

                        </tbody>
                    </table>
                </div>

                {/* 🎯 Mini Games (Scramble Individual Scores) */}
                {isScramble && tournament.miniGames?.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-md font-semibold text-yellow-200 mb-2">
                            🎯 Mini games
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-left text-white">
                                <thead className="uppercase text-xs text-gray-300 border-b border-gray-600">
                                    <tr>
                                        <th className="py-2 px-4">Spelare</th>
                                        {tournament.miniGames.map((mini, idx) => (
                                            <th key={idx} className="py-2 px-4 text-center">{mini.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tournament.playerData.map((player, i) => (
                                        <tr key={player.id} className={i % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}>
                                            <td className="py-2 px-4">{player.name}</td>
                                            {tournament.miniGames.map((mini, idx) => {
                                                const val = player?.miniGameScores?.[String(activeRoundIndex)]?.[mini.name] ?? 0;
                                                return (
                                                    <td key={idx} className="py-2 px-4 text-center text-yellow-300">
                                                        {val > 0 ? "⭐".repeat(val) : "–"}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Info box */}
            {activeRound.info?.trim() && (
                <div className="mt-6">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="flex items-center gap-2 text-sm text-yellow-300 hover:text-yellow-400 font-semibold transition"
                    >
                        {showInfo ? "✖  Dölj info" : "🧾 Visa info"}
                    </button>

                    {/* Animated Info Box */}
                    <AnimatePresence initial={false}>
                        {showInfo && (
                            <motion.div
                                key="info-box"
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden mt-3"
                            >
                                <div className="relative bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-blue-500 rounded-xl p-6 shadow-2xl text-sm text-white font-mono tracking-wide">
                                    <h4 className="text-yellow-300 text-xl font-bold flex items-center gap-2 drop-shadow-md uppercase mb-4">
                                        🧾 Info
                                    </h4>

                                    <div
                                        className="text-white/90 leading-relaxed text-sm space-y-4"
                                        dangerouslySetInnerHTML={{
                                            __html: activeRound.info.replace(/\n/g, "<br />"),
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}


        </div>
    );



}


