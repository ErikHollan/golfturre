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
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center px-6 py-12 text-white font-sans">
      <motion.div
        className="w-full max-w-4xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="rounded-3xl shadow-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-white/10 p-8">
          <CardContent className="space-y-10">
            <h1 className="text-3xl font-extrabold text-green-400 text-center">👤 Hantera Spelare</h1>

            {/* Add/Edit Player */}
            <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-inner">
              <h2 className="text-xl font-bold mb-4 text-white/90">
                {editingId ? "✏️ Redigera spelare" : "➕ Lägg till ny spelare"}
              </h2>

              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Namn"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-800 text-white placeholder-white/40 border border-white/10 p-3 rounded-xl flex-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="number"
                    placeholder="HCP"
                    value={handicap}
                    onChange={(e) => setHandicap(e.target.value)}
                    className="bg-gray-800 text-white placeholder-white/40 border border-white/10 p-3 rounded-xl w-24 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Klubb"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  className="bg-gray-800 text-white placeholder-white/40 border border-white/10 p-3 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                />

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Bild</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureChange}
                    className="text-sm text-white"
                  />
                  {picture && (
                    <div className="mt-3">
                      <img
                        src={picture}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-full border border-white/20"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-4 justify-center pt-2">
                  <button
                    onClick={handleAddOrUpdatePlayer}
                    className="bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded-xl font-semibold shadow-md transition"
                  >
                    {editingId ? "Spara ändringar" : "Spara spelare"}
                  </button>

                  {editingId && (
                    <button
                      onClick={resetForm}
                      className="bg-gray-500 hover:bg-gray-400 text-white px-6 py-2 rounded-xl font-semibold shadow-md transition"
                    >
                      Avbryt
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Saved Players */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-white/90">📋 Sparade spelare</h2>

              {players.length === 0 ? (
                <p className="text-white/60">Inga spelare tillagda ännu.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-4 bg-[#2a2f45] hover:bg-[#353b55] border border-white/10 p-5 rounded-3xl shadow-sm hover:shadow-md transform hover:scale-[1.01] transition-all duration-200 ease-out"
                    >
                      {player.image_yrl ? (
                        <img
                          src={player.image_yrl}
                          alt={player.name}
                          className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white/60 text-xl"
                          style={{ imageRendering: 'auto' }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white/60 text-xl">
                          👤
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="font-bold text-lg text-white">{player.name}</div>
                        <div className="text-sm text-white/70">Handicap: {player.handicap}</div>
                        <div className="text-sm text-white/50 italic">
                          Klubb: {player.home_club || "–"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(player)}
                          className="bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-200 hover:text-yellow-100 p-2 rounded-full transition"
                          title="Redigera"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(player.id)}
                          className="bg-rose-400/20 hover:bg-rose-400/40 text-rose-300 hover:text-rose-100 p-2 rounded-full transition"
                          title="Radera"
                        >
                          🗑️
                        </button>
                      </div>
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
