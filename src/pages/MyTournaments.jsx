import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { motion } from "framer-motion";

export default function MyTournaments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [scores, setScores] = useState({}); // tournamentId → score data

  useEffect(() => {
    if (!user) return;

    const fetchTournaments = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("tournaments")
        .select(`
    *,
    tournament_players (
      *,
      players (
        id,
        name
      )
    ),
    rounds(*),
    mini_games(*)
  `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error) {
        setTournaments(data);
        fetchAllScores(data.map((t) => t.id));
      } else {
        console.error("Failed to fetch tournaments:", error);
      }

      setLoading(false);
    };

    const fetchAllScores = async (tournamentIds) => {
      const { data, error } = await supabase
        .from("scores")
        .select("round_id, player_id, score");

      if (error) {
        console.error("Could not fetch scores", error);
        return;
      }

      const scoreMap = {};

      tournamentIds.forEach((tid) => {
        scoreMap[tid] = [];
      });

      // get rounds per tournament
      const { data: allRounds } = await supabase
        .from("rounds")
        .select("id, tournament_id");

      const roundToTournament = {};
      allRounds?.forEach((r) => {
        roundToTournament[r.id] = r.tournament_id;
      });

      data?.forEach((s) => {
        const tournamentId = roundToTournament[s.round_id];
        if (tournamentId && scoreMap[tournamentId]) {
          scoreMap[tournamentId].push(s);
        }
      });

      // Aggregate scores per player per tournament
      const aggregated = {};
      for (const [tid, scores] of Object.entries(scoreMap)) {
        const playerTotals = {};
        scores.forEach((s) => {
          if (!playerTotals[s.player_id]) playerTotals[s.player_id] = 0;
          playerTotals[s.player_id] += s.score;
        });

        // sort by score ascending
        const sorted = Object.entries(playerTotals)
          .sort((a, b) => a[1] - b[1])
          .map(([player_id, total]) => ({ player_id, total }));

        aggregated[tid] = sorted;
      }

      setScores(aggregated);
    };

    fetchTournaments();
  }, [user]);

  const handleDelete = async (id) => {
    const { error } = await supabase.from("tournaments").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete tournament:", error);
      alert("Kunde inte radera turneringen.");
    } else {
      setTournaments((prev) => prev.filter((t) => t.id !== id));
      setDeleteCandidate(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-6 py-12 text-white font-sans">
      <motion.div
        className="w-full max-w-4xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="rounded-3xl shadow-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10 p-8">
          <CardContent className="space-y-6">
            <h1 className="text-3xl font-extrabold text-green-400 text-center">📋 Mina turneringar</h1>

            {loading ? (
              <p className="text-white/70 text-center">Laddar turneringar...</p>
            ) : tournaments.length === 0 ? (
              <p className="text-white/50 text-center">Du har ännu inte skapat några turneringar.</p>
            ) : (
              <div className="space-y-6">
                {tournaments.map((tournament) => {
                  const leaderboard = scores[tournament.id] || [];
                  const playersById = {};
                  tournament.tournament_players?.forEach((tp) => {
                    playersById[tp.player_id] = tp.player;
                  });

                  return (
                    <div
                      key={tournament.id}
                      className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 shadow-inner backdrop-blur-md"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-green-300">🏌️ {tournament.name}</h2>
                        <span className="text-sm text-white/40">
                          {new Date(tournament.created_at).toLocaleDateString("sv-SE")}
                        </span>
                      </div>

                      <div className="text-sm text-white/80 space-y-1">
                        <p>👥 Spelare: {tournament.tournament_players?.length || 0}</p>
                        <p>⛳ Ronder: {tournament.rounds?.length || 0}</p>
                        <p>🎯 Mini Games: {tournament.mini_games?.length || 0}</p>
                        {tournament.team_mode && <p>🔀 Två-lagsläge aktivt</p>}
                      </div>

                      <div className="mt-4">
                        <h4 className="font-semibold text-sm text-white/70 mb-1">🏆 Topp 3:</h4>
                        {leaderboard.length > 0 ? (
                          <ul className="text-sm list-disc pl-5 space-y-1 text-white/90">
                            {leaderboard.slice(0, 3).map((entry, i) => {
                              const player = tournament.tournament_players?.find(
                                (tp) => tp.player_id === entry.player_id
                              );
                              return (
                                <li key={entry.player_id}>
                                  {i + 1}. {player?.players?.name || "Okänd spelare"} – {entry.total} slag
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-white/50 text-sm">Inga scorer ännu</p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => navigate(`/turnering/${tournament.id}`)}
                          className="bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-md hover:shadow-green-500/40"
                        >
                          Öppna turnering
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(tournament)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-semibold transition-all"
                        >
                          Radera
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal for delete confirm */}
        {deleteCandidate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-white/10 text-white p-6 rounded-2xl shadow-xl max-w-sm w-full space-y-4">
              <h3 className="text-lg font-bold text-red-400">⚠️ Radera turnering</h3>
              <p>
                Är du säker på att du vill radera{" "}
                <strong className="text-white">{deleteCandidate.name}</strong>? Detta går inte att ångra.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleteCandidate(null)}
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleDelete(deleteCandidate.id)}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  Radera
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );

}
