import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent } from "../components/ui/card";
import { motion } from "framer-motion";

export default function MyPlayers() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [club, setClub] = useState("");
  const [picture, setPicture] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);

  useEffect(() => {
    if (user) fetchPlayers();
  }, [user]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Kunde inte hämta spelare", error);
    } else {
      setPlayers(data);
    }
  };

  const handleAddOrUpdatePlayer = async () => {
    if (!name || !handicap) {
      alert("Fyll i namn och hcp");
      return;
    }

    const playerData = {
      name,
      handicap: parseFloat(handicap),
      home_club: club,
      image_yrl: picture || null,
      user_id: user.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("players")
        .update(playerData)
        .eq("id", editingId);

      if (error) {
        console.error("Kunde inte uppdatera spelare", error);
        alert("Misslyckades med att spara ändringar.");
        return;
      }
    } else {
      const { error } = await supabase.from("players").insert([playerData]);

      if (error) {
        console.error("Kunde inte spara spelare", error);
        alert("Misslyckades med att spara spelare.");
        return;
      }
    }

    resetForm();
    fetchPlayers();
  };


  const handlePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const filePath = `${user.id}/${file.name}`;
    // 1. Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from("player-images")
      .upload(filePath, file);

    if (uploadError) {
      alert("Kunde inte ladda upp bild");
      console.error("Upload error:", uploadError);
      return;
    }

    // 2. Get public URL
    const { data: urlData } = supabase
      .storage
      .from("player-images")
      .getPublicUrl(filePath);

    setPicture(urlData.publicUrl);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Är du säker på att du vill ta bort spelaren?")) {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) {
        console.error("Kunde inte ta bort spelare", error);
        alert("Något gick fel.");
        return;
      }
      fetchPlayers();
    }
  };

  const handleEdit = (player) => {
    setEditingId(player.id);
    setName(player.name);
    setHandicap(player.handicap);
    setClub(player.home_club || "");
    setPicture(player.image_yrl || "");
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setHandicap("");
    setClub("");
    setPicture("");
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-4 sm:px-6 py-10 text-white font-sans">
      <motion.div
        className="w-full max-w-5xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="rounded-3xl shadow-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10 p-5 sm:p-8">
          <CardContent className="space-y-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-green-400 text-center">
              👤 Hantera Spelare
            </h1>

            {/* Add/Edit */}
            <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-inner">
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-white/90">
                {editingId ? "✏️ Redigera spelare" : "➕ Lägg till ny spelare"}
              </h2>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Namn"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-800 text-white placeholder-white/40 border border-white/10 p-3 rounded-xl flex-1 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="HCP"
                    value={handicap}
                    onChange={(e) => setHandicap(e.target.value)}
                    className="bg-gray-800 text-white placeholder-white/40 border border-white/10 p-3 rounded-xl w-full sm:w-24 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />

                </div>

                <input
                  type="text"
                  placeholder="Klubb"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  className="bg-gray-800 text-white placeholder-white/40 border border-white/10 p-3 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/60 mb-1">Bild</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureChange}
                    className="text-xs text-white"
                  />
                  {picture && (
                    <div className="mt-3">
                      <img
                        src={picture}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-full border border-white/20"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 w-full">
                  <button
                    onClick={handleAddOrUpdatePlayer}
                    className="bg-green-500 hover:bg-green-400 w-full sm:w-auto text-white px-6 py-2 rounded-xl font-semibold shadow-md transition text-sm"
                  >
                    {editingId ? "Spara ändringar" : "Spara spelare"}
                  </button>
                  {editingId && (
                    <button
                      onClick={resetForm}
                      className="bg-gray-500 hover:bg-gray-400 text-white w-full sm:w-auto px-6 py-2 rounded-xl font-semibold shadow-md transition text-sm"
                    >
                      Avbryt
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Saved Players */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-white/90">📋 Sparade spelare</h2>
              {players.length === 0 ? (
                <p className="text-white/60 text-sm">Inga spelare tillagda ännu.</p>
              ) : (
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      onClick={() =>
                        setExpandedPlayerId(expandedPlayerId === player.id ? null : player.id)
                      }
                      className="cursor-pointer flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full bg-[#2a2f45] hover:bg-[#353b55] border border-white/10 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 ease-out"
                    >
                      <div className="flex items-center gap-4">
                        {player.image_yrl ? (
                          <img
                            src={player.image_yrl}
                            alt={player.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full"
                          />
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center text-white/60 text-xl">
                            👤
                          </div>
                        )}
                        <div className="flex flex-col flex-1 text-sm overflow-hidden">
                          <span className="font-bold text-white truncate">{player.name}</span>
                          <span className="text-white/70">HCP: {player.handicap}</span>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {(expandedPlayerId === player.id || window.innerWidth >= 640) && (
                        <div className="mt-2 sm:mt-0 sm:ml-auto text-sm sm:flex sm:items-center sm:gap-6 w-full sm:w-auto">
                          <div className="text-white/50 italic sm:text-right">
                            {player.home_club || "–"}
                          </div>
                          <div className="flex gap-2 mt-2 sm:mt-0 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(player);
                              }}
                              className="bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-200 hover:text-yellow-100 p-2 rounded-full transition"
                              title="Redigera"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(player.id);
                              }}
                              className="bg-rose-400/20 hover:bg-rose-400/40 text-rose-300 hover:text-rose-100 p-2 rounded-full transition"
                              title="Radera"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}