import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

export default function NewTournament({ editMode = false, tournamentData = null, setActiveTab = null, setTournament = null, onSaved = null }) {
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
  const [showPreview, setShowPreview] = useState(false); //Infotext
  const [showScrambleInfo, setShowScrambleInfo] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHandicap, setNewHandicap] = useState("");
  const [newClub, setNewClub] = useState("");


  const gameModes = [
    "Slagspel",
    "Handicap-justerat slagspel",
    "Poängbogey",
    "Scramble (2 man)",
    "Bästboll",
  ];

  const presetInfo = {
    "slagspel": `**EXEMPELTEXT** \n <strong>Tider:</strong>\nTee time: 09:00\nLunch: 13:00\n\n<strong>Regler:</strong>\nRent slagspel, bara att köra.\nMulligan gäller på första hålet\n\n<strong>CTP:</strong>\nHål 2, 8, 12\n\n<strong>Longest drive:</strong>\nHål 2, 5, 9`,
    "handicapjusterat": `**EXEMPELTEXT** \n<strong>Tider:</strong>\nTee time: 10:30\n\n<strong>Regler:</strong>\nSlagspel med avdrag för handicap.\nExempel: Spelare X har 20 i handicap och spelar på 100 slag. Resultat: 80 slag.\n\n<strong>CTP:</strong>\nHål 6, 14, 18\n\n<strong>Longest drive:</strong>\nHål 2, 5, 9`,
    "scramble": `**EXEMPELTEXT** \n <strong>Tider:</strong>\nTee time: 15:00\n\n<strong>Regler:</strong>\nLättnad gäller för alla slag\n\n<strong>CTP:</strong>\nHål 6, 14, 18\n\n<strong>Longest drive:</strong>\nHål 2, 5, 9`,
  };

  const defaultRound = (data = {}, i) => ({
    name: data.name || `Runda ${i + 1}`,
    modes: data.modes || [""],
    scrambleOptions: data.scrambleOptions || null,
    info: data.info || "",
    holes: data.holes ?? 18,
  });


  const rebuildTournamentData = async (tournamentId, playerIds) => {
    // Hämta turnering
    const { data: updatedTournament, error: fetchError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();
    if (fetchError || !updatedTournament) throw fetchError;

    // Hämta spelare från DB (inte gammal tournamentData!)
    const { data: playersRes, error: plErr } = await supabase
      .from("players")
      .select("*")
      .in("id", playerIds);
    if (plErr) throw plErr;

    const playerData = (playersRes || []).map((p) => ({
      id: p.id,
      name: p.name,
      handicap: p.handicap,
      club: p.home_club,
      image: p.image_url,
      scores: [],
      miniGameScores: {},
    }));

    // rounds
    const { data: roundsData, error: rErr } = await supabase
      .from("rounds")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("order_index");
    if (rErr) throw rErr;

    const roundIds = roundsData.map((r) => r.id);

    // scramble & modes
    const { data: scrambleSettings } = await supabase
      .from("scramble_settings")
      .select("*")
      .in("round_id", roundIds);

    const { data: roundModes } = await supabase
      .from("round_modes")
      .select("*")
      .in("round_id", roundIds);

    const { data: customPairs } = await supabase
      .from("scramble_custom_pairs")
      .select("*")
      .in("round_id", roundIds);

    const rounds = roundsData.map((round) => {
      const scramble = scrambleSettings?.find((s) => s.round_id === round.id) || null;
      const pairs = (customPairs || []).filter((p) => p.round_id === round.id);
      const roundPairs = {};
      for (const pair of pairs) {
        roundPairs[pair.player_1_id] = pair.player_2_id;
        roundPairs[pair.player_2_id] = pair.player_1_id;
      }
      // skapa teams-array om custom pairing finns
      let teams = [];

      if (scramble?.pairing === "custom") {
        const seen = new Set(); // 👈 viktigt: placera här, inuti if-satsen
        teams = Object.entries(roundPairs)
          .filter(([p1, p2]) => {
            if (seen.has(p1) || seen.has(p2)) return false;
            seen.add(p1);
            seen.add(p2);
            return true;
          })
          .map(([p1, p2]) => [p1, p2]);
      }



      return {
        ...round,
        modes: (roundModes || [])
          .filter((m) => m.round_id === round.id)
          .sort((a, b) => a.position - b.position)
          .map((m) => m.mode),
        scrambleOptions: scramble
          ? {
            scrambleWithHandicap: scramble.scramble_with_handicap,
            pairing: scramble.pairing,
            lowPct: scramble.low_hcp,
            highPct: scramble.high_hcp,
            customTeams: roundPairs,
          }
          : null,
        teams,
      };

    });

    // mini games
    const { data: miniGames } = await supabase
      .from("mini_games")
      .select("*")
      .eq("tournament_id", tournamentId);

    return {
      ...updatedTournament,
      players: playerIds,
      playerData,
      rounds,
      miniGames,
    };
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


  useEffect(() => {
    if (editMode && tournamentData) {
      setTournamentName(tournamentData.name || "");
      setSelectedPlayerIds(tournamentData.players || []);
      setTeamMode(tournamentData.team_mode || false);
      setTeamCaptains(tournamentData.team_data?.captains || { red: "", green: "" });
      setTeamAssignments(tournamentData.team_data?.assignments || {});
      setMiniGames((tournamentData.miniGames || []).map((g) => ({
        name: g.name,
        subtract: g.subtract_from_score,
        deduction: g.deduction_value,
      })));
      setRounds((tournamentData.rounds || []).map(defaultRound));
    }
  }, [editMode, tournamentData]);



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
      const newRounds = Array.from({ length: n }, (_, i) => defaultRound(rounds[i], i));

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
        pairing: index === 0 ? "handicap" : "position",
        lowPct: null,
        highPct: null,
      };
    } else {
      updated[index].modes = [value];
      updated[index].scrambleOptions = null;
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
      return;
    }

    const updated = [...rounds];
    updated[index].scrambleOptions[key] = value;

    // Fix: initiera tom customTeams om pairing blir "custom"
    if (key === "pairing" && value === "custom") {
      if (!updated[index].scrambleOptions.customTeams) {
        updated[index].scrambleOptions.customTeams = {};
      }
    }

    setRounds(updated);
  };

  const insertTournamentData = async (tournamentId) => {

    // 1. Link players
    const playerInserts = selectedPlayerIds.map((pid) => ({
      tournament_id: tournamentId,
      player_id: pid,
    }));

    // if (playerInserts.length > 0) {
    //   await supabase.from("tournament_players").insert(playerInserts);
    // }
    if (playerInserts.length > 0) {
      await supabase
        .from("tournament_players")
        .upsert(playerInserts, { onConflict: ['tournament_id', 'player_id'] });
    }

    // 2. Mini games
    const validMiniGames = miniGames.filter((g) => g.name.trim() !== "");
    if (validMiniGames.length > 0) {
      await supabase.from("mini_games").insert(
        validMiniGames.map((game) => ({
          name: game.name.trim(),
          tournament_id: tournamentId,
          subtract_from_score: game.subtract || false,
          deduction_value: game.deduction || 0,
        }))
      );
    }

    // 3. Rounds
    const { data: insertedRounds, error: roundInsertError } = await supabase
      .from("rounds")
      .insert(
        rounds.map((r, index) => ({
          tournament_id: tournamentId,
          name: r.name || `Runda ${index + 1}`,
          info: r.info,
          order_index: index,
          holes: r.holes ?? 18, // 👈 Lägg till detta
        }))
      )
      .select();

    if (roundInsertError) throw roundInsertError;

    // 4. Modes
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
    await supabase.from("round_modes").insert(roundModes);

    // 5. Scramble settings
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
      await supabase.from("scramble_settings").insert(scrambleSettings);
    }

    // 6. Scramble custom pairs
    const customPairs = [];
    insertedRounds.forEach((round, index) => {
      const teams = rounds[index].scrambleOptions?.customTeams || {};
      const seen = new Set();
      Object.entries(teams).forEach(([p1, p2]) => {
        if (!seen.has(p1) && !seen.has(p2)) {
          customPairs.push({
            round_id: round.id,
            player_1_id: p1,
            player_2_id: p2,
          });
          seen.add(p1);
          seen.add(p2);
        }
      });
    });
    if (customPairs.length > 0) {
      await supabase.from("scramble_custom_pairs").insert(customPairs);
    }


  };

  const saveTournamentMetadata = async (id = null) => {
    const isNew = !id;

    const payload = {
      name: tournamentName.trim(),
      user_id: user.id,
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
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("tournaments")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } else {
      const { error } = await supabase
        .from("tournaments")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
      return id;
    }
  };

  const clearOldTournamentData = async (tournamentId) => {

    const deleteTables = [
      "tournament_players",
      "rounds",
      "mini_games",
    ];

    // 1. Hämta alla round-id:n för turneringen
    const { data: rounds, error: roundFetchError } = await supabase
      .from("rounds")
      .select("id")
      .eq("tournament_id", tournamentId);

    if (roundFetchError) {
      console.error("❌ Kunde inte hämta ronder", roundFetchError);
      return;
    }

    const roundIds = rounds.map((r) => r.id);

    // 2. Radera scramble_settings, scramble_custom_pairs och round_modes som är kopplade till round_id
    if (roundIds.length > 0) {
      const tablesWithRoundId = ["scramble_settings", "scramble_custom_pairs", "round_modes"];
      for (const table of tablesWithRoundId) {
        const { error } = await supabase
          .from(table)
          .delete()
          .in("round_id", roundIds);

        if (error) {
          console.error(`❌ Misslyckades att ta bort från ${table}`, error);
        }
      }
    }

    // 3. Radera övriga tabeller med direkt koppling till tournament_id
    for (const table of deleteTables) {
      const { error, count } = await supabase
        .from(table)
        .delete()
        .eq("tournament_id", tournamentId)
        .select('*', { count: 'exact' }); // 👈 detta kräver .select()

      if (error) {
        console.error(`❌ Misslyckades att ta bort från ${table}`, error);
      } else {
        console.log(`✅ Raderade ${count} rader från ${table}`);
      }
    }
  };


  const handleSaveTournament = async () => {
    if (!tournamentName.trim()) {
      alert("Vänligen ange namn på turneringen");
      return;
    }

    if (selectedPlayerIds.length === 0) {
      alert("Vänligen välj spelare")
      return;
    }

    try {
      const tournamentId = await saveTournamentMetadata(editMode ? tournamentData.id : null);

      if (editMode) {
        await clearOldTournamentData(tournamentId);
      }

      await insertTournamentData(tournamentId);

      const updatedTournament = await rebuildTournamentData(
        tournamentId,
        selectedPlayerIds,
        editMode ? tournamentData : { playerData: players }
      );

      if (editMode) {
        setActiveTab?.("standings");
        onSaved?.(updatedTournament); // 👈 skickar med ny data
      } else {
        navigate(`/turnering/${tournamentId}`);
      }

    } catch (err) {
      console.error("❌ Fel vid sparande:", err);
      alert("Misslyckades att spara turneringen.");
    }
  };

  const handleQuickAddPlayer = async () => {
    if (!newName || !newHandicap) {
      alert("Fyll i både namn och HCP");
      return;
    }

    const newPlayer = {
      name: newName,
      handicap: parseFloat(newHandicap),
      home_club: newClub,
      user_id: user.id,
    };

    const { error, data } = await supabase
      .from("players")
      .insert([newPlayer])
      .select()
      .single();

    if (error) {
      console.error("Fel vid skapande av spelare:", error);
      alert("Kunde inte skapa spelare.");
      return;
    }

    // Lägg till den direkt i listan
    setPlayers((prev) => [...prev, data]);

    // Återställ
    setNewName("");
    setNewHandicap("");
    setNewClub("");
    setShowAddPlayer(false);
  };


  //Komponent för indelning av scramble-lag
  function CustomPairForm({ players, teamPlayers, onAddPair }) {
    const [selectedA, setSelectedA] = useState("");
    const [selectedB, setSelectedB] = useState("");

    const handleAdd = () => {
      if (selectedA && selectedB && selectedA !== selectedB) {
        onAddPair(selectedA, selectedB);
        setSelectedA("");
        setSelectedB("");
      }
    };

    const getName = (id) => players.find((p) => p.id === id)?.name || "";

    const validPlayerIds = new Set(players.map((p) => p.id));
    const options = teamPlayers
      .filter((id) => validPlayerIds.has(id))
      .map((id) => (
        <option key={id} value={id}>
          {getName(id)}
        </option>
      ));


    if (editMode && players.length === 0) {
      return (
        <div className="text-white p-6 text-center">
          ⏳ Laddar spelare och turneringsdata...
        </div>
      );
    }


    return (
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <select
          value={selectedA}
          onChange={(e) => setSelectedA(e.target.value)}
          className="bg-blue-800 border border-white/20 rounded px-2 py-1.5 text-sm text-white w-full sm:flex-1 min-w-0"
        >
          <option value="">Spelare 1</option>
          {options}
        </select>

        <select
          value={selectedB}
          onChange={(e) => setSelectedB(e.target.value)}
          className="bg-blue-800 border border-white/20 rounded px-2 py-1.5 text-sm text-white w-full sm:flex-1 min-w-0"
        >
          <option value="">Spelare 2</option>
          {options}
        </select>

        <button
          onClick={handleAdd}
          className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 px-4 py-2 rounded text-sm font-semibold w-full sm:w-auto sm:whitespace-nowrap"
          disabled={!selectedA || !selectedB || selectedA === selectedB}
        >
          Lägg till par
        </button>
      </div>
    );


  }


  return (
    <div className="bg-gradient-to-r from-blue-900 to-blue-700 min-h-screen text-white">
      <div className="min-h-screen text-white p-6 max-w-5xl mx-auto space-y-6">

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
          {/* Add player trigger */}
          {!showAddPlayer && (
            <button
              onClick={() => setShowAddPlayer(true)}
              className="mt-4 inline-flex items-center gap-2 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 hover:text-yellow-200 font-medium px-4 py-2 rounded-xl text-sm shadow hover:shadow-yellow-500/20 transition-all"
            >
              <span>➕</span>
              <span>Lägg till ny spelare</span>
            </button>
          )}

          {/* Player add form */}
          {showAddPlayer && (
            <div className="bg-blue-900/50 p-5 mt-5 rounded-2xl border border-white/10 space-y-4 shadow-inner max-w-md">
              <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
                ➕ Ny spelare
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Namn"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 p-3 rounded-xl bg-blue-900/30 text-white placeholder-white/50 text-sm border border-white/10 focus:ring-2 focus:ring-yellow-400"
                />
                <input
                  type="number"
                  placeholder="HCP"
                  value={newHandicap}
                  onChange={(e) => setNewHandicap(e.target.value)}
                  className="w-full sm:w-24 p-3 rounded-xl bg-blue-900/30 text-white placeholder-white/50 text-sm border border-white/10 sm:text-center"
                />
              </div>

              <input
                type="text"
                placeholder="Klubb"
                value={newClub}
                onChange={(e) => setNewClub(e.target.value)}
                className="w-full p-3 rounded-xl bg-blue-900/30 text-white placeholder-white/50 text-sm border border-white/10 focus:ring-2 focus:ring-yellow-400"
              />

              <div className="flex gap-3 justify-end pt-1">
                <button
                  onClick={handleQuickAddPlayer}
                  className="bg-green-500 hover:bg-green-400 text-white font-semibold px-5 py-2 rounded-xl text-sm shadow hover:shadow-green-500/30 transition"
                >
                  Spara spelare
                </button>
                <button
                  onClick={() => setShowAddPlayer(false)}
                  className="text-white/50 hover:text-white/80 text-sm font-medium"
                >
                  Avbryt
                </button>
              </div>
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
                    if (!player) return null; // 👈 hoppa över om inte hittad
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
        <div className="bg-blue-800/40 p-6 rounded-2xl shadow-xl shadow-blue-900/40 space-y-4">
          {!editMode && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
              {/* Rubrik + kontroll tillsammans till vänster */}
              <h2 className="text-xl font-semibold text-yellow-300 whitespace-nowrap">
                ⛳ Antal ronder
              </h2>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRoundsChange(rounds.length - 1)}
                  disabled={rounds.length <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-600 disabled:opacity-30 text-white text-xl font-bold leading-none transition transform -translate-y-[1px]"
                >
                  –
                </button>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={rounds.length}
                  onChange={(e) => handleRoundsChange(e.target.value)}
                  className="w-14 text-center text-white bg-blue-900/40 border border-white/20 rounded-lg py-2 focus:ring-2 focus:ring-yellow-400"
                />

                <button
                  onClick={() => handleRoundsChange(rounds.length + 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-600 text-white text-xl font-bold leading-none transition transform -translate-y-[1px]"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {rounds.map((round, i) => (
            <div
              key={i}
              className="w-full sm:relative sm:rounded-2xl sm:p-6 pt-4 pb-4 bg-transparent sm:bg-blue-800/40 border-t border-white/20 sm:border sm:shadow-lg sm:shadow-blue-900/30 sm:ring-1 sm:ring-inset sm:ring-white/10 space-y-4"
            >

              {/* Runda + hålval */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="font-semibold text-lg text-yellow-200">
                  Runda {i + 1}
                </span>
                <div className="flex items-center gap-2">
                  <label htmlFor={`holes-${i}`} className="text-white text-sm">
                    Antal hål:
                  </label>
                  <select
                    id={`holes-${i}`}
                    value={round.holes ?? 18}
                    onChange={(e) => {
                      const updated = [...rounds];
                      updated[i].holes = parseInt(e.target.value);
                      setRounds(updated);
                    }}
                    className="bg-blue-800 text-white border border-white/20 rounded px-3 py-1.5 text-sm"
                  >
                    <option value={18}>18 hål</option>
                    <option value={9}>9 hål</option>
                  </select>
                </div>
              </div>

              {/* Bananamn */}
              <input
                type="text"
                placeholder="Bana eller namn"
                value={round.name}
                onChange={(e) => handleRoundNameChange(i, e.target.value)}
                className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              />

              {/* Spelform */}
              <select
                value={round.modes[0] || ""}
                onChange={(e) => handleRoundModeChange(i, e.target.value, 0)}
                className="bg-white/10 text-white border border-white/20 rounded px-3 py-2 w-full focus:ring-2 focus:ring-yellow-400"
              >
                <option value="" disabled hidden>Välj spelform</option>
                {gameModes.map((mode) => (
                  <option key={mode} value={mode} className="text-black">
                    {mode}
                  </option>
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
              <div className="space-y-4">
                {/* Toggle Buttons */}
                <p className="text-xs text-white/50 mt-1">
                  Du kan använda <code>&lt;strong&gt;</code> för att göra text <strong>fet</strong>.
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`px-4 py-2 sm:px-3 sm:py-1 rounded-md font-medium transition ${!showPreview
                      ? "bg-yellow-400 text-black"
                      : "bg-white/10 text-white hover:bg-white/20"
                      } text-xs sm:text-sm`}
                  >
                    📝 <span className="hidden sm:inline">Redigera</span>
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`px-4 py-2 sm:px-3 sm:py-1 rounded-md font-medium transition ${showPreview
                      ? "bg-yellow-400 text-black"
                      : "bg-white/10 text-white hover:bg-white/20"
                      } text-xs sm:text-sm`}
                  >
                    👁 <span className="hidden sm:inline">Förhandsgranska</span>
                  </button>
                </div>


                {/* Redigera / Preview */}
                {showPreview ? (
                  <div className="relative bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-blue-500 rounded-xl p-6 shadow-2xl text-sm text-white font-mono tracking-wide">
                    <h4 className="text-yellow-300 text-xl font-bold flex items-center gap-2 drop-shadow-md uppercase mb-4">
                      🧾 Info
                    </h4>
                    <div
                      className="text-white/90 leading-relaxed text-sm space-y-4"
                      dangerouslySetInnerHTML={{
                        __html: round.info.replace(/\n/g, "<br />"),
                      }}
                    />
                  </div>
                ) : (
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
                  />
                )}
              </div>


              {/* Scramble options */}
              {round.modes.includes("Scramble (2 man)") && round.scrambleOptions && (
                <>
                  <h4 className="font-semibold text-yellow-300">⚙️ Scramble-inställningar</h4>
                  <button
                    onClick={() => setShowScrambleInfo((prev) => !prev)}
                    className="text-xs text-blue-300 hover:text-yellow-300 underline transition"
                  >
                    {showScrambleInfo ? "Dölj info" : "Visa info om inställningarna"}
                  </button>

                  {showScrambleInfo && (
                    <div className="mt-4 p-4 rounded-lg bg-blue-900/60 text-sm text-white border border-blue-500 space-y-3 w-full break-words">
                      <div className="flex flex-col gap-4 mt-2 max-w-3xl">
                        <h4 className="text-yellow-300 font-semibold text-base border-b border-yellow-400 pb-1">
                          Typ av spel
                        </h4>

                        <p>
                          <strong>Slagspel:</strong> Standard scramble där lagen tävlar i slag utan hänsyn till spelarnas handicap.
                        </p>
                        <p>
                          <strong>HCP-justerat:</strong> Lagets score justeras baserat på spelarnas handicap enligt angivna procentsatser.
                        </p>
                        <p>
                          <strong>Låg/Hög HCP (%):</strong> Används för att justera lagets totala handicap baserat på de inblandade spelarna.
                          Välj hur lagets spel-handicap ska viktas.
                        </p>

                        <h4 className="text-yellow-300 font-semibold text-base border-b border-yellow-400 pb-1 mt-4">
                          Lagindelning
                        </h4>

                        <p>
                          <strong>Position:</strong> Spelare paras ihop baserat på sin placering i tävlingen där bäst placerad spelar med sämst.
                          Detta alternativ går ej att välja om scramble väljs som första runda då inga tidigare placeringar existerar.
                        </p>
                        <p>
                          <strong>Handicap:</strong> Spelare paras ihop efter handicap där lägst handicap spelar med högst handicap.
                        </p>
                        <p>
                          <strong>Egen indelning:</strong> Para ihop spelare med valfri annan spelare. Är två-lagsläget aktiverat går det bara att para ihop spelare inom samma lag.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowScrambleInfo((prev) => !prev)}
                        className="text-xs text-blue-300 hover:text-yellow-300 underline transition"
                      >
                        {showScrambleInfo ? "Dölj info" : "Visa info om inställningarna"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="font-medium text-white/80">Typ av spel:</span>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 mt-2">
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

                        <span>
                          <span className="sm:hidden">Handicap</span>
                          <span className="hidden sm:inline">HCP-justerat</span>
                        </span>
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
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-pairing-${i}`}
                          value="position"
                          checked={round.scrambleOptions.pairing === "position"}
                          onChange={(e) => handleScrambleOptionChange(i, "pairing", e.target.value)}
                        />
                        <span>
                          <span className="sm:hidden">Position</span>
                          <span className="hidden sm:inline">Baserat på position</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-pairing-${i}`}
                          value="handicap"
                          checked={round.scrambleOptions.pairing === "handicap"}
                          onChange={(e) => handleScrambleOptionChange(i, "pairing", e.target.value)}
                        />
                        <span>
                          <span className="sm:hidden">Handicap</span>
                          <span className="hidden sm:inline">Baserat på handicap</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`scramble-pairing-${i}`}
                          value="custom"
                          checked={round.scrambleOptions.pairing === "custom"}
                          onChange={(e) => handleScrambleOptionChange(i, "pairing", e.target.value)}
                        />
                        <span>Egen indelning</span>
                      </label>
                    </div>
                  </div>
                  {round.scrambleOptions.pairing === "custom" && (
                    <div className="mt-4 p-0 sm:p-4 rounded-xl sm:bg-blue-900/40 space-y-6 sm:border sm:border-blue-500">
                      <h4 className="text-yellow-300 font-semibold text-lg">🧩 Anpassad lagindelning</h4>
                      <p className="text-sm text-white/70">
                        Välj par för scramble inom respektive lag.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {teamMode ? (
                          ["red", "green"].map((teamKey) => {
                            const teamPlayers = selectedPlayerIds.filter((id) => teamAssignments[id] === teamKey);
                            const teamName = teamCaptains[teamKey] || (teamKey === "red" ? "Röd" : "Grön");
                            const teamColor = teamKey === "red" ? "text-red-400" : "text-green-400";

                            const used = Object.entries(round.scrambleOptions.customTeams || {})
                              .filter(([a, b]) => a < b)
                              .flatMap(([a, b]) => [a, b]);

                            const availablePlayers = teamPlayers.filter((id) => !used.includes(id));

                            return (
                              <div key={teamKey}>
                                <h5 className={`text-base font-bold mb-2 ${teamColor}`}>Lag {teamName}</h5>

                                {availablePlayers.length < 2 ? (
                                  <p className="text-sm text-white/50">Inte tillräckligt med spelare för fler par.</p>
                                ) : (
                                  <CustomPairForm
                                    players={players}
                                    teamPlayers={availablePlayers}
                                    onAddPair={(a, b) => {
                                      const updated = [...rounds];
                                      if (!updated[i].scrambleOptions.customTeams) {
                                        updated[i].scrambleOptions.customTeams = {};
                                      }
                                      updated[i].scrambleOptions.customTeams[a] = b;
                                      updated[i].scrambleOptions.customTeams[b] = a;
                                      setRounds(updated);
                                    }}
                                  />
                                )}

                                <div className="mt-4 grid gap-2">
                                  {Object.entries(round.scrambleOptions.customTeams || {})
                                    .filter(([p1, p2]) =>
                                      teamMode
                                        ? teamPlayers.includes(p1) && p1 < p2
                                        : p1 < p2
                                    )
                                    .map(([p1, p2]) => {
                                      const name1 = players.find((p) => p.id === p1)?.name;
                                      const name2 = players.find((p) => p.id === p2)?.name;
                                      return (
                                        <div
                                          key={p1}
                                          className="flex items-center justify-between bg-blue-800/40 border border-white/10 px-3 py-2 rounded-md text-sm text-white/90"
                                        >
                                          <span className="truncate">
                                            {name1} + {name2}
                                          </span>
                                          <button
                                            onClick={() => {
                                              const updated = [...rounds];
                                              delete updated[i].scrambleOptions.customTeams[p1];
                                              delete updated[i].scrambleOptions.customTeams[p2];
                                              setRounds(updated);
                                            }}
                                            className="text-xs text-red-400 hover:text-red-300 hover:underline transition"
                                          >
                                            Ta bort
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>

                              </div>
                            );
                          })
                        ) : (
                          <div>
                            <h5 className="text-base font-bold mb-2 text-yellow-300">Scramble-par</h5>

                            {(() => {
                              const used = Object.entries(round.scrambleOptions.customTeams || {})
                                .filter(([a, b]) => a < b)
                                .flatMap(([a, b]) => [a, b]);

                              const availablePlayers = selectedPlayerIds.filter((id) => !used.includes(id));

                              return (
                                <>
                                  {availablePlayers.length < 2 ? (
                                    <p className="text-sm text-white/50">Inte tillräckligt med spelare för fler par.</p>
                                  ) : (
                                    <CustomPairForm
                                      players={players}
                                      teamPlayers={availablePlayers}
                                      onAddPair={(a, b) => {
                                        const updated = [...rounds];
                                        if (!updated[i].scrambleOptions.customTeams) {
                                          updated[i].scrambleOptions.customTeams = {};
                                        }
                                        updated[i].scrambleOptions.customTeams[a] = b;
                                        updated[i].scrambleOptions.customTeams[b] = a;
                                        setRounds(updated);
                                      }}
                                    />
                                  )}
                                  <div className="mt-4 grid gap-2">
                                    {Object.entries(round.scrambleOptions.customTeams || {})
                                      .filter(([p1, p2]) => p1 < p2)
                                      .map(([p1, p2]) => {
                                        const name1 = players.find((p) => p.id === p1)?.name;
                                        const name2 = players.find((p) => p.id === p2)?.name;
                                        return (
                                          <div
                                            key={p1}
                                            className="flex items-center justify-between bg-blue-800/40 border border-white/10 px-3 py-2 rounded-md text-sm text-white/90"
                                          >
                                            <span className="truncate">
                                              {name1} + {name2}
                                            </span>
                                            <button
                                              onClick={() => {
                                                const updated = [...rounds];
                                                delete updated[i].scrambleOptions.customTeams[p1];
                                                delete updated[i].scrambleOptions.customTeams[p2];
                                                setRounds(updated);
                                              }}
                                              className="text-xs text-red-400 hover:text-red-300 hover:underline transition"
                                            >
                                              Ta bort
                                            </button>
                                          </div>
                                        );
                                      })}
                                  </div>

                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Mini Games */}
        <div className="bg-blue-800/40 p-6 rounded-2xl shadow space-y-6 shadow-xl shadow-blue-900/40">
          <h2 className="text-xl font-semibold text-yellow-300">🎯 Mini Games</h2>

          {miniGames.length === 0 && (
            <p className="text-white/70">Inga mini games tillagda ännu.</p>
          )}

          <div className="space-y-6">
            {miniGames.map((game, idx) => (
              <div
                key={idx}
                className="bg-blue-900/40 border border-white/10 rounded-xl p-4 shadow-inner space-y-4 overflow-hidden"

              >
                {/* Name + Delete */}
                {/* Name + Delete */}
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={game.name}
                    onChange={(e) => {
                      const updated = [...miniGames];
                      updated[idx].name = e.target.value;
                      setMiniGames(updated);
                    }}
                    placeholder={`Mini game ${idx + 1}`}
                    className="text-sm sm:text-base bg-blue-800 text-white placeholder-white/60 border border-white/20 rounded px-3 py-1.5 sm:py-2 font-medium w-[calc(100%-2.5rem)] sm:w-full"
                  />
                  <button
                    onClick={() =>
                      setMiniGames(miniGames.filter((_, i) => i !== idx))
                    }
                    className="shrink-0 text-red-500 hover:text-red-400 text-lg font-bold transition"
                    title="Ta bort mini game"
                  >
                    ❌
                  </button>
                </div>


                {/* Subtract toggle */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={game.subtract}
                    onChange={(e) => {
                      const updated = [...miniGames];
                      updated[idx].subtract = e.target.checked;
                      setMiniGames(updated);
                    }}
                    className="accent-yellow-400 mt-1"
                  />
                  <div className="text-sm text-white/90">
                    <span className="font-semibold text-yellow-300">
                      Dra av från totalresultatet
                    </span>
                    <p className="text-white/60 text-xs mt-0.5 leading-snug">
                      Om detta är valt kommer poängen i detta moment ge avdrag i slag.
                    </p>
                  </div>
                </div>

                {/* Deduction amount */}
                {game.subtract && (
                  <div className="ml-6">
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      Slagavdrag per poäng:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={game.deduction}
                      onChange={(e) => {
                        const updated = [...miniGames];
                        updated[idx].deduction = parseFloat(e.target.value) || 0;
                        setMiniGames(updated);
                      }}
                      className="bg-blue-800 text-white border border-white/20 rounded px-3 py-2 w-24 text-center"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new mini game */}
          <button
            onClick={() =>
              setMiniGames([
                ...miniGames,
                { name: "", subtract: false, deduction: 0 },
              ])
            }
            className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 px-5 py-2 rounded-lg shadow font-semibold transition"
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
            {editMode ? "💾 Spara ändringar" : "💾 Skapa turnering"}
          </button>
        </div>
      </div >
    </div >
  );

}
