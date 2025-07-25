import React, { useEffect, useState } from "react";
import { PencilIcon, UsersIcon } from "lucide-react";
import { supabase } from "../../../../lib/supabaseClient";

export default function TournamentPlayers({ tournament, isAdmin, setActiveTab }) {
    const [players, setPlayers] = useState([]);
    const [editing, setEditing] = useState({});
    const [teams, setTeams] = useState([]);

    useEffect(() => {
        if (tournament?.id) {
            fetchPlayersAndTeams();
        }
    }, [tournament]);


    const fetchPlayersAndTeams = async () => {
        const { data, error } = await supabase
            .from("tournament_players")
            .select("id, team_id, player:player_id(*)")
            .eq("tournament_id", tournament.id);

        const { data: teamsData } = await supabase
            .from("teams")
            .select("*")
            .eq("tournament_id", tournament.id);

        if (!error) {
            setPlayers(data);
            setTeams(teamsData || []);
        } else {
            console.error("Could not load players", error);
        }
    };

    const handlePlayerChange = (id, field, value) => {
        setPlayers((prev) =>
            prev.map((p) =>
                p.player.id === id ? { ...p, player: { ...p.player, [field]: value } } : p
            )
        );
    };

    const toggleEdit = (id) => {
        setEditing((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSave = async () => {
        for (const p of players) {
            const { error: playerError } = await supabase
                .from("players")
                .update({
                    name: p.player.name,
                    handicap: p.player.handicap,
                })
                .eq("id", p.player.id);

            if (playerError) {
                console.error("Update error", playerError);
                alert("Ett fel uppstod vid uppdatering.");
                return;
            }
        }

        // Save updated team assignments
        const { error: teamError } = await supabase
            .from("tournaments")
            .update({
                team_data: tournament.team_data,
            })
            .eq("id", tournament.id);

        if (teamError) {
            console.error("Team update error", teamError);
            alert("Fel vid laguppdatering.");
            return;
        }

        alert("✅ Spelare och lag uppdaterade!");
        setActiveTab("standings");
    };


    return (
        <div className="mt-10 space-y-10 px-4 md:px-10 text-white">
            <h2 className="text-3xl font-bold text-center text-yellow-400 flex items-center justify-center gap-2">
                <UsersIcon className="w-8 h-8" />
                Spelare
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {players.map((p) => (
                    <div
                        key={p.id}
                        className="bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl p-6 shadow-xl border border-blue-400/30 hover:scale-[1.01] transition"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            {p.player.image_yrl ? (
                                <img
                                    src={p.player.image_yrl}
                                    alt={p.player.name}
                                    className="w-12 aspect-square rounded-full border-2 border-yellow-400 object-cover"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm">
                                    ?
                                </div>
                            )}
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-yellow-300">
                                    {editing[p.player.id] ? (
                                        <input
                                            value={p.player.name}
                                            onChange={(e) =>
                                                handlePlayerChange(p.player.id, "name", e.target.value)
                                            }
                                            className="bg-transparent text-yellow-300 font-bold w-full outline-none border-b border-yellow-400 focus:border-yellow-300 text-xl"
                                        />
                                    ) : (
                                        p.player.name
                                    )}
                                </h3>
                                {isAdmin && (
                                    <button
                                        onClick={() => toggleEdit(p.player.id)}
                                        className="text-xs text-blue-300 hover:text-white mt-1 flex items-center gap-1"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                        {editing[p.player.id] ? "Klar" : "Redigera"}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="text-sm space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-300">🏌️ Handicap:</span>
                                {editing[p.player.id] ? (
                                    <input
                                        type="number"
                                        value={p.player.handicap}
                                        onChange={(e) =>
                                            handlePlayerChange(p.player.id, "handicap", e.target.value)
                                        }
                                        className="bg-transparent text-white font-semibold w-12 text-sm border-b border-green-400"
                                    />
                                ) : (
                                    <span className="text-white font-semibold text-sm">
                                        {p.player.handicap}
                                    </span>
                                )}
                            </div>

                            <div>
                                <span className="text-gray-300">🏡 Klubb:</span>{" "}
                                <span className="ml-1 italic text-white">
                                    {p.player.home_club || "–"}
                                </span>
                            </div>

                            {tournament.team_mode && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-300">🎽 Lag:</span>
                                    {isAdmin ? (
                                        <select
                                            value={tournament.team_data.assignments?.[p.player.id] || ""}
                                            onChange={(e) => {
                                                const newTeam = e.target.value;
                                                const updatedAssignments = {
                                                    ...tournament.team_data.assignments,
                                                    [p.player.id]: newTeam,
                                                };

                                                // 1. Update the tournament object locally (if passed via props with setTournament)
                                                if (tournament.team_data) {
                                                    tournament.team_data.assignments = updatedAssignments;
                                                }

                                                // 2. Update the Supabase database on save (you’ll add this to handleSave)
                                                setPlayers((prev) =>
                                                    prev.map((pl) =>
                                                        pl.player.id === p.player.id ? { ...pl, team_id: newTeam } : pl
                                                    )
                                                );
                                            }}
                                            className="ml-2 rounded-full px-3 py-1 bg-black/30 text-white border border-purple-400"
                                        >
                                            <option value="">Välj lag</option>
                                            <option value="red">🔴 {tournament.team_data.captains?.red || "Röd"}</option>
                                            <option value="green">🟢 {tournament.team_data.captains?.green || "Grön"}</option>
                                        </select>
                                    ) : (
                                        <span className="ml-2 font-semibold text-white">
                                            {tournament.team_data.assignments?.[p.player.id] === "red" && (
                                                <>🔴 {tournament.team_data.captains?.red || "Röd"}</>
                                            )}
                                            {tournament.team_data.assignments?.[p.player.id] === "green" && (
                                                <>🟢 {tournament.team_data.captains?.green || "Grön"}</>
                                            )}
                                            {!tournament.team_data.assignments?.[p.player.id] && "–"}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isAdmin && (
                <div className="text-center pt-10">
                    <button
                        onClick={handleSave}
                        className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow"
                    >
                        💾 Spara spelare
                    </button>
                </div>
            )}
        </div>
    );
}
