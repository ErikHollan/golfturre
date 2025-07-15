import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

export default function NewTournament() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [tournamentName, setTournamentName] = useState("");
  const [rounds, setRounds] = useState([{ name: "", modes: [""], scrambleOptions: null, info: "" }]);
  const [teamMode, setTeamMode] = useState(false);
  const [teamAssignments, setTeamAssignments] = useState({});
  const [teamCaptains, setTeamCaptains] = useState({ red: "", green: "" });
  const [miniGames, setMiniGames] = useState([]);

  const gameModes = [
    "Slagspel",
    "Handicap-justerat slagspel",
    "Poängbogey",
    "Scramble (2 man)",
    "Bästboll",
  ];

  const presetInfo = {
    "slagspel": `<strong>Tider:</strong>\nTee time: 09:00\nLunch: 13:00\n\n<strong>Regler:</strong>\nRent slagspel, bara att köra.\nMulligan gäller på första hålet\n\n<strong>CTP:</strong>\nHål 2, 8, 12\n\n<strong>Longest drive:</strong>\nHål 2, 5, 9`,
    "handicapjusterat": `<strong>Tider:</strong>\nTee time: 10:30\n\n<strong>Regler:</strong>\nSlagspel med avdrag för handicap.\nExempel: Spelare X har 20 i handicap och spelar på 100 slag. Resultat: 80 slag.\n\n<strong>CTP:</strong>\nHål 6, 14, 18\n\n<strong>Longest drive:</strong>\nHål 2, 5, 9`,
    "scramble": `<strong>Tider:</strong>\nTee time: 15:00\n\n<strong>Regler:</strong>\nBäst placerad inom laget paras ihop med sämst placerad osv\nLättnad gäller för alla slag\n\n<strong>CTP:</strong>\nHål 6, 14, 18\n\n<strong>Longest drive:</strong>\nHål 2, 5, 9`,
  };

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id);

      if (!error) setPlayers(data);
      else console.error("Could not load players", error);
    };

    if (user) fetchPlayers();
  }, [user]);

  const togglePlayer = (id) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const assignTeam = (playerId, team) => {
    setTeamAssignments((prev) => ({ ...prev, [playerId]: team }));
  };

  const handleRoundsChange = (num) => {
    const n = parseInt(num, 10);
    if (!isNaN(n) && n > 0) {
      const newRounds = Array.from({ length: n }, (_, i) => ({
        ...rounds[i],
        name: rounds[i]?.name || `Runda ${i + 1}`,
        modes: rounds[i]?.modes || [""],
        scrambleOptions: rounds[i]?.scrambleOptions || null,
        info: rounds[i]?.info || "",
      }));
      setRounds(newRounds);
    }
  };

  const handleRoundNameChange = (index, value) => {
    const updated = [...rounds];
    updated[index].name = value;
    setRounds(updated);
  };

  const handleRoundModeChange = (index, value, which = 0) => {
    const updated = [...rounds];
    const lowerValue = value.toLowerCase();

    if (value === "Scramble (2 man)") {
      updated[index].modes = [value];
      updated[index].scrambleOptions = {
        scrambleWithHandicap: false,
        pairing: index === 0 ? "handicap" : "position", // ✅ Enforce handicap pairing for first roundF
        lowPct: null,
        highPct: null,
      };
    } else {
      updated[index].modes[which] = value;
      if (updated[index].modes.includes("Scramble (2 man)")) {
        updated[index].modes = [value];
        updated[index].scrambleOptions = null;
      }
    }

    if (which === 0) {
      if (lowerValue === "slagspel") updated[index].info = presetInfo.slagspel;
      else if (lowerValue === "handicap-justerat slagspel") updated[index].info = presetInfo.handicapjusterat;
      else if (lowerValue === "scramble (2 man)") updated[index].info = presetInfo.scramble;
    }

    setRounds(updated);
  };

  const addSecondMode = (index) => {
    const updated = [...rounds];
    if (!updated[index].modes[1]) updated[index].modes.push("");
    setRounds(updated);
  };

  const removeSecondMode = (roundIndex) => {
    const updated = [...rounds];
    updated[roundIndex].modes = [updated[roundIndex].modes[0]];
    setRounds(updated);
  };

  const handleScrambleOptionChange = (index, key, value) => {

    if (key === "pairing" && value === "position" && index === 0) {
      alert("⛔ Första rundan kan inte använda lagindelning baserat på position, då inga placeringar finns ännu.");
      return; // Prevent the change
    }
    const updated = [...rounds];
    updated[index].scrambleOptions[key] = value;
    setRounds(updated);
  };

  const handleSaveTournament = async () => {
    if (!tournamentName.trim() || selectedPlayerIds.length === 0) {
      alert("Vänligen ange namn och välj spelare.");
      return;
    }

    // 1. Insert tournament
    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .insert([
        {
          name: tournamentName.trim(),
          user_id: user.id, // 🔄 use correct column name
          team_mode: teamMode,
          team_data: teamMode
            ? {
              captains: teamCaptains,
              assignments: teamAssignments,
              colors: {
                red: "#EF4444",
                green: "#10B981",
              },
            }
            : null,
        },
      ])
      .select()
      .single();

    if (tournamentError) {
      console.error("Failed to create tournament:", tournamentError);
      alert("Kunde inte skapa turnering.");
      return;
    }
    // 2. Link players to tournament
    const playerInserts = selectedPlayerIds.map((pid) => ({
      tournament_id: tournamentData.id,
      player_id: pid,
    }));

    console.log("Trying to insert into tournament_players:", playerInserts);

    const { error: playerLinkError } = await supabase
      .from("tournament_players")
      .insert(playerInserts);

    if (playerLinkError) {
      console.error("Failed to link players:", playerLinkError);
    } else {
      console.log("✅ Players linked to tournament");
    }
    // 3. Insert mini games (if any)
    const validMiniGames = miniGames.filter((g) => g.name.trim() !== "");

    if (validMiniGames.length > 0) {
      const { error: miniGamesError } = await supabase
        .from("mini_games")
        .insert(
          validMiniGames.map((game) => ({
            name: game.name.trim(),
            tournament_id: tournamentData.id,
          }))
        );

      if (miniGamesError) {
        console.error("Could not insert mini games:", miniGamesError);
      }
    }

    // 4. Insert rounds
    const { data: insertedRounds, error: roundInsertError } = await supabase
      .from("rounds")
      .insert(
        rounds.map((r, index) => ({
          tournament_id: tournamentData.id,
          name: r.name || `Runda ${index + 1}`,
          info: r.info,
          order_index: index,
        }))
      )
      .select(); // return inserted rows

    if (roundInsertError) {
      console.error("Failed to insert rounds:", roundInsertError);
      return;
    }

    // 5. Insert round_modes
    const roundModes = [];
    insertedRounds.forEach((round, i) => {
      rounds[i].modes.forEach((mode, pos) => {
        roundModes.push({
          round_id: round.id,
          mode,
          position: pos,
        });
      });
    });

    if (roundModes.length > 0) {
      const { error: roundModesError } = await supabase
        .from("round_modes")
        .insert(roundModes);

      if (roundModesError) {
        console.error("Failed to insert round modes:", roundModesError);
      }
    }

    // 6. Insert scramble_settings
    const scrambleSettings = [];
    insertedRounds.forEach((round, i) => {
      const scramble = rounds[i].scrambleOptions;
      if (scramble) {
        scrambleSettings.push({
          round_id: round.id,
          scramble_with_handicap: scramble.scrambleWithHandicap,
          pairing: scramble.pairing,
          low_hcp: scramble.lowPct,
          high_hcp: scramble.highPct,
        });
      }
    });

    if (scrambleSettings.length > 0) {
      const { error: scrambleError } = await supabase
        .from("scramble_settings")
        .insert(scrambleSettings);

      if (scrambleError) {
        console.error("Failed to insert scramble settings:", scrambleError);
      }
    }

    // ✅ Navigate to dashboard
    navigate(`/turnering/${tournamentData.id}`)
  };


  console.log("Selected player IDs:", selectedPlayerIds);
  return (
    <div className="bg-gradient-to-r from-blue-900 to-blue-700 min-h-screen text-white">
      <div className="min-h-screen text-white p-6 max-w-5xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-center text-yellow-300 mb-8">🏌️‍♂️ Skapa Ny Turnering</h1>

        {/* Tournament Name */}
        <div className="bg-blue-800/40 p-6 rounded-2xl shadow space-y-3 shadow-xl shadow-blue-900/40">
          <h2 className="text-xl font-semibold text-yellow-300">Turneringsnamn</h2>
          <input
            type="text"
            placeholder="Ange namn på turneringen"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            className="w-full bg-white/10 text-white placeholder-white/60 border border-white/30 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
          />
        </div>


        {/* Player Selection */}
        <div className="bg-blue-800/40 p-6 rounded-2xl shadow space-y-4 shadow-xl shadow-blue-900/40">
          <h2 className="text-xl font-semibold text-yellow-300">👥 Välj Spelare</h2>
          {players.length === 0 ? (
            <p className="text-white/70">Inga spelare tillgängliga.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const sorted = [...players].sort((a, b) => Number(a.handicap) - Number(b.handicap));
                const numCols = 3;
                const numRows = Math.ceil(sorted.length / numCols);
                const transposed = [];

                for (let row = 0; row < numRows; row++) {
                  for (let col = 0; col < numCols; col++) {
                    const index = col * numRows + row;
                    if (index < sorted.length) {
                      transposed.push(sorted[index]);
                    }
                  }
                }

                return transposed.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border border-white/10 bg-blue-800/30 cursor-pointer transition-all duration-200 ${selectedPlayerIds.includes(player.id)
                      ? "bg-yellow-300/10 border-yellow-300 text-yellow-200 font-semibold"
                      : "hover:bg-blue-800/50"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.includes(player.id)}
                        onChange={() => togglePlayer(player.id)}
                        className="accent-yellow-400"
                      />
                      <span>{player.name}</span>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-300 text-blue-900 font-bold shadow-sm">
                      {player.handicap}
                    </div>
                  </label>
                ));
              })()}
            </div>
          )}

          {/* Two-team mode toggle */}
          <div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-white">
              <input
                type="checkbox"
                checked={teamMode}
                onChange={() => setTeamMode(!teamMode)}
                className="accent-yellow-400"
              />
              Aktivera två-lagsläge
            </label>
          </div>

          {/* Team Captains & Assignment */}
          {teamMode && (
            <div className="space-y-6 pt-4 border-t border-white/20 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-red-300 mb-1">Lagnamn</label>
                  <input
                    type="text"
                    value={teamCaptains.red}
                    onChange={(e) => setTeamCaptains({ ...teamCaptains, red: e.target.value })}
                    className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-green-300 mb-1">Lagnamn</label>
                  <input
                    type="text"
                    value={teamCaptains.green}
                    onChange={(e) => setTeamCaptains({ ...teamCaptains, green: e.target.value })}
                    className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white/80 mb-3">Tilldela spelare till lag</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedPlayerIds.map((id) => {
                    const player = players.find((p) => p.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-3 p-2 border border-white/10 rounded bg-white/5"
                      >
                        <span className="text-sm font-medium text-white/90 w-24 truncate">{player.name}</span>
                        <select
                          value={teamAssignments[id] || ""}
                          onChange={(e) => assignTeam(id, e.target.value)}
                          className="bg-blue-700 border border-white/20 text-white rounded px-2 py-1 text-sm"
                        >
                          <option value="">Välj lag</option>
                          <option value="red">{teamCaptains.red || "Röd"}</option>
                          <option value="green">{teamCaptains.green || "Grön"}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rounds */}
        <div className="bg-blue-800/40  p-6 rounded-2xl shadow space-y-4 shadow-xl shadow-blue-900/40">
          <h2 className="text-xl font-semibold text-yellow-300">⛳ Ronder</h2>
          <div className="flex items-center gap-2">
            <label className="font-medium text-white/90">Antal ronder:</label>
            <input
              type="number"
              min="1"
              value={rounds.length}
              onChange={(e) => handleRoundsChange(e.target.value)}
              className="bg-blue-800 text-white border border-white/30 rounded px-3 py-1 w-20 focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {rounds.map((round, i) => (
            <div
              key={i}
              className="relative rounded-2xl p-6 bg-blue-800/40 border border-white/20 shadow-lg shadow-blue-900/30 ring-1 ring-inset ring-white/10  space-y-4"
            >
              <span className="font-semibold text-lg text-yellow-200">Runda {i + 1}</span>

              <input
                type="text"
                placeholder="Bana eller namn"
                value={round.name}
                onChange={(e) => handleRoundNameChange(i, e.target.value)}
                className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />

              <select
                value={round.modes[0] || ""}
                onChange={(e) => handleRoundModeChange(i, e.target.value, 0)}
                className="bg-white/10 text-white border border-white/20 rounded px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
              >
                <option value="" disabled hidden>Välj spelform</option>
                {gameModes.map((mode) => (
                  <option key={mode} value={mode} className="text-black">{mode}</option>
                ))}
              </select>

              {/* multipla game modes (under utveckling) 
              {round.modes[0] !== "Scramble (2 man)" && (
                <>
                  {round.modes.length < 2 && (
                    <button
                      onClick={() => addSecondMode(i)}
                      className="text-yellow-300 underline text-sm"
                    >
                      + Lägg till ytterligare spelform
                    </button>
                  )}
                  {round.modes.length > 1 && (
                    <div className="flex gap-2 items-center">
                      <select
                        value={round.modes[1]}
                        onChange={(e) => handleRoundModeChange(i, e.target.value, 1)}
                        className="bg-white/10  text-white border border-white/20 rounded px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="">Välj</option>
                        {gameModes
                          .filter((m) => m !== "Scramble (2 man)" && m !== round.modes[0])
                          .map((mode) => (
                            <option key={mode} value={mode} className="text-black">{mode}</option>
                          ))}
                      </select>
                      <button
                        onClick={() => removeSecondMode(i)}
                        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                        title="Ta bort spelform"
                      >
                        ✖
                      </button>
                    </div>
                  )}
                </>
              )}
*/}
              <p className="text-xs text-white/50 mt-1">
                Du kan använda <code>&lt;strong&gt;</code> för att göra text <strong>fet</strong>.
              </p>
              <textarea
                value={round.info}
                onChange={(e) => {
                  const updated = [...rounds];
                  updated[i].info = e.target.value;
                  setRounds(updated);
                }}
                rows={6}
                placeholder="Valfri info om ronden..."
                className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
              ></textarea>

              {/* Scramble options */}
              {round.modes.includes("Scramble (2 man)") && round.scrambleOptions && (
                <div className="bg-blue-800/40 p-4 border border-white/20 rounded space-y-4">
                  <h4 className="font-semibold text-yellow-300">⚙️ Scramble Inställningar</h4>

                  <div className="space-y-2">
                    <span className="font-medium text-white/80">Typ av spel:</span>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-hcp-${i}`}
                          checked={round.scrambleOptions.scrambleWithHandicap === false}
                          onChange={() => handleScrambleOptionChange(i, "scrambleWithHandicap", false)}
                        />
                        Slagspel
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-hcp-${i}`}
                          checked={round.scrambleOptions.scrambleWithHandicap !== false}
                          onChange={() => handleScrambleOptionChange(i, "scrambleWithHandicap", true)}
                        />
                        Handicap-justerat
                      </label>
                    </div>

                    {round.scrambleOptions.scrambleWithHandicap && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div>
                          <label className="text-sm font-medium text-white/80">Låg HCP (%)</label>
                          <input
                            type="number"
                            value={round.scrambleOptions.lowPct}
                            onChange={(e) => handleScrambleOptionChange(i, "lowPct", e.target.value)}
                            className="bg-blue-800 text-white border border-white/20 rounded px-3 py-2 w-full"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-white/80">Hög HCP (%)</label>
                          <input
                            type="number"
                            value={round.scrambleOptions.highPct}
                            onChange={(e) => handleScrambleOptionChange(i, "highPct", e.target.value)}
                            className="bg-blue-800 text-white border border-white/20 rounded px-3 py-2 w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-medium text-white/80">Lagindelning:</span>
                    <div className="flex gap-6 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-pairing-${i}`}
                          value="position"
                          checked={round.scrambleOptions.pairing === "position"}
                          onChange={(e) => handleScrambleOptionChange(i, "pairing", e.target.value)}
                        />
                        Baserat på position
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-pairing-${i}`}
                          value="handicap"
                          checked={round.scrambleOptions.pairing === "handicap"}
                          onChange={(e) => handleScrambleOptionChange(i, "pairing", e.target.value)}
                        />
                        Baserat på handicap
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mini Games */}
        <div className="bg-blue-800/40  p-6 rounded-2xl shadow space-y-4 shadow-xl shadow-blue-900/4 ">

          <h2 className="text-xl font-semibold text-yellow-300">🎯 Mini Games</h2>
          {miniGames.length === 0 && (
            <p className="text-white/70">Inga mini games tillagda ännu.</p>
          )}
          <div className="space-y-2">
            {miniGames.map((game, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={game.name}
                  onChange={(e) => {
                    const updated = [...miniGames];
                    updated[idx].name = e.target.value;
                    setMiniGames(updated);
                  }}
                  placeholder={`Mini game ${idx + 1}`}
                  className="flex-1 bg-blue-800 text-white placeholder-white/60 border border-white/20 rounded px-3 py-2"
                />
                <button
                  onClick={() => setMiniGames(miniGames.filter((_, i) => i !== idx))}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                >
                  ✖
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setMiniGames([...miniGames, { name: "" }])}
            className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 px-4 py-2 rounded shadow font-semibold"
          >
            ➕ Lägg till mini game
          </button>
        </div>

        {/* Save Button */}
        <div className="text-center">
          <button
            onClick={handleSaveTournament}
            className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-lg px-6 py-3 rounded-full shadow font-semibold transition"
          >
            💾 Skapa turnering
          </button>
        </div>
      </div >
    </div>
  );

}
