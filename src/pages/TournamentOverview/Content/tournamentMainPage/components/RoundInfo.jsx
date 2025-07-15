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

    useEffect(() => {
        if (!players || players.length === 0 || !rounds || rounds.length === 0) return;

        let targetIndex = 0;

        for (let i = 0; i < rounds.length; i++) {
            const hasScores = players.some(
                (p) => typeof p.scores?.[i] === "number" && p.scores[i] > 0
            );

            if (hasScores) {
                targetIndex = i + 1;
            }
        }

        if (targetIndex >= rounds.length) {
            targetIndex = rounds.length - 1; // cap at last round
        }

        setActiveRoundIndex(targetIndex);
    }, [players, rounds, setActiveRoundIndex]);


    const generatedTeams = useMemo(() => {

        if (pairingIsPosition) {
            if (!isScramble || activeRoundIndex === 0) {
                return activeRound.teams || [];
            }
        }


        const thisRoundHasScores = players.some(
            (p) => typeof p.scores?.[activeRoundIndex] === "number" && p.scores[activeRoundIndex] > 0
        );

        if (thisRoundHasScores && activeRound.teams?.length > 0) {
            return activeRound.teams;
        }

        const pairingType = activeRound.scrambleOptions?.pairing || "position";
        const hasTeamAssignments = tournament.team_data?.assignments &&
            Object.keys(tournament.team_data.assignments).length > 0;

        const pairBy = (group, key = "total") => {
            const sorted = [...group].sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0));
            const teams = [];
            let left = 0,
                right = sorted.length - 1;

            while (left < right) {
                teams.push([sorted[left++].id, sorted[right--].id]);
            }

            if (left === right) {
                teams.push([sorted[left].id]);
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
            }));

            grouped = pairBy(withData, pairingType === "handicap" ? "handicap" : "total");
        }

        return grouped;
    }, [isScramble, activeRoundIndex, players, activeRound.teams, tournament.team_data, activeRound.scrambleOptions]);


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
                    } else {
                        console.log("✅ Saved generated teams to Supabase");
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

        const scores = generatedTeams.map((team) => {
            const firstPlayerId = team[0];
            const player = players.find((p) => p.id === firstPlayerId);
            const score = player?.scores?.[activeRoundIndex] || 0;

            return { team, score };
        });

        setTeamScores(scores);
    }, [generatedTeams, players, activeRoundIndex, isScramble]);

    const handlePrev = () => {
        if (activeRoundIndex > 0) setActiveRoundIndex(activeRoundIndex - 1);
    };

    const handleNext = () => {
        if (activeRoundIndex < rounds.length - 1) setActiveRoundIndex(activeRoundIndex + 1);
    };

    const getTeamNames = (team) =>
        team.map((id) => players.find((p) => p.id === id)?.name || "Unknown").join(" & ");

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
                <h3 className="text-lg font-bold text-yellow-300">
                    Round {activeRoundIndex + 1}: {activeRound.name}
                </h3>
                <button
                    onClick={handleNext}
                    disabled={activeRoundIndex === rounds.length - 1}
                    className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-30"
                >
                    ▶
                </button>
            </div>

            <p className="text-sm mb-4">
                <span className="text-gray-300">Game Mode:</span>{" "}
                <span className="italic">{mode}</span>

                {isScramble && (
                    <>
                        <span className="mx-2 text-gray-500">•</span>
                        <span className="text-gray-300">Lagindelning:</span>{" "}
                        <span className="italic">{activeRound.scrambleOptions.pairing}</span>
                        {tournament.team_mode &&
                            <span className="italic"> inom laget</span>
                        }
                    </>
                )}
            </p>


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
                                <th className="py-2 px-4 text-yellow-300 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isScramble
                                ? [...teamScores]
                                    .sort((a, b) => a.score - b.score)
                                    .map((t, i) => (
                                        <tr
                                            key={i}
                                            className={i % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}
                                        >
                                            <td className="py-2 px-4">{getTeamNames(t.team)}</td>
                                            <td className="py-2 px-4 pr-6 text-right">{t.score}</td>
                                        </tr>
                                    ))
                                : [...tournament.playerData]
                                    .sort(
                                        (a, b) =>
                                            (a.scores?.[activeRoundIndex] ?? Infinity) -
                                            (b.scores?.[activeRoundIndex] ?? Infinity)
                                    )
                                    .map((player, i) => (
                                        <tr
                                            key={player.id}
                                            className={i % 2 === 0 ? "bg-blue-700/50" : "bg-blue-900/50"}
                                        >
                                            <td className="py-2 px-4">{player.name}</td>
                                            {tournament.miniGames?.map((mini, idx) => {
                                                const val =
                                                    player?.miniGameScores?.[String(activeRoundIndex)]?.[mini.name] ?? 0;
                                                return (
                                                    <td key={idx} className="py-2 px-4 text-center text-yellow-300">
                                                        {val > 0 ? "⭐".repeat(val) : "–"}
                                                    </td>
                                                );
                                            })}
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
                                        <th className="py-2 px-4">Player</th>
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


