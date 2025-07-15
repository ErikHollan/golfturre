import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";

export default function EditScores({ tournament, setTournament, setPrevStandings, setActiveTab, isAdmin }) {
    const [saveMessage, setSaveMessage] = useState("");
    const [bruttoValues, setBruttoValues] = useState({});
    // const [editMode, setEditMode] = useState("total");


    console.log("tournament.round.modes from editscore", tournament.rounds)


    useEffect(() => {
        const initialBruttos = {};
        tournament?.playerData?.forEach((player) => {
            tournament.rounds.forEach((round, roundIdx) => {
                if (round.modes?.[0]?.toLowerCase() === "handicap-justerat slagspel") {
                    const netto = player.scores?.[roundIdx];
                    const hcp = parseFloat(player.handicap);
                    if (!isNaN(netto) && !isNaN(hcp)) {
                        initialBruttos[`${player.id}-${roundIdx}`] = Math.round(netto + hcp);
                    }
                }
            });
        });
        setBruttoValues(initialBruttos);
    }, [tournament]);

    useEffect(() => {
        let anyUpdated = false;
        const updatedRounds = [...tournament.rounds];

        updatedRounds.forEach((round, idx) => {
            const isScramble = round.modes?.[0]?.toLowerCase().includes("scramble");
            const needsGeneration = isScramble && (!round.teams || round.teams.length === 0);

            if (needsGeneration) {
                const generated = generateTeamsForRound(round, idx, tournament.playerData, tournament);
                updatedRounds[idx] = { ...round, teams: generated };
                anyUpdated = true;
            }
        });

        if (anyUpdated) {
            setTournament({ ...tournament, rounds: updatedRounds });
        }
    }, []);

    const generateTeamsForRound = (round, roundIndex, players, tournament) => {
        const pairingType = round.scrambleOptions?.pairing || "position";

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

        const hasAssignments = tournament.team_data?.assignments &&
            Object.keys(tournament.team_data.assignments).length > 0;

        let grouped = [];

        if (hasAssignments) {
            const teamAssignments = tournament.team_data.assignments;
            const red = [];
            const green = [];

            players.forEach((p) => {
                const playerData = {
                    ...p,
                    total: p.scores.slice(0, roundIndex).reduce((sum, s) => sum + (s || 0), 0),
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
            const withTotals = players.map((p) => ({
                ...p,
                total: p.scores.slice(0, roundIndex).reduce((sum, s) => sum + (s || 0), 0),
            }));

            grouped = pairBy(withTotals, pairingType === "handicap" ? "handicap" : "total");
        }

        return grouped;
    };

    const handleSave = async (e) => {
        e.preventDefault();

        // 1. Capture current standings for transition animation
        const currentSorted = [...tournament.playerData].sort((a, b) => {
            const aTotal = a.scores.reduce((sum, val) => sum + (val || 0), 0);
            const bTotal = b.scores.reduce((sum, val) => sum + (val || 0), 0);
            return aTotal - bTotal;
        });
        setPrevStandings(currentSorted.map(p => p.id));

        // 2. Get form data and updated players
        const formData = new FormData(e.target);
        const updatedScores = [];
        const updatedMiniGameScores = [];

        const updatedPlayers = tournament.playerData.map((player) => {
            const scores = tournament.rounds.map((round, roundIdx) => {
                const isScramble = round.modes?.[0]?.toLowerCase().includes("scramble");
                const teams = round.teams || [];
                let val = null;

                if (isScramble) {
                    const team = teams.find((team) => team.includes(player.id));
                    const teamLeaderId = team?.[0];
                    val = formData.get(`${teamLeaderId}-${roundIdx}`);
                } else if (round.modes?.[0]?.toLowerCase() === "handicap-justerat slagspel") {
                    const netto = formData.get(`netto-${player.id}-${roundIdx}`);
                    val = netto ? Math.round(netto) : 0;
                } else {
                    val = formData.get(`${player.id}-${roundIdx}`);
                }
                const score = val ? parseInt(val, 10) : 0;

                updatedScores.push({
                    round_id: tournament.rounds[roundIdx].id,
                    player_id: player.id,
                    score,
                });

                return score;
            });

            const miniGameScores = {};

            tournament.miniGames?.forEach((miniGame) => {
                tournament.rounds.forEach((round, roundIdx) => {
                    const key = `mini-${roundIdx}-${miniGame.name}-${player.id}`;
                    const val = formData.get(key);
                    if (!miniGameScores[roundIdx]) {
                        miniGameScores[roundIdx] = {};
                    }
                    if (val) {
                        const parsed = parseInt(val, 10);
                        miniGameScores[roundIdx][miniGame.name] = parsed;

                        updatedMiniGameScores.push({
                            mini_game_id: miniGame.id,
                            round_id: tournament.rounds[roundIdx].id,
                            player_id: player.id,
                            value: parsed,
                        });
                    }
                });
            });

            return { ...player, scores, miniGameScores };
        });

        // 3. Update tournament state
        const updatedTournament = { ...tournament, playerData: updatedPlayers };
        setTournament(updatedTournament);

        // 4. Save scores to Supabase
        try {
            // Delete existing scores first (to handle overwrite)
            const roundIds = tournament.rounds.map(r => r.id);
            const playerIds = tournament.playerData.map(p => p.id);

            await supabase
                .from("scores")
                .delete()
                .in("round_id", roundIds)
                .in("player_id", playerIds);

            if (updatedScores.length > 0) {
                const { error: insertError } = await supabase.from("scores").insert(updatedScores);
                if (insertError) console.error("❌ Failed to insert scores:", insertError);
            }

            // Do the same for mini_game_scores
            await supabase
                .from("mini_game_scores")
                .delete()
                .in("round_id", roundIds)
                .in("player_id", playerIds);

            if (updatedMiniGameScores.length > 0) {
                const { error: mgInsertError } = await supabase
                    .from("mini_game_scores")
                    .insert(updatedMiniGameScores);
                if (mgInsertError) console.error("❌ Failed to insert mini game scores:", mgInsertError);
            }
        } catch (err) {
            console.error("❌ Unexpected error saving scores:", err);
        }

        setSaveMessage("✅ Scores saved!");
        setTimeout(() => setSaveMessage(""), 3000);
        setActiveTab("standings");
    };

    return (
        <div className="bg-blue-800/30 p-4 rounded-xl mt-4 shadow">
            <h2 className="text-3xl font-bold text-center text-yellow-400 flex items-center justify-center gap-2 mb-10">
                ✍️ Redigera resultat
            </h2>


            {/* Edit mode selector (optional if you expand later)  - UNDER UTVECKLING
            <div className="mb-4">
                <label className="text-sm text-white mr-4">Edit mode:</label>
                <select
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value)}
                    className="px-2 py-1 text-black rounded"
                >
                    <option value="total">Total Score</option>
                    <option value="holes">Per Hole</option>
                </select>
            </div>
            */}

            <form onSubmit={handleSave}>
                <div className="space-y-8">
                    {tournament.rounds.map((round, roundIdx) => {
                        const isScramble = round.modes?.[0]?.toLowerCase().includes("scramble");
                        const teams = round.teams || [];

                        return (
                            <div key={roundIdx} className="bg-blue-900/40 p-4 rounded-md shadow">
                                <h3 className="font-semibold text-yellow-200 mb-4">
                                    🏌️‍♂️ {round.name || `Runda ${roundIdx + 1}`} - {round.modes[0] || `Runda ${roundIdx + 1}`}
                                </h3>

                                {!isScramble && (
                                    <div className="overflow-x-auto border border-blue-700 rounded-lg">
                                        <table className="min-w-full text-sm text-left text-white">
                                            <thead className="text-xs uppercase bg-blue-800 text-gray-300">
                                                <tr>
                                                    <th className="py-3 px-4 text-yellow-300 bg-blue-900">Player</th>
                                                    <th className="py-3 px-4 text-yellow-300 bg-blue-900 border-r border-blue-600">🏌️ Score</th>
                                                    {tournament.miniGames?.map((miniGame, idx) => (
                                                        <th
                                                            key={idx}
                                                            colSpan={1}
                                                            className="py-3 px-2 text-center bg-blue-800 text-yellow-200 border-l border-blue-600"
                                                        >
                                                            🎯 {miniGame.name}
                                                        </th>
                                                    ))}
                                                </tr>

                                            </thead>
                                            <tbody>
                                                {tournament.playerData.map((player, i) => (
                                                    <tr key={player.id} className={i % 2 === 0 ? "bg-blue-700/30" : "bg-blue-900/30"}>
                                                        <td className="py-2 px-4 font-medium text-white">{player.name}</td>
                                                        <td className="py-2 px-4 border-r border-blue-600">
                                                            {round.modes[0]?.toLowerCase() === "handicap-justerat slagspel" ? (
                                                                <div className="flex items-center gap-2">
                                                                    {/* Bruttoscore */}
                                                                    <input
                                                                        name={`brutto-${player.id}-${roundIdx}`}
                                                                        type="number"
                                                                        placeholder="Brutto"
                                                                        defaultValue={
                                                                            player.scores?.[roundIdx] != null && !isNaN(player.handicap)
                                                                                ? Math.round(player.scores[roundIdx] + parseFloat(player.handicap))
                                                                                : ""
                                                                        }
                                                                        className="border rounded px-2 py-1 text-black w-20"
                                                                        onChange={(e) => {
                                                                            const val = parseInt(e.target.value, 10);
                                                                            const updated = {
                                                                                ...bruttoValues,
                                                                                [`${player.id}-${roundIdx}`]: isNaN(val) ? "" : val
                                                                            };
                                                                            setBruttoValues(updated);
                                                                        }}
                                                                    />

                                                                    {/* Handicap badge */}
                                                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
                                                                        – {player.handicap}
                                                                    </span>

                                                                    {/* Netto score (derived) */}
                                                                    <input
                                                                        name={`netto-${player.id}-${roundIdx}`}
                                                                        type="number"
                                                                        readOnly
                                                                        className="border rounded px-2 py-1 text-black w-20 bg-gray-100 cursor-not-allowed"
                                                                        value={
                                                                            (() => {
                                                                                const brutto = bruttoValues?.[`${player.id}-${roundIdx}`];
                                                                                const hcp = parseFloat(player.handicap);
                                                                                if (!isNaN(brutto) && !isNaN(hcp)) {
                                                                                    return Math.max(0, brutto - hcp);
                                                                                }
                                                                                return "";
                                                                            })()
                                                                        }
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    name={`${player.id}-${roundIdx}`}
                                                                    type="number"
                                                                    placeholder="Score"
                                                                    defaultValue={player.scores?.[roundIdx] ?? ""}
                                                                    className="border rounded px-2 py-1 text-black w-24"
                                                                />
                                                            )}

                                                        </td>

                                                        {tournament.miniGames?.map((miniGame, miniIdx) => (
                                                            <td key={miniIdx} className="py-2 px-2 border-l border-blue-700 text-center">
                                                                <input
                                                                    name={`mini-${roundIdx}-${miniGame.name}-${player.id}`}
                                                                    type="number"
                                                                    placeholder="Poäng"
                                                                    defaultValue={
                                                                        player?.miniGameScores?.[roundIdx]?.[miniGame.name] ?? ""
                                                                    }
                                                                    className="border rounded px-2 py-1 text-black w-24"
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                )}

                                {isScramble && teams.length > 0 && (
                                    <div className="overflow-x-auto border border-blue-700 rounded-lg">
                                        <table className="min-w-full text-sm text-left text-white">
                                            <thead className="text-xs uppercase bg-blue-800 text-gray-300">
                                                <tr>
                                                    <th className="py-3 px-4 text-yellow-300 bg-blue-900">Team</th>
                                                    <th className="py-3 px-4 text-yellow-300 bg-blue-900 border-r border-blue-600">🏌️ Score</th>
                                                    {tournament.miniGames?.map((miniGame, idx) => (
                                                        <th
                                                            key={idx}
                                                            colSpan={2}
                                                            className="py-3 px-2 text-center bg-blue-800 text-yellow-200 border-l border-blue-600"
                                                        >
                                                            🎯 {miniGame.name}
                                                        </th>
                                                    ))}
                                                </tr>
                                                <tr className="bg-blue-800 text-gray-400">
                                                    <th colSpan={2}></th>
                                                    {tournament.miniGames?.map((_, idx) => (
                                                        <>
                                                            <th key={`${idx}-p1`} className="py-2 px-2 text-center w-24 border-l border-blue-700">P1</th>
                                                            <th key={`${idx}-p2`} className="py-2 px-2 text-center w-24 border-l border-blue-700">P2</th>
                                                        </>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teams.map((team, teamIdx) => {
                                                    const teamName = team
                                                        .map((id) => {
                                                            const p = tournament.playerData.find((pl) => pl.id === id);
                                                            return p?.name || "Okänd";
                                                        })
                                                        .join(" & ");

                                                    const teamLeaderId = team[0];
                                                    const teamScore = tournament.playerData.find((p) => p.id === teamLeaderId)?.scores?.[roundIdx] ?? "";

                                                    const [p1, p2] = team.map((id) => tournament.playerData.find((p) => p.id === id));

                                                    return (
                                                        <tr key={`team-${teamIdx}`} className={teamIdx % 2 === 0 ? "bg-blue-700/30" : "bg-blue-900/30"}>
                                                            <td className="py-2 px-4 font-medium text-white">{teamName}</td>
                                                            <td className="py-2 px-4 border-r border-blue-600">
                                                                <input
                                                                    name={`${teamLeaderId}-${roundIdx}`}
                                                                    type="number"
                                                                    placeholder="Score"
                                                                    defaultValue={teamScore}
                                                                    className="border rounded px-2 py-1 text-black w-24"
                                                                />
                                                            </td>
                                                            {tournament.miniGames?.map((miniGame, miniIdx) => (
                                                                <>
                                                                    <td key={`${teamIdx}-${miniIdx}-p1`} className="py-2 px-2 border-l border-blue-700 text-center">
                                                                        <input
                                                                            name={`mini-${roundIdx}-${miniGame.name}-${p1?.id}`}
                                                                            type="number"
                                                                            placeholder="P1"
                                                                            defaultValue={p1?.miniGameScores?.[roundIdx]?.[miniGame.name] ?? ""}
                                                                            className="border rounded px-2 py-1 text-black w-16 text-center"
                                                                        />
                                                                    </td>
                                                                    <td key={`${teamIdx}-${miniIdx}-p2`} className="py-2 px-2 border-l border-blue-700 text-center">
                                                                        {p2 && (
                                                                            <input
                                                                                name={`mini-${roundIdx}-${miniGame.name}-${p2?.id}`}
                                                                                type="number"
                                                                                placeholder="P2"
                                                                                defaultValue={p2?.miniGameScores?.[roundIdx]?.[miniGame.name] ?? ""}
                                                                                className="border rounded px-2 py-1 text-black w-16 text-center"
                                                                            />
                                                                        )}
                                                                    </td>
                                                                </>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}



                            </div>
                        );
                    })}
                </div>

                {isAdmin && (
                    <button
                        type="submit"
                        className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow"
                    >
                        💾 Spara ändringar
                    </button>
                )}
                {saveMessage && <p className="text-green-300 mt-2">{saveMessage}</p>}
            </form>
        </div>
    );
}