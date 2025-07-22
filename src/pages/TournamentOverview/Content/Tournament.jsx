import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";
import EditScores from "./editScores/EditScores";
import TournamentStandings from "./tournamentMainPage/components/TournamentStandings";
import MiniGamesStandings from "./miniGames/MinigamesStandings";
import TournamentPlayers from "./players/Players";
import NewTournament from "../../NewTournament";

export default function Tournament() {

    const { user, loading2 } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [activeTab, setActiveTab] = useState("standings");
    const [prevStandings, setPrevStandings] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTournament = async () => {
        setLoading(true);

        // 1. Fetch main tournament
        const { data: tournamentData, error: tErr } = await supabase
            .from("tournaments")
            .select("*")
            .eq("id", id)
            .single();

        if (tErr) {
            console.error("Failed to fetch tournament", tErr);
            return;
        }

        // 2. Fetch players linked to this tournament
        const { data: tournamentPlayers, error: tpErr } = await supabase
            .from("tournament_players")
            .select("player_id, players (*)")
            .eq("tournament_id", id);

        if (tpErr) {
            console.error("Failed to fetch tournament players", tpErr);
            return;
        }

        const playerData = tournamentPlayers.map((p) => ({
            id: p.players.id,
            name: p.players.name,
            handicap: p.players.handicap,
            club: p.players.home_club,
            image: p.players.image_url,
            scores: [],
            miniGameScores: {},
        }));
        const playerIds = playerData.map((p) => p.id);

        // 3. Fetch all rounds
        const { data: roundsData, error: rErr } = await supabase
            .from("rounds")
            .select("*")
            .eq("tournament_id", id)
            .order("order_index", { ascending: true });

        if (rErr) {
            console.error("Failed to fetch rounds", rErr);
            return;
        }

        // 4. Get round_modes
        const { data: modesData, error: mErr } = await supabase.from("round_modes").select("*");

        if (mErr) {
            console.error("Failed to fetch round modes", mErr);
            return;
        }

        // 5. Scramble settings
        const { data: scrambleData, error: sErr } = await supabase.from("scramble_settings").select("*");

        if (sErr) {
            console.error("Failed to fetch scramble settings", sErr);
            return;
        }

        // ✅ 6. Fetch mini games
        const { data: miniGames, error: mgErr } = await supabase
            .from("mini_games")
            .select("*")
            .eq("tournament_id", id);

        if (mgErr) {
            console.error("Failed to fetch mini games", mgErr);
        }

        // ✅ 7. Fetch scores
        const roundIds = roundsData.map((r) => r.id);
        const { data: scoresData, error: scoresErr } = await supabase
            .from("scores")
            .select("*")
            .in("round_id", roundIds)
            .in("player_id", playerIds);

        if (scoresErr) {
            console.error("Failed to fetch scores", scoresErr);
            return;
        }

        // ✅ 8. Fetch mini game scores
        const { data: miniGameScoresData, error: mgScoresErr } = await supabase
            .from("mini_game_scores")
            .select(`
    id,
    value,
    player_id,
    round_id,
    mini_game_id,
    mini_games (
      id,
      name
    )
  `)
            .eq("mini_games.tournament_id", id);


        if (mgScoresErr) {
            console.error("Failed to fetch mini game scores", mgScoresErr);
        }

        // 🔄 Fetch scramble custom pairs

        const { data: customPairsData, error: cpErr } = await supabase
            .from("scramble_custom_pairs")
            .select("*")
            .in("round_id", roundIds);

        if (cpErr) {
            console.error("Failed to fetch custom scramble pairs", cpErr);
        }

        // Build round objects
        const rounds = roundsData.map((round) => ({
            ...round,
            modes: modesData
                .filter((m) => m.round_id === round.id)
                .sort((a, b) => a.position - b.position)
                .map((m) => m.mode),
            scrambleOptions: (() => {
                const s = scrambleData.find((s) => s.round_id === round.id);
                return s
                    ? {
                        pairing: s.pairing,
                        scrambleWithHandicap: s.scramble_with_handicap,
                        lowPct: s.low_hcp,
                        highPct: s.high_hcp,
                        customTeams: (() => {
                            const pairs = customPairsData?.filter((p) => p.round_id === round.id) || [];
                            const teams = {};
                            for (const pair of pairs) {
                                teams[pair.player_1_id] = pair.player_2_id;
                                teams[pair.player_2_id] = pair.player_1_id;
                            }
                            return teams;
                        })(),

                    }
                    : null;
            })(),

            teams: [], // optional if using team generation logic
        }));

        // Populate scores & mini game scores per player
        playerData.forEach((player) => {
            // Scores
            player.scores = rounds.map((r) => {
                const s = scoresData.find((s) => s.round_id === r.id && s.player_id === player.id);
                return s?.score || 0;
            });

            // Mini game scores
            player.miniGameScores = {};
            rounds.forEach((r, i) => {
                const scoresForRound = miniGameScoresData.filter(
                    (mg) => mg.round_id === r.id && mg.player_id === player.id
                );
                if (scoresForRound.length > 0) {
                    player.miniGameScores[i] = {};
                    scoresForRound.forEach((mg) => {
                        const gameName = mg.mini_games?.name;
                        if (gameName) {
                            player.miniGameScores[i][gameName] = mg.value || 0;
                        }
                    });
                }
            });
        });

        const finalTournament = {
            ...tournamentData,
            players: playerIds,
            playerData,
            rounds,
            miniGames,
        };

        setTournament(finalTournament);
        updateStandings(finalTournament);
        setLoading(false);

    };



    useEffect(() => {
        fetchTournament();
    }, [id]);

    useEffect(() => {
        if (!loading2 && user && tournament) {
            setIsAdmin(user.id === tournament.user_id);
        }
    }, [user, tournament, loading2]);

    function updateStandings(data) {
        if (data && data.playerData) {
            const sorted = [...data.playerData].sort((a, b) => {
                const aTotal = a.scores.reduce((sum, val) => sum + (val || 0), 0);
                const bTotal = b.scores.reduce((sum, val) => sum + (val || 0), 0);
                return aTotal - bTotal;
            });
            setPrevStandings(sorted.map((p) => p.id));
        }
    }

    if (loading || !tournament)
        return <p className="p-6 text-white">⏳ Laddar turnering...</p>;

    const tabs = [
        { id: "standings", label: "Min turnering" },
        ...(tournament.miniGames?.length > 0 ? [{ id: "mini-games", label: "Mini Games" }] : []),
        { id: "players", label: "Spelare" },
    ];

    if (isAdmin && !tabs.find((t) => t.id === "edit-scores")) {
        tabs.push({ id: "edit-scores", label: "Redigera resultat" });
    }

    if (isAdmin && !tabs.find((t) => t.id === "edit-tournament")) {
        tabs.push({ id: "edit-tournament", label: "Redigera turnering" });
    }

    const playerObjects = tournament.players.map((id) => {
        const p = tournament.playerData.find((pl) => pl.id === id);
        return {
            id: p?.id || id,
            name: p?.name || "Okänd",
            scores: p?.scores || tournament.rounds.map(() => 0),
        };
    });

    return (
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 min-h-screen text-white">
            <div className="max-w-4xl mx-auto p-4">
                <div className="overflow-x-auto">
                    <div className="flex space-x-2 border-b border-gray-400 w-max min-w-full">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap px-3 py-2 text-xs sm:text-sm font-medium uppercase tracking-wider ${activeTab === tab.id
                                    ? "border-b-4 border-yellow-400 text-yellow-300"
                                    : "text-gray-300 hover:text-white"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6">
                    {activeTab === "standings" && (
                        <TournamentStandings
                            players={playerObjects}
                            rounds={tournament.rounds.map((r) => r.name)}
                            tournamentModes={tournament.rounds.map((r) => r.modes?.[0])}
                            tournament={tournament}
                            setTournament={setTournament}
                            prevStandings={prevStandings}
                        />
                    )}

                    {activeTab === "mini-games" && (
                        <MiniGamesStandings tournament={tournament} />
                    )}

                    {activeTab === "players" && (
                        <TournamentPlayers
                            tournament={tournament}
                            updateTournament={setTournament}
                            isAdmin={isAdmin}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {activeTab === "edit-scores" && (
                        <EditScores
                            tournament={tournament}
                            setPrevStandings={setPrevStandings}
                            setTournament={setTournament}
                            setActiveTab={setActiveTab}
                            isAdmin={isAdmin}
                        />
                    )}
                    {activeTab === "edit-tournament" && tournament && (
                        <NewTournament
                            editMode={true}
                            tournamentData={tournament}
                            setActiveTab={setActiveTab}
                            setTournament={setTournament}
                            onSaved={(updatedTournament) => {
                                setTournament(updatedTournament);
                                fetchTournament(); // redundans, men säkrare vid ex. relationsdata
                            }}
                        />

                    )}
                </div>
            </div>
        </div>
    );
}
